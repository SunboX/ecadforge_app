import { PcbScene3dBoardMaterialPalette } from './PcbScene3dBoardMaterialPalette.mjs'
import { PcbScene3dCutoutGeometryFilter } from './PcbScene3dCutoutGeometryFilter.mjs'
import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'
import { PcbScene3dOutlineBuilder } from './PcbScene3dOutlineBuilder.mjs'

/**
 * Builds separate solder-mask face sheets for board-assembly rendering.
 */
export class PcbScene3dBoardSolderMaskFactory {
    static #CURVE_SEGMENTS = 20
    static #OUTER_SAMPLE_POINTS = 160
    static #DRILL_SAMPLE_POINTS = 72
    static #EDGE_CLEARANCE_MIL = 0
    static #FACE_Z_OFFSET_MIL = 0
    static #EDGE_CLIP_MAX_DEPTH = 10
    static #EDGE_CLIP_MAX_EDGE_LENGTH_MIL = 2

    /**
     * Builds top and bottom solder-mask face meshes for generated board bodies.
     * @param {any} THREE
     * @param {{ board?: any, detail?: any, boardAssemblyModel?: any }} sceneDescription
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any}
     */
    static buildGroup(
        THREE,
        sceneDescription,
        normalizeBoardPoint = (x, y) => ({ x, y })
    ) {
        const group = new THREE.Group()
        group.name = 'board-solder-mask'
        const board = sceneDescription?.board || {}
        const hasBoardAssemblyModel = Boolean(
            sceneDescription?.boardAssemblyModel
        )
        const visible = PcbScene3dBoardMaterialPalette.isGeneratedBodyVisible({
            hasBoardAssemblyModel
        })

        if (!hasBoardAssemblyModel || !visible) {
            return group
        }

        const geometry = PcbScene3dBoardSolderMaskFactory.#buildMaskGeometry(
            THREE,
            board,
            sceneDescription?.detail || {},
            normalizeBoardPoint
        )
        const topMaterial = PcbScene3dBoardSolderMaskFactory.#buildMaterial(
            THREE,
            board,
            THREE.FrontSide
        )
        const bottomMaterial = PcbScene3dBoardSolderMaskFactory.#buildMaterial(
            THREE,
            board,
            THREE.BackSide
        )
        const z = Number(board?.thicknessMil || 0) / 2

        group.add(
            PcbScene3dBoardSolderMaskFactory.#buildSurfaceMesh(
                THREE,
                geometry,
                topMaterial,
                z + PcbScene3dBoardSolderMaskFactory.#FACE_Z_OFFSET_MIL,
                'board-solder-mask-top'
            )
        )
        group.add(
            PcbScene3dBoardSolderMaskFactory.#buildSurfaceMesh(
                THREE,
                geometry,
                bottomMaterial,
                -z - PcbScene3dBoardSolderMaskFactory.#FACE_Z_OFFSET_MIL,
                'board-solder-mask-bottom'
            )
        )

        return group
    }

    /**
     * Builds one flat solder-mask face mesh.
     * @param {any} THREE
     * @param {any} geometry Board face geometry.
     * @param {any} material Surface material.
     * @param {number} z Face z coordinate.
     * @param {string} name Mesh name.
     * @returns {any}
     */
    static #buildSurfaceMesh(THREE, geometry, material, z, name) {
        const mesh = new THREE.Mesh(geometry, material)
        mesh.name = name
        mesh.position.z = z

        return mesh
    }

    /**
     * Builds the solder-mask face geometry.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any}
     */
    static #buildMaskGeometry(THREE, board, detail, normalizeBoardPoint) {
        const { shape, clippingHoles } =
            PcbScene3dBoardSolderMaskFactory.#buildMaskShape(
                THREE,
                board,
                detail,
                normalizeBoardPoint
            )
        const geometry = new THREE.ShapeGeometry(
            shape,
            PcbScene3dBoardSolderMaskFactory.#CURVE_SEGMENTS
        )

        return PcbScene3dCutoutGeometryFilter.filter(
            THREE,
            geometry,
            clippingHoles,
            {
                maxDepth:
                    PcbScene3dBoardSolderMaskFactory.#EDGE_CLIP_MAX_DEPTH,
                maxEdgeLength:
                    PcbScene3dBoardSolderMaskFactory
                        .#EDGE_CLIP_MAX_EDGE_LENGTH_MIL
            }
        )
    }

    /**
     * Builds the inset mask shape and drill cutouts requiring fallback clipping.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {{ shape: any, clippingHoles: { x: number, y: number }[][] }}
     */
    static #buildMaskShape(THREE, board, detail, normalizeBoardPoint) {
        const shape = PcbScene3dBoardSolderMaskFactory.#buildInsetOuterShape(
            THREE,
            board
        )
        const contourPoints =
            PcbScene3dBoardSolderMaskFactory.#resolveShapePoints(shape)
        const drillCutouts =
            PcbScene3dBoardSolderMaskFactory.#resolveDrillCutouts(
                THREE,
                detail,
                normalizeBoardPoint
            )
        const { shapeHoles, clippingCutouts } =
            PcbScene3dBoardSolderMaskFactory.#partitionDrillCutouts(
                drillCutouts,
                contourPoints
            )

        PcbScene3dBoardSolderMaskFactory.#appendShapeHoles(
            THREE,
            shape,
            shapeHoles
        )
        return {
            shape,
            clippingHoles: clippingCutouts.map((cutout) => cutout.points)
        }
    }

    /**
     * Builds the solder-mask outer boundary with only perimeter clearance.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @returns {any}
     */
    static #buildInsetOuterShape(THREE, board) {
        const baseShape =
            PcbScene3dBoardSolderMaskFactory.#buildBaseOuterShape(THREE, board)
        const scale = PcbScene3dBoardSolderMaskFactory.#resolveOuterScale(board)

        if (scale.x === 1 && scale.y === 1) {
            return baseShape
        }

        const points =
            PcbScene3dBoardSolderMaskFactory.#resolveShapePoints(
                baseShape
            ).map((point) => ({
                x: point.x * scale.x,
                y: point.y * scale.y
            }))

        return PcbScene3dBoardSolderMaskFactory.#buildShapeFromPoints(
            THREE,
            points
        )
    }

    /**
     * Builds the original board outline without drill apertures.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @returns {any}
     */
    static #buildBaseOuterShape(THREE, board) {
        const shape = new THREE.Shape()
        const commands = PcbScene3dOutlineBuilder.buildCommands(board)

        if (!commands.length) {
            return PcbScene3dBoardSolderMaskFactory.#buildRectangleShape(
                THREE,
                board
            )
        }

        for (const command of commands) {
            if (command.type === 'move') {
                shape.moveTo(Number(command.x || 0), Number(command.y || 0))
                continue
            }

            if (command.type === 'arc') {
                shape.absarc(
                    Number(command.cx || 0),
                    Number(command.cy || 0),
                    Number(command.radius || 0),
                    Number(command.startAngleRad || 0),
                    Number(command.endAngleRad || 0),
                    Boolean(command.clockwise)
                )
                continue
            }

            shape.lineTo(Number(command.x || 0), Number(command.y || 0))
        }

        shape.closePath()
        return shape
    }

    /**
     * Builds a rectangular fallback shape.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number }} board
     * @returns {any}
     */
    static #buildRectangleShape(THREE, board) {
        const halfWidth = Number(board?.widthMil || 0) / 2
        const halfHeight = Number(board?.heightMil || 0) / 2
        const shape = new THREE.Shape()

        shape.moveTo(-halfWidth, -halfHeight)
        shape.lineTo(halfWidth, -halfHeight)
        shape.lineTo(halfWidth, halfHeight)
        shape.lineTo(-halfWidth, halfHeight)
        shape.lineTo(-halfWidth, -halfHeight)
        shape.closePath()
        return shape
    }

    /**
     * Resolves sampled points from one shape outline.
     * @param {{ getPoints?: (segments: number) => { x: number, y: number }[] }} shape
     * @returns {{ x: number, y: number }[]}
     */
    static #resolveShapePoints(shape) {
        return (shape?.getPoints?.(
            PcbScene3dBoardSolderMaskFactory.#OUTER_SAMPLE_POINTS
        ) || []).map((point) => ({
            x: Number(point.x || 0),
            y: Number(point.y || 0)
        }))
    }

    /**
     * Builds one closed shape from sampled outline points.
     * @param {any} THREE
     * @param {{ x: number, y: number }[]} points
     * @returns {any}
     */
    static #buildShapeFromPoints(THREE, points) {
        const shape = new THREE.Shape()

        if (!points.length) {
            return shape
        }

        shape.moveTo(points[0].x, points[0].y)
        for (let index = 1; index < points.length; index += 1) {
            shape.lineTo(points[index].x, points[index].y)
        }

        shape.closePath()
        return shape
    }

    /**
     * Resolves normalized drill cutout polygons.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {{ path: any, points: { x: number, y: number }[] }[]}
     */
    static #resolveDrillCutouts(THREE, detail, normalizeBoardPoint) {
        return PcbScene3dDrillPathFactory.resolveBoardDrillSpecs(detail)
            .map((drillSpec) => {
                const point = normalizeBoardPoint(drillSpec.x, drillSpec.y)
                const path = PcbScene3dDrillPathFactory.buildDrillPath(THREE, {
                    ...drillSpec,
                    x: point.x,
                    y: point.y
                })

                return {
                    path,
                    points:
                        PcbScene3dBoardSolderMaskFactory.#resolveDrillCutoutPoints(
                            {
                                ...drillSpec,
                                x: point.x,
                                y: point.y
                            },
                            path
                        )
                }
            })
            .filter((cutout) => cutout.path && cutout.points.length >= 3)
    }

    /**
     * Resolves sampled points for drill cutout classification and clipping.
     * @param {{ x: number, y: number, diameter?: number, slotLength?: number | null }} drillSpec
     * @param {{ getPoints?: (segments: number) => { x: number, y: number }[] } | null} path
     * @returns {{ x: number, y: number }[]}
     */
    static #resolveDrillCutoutPoints(drillSpec, path) {
        const diameter = Number(drillSpec?.diameter || 0)
        const slotLength = Number(drillSpec?.slotLength || 0)

        if (diameter > 0 && slotLength <= diameter + 0.001) {
            return PcbScene3dBoardSolderMaskFactory.#buildCircularCutoutPoints(
                Number(drillSpec?.x || 0),
                Number(drillSpec?.y || 0),
                diameter / 2
            )
        }

        return PcbScene3dBoardSolderMaskFactory.#resolvePathPoints(path)
    }

    /**
     * Builds uniformly sampled points for a circular drill cutout.
     * @param {number} centerX Drill center X.
     * @param {number} centerY Drill center Y.
     * @param {number} radius Drill radius.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildCircularCutoutPoints(centerX, centerY, radius) {
        return Array.from(
            {
                length: PcbScene3dBoardSolderMaskFactory.#DRILL_SAMPLE_POINTS
            },
            (_, index) => {
                const angle =
                    (Math.PI * 2 * index) /
                    PcbScene3dBoardSolderMaskFactory.#DRILL_SAMPLE_POINTS
                return {
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius
                }
            }
        )
    }

    /**
     * Resolves sampled points from one path.
     * @param {{ getPoints?: (segments: number) => { x: number, y: number }[] } | null} path
     * @returns {{ x: number, y: number }[]}
     */
    static #resolvePathPoints(path) {
        return (path?.getPoints?.(
            PcbScene3dBoardSolderMaskFactory.#DRILL_SAMPLE_POINTS
        ) || []).map((point) => ({
            x: Number(point.x || 0),
            y: Number(point.y || 0)
        }))
    }

    /**
     * Splits drill cutouts into safe shape holes and fallback clip polygons.
     * @param {{ path: any, points: { x: number, y: number }[] }[]} drillCutouts
     * @param {{ x: number, y: number }[]} contourPoints
     * @returns {{ shapeHoles: { path: any, points: { x: number, y: number }[] }[], clippingCutouts: { path: any, points: { x: number, y: number }[] }[] }}
     */
    static #partitionDrillCutouts(drillCutouts, contourPoints) {
        const shapeHoles = []
        const clippingCutouts = []

        for (const cutout of Array.isArray(drillCutouts) ? drillCutouts : []) {
            if (
                PcbScene3dBoardSolderMaskFactory.#isHoleInsideContour(
                    cutout.points,
                    contourPoints
                )
            ) {
                shapeHoles.push(cutout)
                continue
            }

            clippingCutouts.push(cutout)
        }

        return { shapeHoles, clippingCutouts }
    }

    /**
     * Appends normalized cutout paths to one shape fill.
     * @param {any} THREE
     * @param {{ holes: any[] }} shape
     * @param {{ path: any, points: { x: number, y: number }[] }[]} holes
     * @returns {void}
     */
    static #appendShapeHoles(THREE, shape, holes) {
        for (const hole of Array.isArray(holes) ? holes : []) {
            shape.holes.push(
                hole.path ||
                    PcbScene3dBoardSolderMaskFactory.#buildPathFromPoints(
                        THREE,
                        hole.points
                    )
            )
        }
    }

    /**
     * Builds one closed path from sampled points.
     * @param {any} THREE
     * @param {{ x: number, y: number }[]} points
     * @returns {any}
     */
    static #buildPathFromPoints(THREE, points) {
        const path = new THREE.Path()

        if (!points.length) {
            return path
        }

        path.moveTo(points[0].x, points[0].y)
        for (let index = 1; index < points.length; index += 1) {
            path.lineTo(points[index].x, points[index].y)
        }

        path.closePath()
        return path
    }

    /**
     * Returns true when a cutout can safely be added as a shape hole.
     * @param {{ x: number, y: number }[]} hole
     * @param {{ x: number, y: number }[]} contour
     * @returns {boolean}
     */
    static #isHoleInsideContour(hole, contour) {
        return (
            Array.isArray(hole) &&
            Array.isArray(contour) &&
            hole.length >= 3 &&
            contour.length >= 3 &&
            hole.every((point) =>
                PcbScene3dBoardSolderMaskFactory.#isPointStrictlyInsidePolygon(
                    point,
                    contour
                )
            )
        )
    }

    /**
     * Returns true when a point lies inside a polygon and away from its border.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #isPointStrictlyInsidePolygon(point, polygon) {
        if (
            PcbScene3dBoardSolderMaskFactory.#isPointOnPolygonBoundary(
                point,
                polygon
            )
        ) {
            return false
        }

        let inside = false
        for (
            let index = 0, previousIndex = polygon.length - 1;
            index < polygon.length;
            previousIndex = index, index += 1
        ) {
            const current = polygon[index]
            const previous = polygon[previousIndex]
            const intersects =
                current.y > point.y !== previous.y > point.y &&
                point.x <
                    ((previous.x - current.x) * (point.y - current.y)) /
                        (previous.y - current.y) +
                        current.x

            if (intersects) {
                inside = !inside
            }
        }

        return inside
    }

    /**
     * Returns true when a point lies on any polygon edge.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #isPointOnPolygonBoundary(point, polygon) {
        return polygon.some((start, index) =>
            PcbScene3dBoardSolderMaskFactory.#isPointOnSegment(
                point,
                start,
                polygon[(index + 1) % polygon.length]
            )
        )
    }

    /**
     * Returns true when a point lies on one line segment.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @returns {boolean}
     */
    static #isPointOnSegment(point, start, end) {
        const lengthSquared =
            (end.x - start.x) * (end.x - start.x) +
            (end.y - start.y) * (end.y - start.y)

        if (lengthSquared < 0.001) {
            return Math.hypot(point.x - start.x, point.y - start.y) < 0.001
        }

        const cross =
            (point.y - start.y) * (end.x - start.x) -
            (point.x - start.x) * (end.y - start.y)
        if (Math.abs(cross) > 0.001) {
            return false
        }

        const dot =
            (point.x - start.x) * (end.x - start.x) +
            (point.y - start.y) * (end.y - start.y)
        if (dot < -0.001) {
            return false
        }

        return dot <= lengthSquared + 0.001
    }

    /**
     * Resolves the mask outer-boundary scale for edge clearance.
     * @param {{ widthMil?: number, heightMil?: number }} board Board dimensions.
     * @returns {{ x: number, y: number }}
     */
    static #resolveOuterScale(board) {
        const width = Number(board?.widthMil || 0)
        const height = Number(board?.heightMil || 0)

        if (width <= 0 || height <= 0) {
            return { x: 1, y: 1 }
        }

        const clearance = PcbScene3dBoardSolderMaskFactory.#EDGE_CLEARANCE_MIL
        return {
            x: Math.max((width - 2 * clearance) / width, 0.9),
            y: Math.max((height - 2 * clearance) / height, 0.9)
        }
    }

    /**
     * Builds the solder-mask material.
     * @param {any} THREE
     * @param {{ surfaceColor?: number }} board Board metadata.
     * @param {number} side Rendered material side.
     * @returns {any}
     */
    static #buildMaterial(THREE, board, side) {
        return new THREE.MeshStandardMaterial({
            color: PcbScene3dBoardMaterialPalette.resolveSurfaceColor(board, {
                hasBoardAssemblyModel: true
            }),
            roughness: 0.68,
            metalness: 0.08,
            polygonOffset: true,
            polygonOffsetFactor: -1,
            polygonOffsetUnits: -1,
            side
        })
    }
}
