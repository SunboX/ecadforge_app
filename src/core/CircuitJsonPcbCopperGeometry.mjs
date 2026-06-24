/**
 * Computes copper-to-copper distances from normalized PCB primitives.
 */
export class CircuitJsonPcbCopperGeometry {
    /**
     * Resolves the nearest edge clearance between two copper primitives.
     * @param {object} left First primitive.
     * @param {object} right Second primitive.
     * @returns {number | null}
     */
    static clearance(left, right) {
        const leftShapes = CircuitJsonPcbCopperGeometry.#shapes(left)
        const rightShapes = CircuitJsonPcbCopperGeometry.#shapes(right)
        if (!leftShapes.length || !rightShapes.length) return null

        let best = Infinity
        for (const leftShape of leftShapes) {
            for (const rightShape of rightShapes) {
                best = Math.min(
                    best,
                    CircuitJsonPcbCopperGeometry.#shapeDistance(
                        leftShape,
                        rightShape
                    )
                )
            }
        }

        return Number.isFinite(best) ? Math.max(best, 0) : null
    }

    /**
     * Builds copper shapes for one primitive.
     * @param {object} primitive Primitive row.
     * @returns {object[]}
     */
    static #shapes(primitive) {
        if (primitive.kind === 'track') {
            return [
                {
                    type: 'capsule',
                    start: { x: primitive.x1, y: primitive.y1 },
                    end: { x: primitive.x2, y: primitive.y2 },
                    radius: Number(primitive.width || 0) / 2
                }
            ]
        }
        if (primitive.kind === 'via') {
            return [
                {
                    type: 'circle',
                    center: { x: primitive.x, y: primitive.y },
                    radius: Number(primitive.diameter || 0) / 2
                }
            ]
        }
        if (primitive.kind === 'zone') {
            return CircuitJsonPcbCopperGeometry.#polygonShape(primitive.points)
        }
        if (primitive.kind === 'pad') {
            return CircuitJsonPcbCopperGeometry.#padShapes(primitive)
        }
        return []
    }

    /**
     * Builds copper shapes for a pad primitive.
     * @param {object} primitive Pad primitive.
     * @returns {object[]}
     */
    static #padShapes(primitive) {
        const shape = String(primitive.shape || 'rect').toLowerCase()
        if (shape === 'circle') {
            return [
                {
                    type: 'circle',
                    center: { x: primitive.x, y: primitive.y },
                    radius:
                        Math.max(
                            Number(primitive.width || 0),
                            Number(primitive.height || 0)
                        ) / 2
                }
            ]
        }
        if (shape === 'pill' || shape === 'rotated_pill') {
            return [
                CircuitJsonPcbCopperGeometry.#pillShape(
                    primitive,
                    shape === 'rotated_pill'
                )
            ]
        }
        if (shape === 'polygon') {
            return CircuitJsonPcbCopperGeometry.#polygonShape(primitive.points)
        }
        return [
            {
                type: 'polygon',
                points: CircuitJsonPcbCopperGeometry.#rectPoints(primitive)
            }
        ]
    }

    /**
     * Builds a capsule for a pill pad.
     * @param {object} primitive Pad primitive.
     * @param {boolean} forceRotation Whether rotation should be applied.
     * @returns {object}
     */
    static #pillShape(primitive, forceRotation) {
        const width = Number(primitive.width || primitive.bounds?.width || 0)
        const height = Number(primitive.height || primitive.bounds?.height || 0)
        const radius = Math.min(width, height) / 2
        const run = Math.max(width, height) / 2 - radius
        const angle =
            ((forceRotation ? Number(primitive.rotation || 0) : 0) * Math.PI) /
            180
        const axis = width >= height ? 0 : Math.PI / 2
        const dx = Math.cos(angle + axis) * run
        const dy = Math.sin(angle + axis) * run
        return {
            type: 'capsule',
            start: { x: Number(primitive.x) - dx, y: Number(primitive.y) - dy },
            end: { x: Number(primitive.x) + dx, y: Number(primitive.y) + dy },
            radius
        }
    }

    /**
     * Builds a polygon shape when enough points are present.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #polygonShape(points) {
        const normalized = (Array.isArray(points) ? points : [])
            .map((point) => ({
                x: Number(point?.x),
                y: Number(point?.y)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
        return normalized.length >= 3
            ? [{ type: 'polygon', points: normalized }]
            : []
    }

    /**
     * Builds rotated rectangle corner points.
     * @param {object} primitive Rectangular primitive.
     * @returns {{ x: number, y: number }[]}
     */
    static #rectPoints(primitive) {
        const center = { x: Number(primitive.x), y: Number(primitive.y) }
        const width = Number(primitive.width || primitive.bounds?.width || 0)
        const height = Number(primitive.height || primitive.bounds?.height || 0)
        const angle = (Number(primitive.rotation || 0) * Math.PI) / 180
        return [
            { x: -width / 2, y: -height / 2 },
            { x: width / 2, y: -height / 2 },
            { x: width / 2, y: height / 2 },
            { x: -width / 2, y: height / 2 }
        ].map((point) => ({
            x: center.x + point.x * Math.cos(angle) - point.y * Math.sin(angle),
            y: center.y + point.x * Math.sin(angle) + point.y * Math.cos(angle)
        }))
    }

    /**
     * Computes distance between two primitive shapes.
     * @param {object} left First shape.
     * @param {object} right Second shape.
     * @returns {number}
     */
    static #shapeDistance(left, right) {
        if (left.type === 'circle' && right.type === 'circle') {
            return (
                CircuitJsonPcbCopperGeometry.#pointDistance(
                    left.center,
                    right.center
                ) -
                left.radius -
                right.radius
            )
        }
        if (left.type === 'capsule' && right.type === 'capsule') {
            return (
                CircuitJsonPcbCopperGeometry.#segmentDistance(
                    left.start,
                    left.end,
                    right.start,
                    right.end
                ) -
                left.radius -
                right.radius
            )
        }
        if (left.type === 'circle' && right.type === 'capsule') {
            return CircuitJsonPcbCopperGeometry.#circleCapsuleDistance(
                left,
                right
            )
        }
        if (left.type === 'capsule' && right.type === 'circle') {
            return CircuitJsonPcbCopperGeometry.#circleCapsuleDistance(
                right,
                left
            )
        }
        if (left.type === 'polygon' && right.type === 'polygon') {
            return CircuitJsonPcbCopperGeometry.#polygonDistance(
                left.points,
                right.points
            )
        }
        if (left.type === 'circle' && right.type === 'polygon') {
            return CircuitJsonPcbCopperGeometry.#circlePolygonDistance(
                left,
                right.points
            )
        }
        if (left.type === 'polygon' && right.type === 'circle') {
            return CircuitJsonPcbCopperGeometry.#circlePolygonDistance(
                right,
                left.points
            )
        }
        if (left.type === 'capsule' && right.type === 'polygon') {
            return CircuitJsonPcbCopperGeometry.#capsulePolygonDistance(
                left,
                right.points
            )
        }
        return CircuitJsonPcbCopperGeometry.#capsulePolygonDistance(
            right,
            left.points
        )
    }

    /**
     * Computes circle-to-capsule edge distance.
     * @param {object} circle Circle shape.
     * @param {object} capsule Capsule shape.
     * @returns {number}
     */
    static #circleCapsuleDistance(circle, capsule) {
        return (
            CircuitJsonPcbCopperGeometry.#pointSegmentDistance(
                circle.center,
                capsule.start,
                capsule.end
            ) -
            circle.radius -
            capsule.radius
        )
    }

    /**
     * Computes circle-to-polygon edge distance.
     * @param {object} circle Circle shape.
     * @param {object[]} polygon Polygon points.
     * @returns {number}
     */
    static #circlePolygonDistance(circle, polygon) {
        if (CircuitJsonPcbCopperGeometry.#pointInPolygon(circle.center, polygon)) {
            return 0
        }
        return (
            Math.min(
                ...CircuitJsonPcbCopperGeometry.#edges(polygon).map((edge) =>
                    CircuitJsonPcbCopperGeometry.#pointSegmentDistance(
                        circle.center,
                        edge[0],
                        edge[1]
                    )
                )
            ) - circle.radius
        )
    }

    /**
     * Computes capsule-to-polygon edge distance.
     * @param {object} capsule Capsule shape.
     * @param {object[]} polygon Polygon points.
     * @returns {number}
     */
    static #capsulePolygonDistance(capsule, polygon) {
        if (
            CircuitJsonPcbCopperGeometry.#pointInPolygon(
                capsule.start,
                polygon
            ) ||
            CircuitJsonPcbCopperGeometry.#pointInPolygon(capsule.end, polygon)
        ) {
            return 0
        }
        const distance = Math.min(
            ...CircuitJsonPcbCopperGeometry.#edges(polygon).map((edge) =>
                CircuitJsonPcbCopperGeometry.#segmentDistance(
                    capsule.start,
                    capsule.end,
                    edge[0],
                    edge[1]
                )
            )
        )
        return distance - capsule.radius
    }

    /**
     * Computes polygon-to-polygon edge distance.
     * @param {object[]} left First polygon.
     * @param {object[]} right Second polygon.
     * @returns {number}
     */
    static #polygonDistance(left, right) {
        if (
            left.some((point) =>
                CircuitJsonPcbCopperGeometry.#pointInPolygon(point, right)
            ) ||
            right.some((point) =>
                CircuitJsonPcbCopperGeometry.#pointInPolygon(point, left)
            )
        ) {
            return 0
        }
        return Math.min(
            ...CircuitJsonPcbCopperGeometry.#edges(left).flatMap((leftEdge) =>
                CircuitJsonPcbCopperGeometry.#edges(right).map((rightEdge) =>
                    CircuitJsonPcbCopperGeometry.#segmentDistance(
                        leftEdge[0],
                        leftEdge[1],
                        rightEdge[0],
                        rightEdge[1]
                    )
                )
            )
        )
    }

    /**
     * Builds polygon edge pairs.
     * @param {object[]} points Polygon points.
     * @returns {object[][]}
     */
    static #edges(points) {
        return points.map((point, index) => [
            point,
            points[(index + 1) % points.length]
        ])
    }

    /**
     * Computes point distance.
     * @param {object} left First point.
     * @param {object} right Second point.
     * @returns {number}
     */
    static #pointDistance(left, right) {
        return Math.hypot(Number(left.x) - Number(right.x), Number(left.y) - Number(right.y))
    }

    /**
     * Computes point-to-segment distance.
     * @param {object} point Point.
     * @param {object} start Segment start.
     * @param {object} end Segment end.
     * @returns {number}
     */
    static #pointSegmentDistance(point, start, end) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const lengthSq = dx * dx + dy * dy
        if (!lengthSq) return CircuitJsonPcbCopperGeometry.#pointDistance(point, start)
        const t = Math.max(
            0,
            Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq)
        )
        return CircuitJsonPcbCopperGeometry.#pointDistance(point, {
            x: start.x + dx * t,
            y: start.y + dy * t
        })
    }

    /**
     * Computes segment-to-segment distance.
     * @param {object} leftStart First segment start.
     * @param {object} leftEnd First segment end.
     * @param {object} rightStart Second segment start.
     * @param {object} rightEnd Second segment end.
     * @returns {number}
     */
    static #segmentDistance(leftStart, leftEnd, rightStart, rightEnd) {
        if (
            CircuitJsonPcbCopperGeometry.#segmentsIntersect(
                leftStart,
                leftEnd,
                rightStart,
                rightEnd
            )
        ) {
            return 0
        }
        return Math.min(
            CircuitJsonPcbCopperGeometry.#pointSegmentDistance(
                leftStart,
                rightStart,
                rightEnd
            ),
            CircuitJsonPcbCopperGeometry.#pointSegmentDistance(
                leftEnd,
                rightStart,
                rightEnd
            ),
            CircuitJsonPcbCopperGeometry.#pointSegmentDistance(
                rightStart,
                leftStart,
                leftEnd
            ),
            CircuitJsonPcbCopperGeometry.#pointSegmentDistance(
                rightEnd,
                leftStart,
                leftEnd
            )
        )
    }

    /**
     * Returns true when two segments intersect.
     * @param {object} leftStart First segment start.
     * @param {object} leftEnd First segment end.
     * @param {object} rightStart Second segment start.
     * @param {object} rightEnd Second segment end.
     * @returns {boolean}
     */
    static #segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd) {
        const o1 = CircuitJsonPcbCopperGeometry.#orientation(leftStart, leftEnd, rightStart)
        const o2 = CircuitJsonPcbCopperGeometry.#orientation(leftStart, leftEnd, rightEnd)
        const o3 = CircuitJsonPcbCopperGeometry.#orientation(rightStart, rightEnd, leftStart)
        const o4 = CircuitJsonPcbCopperGeometry.#orientation(rightStart, rightEnd, leftEnd)
        return o1 * o2 < 0 && o3 * o4 < 0
    }

    /**
     * Computes segment orientation.
     * @param {object} a First point.
     * @param {object} b Second point.
     * @param {object} c Third point.
     * @returns {number}
     */
    static #orientation(a, b, c) {
        return Math.sign((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x))
    }

    /**
     * Returns true when a point is inside a polygon.
     * @param {object} point Point.
     * @param {object[]} polygon Polygon points.
     * @returns {boolean}
     */
    static #pointInPolygon(point, polygon) {
        let inside = false
        for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index, index += 1) {
            const a = polygon[index]
            const b = polygon[previous]
            const intersects =
                a.y > point.y !== b.y > point.y &&
                point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
            if (intersects) inside = !inside
        }
        return inside
    }
}
