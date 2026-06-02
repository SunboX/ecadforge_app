import { PcbScene3dCopperTextFactory } from './PcbScene3dCopperTextFactory.mjs'
import { PcbScene3dCutoutGeometryFilter } from './PcbScene3dCutoutGeometryFilter.mjs'
import { PcbScene3dDrillCutoutFilter } from './PcbScene3dDrillCutoutFilter.mjs'
import { PcbScene3dShapePathFactory } from './PcbScene3dShapePathFactory.mjs'
import { PcbScene3dSilkscreenStrokeWidthResolver } from './PcbScene3dSilkscreenStrokeWidthResolver.mjs'
import { PcbScene3dStrokeGeometryBuilder } from './PcbScene3dStrokeGeometryBuilder.mjs'
import { PcbScene3dTrueTypeTextFactory } from './PcbScene3dTrueTypeTextFactory.mjs'

/**
 * Builds documentation-layer silkscreen meshes for the 3D PCB view.
 */
export class PcbScene3dSilkscreenFactory {
    static #DEFAULT_SILKSCREEN_COLOR = 0xf8f6ef
    static #FILL_THICKNESS_MIL = 0.8
    static #GEOMETRY_EPSILON = 0.001
    static #FULL_CIRCLE_EPSILON = 0.001
    static #MIN_STROKE_WIDTH_MIL = 0.04
    static #STROKE_Z_OFFSET = 0.04

    /**
     * Builds the combined top and bottom silkscreen group.
     * @param {any} THREE
     * @param {{ top?: { fills?: any[], tracks?: any[], arcs?: any[], texts?: any[], drillCutouts?: { x: number, y: number }[][], fillColor?: number, strokeColor?: number, knockoutColor?: number, nativeTextKnockouts?: boolean }, bottom?: { fills?: any[], tracks?: any[], arcs?: any[], texts?: any[], drillCutouts?: { x: number, y: number }[][], fillColor?: number, strokeColor?: number, knockoutColor?: number, nativeTextKnockouts?: boolean } }} silkscreen
     * @param {number} topZ
     * @param {number} bottomZ
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any}
     */
    static buildGroup(THREE, silkscreen, topZ, bottomZ, normalizeBoardPoint) {
        const group = new THREE.Group()
        const topGroup = PcbScene3dSilkscreenFactory.#buildSideGroup(
            THREE,
            silkscreen?.top,
            Math.abs(Number(topZ || 0)),
            normalizeBoardPoint,
            false
        )
        const bottomGroup = PcbScene3dSilkscreenFactory.#buildSideGroup(
            THREE,
            silkscreen?.bottom,
            Math.abs(Number(bottomZ || 0)),
            normalizeBoardPoint,
            true
        )

        if (topGroup.children.length) {
            group.add(topGroup)
        }
        if (bottomGroup.children.length) {
            group.add(bottomGroup)
        }

        return group
    }

    /**
     * Builds one side-specific silkscreen group.
     * @param {any} THREE
     * @param {{ fills?: any[], tracks?: any[], arcs?: any[], texts?: any[], drillCutouts?: { x: number, y: number }[][], fillColor?: number, strokeColor?: number, knockoutColor?: number, nativeTextKnockouts?: boolean } | undefined} silkscreen
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any}
     */
    static #buildSideGroup(THREE, silkscreen, z, normalizeBoardPoint, mirrorY) {
        const group = new THREE.Group()
        const strokeColor = PcbScene3dSilkscreenFactory.#resolveMaterialColor(
            silkscreen?.strokeColor
        )
        const fillColor = PcbScene3dSilkscreenFactory.#resolveMaterialColor(
            silkscreen?.fillColor
        )
        const hasExplicitFillColor = Number.isInteger(silkscreen?.fillColor)
        const textMaterialColor = strokeColor
        const invertedTextMaterialColor = Number.isInteger(
            silkscreen?.knockoutColor
        )
            ? PcbScene3dSilkscreenFactory.#resolveMaterialColor(
                  silkscreen.knockoutColor
              )
            : hasExplicitFillColor
              ? fillColor
              : textMaterialColor
        const strokeZ = z + PcbScene3dSilkscreenFactory.#STROKE_Z_OFFSET
        const drillCutouts = PcbScene3dSilkscreenFactory.#normalizeDrillCutouts(
            silkscreen?.drillCutouts,
            normalizeBoardPoint,
            mirrorY
        )
        const strokeMaterial = PcbScene3dSilkscreenFactory.#buildMaterial(
            THREE,
            strokeColor
        )
        const fillMaterial = PcbScene3dSilkscreenFactory.#buildMaterial(
            THREE,
            fillColor
        )
        const trackMesh = PcbScene3dSilkscreenFactory.#buildTrackMesh(
            THREE,
            silkscreen?.tracks || [],
            strokeZ,
            normalizeBoardPoint,
            mirrorY,
            strokeMaterial,
            drillCutouts
        )
        const arcMesh = PcbScene3dSilkscreenFactory.#buildArcMesh(
            THREE,
            silkscreen?.arcs || [],
            strokeZ,
            normalizeBoardPoint,
            mirrorY,
            strokeMaterial,
            drillCutouts
        )
        const fillMeshes = PcbScene3dSilkscreenFactory.#buildFillMeshes(
            THREE,
            silkscreen?.fills || [],
            z,
            normalizeBoardPoint,
            mirrorY,
            fillMaterial,
            drillCutouts
        )
        const texts = Array.isArray(silkscreen?.texts) ? silkscreen.texts : []
        const renderableTexts = texts.filter(
            (text) =>
                !PcbScene3dSilkscreenFactory.#shouldSkipSourceText(
                    text,
                    silkscreen
                )
        )
        const textGroup = PcbScene3dCopperTextFactory.buildGroup(
            THREE,
            renderableTexts.filter(
                (text) => !PcbScene3dTrueTypeTextFactory.isTrueTypeText(text)
            ),
            strokeZ,
            normalizeBoardPoint,
            {
                drillCutouts,
                filterSide: false,
                materialColor: strokeColor,
                mirrorY,
                side: mirrorY ? 'bottom' : 'top'
            }
        )
        const trueTypeTextGroup = PcbScene3dTrueTypeTextFactory.buildGroup(
            THREE,
            renderableTexts,
            strokeZ,
            normalizeBoardPoint,
            {
                invertedMaterialColor: invertedTextMaterialColor,
                materialColor: textMaterialColor,
                mirrorY
            }
        )

        if (trackMesh) {
            group.add(trackMesh)
        }
        if (arcMesh) {
            group.add(arcMesh)
        }
        if (fillMeshes.length) {
            group.add(...fillMeshes)
        }
        if (textGroup.children.length) {
            group.add(textGroup)
        }
        if (trueTypeTextGroup.children.length) {
            group.add(trueTypeTextGroup)
        }
        if (mirrorY && group.children.length) {
            group.rotation.x = Math.PI
        }

        return group
    }

    /**
     * Skips source text when recovered Altium fills already contain
     * the corresponding inverted-text holes.
     * @param {object} text
     * @param {{ nativeTextKnockouts?: boolean } | undefined} silkscreen
     * @returns {boolean}
     */
    static #shouldSkipSourceText(text, silkscreen) {
        return (
            Boolean(silkscreen?.nativeTextKnockouts) &&
            Boolean(text?.isInverted)
        )
    }

    /**
     * Builds one filled mesh for all stroke-style silkscreen tracks.
     * @param {any} THREE
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number }[]} tracks
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @param {any} material
     * @param {{ x: number, y: number }[][]} drillCutouts
     * @returns {any | null}
     */
    static #buildTrackMesh(
        THREE,
        tracks,
        z,
        normalizeBoardPoint,
        mirrorY,
        material,
        drillCutouts
    ) {
        const positions = []
        const denseHairline =
            PcbScene3dSilkscreenStrokeWidthResolver.resolveDenseHairline(tracks)

        for (const track of tracks) {
            const start = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(track.x1 || 0),
                Number(track.y1 || 0),
                mirrorY
            )
            const end = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(track.x2 || 0),
                Number(track.y2 || 0),
                mirrorY
            )
            PcbScene3dStrokeGeometryBuilder.appendTrack(
                positions,
                start,
                end,
                PcbScene3dSilkscreenStrokeWidthResolver.resolveTrackWidth(
                    Number(track.width || 0),
                    denseHairline
                ),
                z,
                {
                    minWidth: PcbScene3dSilkscreenFactory.#MIN_STROKE_WIDTH_MIL
                }
            )
        }

        return PcbScene3dSilkscreenFactory.#buildStrokeMesh(
            THREE,
            positions,
            material,
            drillCutouts
        )
    }

    /**
     * Builds one filled mesh for all stroke-style silkscreen arcs.
     * @param {any} THREE
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }[]} arcs
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @param {any} material
     * @param {{ x: number, y: number }[][]} drillCutouts
     * @returns {any | null}
     */
    static #buildArcMesh(
        THREE,
        arcs,
        z,
        normalizeBoardPoint,
        mirrorY,
        material,
        drillCutouts
    ) {
        const positions = []

        for (const arc of arcs) {
            const center = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(arc.x || 0),
                Number(arc.y || 0),
                mirrorY
            )
            PcbScene3dStrokeGeometryBuilder.appendArc(
                positions,
                center,
                arc,
                z,
                mirrorY,
                {
                    fullCircleEpsilon:
                        PcbScene3dSilkscreenFactory.#FULL_CIRCLE_EPSILON,
                    minWidth: PcbScene3dSilkscreenFactory.#MIN_STROKE_WIDTH_MIL
                }
            )
        }

        return PcbScene3dSilkscreenFactory.#buildStrokeMesh(
            THREE,
            positions,
            material,
            drillCutouts
        )
    }

    /**
     * Builds thin fill meshes for silkscreen solids.
     * @param {any} THREE
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }[]} fills
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @param {any} material
     * @param {{ x: number, y: number }[][]} drillCutouts
     * @returns {any[]}
     */
    static #buildFillMeshes(
        THREE,
        fills,
        z,
        normalizeBoardPoint,
        mirrorY,
        material,
        drillCutouts
    ) {
        return fills.map((fill) => {
            const points = PcbScene3dSilkscreenFactory.#normalizeFillPoints(
                fill,
                normalizeBoardPoint,
                mirrorY,
                Boolean(drillCutouts.length)
            )
            const fillHoles = PcbScene3dSilkscreenFactory.#normalizeFillHoles(
                fill,
                normalizeBoardPoint,
                mirrorY
            )

            if (
                points.length >= 3 &&
                THREE.Shape &&
                THREE.Path &&
                THREE.ShapeGeometry
            ) {
                return PcbScene3dSilkscreenFactory.#buildShapeFillMesh(
                    THREE,
                    points,
                    fillHoles,
                    drillCutouts,
                    z,
                    material
                )
            }

            return PcbScene3dSilkscreenFactory.#buildBoxFillMesh(
                THREE,
                fill,
                z,
                normalizeBoardPoint,
                mirrorY,
                material
            )
        })
    }

    /**
     * Builds one polygon fill mesh from authored silkscreen points.
     * @param {any} THREE
     * @param {{ x: number, y: number }[]} points Normalized polygon points.
     * @param {{ x: number, y: number }[][]} fillHoles Normalized authored polygon holes.
     * @param {{ x: number, y: number }[][]} drillCutouts Normalized drill cutouts.
     * @param {number} z
     * @param {any} material
     * @returns {any}
     */
    static #buildShapeFillMesh(
        THREE,
        points,
        fillHoles,
        drillCutouts,
        z,
        material
    ) {
        const shape = PcbScene3dShapePathFactory.buildShape(THREE, points)
        const { authoredHoles, drillHoles, uncoveredCutouts } =
            PcbScene3dDrillCutoutFilter.partitionFillHoles(
                drillCutouts,
                fillHoles
            )
        const { shapeHoles, clippingHoles } =
            PcbScene3dSilkscreenFactory.#partitionDrillCutouts(
                uncoveredCutouts,
                points
            )
        PcbScene3dSilkscreenFactory.#appendShapeHoles(
            THREE,
            shape,
            authoredHoles,
            points
        )
        PcbScene3dSilkscreenFactory.#appendShapeHoles(
            THREE,
            shape,
            shapeHoles,
            points
        )

        const geometry = PcbScene3dCutoutGeometryFilter.filter(
            THREE,
            new THREE.ShapeGeometry(shape),
            authoredHoles.concat(shapeHoles, drillHoles, clippingHoles),
            { maxDepth: 12, maxEdgeLength: 2 }
        )
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(0, 0, z)
        return mesh
    }

    /**
     * Splits drill cutouts into safe shape holes and fallback clip polygons.
     * @param {{ x: number, y: number }[][]} drillCutouts
     * @param {{ x: number, y: number }[]} contourPoints
     * @returns {{ shapeHoles: { x: number, y: number }[][], clippingHoles: { x: number, y: number }[][] }}
     */
    static #partitionDrillCutouts(drillCutouts, contourPoints) {
        const shapeHoles = []
        const clippingHoles = []

        for (const cutout of Array.isArray(drillCutouts) ? drillCutouts : []) {
            if (
                PcbScene3dSilkscreenFactory.#isHoleInsideContour(
                    cutout,
                    contourPoints
                )
            ) {
                shapeHoles.push(cutout)
                continue
            }

            clippingHoles.push(cutout)
        }

        return { shapeHoles, clippingHoles }
    }

    /**
     * Appends normalized cutout paths to one shape fill.
     * @param {any} THREE
     * @param {{ holes: any[] }} shape
     * @param {{ x: number, y: number }[][]} holes
     * @param {{ x: number, y: number }[]} contourPoints
     * @returns {void}
     */
    static #appendShapeHoles(THREE, shape, holes, contourPoints) {
        if (!Array.isArray(holes) || !Array.isArray(shape.holes)) {
            return
        }

        for (const points of holes) {
            if (
                !PcbScene3dSilkscreenFactory.#isHoleInsideContour(
                    points,
                    contourPoints
                )
            ) {
                continue
            }

            shape.holes.push(
                PcbScene3dShapePathFactory.buildPath(THREE, points)
            )
        }
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
                PcbScene3dSilkscreenFactory.#isPointStrictlyInsidePolygon(
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
            PcbScene3dSilkscreenFactory.#isPointOnPolygonBoundary(
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
     * Returns true when a point lies on a polygon edge.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #isPointOnPolygonBoundary(point, polygon) {
        return polygon.some((start, index) =>
            PcbScene3dSilkscreenFactory.#isPointOnSegment(
                point,
                start,
                polygon[(index + 1) % polygon.length]
            )
        )
    }

    /**
     * Returns true when a point lies on a segment within geometry tolerance.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @returns {boolean}
     */
    static #isPointOnSegment(point, start, end) {
        const cross =
            (point.y - start.y) * (end.x - start.x) -
            (point.x - start.x) * (end.y - start.y)

        if (Math.abs(cross) > PcbScene3dSilkscreenFactory.#GEOMETRY_EPSILON) {
            return false
        }

        const dot =
            (point.x - start.x) * (end.x - start.x) +
            (point.y - start.y) * (end.y - start.y)

        if (dot < -PcbScene3dSilkscreenFactory.#GEOMETRY_EPSILON) {
            return false
        }

        const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2

        return (
            dot <= lengthSquared + PcbScene3dSilkscreenFactory.#GEOMETRY_EPSILON
        )
    }

    /**
     * Builds one rectangular fallback fill mesh.
     * @param {any} THREE
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number }} fill
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @param {any} material
     * @returns {any}
     */
    static #buildBoxFillMesh(
        THREE,
        fill,
        z,
        normalizeBoardPoint,
        mirrorY,
        material
    ) {
        const center = PcbScene3dSilkscreenFactory.#normalizePoint(
            normalizeBoardPoint,
            (Number(fill.x1 || 0) + Number(fill.x2 || 0)) / 2,
            (Number(fill.y1 || 0) + Number(fill.y2 || 0)) / 2,
            mirrorY
        )
        const mesh = new THREE.Mesh(
            new THREE.BoxGeometry(
                Math.max(
                    Math.abs(Number(fill.x2 || 0) - Number(fill.x1 || 0)),
                    1
                ),
                Math.max(
                    Math.abs(Number(fill.y2 || 0) - Number(fill.y1 || 0)),
                    1
                ),
                PcbScene3dSilkscreenFactory.#FILL_THICKNESS_MIL
            ),
            material
        )
        mesh.position.set(center.x, center.y, z)
        return mesh
    }

    /**
     * Normalizes authored polygon fill points.
     * @param {{ points?: { x: number, y: number }[], holes?: { x: number, y: number }[][] }} fill
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @param {boolean} forcePolygon
     * @returns {{ x: number, y: number }[]}
     */
    static #normalizeFillPoints(
        fill,
        normalizeBoardPoint,
        mirrorY,
        forcePolygon
    ) {
        if (!Array.isArray(fill?.points)) {
            return (Array.isArray(fill?.holes) && fill.holes.length) ||
                forcePolygon
                ? PcbScene3dSilkscreenFactory.#normalizeRectangleFillPoints(
                      fill,
                      normalizeBoardPoint,
                      mirrorY
                  )
                : []
        }

        return PcbScene3dShapePathFactory.normalizeShapePoints(
            fill.points,
            normalizeBoardPoint,
            mirrorY
        )
    }

    /**
     * Normalizes one rectangular fill into polygon points when it needs holes.
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number }} fill
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }[]}
     */
    static #normalizeRectangleFillPoints(fill, normalizeBoardPoint, mirrorY) {
        const x1 = Number(fill?.x1)
        const y1 = Number(fill?.y1)
        const x2 = Number(fill?.x2)
        const y2 = Number(fill?.y2)

        if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
        ) {
            return []
        }

        return [
            PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                x1,
                y1,
                mirrorY
            ),
            PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                x2,
                y1,
                mirrorY
            ),
            PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                x2,
                y2,
                mirrorY
            ),
            PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                x1,
                y2,
                mirrorY
            )
        ]
    }

    /**
     * Normalizes authored polygon fill holes.
     * @param {{ holes?: { x: number, y: number }[][] }} fill
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }[][]}
     */
    static #normalizeFillHoles(fill, normalizeBoardPoint, mirrorY) {
        if (!Array.isArray(fill?.holes)) {
            return []
        }

        return fill.holes
            .map((hole) =>
                PcbScene3dSilkscreenFactory.#normalizePointList(
                    hole,
                    normalizeBoardPoint,
                    mirrorY
                )
            )
            .filter((hole) => hole.length >= 3)
    }

    /**
     * Normalizes side-level drill cutouts into local silkscreen polygons.
     * @param {{ x?: number, y?: number }[][] | undefined} drillCutouts
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }[][]}
     */
    static #normalizeDrillCutouts(drillCutouts, normalizeBoardPoint, mirrorY) {
        if (!Array.isArray(drillCutouts)) {
            return []
        }

        return drillCutouts
            .map((cutout) =>
                PcbScene3dSilkscreenFactory.#normalizePointList(
                    cutout,
                    normalizeBoardPoint,
                    mirrorY
                )
            )
            .filter((cutout) => cutout.length >= 3)
    }

    /**
     * Normalizes one authored point list.
     * @param {{ x?: number, y?: number }[]} points
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }[]}
     */
    static #normalizePointList(points, normalizeBoardPoint, mirrorY) {
        return (Array.isArray(points) ? points : [])
            .map((point) =>
                PcbScene3dSilkscreenFactory.#normalizePoint(
                    normalizeBoardPoint,
                    Number(point?.x || 0),
                    Number(point?.y || 0),
                    mirrorY
                )
            )
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
    }

    /**
     * Builds one configured stroke mesh from triangle positions.
     * @param {any} THREE
     * @param {number[]} positions
     * @param {any} material
     * @param {{ x: number, y: number }[][]} [drillCutouts]
     * @returns {any | null}
     */
    static #buildStrokeMesh(THREE, positions, material, drillCutouts = []) {
        if (!positions.length) {
            return null
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        )

        return new THREE.Mesh(
            PcbScene3dCutoutGeometryFilter.filter(
                THREE,
                geometry,
                drillCutouts,
                { maxDepth: 12, maxEdgeLength: 2 }
            ),
            material
        )
    }

    /**
     * Builds one shared silkscreen material.
     * @param {any} THREE
     * @param {number} [color]
     * @returns {any}
     */
    static #buildMaterial(
        THREE,
        color = PcbScene3dSilkscreenFactory.#DEFAULT_SILKSCREEN_COLOR
    ) {
        return new THREE.MeshBasicMaterial({
            color,
            transparent: false,
            opacity: 1,
            toneMapped: false,
            fog: false,
            side: THREE.DoubleSide
        })
    }

    /**
     * Resolves a safe RGB material color.
     * @param {unknown} color
     * @returns {number}
     */
    static #resolveMaterialColor(color) {
        const numericColor = Number(color)

        return Number.isInteger(numericColor) &&
            numericColor >= 0 &&
            numericColor <= 0xffffff
            ? numericColor
            : PcbScene3dSilkscreenFactory.#DEFAULT_SILKSCREEN_COLOR
    }

    /**
     * Normalizes one board point and optionally mirrors underside primitives.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {number} x
     * @param {number} y
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }}
     */
    static #normalizePoint(normalizeBoardPoint, x, y, mirrorY) {
        const point = normalizeBoardPoint(x, y)

        return { x: point.x, y: mirrorY ? -point.y : point.y }
    }
}
