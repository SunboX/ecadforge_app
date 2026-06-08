import { PcbScene3dBoardEdgeCutoutBuilder } from './PcbScene3dBoardEdgeCutoutBuilder.mjs'
import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'
import { PcbScene3dOutlineBuilder } from './PcbScene3dOutlineBuilder.mjs'

/**
 * Builds the board solid profile, including drilled holes.
 */
export class PcbScene3dBoardShapeFactory {
    static #CURVE_SEGMENTS = 20
    static #PAD_HOLE_SHAPE_SLOT = 2
    static #PLATED_WALL_MATERIAL_INDEX = 2
    static #EDGE_WALL_MATERIAL_INDEX = 1
    static #CONTOUR_SAMPLE_POINTS = 64
    static #GEOMETRY_EPSILON = 0.001
    static #CONTOUR_MATCH_TOLERANCE_MIL = 0.25

    /**
     * Builds one board shape with drill holes.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @param {{ pads?: any[], vias?: any[] }} [detail]
     * @param {(x: number, y: number) => { x: number, y: number }} [normalizeBoardPoint]
     * @returns {any}
     */
    static buildShape(
        THREE,
        board,
        detail = {},
        normalizeBoardPoint = (x, y) => ({ x, y })
    ) {
        const baseShape = PcbScene3dBoardShapeFactory.#buildBaseShape(
            THREE,
            board
        )
        const contourPoints =
            PcbScene3dBoardEdgeCutoutBuilder.resolveShapePoints(baseShape)
        const drillCutouts = PcbScene3dBoardShapeFactory.#resolveDrillCutouts(
            THREE,
            detail,
            normalizeBoardPoint
        )
        const edgeCutouts = drillCutouts.filter(
            (cutout) =>
                cutout.isCircular &&
                !PcbScene3dBoardEdgeCutoutBuilder.isHoleInsideContour(
                    cutout.points,
                    contourPoints
                )
        )
        const shape = edgeCutouts.length
            ? PcbScene3dBoardEdgeCutoutBuilder.buildShapeFromPoints(
                  THREE,
                  PcbScene3dBoardEdgeCutoutBuilder.applyCircularEdgeCutouts(
                      contourPoints,
                      edgeCutouts
                  )
              )
            : baseShape
        const finalContourPoints = edgeCutouts.length
            ? PcbScene3dBoardEdgeCutoutBuilder.resolveShapePoints(shape)
            : contourPoints

        for (const cutout of drillCutouts) {
            if (edgeCutouts.includes(cutout)) {
                continue
            }

            if (
                !cutout.isCircular ||
                PcbScene3dBoardEdgeCutoutBuilder.isHoleInsideContour(
                    cutout.points,
                    finalContourPoints
                )
            ) {
                shape.holes.push(cutout.path)
            }
        }

        return shape
    }

    /**
     * Resolves circular drills that intersect the board outline.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @param {{ pads?: any[], vias?: any[] }} [detail]
     * @param {(x: number, y: number) => { x: number, y: number }} [normalizeBoardPoint]
     * @returns {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }[]}
     */
    static resolveCircularEdgeDrills(
        THREE,
        board,
        detail = {},
        normalizeBoardPoint = (x, y) => ({ x, y })
    ) {
        if (!board) {
            return []
        }

        const contourPoints =
            PcbScene3dBoardEdgeCutoutBuilder.resolveShapePoints(
                PcbScene3dBoardShapeFactory.#buildBaseShape(THREE, board)
            )

        return PcbScene3dBoardShapeFactory.#resolveDrillCutouts(
            THREE,
            detail,
            normalizeBoardPoint
        )
            .filter(
                (cutout) =>
                    cutout.isCircular &&
                    !PcbScene3dBoardEdgeCutoutBuilder.isHoleInsideContour(
                        cutout.points,
                        contourPoints
                    )
            )
            .map((cutout) => cutout.drillSpec)
    }

    /**
     * Builds the outer board shape before drill holes are applied.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @returns {any}
     */
    static #buildBaseShape(THREE, board) {
        const shape = new THREE.Shape()
        const commands = PcbScene3dOutlineBuilder.buildCommands(board)

        if (!commands.length) {
            shape.moveTo(-board.widthMil / 2, -board.heightMil / 2)
            shape.lineTo(board.widthMil / 2, -board.heightMil / 2)
            shape.lineTo(board.widthMil / 2, board.heightMil / 2)
            shape.lineTo(-board.widthMil / 2, board.heightMil / 2)
            shape.lineTo(-board.widthMil / 2, -board.heightMil / 2)
        } else {
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
        }
        return shape
    }

    /**
     * Builds one extruded board body geometry with open drill apertures.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, thicknessMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @param {{ pads?: any[], vias?: any[] }} [detail]
     * @param {(x: number, y: number) => { x: number, y: number }} [normalizeBoardPoint]
     * @returns {any}
     */
    static buildGeometry(
        THREE,
        board,
        detail = {},
        normalizeBoardPoint = (x, y) => ({ x, y })
    ) {
        const thicknessMil = Number(board?.thicknessMil || 0)
        const shape = PcbScene3dBoardShapeFactory.buildShape(
            THREE,
            board,
            detail,
            normalizeBoardPoint
        )
        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth: thicknessMil,
            bevelEnabled: false,
            curveSegments: PcbScene3dBoardShapeFactory.#CURVE_SEGMENTS
        })

        geometry.translate?.(0, 0, -thicknessMil / 2)
        PcbScene3dBoardShapeFactory.#applyPlatedDrillWallMaterials(
            THREE,
            geometry,
            detail,
            normalizeBoardPoint
        )
        return geometry
    }

    /**
     * Resolves normalized drill cutout metadata.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {{ path: any, points: { x: number, y: number }[], centerX: number, centerY: number, radius: number, isCircular: boolean, drillSpec: { x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null } }[]}
     */
    static #resolveDrillCutouts(THREE, detail, normalizeBoardPoint) {
        return PcbScene3dDrillPathFactory.resolveBoardDrillSpecs(detail)
            .map((drillSpec) => {
                const point = normalizeBoardPoint(drillSpec.x, drillSpec.y)
                const normalizedSpec = {
                    ...drillSpec,
                    x: point.x,
                    y: point.y
                }
                const path = PcbScene3dDrillPathFactory.buildDrillPath(
                    THREE,
                    normalizedSpec
                )
                const diameter = Number(normalizedSpec.diameter || 0)
                const slotLength = Number(normalizedSpec.slotLength || 0)
                const isCircular =
                    diameter > 0 && slotLength <= diameter + 0.001
                const points = isCircular
                    ? PcbScene3dBoardEdgeCutoutBuilder.buildCircularCutoutPoints(
                          Number(normalizedSpec.x || 0),
                          Number(normalizedSpec.y || 0),
                          diameter / 2
                      )
                    : PcbScene3dBoardShapeFactory.#resolvePathPoints(path)

                return {
                    path,
                    points,
                    centerX: Number(normalizedSpec.x || 0),
                    centerY: Number(normalizedSpec.y || 0),
                    radius: diameter / 2,
                    isCircular,
                    drillSpec
                }
            })
            .filter((cutout) => cutout.path && cutout.points.length >= 3)
    }

    /**
     * Resolves sampled points from one path.
     * @param {{ getPoints?: (segments: number) => { x: number, y: number }[] } | null} path
     * @returns {{ x: number, y: number }[]}
     */
    static #resolvePathPoints(path) {
        return (path?.getPoints?.(
            PcbScene3dBoardShapeFactory.#CONTOUR_SAMPLE_POINTS
        ) || []).map((point) => ({
            x: Number(point.x || 0),
            y: Number(point.y || 0)
        }))
    }

    /**
     * Assigns copper material to plated drill side-wall triangles only.
     * @param {any} THREE
     * @param {any} geometry
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {void}
     */
    static #applyPlatedDrillWallMaterials(
        THREE,
        geometry,
        detail,
        normalizeBoardPoint
    ) {
        const contours = PcbScene3dBoardShapeFactory.#resolvePlatedContours(
            THREE,
            detail,
            normalizeBoardPoint
        )
        if (!contours.length || !geometry?.groups?.length) {
            return
        }

        const nextGroups = []
        for (const group of geometry.groups) {
            const start = Number(group.start || 0)
            const end = start + Number(group.count || 0)
            for (let index = start; index < end; index += 3) {
                const materialIndex =
                    Number(group.materialIndex) ===
                        PcbScene3dBoardShapeFactory.#EDGE_WALL_MATERIAL_INDEX &&
                    PcbScene3dBoardShapeFactory.#matchesAnyContour(
                        geometry,
                        index,
                        contours
                    )
                        ? PcbScene3dBoardShapeFactory
                              .#PLATED_WALL_MATERIAL_INDEX
                        : Number(group.materialIndex || 0)

                PcbScene3dBoardShapeFactory.#appendGeometryGroup(
                    nextGroups,
                    index,
                    Math.min(3, end - index),
                    materialIndex
                )
            }
        }

        geometry.clearGroups?.()
        nextGroups.forEach((group) => {
            geometry.addGroup(group.start, group.count, group.materialIndex)
        })
    }

    /**
     * Resolves normalized contours for plated board drills.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } }[]}
     */
    static #resolvePlatedContours(THREE, detail, normalizeBoardPoint) {
        return PcbScene3dBoardShapeFactory.#resolvePlatedDrillSpecs(detail)
            .map((drillSpec) => {
                const point = normalizeBoardPoint(drillSpec.x, drillSpec.y)
                const path = PcbScene3dDrillPathFactory.buildDrillPath(THREE, {
                    ...drillSpec,
                    x: point.x,
                    y: point.y
                })
                const points =
                    path?.getPoints?.(
                        PcbScene3dBoardShapeFactory.#CONTOUR_SAMPLE_POINTS
                    ) || []
                return PcbScene3dBoardShapeFactory.#buildContour(points)
            })
            .filter(Boolean)
    }

    /**
     * Resolves deduped drill specs that represent plated holes.
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @returns {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }[]}
     */
    static #resolvePlatedDrillSpecs(detail) {
        const platedKeys = new Set()

        for (const via of detail?.vias || []) {
            const diameter = Number(via?.holeDiameter || 0)
            if (diameter <= 0) {
                continue
            }

            platedKeys.add(
                PcbScene3dBoardShapeFactory.#buildDrillSpecKey({
                    x: Number(via?.x || 0),
                    y: Number(via?.y || 0),
                    diameter,
                    slotLength: null,
                    rotationDeg: 0
                })
            )
        }

        for (const pad of detail?.pads || []) {
            const diameter = Number(pad?.holeDiameter || 0)
            if (
                diameter <= 0 ||
                !PcbScene3dBoardShapeFactory.#hasPadCopperAnnulus(pad, diameter)
            ) {
                continue
            }

            const slotLength =
                Number(pad?.holeShape) ===
                    PcbScene3dBoardShapeFactory.#PAD_HOLE_SHAPE_SLOT &&
                Number(pad?.holeSlotLength || 0) > diameter
                    ? Number(pad?.holeSlotLength || 0)
                    : null
            platedKeys.add(
                PcbScene3dBoardShapeFactory.#buildDrillSpecKey({
                    x: Number(pad?.x || 0),
                    y: Number(pad?.y || 0),
                    diameter,
                    slotLength,
                    rotationDeg:
                        slotLength === null
                            ? 0
                            : PcbScene3dBoardShapeFactory.#normalizeAngle(
                                  Number(pad?.rotation || 0) +
                                      Number(pad?.holeRotation || 0)
                              )
                })
            )
        }

        return PcbScene3dDrillPathFactory.resolveBoardDrillSpecs(detail).filter(
            (drillSpec) =>
                platedKeys.has(
                    PcbScene3dBoardShapeFactory.#buildDrillSpecKey(drillSpec)
                )
        )
    }

    /**
     * Checks whether one pad has copper larger than its drill aperture.
     * @param {any} pad
     * @param {number} diameter
     * @returns {boolean}
     */
    static #hasPadCopperAnnulus(pad, diameter) {
        const drillSpan = Math.max(diameter, Number(pad?.holeSlotLength || 0))

        return [
            pad?.sizeTopX,
            pad?.sizeTopY,
            pad?.sizeMidX,
            pad?.sizeMidY,
            pad?.sizeBottomX,
            pad?.sizeBottomY
        ].some(
            (size) =>
                Number(size || 0) >
                drillSpan + PcbScene3dBoardShapeFactory.#GEOMETRY_EPSILON
        )
    }

    /**
     * Builds one closed contour and bounds from sampled path points.
     * @param {any[]} points
     * @returns {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } } | null}
     */
    static #buildContour(points) {
        const contour = (points || [])
            .map((point) => ({ x: Number(point?.x), y: Number(point?.y) }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        const first = contour[0]
        const last = contour[contour.length - 1]

        if (contour.length < 3) {
            return null
        }

        if (
            Math.hypot(first.x - last.x, first.y - last.y) >
            PcbScene3dBoardShapeFactory.#GEOMETRY_EPSILON
        ) {
            contour.push({ ...first })
        }

        return {
            points: contour,
            bounds: contour.reduce(
                (bounds, point) => ({
                    minX: Math.min(bounds.minX, point.x),
                    maxX: Math.max(bounds.maxX, point.x),
                    minY: Math.min(bounds.minY, point.y),
                    maxY: Math.max(bounds.maxY, point.y)
                }),
                {
                    minX: Infinity,
                    maxX: -Infinity,
                    minY: Infinity,
                    maxY: -Infinity
                }
            )
        }
    }

    /**
     * Returns true when a triangle is on any plated drill contour.
     * @param {any} geometry
     * @param {number} triangleStart
     * @param {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } }[]} contours
     * @returns {boolean}
     */
    static #matchesAnyContour(geometry, triangleStart, contours) {
        return contours.some((contour) =>
            PcbScene3dBoardShapeFactory.#matchesContour(
                geometry,
                triangleStart,
                contour
            )
        )
    }

    /**
     * Returns true when all triangle vertices lie on one drill contour.
     * @param {any} geometry
     * @param {number} triangleStart
     * @param {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } }} contour
     * @returns {boolean}
     */
    static #matchesContour(geometry, triangleStart, contour) {
        for (let offset = 0; offset < 3; offset += 1) {
            const point = PcbScene3dBoardShapeFactory.#resolveVertexPoint(
                geometry,
                triangleStart + offset
            )
            if (
                !PcbScene3dBoardShapeFactory.#isPointNearContour(point, contour)
            ) {
                return false
            }
        }

        return true
    }

    /**
     * Resolves the XY point for one indexed or non-indexed geometry vertex.
     * @param {any} geometry
     * @param {number} index
     * @returns {{ x: number, y: number }}
     */
    static #resolveVertexPoint(geometry, index) {
        const position = geometry.getAttribute('position')
        const vertexIndex = geometry.index?.getX?.(index) ?? index

        return {
            x: position.getX(vertexIndex),
            y: position.getY(vertexIndex)
        }
    }

    /**
     * Returns true when a point is close to one contour boundary.
     * @param {{ x: number, y: number }} point
     * @param {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } }} contour
     * @returns {boolean}
     */
    static #isPointNearContour(point, contour) {
        const tolerance =
            PcbScene3dBoardShapeFactory.#CONTOUR_MATCH_TOLERANCE_MIL
        if (
            point.x < contour.bounds.minX - tolerance ||
            point.x > contour.bounds.maxX + tolerance ||
            point.y < contour.bounds.minY - tolerance ||
            point.y > contour.bounds.maxY + tolerance
        ) {
            return false
        }

        for (let index = 0; index < contour.points.length - 1; index += 1) {
            if (
                PcbScene3dBoardShapeFactory.#distanceToSegment(
                    point,
                    contour.points[index],
                    contour.points[index + 1]
                ) <= tolerance
            ) {
                return true
            }
        }

        return false
    }

    /**
     * Appends or extends a contiguous material group.
     * @param {{ start: number, count: number, materialIndex: number }[]} groups
     * @param {number} start
     * @param {number} count
     * @param {number} materialIndex
     * @returns {void}
     */
    static #appendGeometryGroup(groups, start, count, materialIndex) {
        const previous = groups[groups.length - 1]
        if (
            previous &&
            previous.start + previous.count === start &&
            previous.materialIndex === materialIndex
        ) {
            previous.count += count
            return
        }

        groups.push({ start, count, materialIndex })
    }

    /**
     * Computes the XY distance from a point to a finite segment.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @returns {number}
     */
    static #distanceToSegment(point, start, end) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSquared = dx * dx + dy * dy
        if (lengthSquared <= PcbScene3dBoardShapeFactory.#GEOMETRY_EPSILON) {
            return Math.hypot(point.x - start.x, point.y - start.y)
        }

        const ratio = Math.max(
            0,
            Math.min(
                1,
                ((point.x - start.x) * dx + (point.y - start.y) * dy) /
                    lengthSquared
            )
        )
        const projectedX = start.x + ratio * dx
        const projectedY = start.y + ratio * dy

        return Math.hypot(point.x - projectedX, point.y - projectedY)
    }

    /**
     * Builds a stable drill spec key.
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }} drillSpec
     * @returns {string}
     */
    static #buildDrillSpecKey(drillSpec) {
        return [
            Number(drillSpec.x || 0).toFixed(4),
            Number(drillSpec.y || 0).toFixed(4),
            Number(drillSpec.diameter || 0).toFixed(4),
            Number(drillSpec.slotLength || 0).toFixed(4),
            Number(drillSpec.rotationDeg || 0).toFixed(4)
        ].join(':')
    }

    /**
     * Normalizes one angle into the inclusive `[0, 360)` range.
     * @param {number} angleDeg
     * @returns {number}
     */
    static #normalizeAngle(angleDeg) {
        const normalized = Number(angleDeg || 0) % 360
        return normalized < 0 ? normalized + 360 : normalized
    }
}
