import earcut from 'earcut'
import { PcbAssemblyMeshUtils } from './PcbAssemblyMeshUtils.mjs'

const MAX_HOLE_POINTS = 48
const MIN_HOLE_POINTS = 8
const GEOMETRY_EPSILON = 0.001

/**
 * Builds PCB substrate meshes, including through-board drill cutouts.
 */
export class PcbAssemblyBoardSubstrateBuilder {
    /**
     * Builds a board prism from an outer outline and available drill holes.
     * @param {string} name Mesh name.
     * @param {number[][]} outlinePoints Board outline points in mils.
     * @param {object} sceneDescription Prepared scene description.
     * @param {number} thickness Board thickness in mils.
     * @param {number[]} color Board RGB color.
     * @returns {object | null}
     */
    static build(name, outlinePoints, sceneDescription, thickness, color) {
        const outer = PcbAssemblyMeshUtils.cleanLoop(outlinePoints)
        if (outer.length < 3) {
            return null
        }

        const holes = PcbAssemblyBoardSubstrateBuilder.#boardHoleLoops(
            sceneDescription,
            outer
        )
        if (!holes.length) {
            return PcbAssemblyMeshUtils.prism(name, outer, 0, thickness, color)
        }

        return PcbAssemblyBoardSubstrateBuilder.#prismWithHoles(
            name,
            outer,
            holes,
            thickness,
            color
        )
    }

    /**
     * Builds an extruded board polygon with inner drill walls.
     * @param {string} name Mesh name.
     * @param {number[][]} outer Outer board loop.
     * @param {number[][][]} holes Inner hole loops.
     * @param {number} thickness Board thickness in mils.
     * @param {number[]} color Board RGB color.
     * @returns {object | null}
     */
    static #prismWithHoles(name, outer, holes, thickness, color) {
        const loops = [outer, ...holes]
        const holeIndexes = []
        const points = []
        const flat = []

        for (const loop of loops) {
            if (points.length) {
                holeIndexes.push(points.length)
            }
            for (const point of loop) {
                points.push(point)
                flat.push(point[0], point[1])
            }
        }

        const triangles = earcut(flat, holeIndexes, 2)
        if (!triangles.length) {
            return PcbAssemblyMeshUtils.prism(name, outer, 0, thickness, color)
        }

        const halfThickness = Math.max(Number(thickness || 0), 0.001) / 2
        const bottomZ = -halfThickness
        const topZ = halfThickness
        const topOffset = points.length
        const vertices = [
            ...points.map((point) => [point[0], point[1], bottomZ]),
            ...points.map((point) => [point[0], point[1], topZ])
        ]
        const faces = []

        for (let index = 0; index + 2 < triangles.length; index += 3) {
            const a = triangles[index]
            const b = triangles[index + 1]
            const c = triangles[index + 2]
            faces.push([c, b, a])
            faces.push([a + topOffset, b + topOffset, c + topOffset])
        }

        let loopStart = 0
        PcbAssemblyBoardSubstrateBuilder.#appendLoopWalls(
            faces,
            loopStart,
            outer.length,
            topOffset,
            false
        )
        loopStart += outer.length
        for (const hole of holes) {
            PcbAssemblyBoardSubstrateBuilder.#appendLoopWalls(
                faces,
                loopStart,
                hole.length,
                topOffset,
                true
            )
            loopStart += hole.length
        }

        return {
            name,
            vertices,
            faces,
            ...(Array.isArray(color) ? { color } : {})
        }
    }

    /**
     * Appends side-wall faces for one polygon loop.
     * @param {number[][]} faces Mutable face list.
     * @param {number} start Loop start index.
     * @param {number} length Loop length.
     * @param {number} topOffset Top vertex offset.
     * @param {boolean} reverse Whether to reverse wall orientation.
     * @returns {void}
     */
    static #appendLoopWalls(faces, start, length, topOffset, reverse) {
        for (let index = 0; index < length; index += 1) {
            const current = start + index
            const next = start + ((index + 1) % length)
            faces.push(
                reverse
                    ? [next, current, current + topOffset, next + topOffset]
                    : [current, next, next + topOffset, current + topOffset]
            )
        }
    }

    /**
     * Resolves all usable board hole loops.
     * @param {object} sceneDescription Prepared scene description.
     * @param {number[][]} outer Board outline loop.
     * @returns {number[][][]}
     */
    static #boardHoleLoops(sceneDescription, outer) {
        const contourLoops =
            PcbAssemblyBoardSubstrateBuilder.#drillCutoutLoops(sceneDescription)
        const rawLoops = contourLoops.length
            ? contourLoops
            : PcbAssemblyBoardSubstrateBuilder.#primitiveHoleLoops(
                  sceneDescription
              )
        const seen = new Set()
        const holes = []

        for (const loop of rawLoops) {
            const normalized =
                PcbAssemblyBoardSubstrateBuilder.#normalizeHoleLoop(loop)
            if (
                normalized.length < 3 ||
                Math.abs(
                    PcbAssemblyBoardSubstrateBuilder.#signedArea(normalized)
                ) <= GEOMETRY_EPSILON
            ) {
                continue
            }

            const center =
                PcbAssemblyBoardSubstrateBuilder.#centroid(normalized)
            if (
                !PcbAssemblyBoardSubstrateBuilder.#pointInPolygon(center, outer)
            ) {
                continue
            }

            const signature =
                PcbAssemblyBoardSubstrateBuilder.#holeSignature(normalized)
            if (seen.has(signature)) {
                continue
            }
            seen.add(signature)
            holes.push(normalized)
        }

        return holes
    }

    /**
     * Reads existing drill cutout contours from scene silkscreen details.
     * @param {object} sceneDescription Prepared scene description.
     * @returns {Array<Array<object | number[]>>}
     */
    static #drillCutoutLoops(sceneDescription) {
        const silkscreen = sceneDescription?.detail?.silkscreen || {}
        return ['top', 'bottom'].flatMap((side) =>
            Array.isArray(silkscreen?.[side]?.drillCutouts)
                ? silkscreen[side].drillCutouts
                : []
        )
    }

    /**
     * Builds fallback hole contours from pads and vias.
     * @param {object} sceneDescription Prepared scene description.
     * @returns {number[][][]}
     */
    static #primitiveHoleLoops(sceneDescription) {
        const detail = sceneDescription?.detail || {}
        return [
            ...PcbAssemblyBoardSubstrateBuilder.#array(detail.pads).map((pad) =>
                PcbAssemblyBoardSubstrateBuilder.#padHoleLoop(pad)
            ),
            ...PcbAssemblyBoardSubstrateBuilder.#array(detail.vias).map((via) =>
                PcbAssemblyBoardSubstrateBuilder.#viaHoleLoop(via)
            )
        ].filter(Boolean)
    }

    /**
     * Builds a fallback pad drill loop.
     * @param {object} pad Pad primitive.
     * @returns {number[][] | null}
     */
    static #padHoleLoop(pad) {
        const diameter = PcbAssemblyBoardSubstrateBuilder.#firstPositive([
            pad?.holeDiameter,
            pad?.drillDiameter,
            pad?.holeSize,
            pad?.drill,
            pad?.holeGeometry?.diameter,
            pad?.holeGeometry?.width
        ])
        if (!diameter) {
            return null
        }

        const x = Number(pad?.x)
        const y = Number(pad?.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return null
        }

        const slotLength = PcbAssemblyBoardSubstrateBuilder.#firstPositive([
            pad?.holeSlotLength,
            pad?.slotLength,
            pad?.holeGeometry?.slotLength,
            pad?.holeGeometry?.length
        ])
        if (slotLength > diameter) {
            return PcbAssemblyBoardSubstrateBuilder.#rotatedPoints(
                PcbAssemblyMeshUtils.capsulePoints(
                    x - (slotLength - diameter) / 2,
                    y,
                    x + (slotLength - diameter) / 2,
                    y,
                    diameter / 2
                ),
                x,
                y,
                Number(pad?.holeRotation ?? pad?.rotation ?? 0)
            )
        }

        return PcbAssemblyMeshUtils.circlePoints(x, y, diameter / 2, 24)
    }

    /**
     * Builds a fallback via drill loop.
     * @param {object} via Via primitive.
     * @returns {number[][] | null}
     */
    static #viaHoleLoop(via) {
        const diameter = PcbAssemblyBoardSubstrateBuilder.#firstPositive([
            via?.holeDiameter,
            via?.drillDiameter,
            via?.holeSize,
            via?.drill
        ])
        const x = Number(via?.x)
        const y = Number(via?.y)

        return diameter && Number.isFinite(x) && Number.isFinite(y)
            ? PcbAssemblyMeshUtils.circlePoints(x, y, diameter / 2, 24)
            : null
    }

    /**
     * Normalizes one candidate hole contour.
     * @param {Array<object | number[]>} loop Candidate loop.
     * @returns {number[][]}
     */
    static #normalizeHoleLoop(loop) {
        const points = PcbAssemblyMeshUtils.cleanLoop(
            PcbAssemblyBoardSubstrateBuilder.#array(loop).map((point) => [
                Number(point?.x ?? point?.[0]),
                Number(point?.y ?? point?.[1])
            ])
        )

        return PcbAssemblyBoardSubstrateBuilder.#simplifyLoop(points)
    }

    /**
     * Reduces very dense circular cutouts to export-friendly loops.
     * @param {number[][]} loop Source loop.
     * @returns {number[][]}
     */
    static #simplifyLoop(loop) {
        if (loop.length <= MAX_HOLE_POINTS) {
            return loop
        }

        const target = Math.max(MAX_HOLE_POINTS, MIN_HOLE_POINTS)
        const step = loop.length / target
        return PcbAssemblyMeshUtils.cleanLoop(
            Array.from({ length: target }, (_entry, index) => {
                return loop[Math.floor(index * step)]
            })
        )
    }

    /**
     * Rotates points around a center.
     * @param {number[][]} points Source points.
     * @param {number} centerX Center X.
     * @param {number} centerY Center Y.
     * @param {number} rotationDeg Rotation in degrees.
     * @returns {number[][]}
     */
    static #rotatedPoints(points, centerX, centerY, rotationDeg) {
        if (Math.abs(Number(rotationDeg || 0)) < GEOMETRY_EPSILON) {
            return points
        }

        const angle = (Number(rotationDeg || 0) * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        return points.map((point) => {
            const dx = point[0] - centerX
            const dy = point[1] - centerY
            return [
                centerX + dx * cos - dy * sin,
                centerY + dx * sin + dy * cos
            ]
        })
    }

    /**
     * Builds a stable duplicate key for one hole loop.
     * @param {number[][]} loop Hole loop.
     * @returns {string}
     */
    static #holeSignature(loop) {
        const bounds = PcbAssemblyBoardSubstrateBuilder.#bounds(loop)
        return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY]
            .map((value) => String(Math.round(value * 10) / 10))
            .join(':')
    }

    /**
     * Computes point bounds.
     * @param {number[][]} points Points.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #bounds(points) {
        return points.reduce(
            (bounds, point) => ({
                minX: Math.min(bounds.minX, point[0]),
                minY: Math.min(bounds.minY, point[1]),
                maxX: Math.max(bounds.maxX, point[0]),
                maxY: Math.max(bounds.maxY, point[1])
            }),
            {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        )
    }

    /**
     * Computes a polygon centroid approximation.
     * @param {number[][]} points Polygon points.
     * @returns {number[]}
     */
    static #centroid(points) {
        return [
            points.reduce((sum, point) => sum + point[0], 0) / points.length,
            points.reduce((sum, point) => sum + point[1], 0) / points.length
        ]
    }

    /**
     * Computes signed polygon area.
     * @param {number[][]} points Polygon points.
     * @returns {number}
     */
    static #signedArea(points) {
        let area = 0
        for (let index = 0; index < points.length; index += 1) {
            const current = points[index]
            const next = points[(index + 1) % points.length]
            area += current[0] * next[1] - next[0] * current[1]
        }
        return area / 2
    }

    /**
     * Tests whether a point lies inside a polygon.
     * @param {number[]} point Candidate point.
     * @param {number[][]} polygon Polygon points.
     * @returns {boolean}
     */
    static #pointInPolygon(point, polygon) {
        let inside = false

        for (
            let index = 0, previous = polygon.length - 1;
            index < polygon.length;
            previous = index, index += 1
        ) {
            const currentPoint = polygon[index]
            const previousPoint = polygon[previous]
            const crosses =
                currentPoint[1] > point[1] !== previousPoint[1] > point[1]
            const xAtY =
                ((previousPoint[0] - currentPoint[0]) *
                    (point[1] - currentPoint[1])) /
                    (previousPoint[1] - currentPoint[1]) +
                currentPoint[0]

            if (crosses && point[0] < xAtY) {
                inside = !inside
            }
        }

        return inside
    }

    /**
     * Returns the first positive finite number.
     * @param {unknown[]} values Candidate values.
     * @returns {number}
     */
    static #firstPositive(values) {
        for (const value of values) {
            const number = Number(value)
            if (Number.isFinite(number) && number > 0) {
                return number
            }
        }

        return 0
    }

    /**
     * Normalizes a value to an array.
     * @param {unknown} value Candidate value.
     * @returns {any[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
