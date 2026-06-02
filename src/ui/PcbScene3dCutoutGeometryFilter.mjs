/**
 * Clips filled 2D geometry against drill-cutout polygons.
 */
export class PcbScene3dCutoutGeometryFilter {
    static #GEOMETRY_EPSILON = 0.001
    static #DEFAULT_MAX_DEPTH = 9
    static #DEFAULT_MAX_EDGE_LENGTH = 4

    /**
     * Removes triangles that still overlap cutouts after triangulation.
     * @param {any} THREE
     * @param {any} geometry
     * @param {{ x: number, y: number }[][]} cutouts
     * @param {{ maxDepth?: number, maxEdgeLength?: number }} [options]
     * @returns {any}
     */
    static filter(THREE, geometry, cutouts, options = {}) {
        if (
            !Array.isArray(cutouts) ||
            !cutouts.length ||
            !geometry?.getAttribute ||
            !THREE.BufferGeometry ||
            !THREE.Float32BufferAttribute
        ) {
            return geometry
        }

        const sourceGeometry =
            geometry.index && geometry.toNonIndexed
                ? geometry.toNonIndexed()
                : geometry
        const position = sourceGeometry.getAttribute('position')
        if (!position?.count) {
            return geometry
        }

        const preparedCutouts =
            PcbScene3dCutoutGeometryFilter.#prepareCutouts(cutouts)
        const settings =
            PcbScene3dCutoutGeometryFilter.#resolveSettings(options)
        const positions = []
        const state = { changed: false }
        for (let index = 0; index < position.count; index += 3) {
            const triangle =
                PcbScene3dCutoutGeometryFilter.#resolveGeometryTriangle(
                    position,
                    index
                )
            PcbScene3dCutoutGeometryFilter.#appendFilteredTriangle(
                positions,
                triangle,
                preparedCutouts,
                settings,
                0,
                state
            )
        }

        if (!state.changed) {
            return geometry
        }

        const filteredGeometry = new THREE.BufferGeometry()
        filteredGeometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        )
        filteredGeometry.computeVertexNormals?.()
        return filteredGeometry
    }

    /**
     * Resolves clipping settings.
     * @param {{ maxDepth?: number, maxEdgeLength?: number }} options
     * @returns {{ maxDepth: number, maxEdgeLength: number }}
     */
    static #resolveSettings(options) {
        return {
            maxDepth: Math.max(
                Number(options?.maxDepth) ||
                    PcbScene3dCutoutGeometryFilter.#DEFAULT_MAX_DEPTH,
                0
            ),
            maxEdgeLength: Math.max(
                Number(options?.maxEdgeLength) ||
                    PcbScene3dCutoutGeometryFilter.#DEFAULT_MAX_EDGE_LENGTH,
                PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON
            )
        }
    }

    /**
     * Prepares cutout polygons with bounds for fast overlap checks.
     * @param {{ x: number, y: number }[][]} cutouts
     * @returns {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } }[]}
     */
    static #prepareCutouts(cutouts) {
        return cutouts
            .filter((cutout) => Array.isArray(cutout) && cutout.length >= 3)
            .map((cutout) => ({
                points: cutout,
                bounds: PcbScene3dCutoutGeometryFilter.#resolveBounds(cutout)
            }))
    }

    /**
     * Appends a triangle, subdividing near cutouts before removal.
     * @param {number[]} positions
     * @param {{ x: number, y: number, z: number }[]} triangle
     * @param {{ points: { x: number, y: number }[], bounds: { minX: number, maxX: number, minY: number, maxY: number } }[]} cutouts
     * @param {{ maxDepth: number, maxEdgeLength: number }} settings
     * @param {number} depth
     * @param {{ changed: boolean }} state
     * @returns {void}
     */
    static #appendFilteredTriangle(
        positions,
        triangle,
        cutouts,
        settings,
        depth,
        state
    ) {
        const triangleBounds =
            PcbScene3dCutoutGeometryFilter.#resolveBounds(triangle)
        const overlappingCutouts = cutouts.filter(
            (cutout) =>
                PcbScene3dCutoutGeometryFilter.#boundsOverlap(
                    triangleBounds,
                    cutout.bounds
                ) &&
                PcbScene3dCutoutGeometryFilter.#doesTriangleOverlapPolygon(
                    triangle,
                    cutout.points
                )
        )

        if (!overlappingCutouts.length) {
            PcbScene3dCutoutGeometryFilter.#appendTriangle(positions, triangle)
            return
        }

        state.changed = true

        if (
            depth >= settings.maxDepth ||
            PcbScene3dCutoutGeometryFilter.#maxEdgeLength(triangle) <=
                settings.maxEdgeLength
        ) {
            return
        }

        PcbScene3dCutoutGeometryFilter.#subdivideTriangle(triangle).forEach(
            (childTriangle) => {
                PcbScene3dCutoutGeometryFilter.#appendFilteredTriangle(
                    positions,
                    childTriangle,
                    overlappingCutouts,
                    settings,
                    depth + 1,
                    state
                )
            }
        )
    }

    /**
     * Appends one triangle to the flattened position buffer.
     * @param {number[]} positions
     * @param {{ x: number, y: number, z: number }[]} triangle
     * @returns {void}
     */
    static #appendTriangle(positions, triangle) {
        triangle.forEach((point) => {
            positions.push(point.x, point.y, point.z)
        })
    }

    /**
     * Splits one triangle into four child triangles.
     * @param {{ x: number, y: number, z: number }[]} triangle
     * @returns {{ x: number, y: number, z: number }[][]}
     */
    static #subdivideTriangle(triangle) {
        const [first, second, third] = triangle
        const firstSecond = PcbScene3dCutoutGeometryFilter.#midpoint(
            first,
            second
        )
        const secondThird = PcbScene3dCutoutGeometryFilter.#midpoint(
            second,
            third
        )
        const thirdFirst = PcbScene3dCutoutGeometryFilter.#midpoint(
            third,
            first
        )

        return [
            [first, firstSecond, thirdFirst],
            [firstSecond, second, secondThird],
            [thirdFirst, secondThird, third],
            [firstSecond, secondThird, thirdFirst]
        ]
    }

    /**
     * Resolves the midpoint between two 3D points.
     * @param {{ x: number, y: number, z: number }} first
     * @param {{ x: number, y: number, z: number }} second
     * @returns {{ x: number, y: number, z: number }}
     */
    static #midpoint(first, second) {
        return {
            x: (first.x + second.x) / 2,
            y: (first.y + second.y) / 2,
            z: (first.z + second.z) / 2
        }
    }

    /**
     * Resolves the longest edge in one triangle.
     * @param {{ x: number, y: number }[]} triangle
     * @returns {number}
     */
    static #maxEdgeLength(triangle) {
        return Math.max(
            ...triangle.map((point, index) => {
                const next = triangle[(index + 1) % triangle.length]

                return Math.hypot(point.x - next.x, point.y - next.y)
            })
        )
    }

    /**
     * Resolves a polygon or triangle bounding box.
     * @param {{ x: number, y: number }[]} points
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    static #resolveBounds(points) {
        return points.reduce(
            (bounds, point) => ({
                minX: Math.min(bounds.minX, Number(point.x || 0)),
                maxX: Math.max(bounds.maxX, Number(point.x || 0)),
                minY: Math.min(bounds.minY, Number(point.y || 0)),
                maxY: Math.max(bounds.maxY, Number(point.y || 0))
            }),
            {
                minX: Infinity,
                maxX: -Infinity,
                minY: Infinity,
                maxY: -Infinity
            }
        )
    }

    /**
     * Returns true when two bounding boxes overlap.
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} first
     * @param {{ minX: number, maxX: number, minY: number, maxY: number }} second
     * @returns {boolean}
     */
    static #boundsOverlap(first, second) {
        return (
            first.minX <= second.maxX &&
            first.maxX >= second.minX &&
            first.minY <= second.maxY &&
            first.maxY >= second.minY
        )
    }

    /**
     * Resolves one XY triangle from a geometry position attribute.
     * @param {any} position
     * @param {number} startIndex
     * @returns {{ x: number, y: number, z: number }[]}
     */
    static #resolveGeometryTriangle(position, startIndex) {
        return [0, 1, 2].map((offset) => {
            const index = startIndex + offset

            return {
                x: Number(position.getX(index)),
                y: Number(position.getY(index)),
                z: Number(position.getZ?.(index) || 0)
            }
        })
    }

    /**
     * Returns true when one triangle intersects or covers a polygon.
     * @param {{ x: number, y: number }[]} triangle
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #doesTriangleOverlapPolygon(triangle, polygon) {
        if (
            !Array.isArray(triangle) ||
            triangle.length !== 3 ||
            !Array.isArray(polygon) ||
            polygon.length < 3
        ) {
            return false
        }

        return (
            triangle.some((point) =>
                PcbScene3dCutoutGeometryFilter.#isPointInsideOrOnPolygon(
                    point,
                    polygon
                )
            ) ||
            polygon.some((point) =>
                PcbScene3dCutoutGeometryFilter.#isPointInsideOrOnTriangle(
                    point,
                    triangle
                )
            ) ||
            PcbScene3dCutoutGeometryFilter.#hasIntersectingEdges(
                triangle,
                polygon
            )
        )
    }

    /**
     * Returns true when a point is inside or on a polygon.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #isPointInsideOrOnPolygon(point, polygon) {
        return (
            PcbScene3dCutoutGeometryFilter.#isPointOnPolygonBoundary(
                point,
                polygon
            ) ||
            PcbScene3dCutoutGeometryFilter.#isPointStrictlyInsidePolygon(
                point,
                polygon
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
            PcbScene3dCutoutGeometryFilter.#isPointOnPolygonBoundary(
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
            PcbScene3dCutoutGeometryFilter.#isPointOnSegment(
                point,
                start,
                polygon[(index + 1) % polygon.length]
            )
        )
    }

    /**
     * Returns true when a point is inside or on one triangle.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} triangle
     * @returns {boolean}
     */
    static #isPointInsideOrOnTriangle(point, triangle) {
        const signs = triangle.map((current, index) => {
            const next = triangle[(index + 1) % triangle.length]
            return PcbScene3dCutoutGeometryFilter.#cross(point, current, next)
        })
        const hasNegative = signs.some(
            (sign) => sign < -PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON
        )
        const hasPositive = signs.some(
            (sign) => sign > PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON
        )

        return !(hasNegative && hasPositive)
    }

    /**
     * Returns true when any triangle and polygon edges intersect.
     * @param {{ x: number, y: number }[]} triangle
     * @param {{ x: number, y: number }[]} polygon
     * @returns {boolean}
     */
    static #hasIntersectingEdges(triangle, polygon) {
        return triangle.some((triangleStart, triangleIndex) => {
            const triangleEnd = triangle[(triangleIndex + 1) % triangle.length]

            return polygon.some((polygonStart, polygonIndex) =>
                PcbScene3dCutoutGeometryFilter.#segmentsIntersect(
                    triangleStart,
                    triangleEnd,
                    polygonStart,
                    polygon[(polygonIndex + 1) % polygon.length]
                )
            )
        })
    }

    /**
     * Returns true when two finite line segments intersect.
     * @param {{ x: number, y: number }} firstStart
     * @param {{ x: number, y: number }} firstEnd
     * @param {{ x: number, y: number }} secondStart
     * @param {{ x: number, y: number }} secondEnd
     * @returns {boolean}
     */
    static #segmentsIntersect(firstStart, firstEnd, secondStart, secondEnd) {
        const firstOrientation = PcbScene3dCutoutGeometryFilter.#cross(
            firstStart,
            firstEnd,
            secondStart
        )
        const secondOrientation = PcbScene3dCutoutGeometryFilter.#cross(
            firstStart,
            firstEnd,
            secondEnd
        )
        const thirdOrientation = PcbScene3dCutoutGeometryFilter.#cross(
            secondStart,
            secondEnd,
            firstStart
        )
        const fourthOrientation = PcbScene3dCutoutGeometryFilter.#cross(
            secondStart,
            secondEnd,
            firstEnd
        )

        if (
            PcbScene3dCutoutGeometryFilter.#hasOppositeSigns(
                firstOrientation,
                secondOrientation
            ) &&
            PcbScene3dCutoutGeometryFilter.#hasOppositeSigns(
                thirdOrientation,
                fourthOrientation
            )
        ) {
            return true
        }

        return (
            PcbScene3dCutoutGeometryFilter.#isCollinearPointOnSegment(
                secondStart,
                firstStart,
                firstEnd,
                firstOrientation
            ) ||
            PcbScene3dCutoutGeometryFilter.#isCollinearPointOnSegment(
                secondEnd,
                firstStart,
                firstEnd,
                secondOrientation
            ) ||
            PcbScene3dCutoutGeometryFilter.#isCollinearPointOnSegment(
                firstStart,
                secondStart,
                secondEnd,
                thirdOrientation
            ) ||
            PcbScene3dCutoutGeometryFilter.#isCollinearPointOnSegment(
                firstEnd,
                secondStart,
                secondEnd,
                fourthOrientation
            )
        )
    }

    /**
     * Returns true when two signed areas are meaningfully opposite.
     * @param {number} first
     * @param {number} second
     * @returns {boolean}
     */
    static #hasOppositeSigns(first, second) {
        return (
            (first > PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON &&
                second < -PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON) ||
            (first < -PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON &&
                second > PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON)
        )
    }

    /**
     * Returns true when a collinear point lies on a segment.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @param {number} orientation
     * @returns {boolean}
     */
    static #isCollinearPointOnSegment(point, start, end, orientation) {
        return (
            Math.abs(orientation) <=
                PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON &&
            PcbScene3dCutoutGeometryFilter.#isPointOnSegment(point, start, end)
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

        if (
            Math.abs(cross) > PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON
        ) {
            return false
        }

        const dot =
            (point.x - start.x) * (end.x - start.x) +
            (point.y - start.y) * (end.y - start.y)

        if (dot < -PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON) {
            return false
        }

        const lengthSquared = (end.x - start.x) ** 2 + (end.y - start.y) ** 2

        return (
            dot <=
            lengthSquared + PcbScene3dCutoutGeometryFilter.#GEOMETRY_EPSILON
        )
    }

    /**
     * Resolves the signed area for three points.
     * @param {{ x: number, y: number }} first
     * @param {{ x: number, y: number }} second
     * @param {{ x: number, y: number }} third
     * @returns {number}
     */
    static #cross(first, second, third) {
        return (
            (second.x - first.x) * (third.y - first.y) -
            (second.y - first.y) * (third.x - first.x)
        )
    }
}
