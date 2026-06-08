/**
 * Builds rounded outer-contour notches for drills that intersect board edges.
 */
export class PcbScene3dBoardEdgeCutoutBuilder {
    static #OUTER_SAMPLE_POINTS = 160
    static #EDGE_CUTOUT_SAMPLE_POINTS = 72
    static #GEOMETRY_EPSILON = 0.001

    /**
     * Resolves sampled points from one shape outline.
     * @param {{ getPoints?: (segments: number) => { x: number, y: number }[] }} shape
     * @returns {{ x: number, y: number }[]}
     */
    static resolveShapePoints(shape) {
        return PcbScene3dBoardEdgeCutoutBuilder.#dedupeAdjacentPoints(
            (shape?.getPoints?.(
                PcbScene3dBoardEdgeCutoutBuilder.#OUTER_SAMPLE_POINTS
            ) || []).map((point) => ({
                x: Number(point.x || 0),
                y: Number(point.y || 0)
            }))
        )
    }

    /**
     * Builds one closed shape from sampled outline points.
     * @param {any} THREE
     * @param {{ x: number, y: number }[]} points
     * @returns {any}
     */
    static buildShapeFromPoints(THREE, points) {
        const shape = new THREE.Shape()
        const dedupedPoints =
            PcbScene3dBoardEdgeCutoutBuilder.#dedupeAdjacentPoints(points)

        if (!dedupedPoints.length) {
            return shape
        }

        shape.moveTo(dedupedPoints[0].x, dedupedPoints[0].y)
        for (let index = 1; index < dedupedPoints.length; index += 1) {
            shape.lineTo(dedupedPoints[index].x, dedupedPoints[index].y)
        }

        shape.closePath()
        return shape
    }

    /**
     * Builds uniformly sampled points for a circular drill cutout.
     * @param {number} centerX Drill center X.
     * @param {number} centerY Drill center Y.
     * @param {number} radius Drill radius.
     * @returns {{ x: number, y: number }[]}
     */
    static buildCircularCutoutPoints(centerX, centerY, radius) {
        return Array.from(
            {
                length:
                    PcbScene3dBoardEdgeCutoutBuilder.#EDGE_CUTOUT_SAMPLE_POINTS
            },
            (_, index) => {
                const angle =
                    (Math.PI * 2 * index) /
                    PcbScene3dBoardEdgeCutoutBuilder.#EDGE_CUTOUT_SAMPLE_POINTS

                return {
                    x: centerX + Math.cos(angle) * radius,
                    y: centerY + Math.sin(angle) * radius
                }
            }
        )
    }

    /**
     * Applies circular cutouts that cross the board outline as rounded notches.
     * @param {{ x: number, y: number }[]} contourPoints
     * @param {{ centerX: number, centerY: number, radius: number }[]} cutouts
     * @returns {{ x: number, y: number }[]}
     */
    static applyCircularEdgeCutouts(contourPoints, cutouts) {
        return cutouts.reduce(
            (points, cutout) =>
                PcbScene3dBoardEdgeCutoutBuilder.#applyCircularEdgeCutout(
                    points,
                    cutout
                ),
            contourPoints
        )
    }

    /**
     * Returns true when a cutout can safely be added as a shape hole.
     * @param {{ x: number, y: number }[]} hole
     * @param {{ x: number, y: number }[]} contour
     * @returns {boolean}
     */
    static isHoleInsideContour(hole, contour) {
        return (
            Array.isArray(hole) &&
            Array.isArray(contour) &&
            hole.length >= 3 &&
            contour.length >= 3 &&
            hole.every((point) =>
                PcbScene3dBoardEdgeCutoutBuilder.#isPointStrictlyInsidePolygon(
                    point,
                    contour
                )
            )
        )
    }

    /**
     * Applies one circular cutout that intersects the board outline.
     * @param {{ x: number, y: number }[]} contourPoints
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @returns {{ x: number, y: number }[]}
     */
    static #applyCircularEdgeCutout(contourPoints, cutout) {
        const contour =
            PcbScene3dBoardEdgeCutoutBuilder.#dedupeAdjacentPoints(
                contourPoints
            )
        const intersections =
            PcbScene3dBoardEdgeCutoutBuilder.#resolveContourCircleIntersections(
                contour,
                cutout
            )

        if (intersections.length !== 2) {
            return contour
        }

        const [first, second] = intersections
        const firstSpanInside =
            PcbScene3dBoardEdgeCutoutBuilder.#isContourSpanInsideCircle(
                contour,
                first,
                second,
                cutout
            )
        const insideStart = firstSpanInside ? first : second
        const insideEnd = firstSpanInside ? second : first
        const outsidePath = PcbScene3dBoardEdgeCutoutBuilder.#collectContourSpan(
            contour,
            insideEnd,
            insideStart
        )
        const arcPoints =
            PcbScene3dBoardEdgeCutoutBuilder.#buildInteriorArcPoints(
                contour,
                cutout,
                insideStart.point,
                insideEnd.point
            )

        return PcbScene3dBoardEdgeCutoutBuilder.#dedupeAdjacentPoints([
            ...outsidePath,
            ...arcPoints.slice(1)
        ])
    }

    /**
     * Resolves circle intersections along one contour.
     * @param {{ x: number, y: number }[]} contour
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @returns {{ segmentIndex: number, t: number, point: { x: number, y: number } }[]}
     */
    static #resolveContourCircleIntersections(contour, cutout) {
        const intersections = []

        for (let index = 0; index < contour.length; index += 1) {
            const start = contour[index]
            const end = contour[(index + 1) % contour.length]
            PcbScene3dBoardEdgeCutoutBuilder
                .#resolveSegmentCircleIntersections(start, end, cutout)
                .forEach((intersection) => {
                    intersections.push({
                        segmentIndex: index,
                        t: intersection.t,
                        point: intersection.point
                    })
                })
        }

        return PcbScene3dBoardEdgeCutoutBuilder.#dedupeIntersections(
            intersections
        )
            .sort(
                (first, second) =>
                    first.segmentIndex - second.segmentIndex ||
                    first.t - second.t
            )
            .slice(0, 2)
    }

    /**
     * Resolves circle intersections on one segment.
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @returns {{ t: number, point: { x: number, y: number } }[]}
     */
    static #resolveSegmentCircleIntersections(start, end, cutout) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const fx = start.x - cutout.centerX
        const fy = start.y - cutout.centerY
        const a = dx * dx + dy * dy
        const b = 2 * (fx * dx + fy * dy)
        const c = fx * fx + fy * fy - cutout.radius * cutout.radius
        const discriminant = b * b - 4 * a * c

        if (
            a <= PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON ||
            discriminant < 0
        ) {
            return []
        }

        const root = Math.sqrt(discriminant)
        return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
            .filter(
                (t) =>
                    t >=
                        -PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON &&
                    t <= 1 + PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
            )
            .map((t) => ({
                t: Math.max(0, Math.min(1, t)),
                point: {
                    x: start.x + dx * t,
                    y: start.y + dy * t
                }
            }))
    }

    /**
     * Removes duplicated circle intersections.
     * @param {{ segmentIndex: number, t: number, point: { x: number, y: number } }[]} intersections
     * @returns {{ segmentIndex: number, t: number, point: { x: number, y: number } }[]}
     */
    static #dedupeIntersections(intersections) {
        return intersections.filter(
            (intersection, index) =>
                intersections.findIndex(
                    (candidate) =>
                        Math.hypot(
                            candidate.point.x - intersection.point.x,
                            candidate.point.y - intersection.point.y
                        ) <=
                        PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
                ) === index
        )
    }

    /**
     * Checks whether a contour span lies inside one circular cutout.
     * @param {{ x: number, y: number }[]} contour
     * @param {{ segmentIndex: number, t: number, point: { x: number, y: number } }} start
     * @param {{ segmentIndex: number, t: number, point: { x: number, y: number } }} end
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @returns {boolean}
     */
    static #isContourSpanInsideCircle(contour, start, end, cutout) {
        const span = PcbScene3dBoardEdgeCutoutBuilder.#collectContourSpan(
            contour,
            start,
            end
        )
        const sampleStart = span[0]
        const sampleEnd = span[1] || end.point

        return PcbScene3dBoardEdgeCutoutBuilder.#isPointInsideCircle(
            {
                x: (sampleStart.x + sampleEnd.x) / 2,
                y: (sampleStart.y + sampleEnd.y) / 2
            },
            cutout
        )
    }

    /**
     * Collects one directed contour span from start intersection to end.
     * @param {{ x: number, y: number }[]} contour
     * @param {{ segmentIndex: number, t: number, point: { x: number, y: number } }} start
     * @param {{ segmentIndex: number, t: number, point: { x: number, y: number } }} end
     * @returns {{ x: number, y: number }[]}
     */
    static #collectContourSpan(contour, start, end) {
        const points = [start.point]
        const wraps =
            start.segmentIndex > end.segmentIndex ||
            (start.segmentIndex === end.segmentIndex && start.t > end.t)
        const limit = wraps
            ? end.segmentIndex + contour.length
            : end.segmentIndex

        for (
            let index = start.segmentIndex + 1;
            index <= limit;
            index += 1
        ) {
            points.push(contour[index % contour.length])
        }

        points.push(end.point)
        return PcbScene3dBoardEdgeCutoutBuilder.#dedupeAdjacentPoints(points)
    }

    /**
     * Builds the circular arc that stays within the board contour.
     * @param {{ x: number, y: number }[]} contour
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @returns {{ x: number, y: number }[]}
     */
    static #buildInteriorArcPoints(contour, cutout, start, end) {
        const startAngle = Math.atan2(
            start.y - cutout.centerY,
            start.x - cutout.centerX
        )
        const endAngle = Math.atan2(
            end.y - cutout.centerY,
            end.x - cutout.centerX
        )
        const ccwDelta =
            PcbScene3dBoardEdgeCutoutBuilder.#normalizePositiveRadians(
                endAngle - startAngle
            )
        const cwDelta = ccwDelta - Math.PI * 2
        const selectedDelta =
            PcbScene3dBoardEdgeCutoutBuilder.#isArcMidpointInsideContour(
                contour,
                cutout,
                startAngle,
                ccwDelta
            )
                ? ccwDelta
                : cwDelta
        const segments = Math.max(
            8,
            Math.ceil(
                (Math.abs(selectedDelta) / (Math.PI * 2)) *
                    PcbScene3dBoardEdgeCutoutBuilder.#EDGE_CUTOUT_SAMPLE_POINTS
            )
        )

        return Array.from({ length: segments + 1 }, (_, index) => {
            const angle = startAngle + (selectedDelta * index) / segments

            return {
                x: cutout.centerX + Math.cos(angle) * cutout.radius,
                y: cutout.centerY + Math.sin(angle) * cutout.radius
            }
        })
    }

    /**
     * Checks whether one candidate arc midpoint is inside the board contour.
     * @param {{ x: number, y: number }[]} contour
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @param {number} startAngle
     * @param {number} delta
     * @returns {boolean}
     */
    static #isArcMidpointInsideContour(contour, cutout, startAngle, delta) {
        const angle = startAngle + delta / 2

        return PcbScene3dBoardEdgeCutoutBuilder.#isPointStrictlyInsidePolygon(
            {
                x: cutout.centerX + Math.cos(angle) * cutout.radius,
                y: cutout.centerY + Math.sin(angle) * cutout.radius
            },
            contour
        )
    }

    /**
     * Normalizes one angle into `[0, 2π)`.
     * @param {number} angle
     * @returns {number}
     */
    static #normalizePositiveRadians(angle) {
        const fullCircle = Math.PI * 2
        const normalized = angle % fullCircle

        return normalized < 0 ? normalized + fullCircle : normalized
    }

    /**
     * Returns true when a point lies inside a circular cutout.
     * @param {{ x: number, y: number }} point
     * @param {{ centerX: number, centerY: number, radius: number }} cutout
     * @returns {boolean}
     */
    static #isPointInsideCircle(point, cutout) {
        return (
            Math.hypot(point.x - cutout.centerX, point.y - cutout.centerY) <
            cutout.radius -
                PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
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
            PcbScene3dBoardEdgeCutoutBuilder.#isPointOnPolygonBoundary(
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
            PcbScene3dBoardEdgeCutoutBuilder.#isPointOnSegment(
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

        if (
            lengthSquared <
            PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
        ) {
            return (
                Math.hypot(point.x - start.x, point.y - start.y) <
                PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
            )
        }

        const cross =
            (point.y - start.y) * (end.x - start.x) -
            (point.x - start.x) * (end.y - start.y)
        if (
            Math.abs(cross) >
            PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
        ) {
            return false
        }

        const dot =
            (point.x - start.x) * (end.x - start.x) +
            (point.y - start.y) * (end.y - start.y)
        if (dot < -PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON) {
            return false
        }

        return (
            dot <=
            lengthSquared +
                PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
        )
    }

    /**
     * Removes duplicate adjacent points and an optional repeated closing point.
     * @param {{ x: number, y: number }[]} points
     * @returns {{ x: number, y: number }[]}
     */
    static #dedupeAdjacentPoints(points) {
        const deduped = []

        for (const point of Array.isArray(points) ? points : []) {
            const previous = deduped[deduped.length - 1]
            if (
                previous &&
                Math.hypot(previous.x - point.x, previous.y - point.y) <=
                    PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
            ) {
                continue
            }

            deduped.push(point)
        }

        const first = deduped[0]
        const last = deduped[deduped.length - 1]
        if (
            first &&
            last &&
            deduped.length > 1 &&
            Math.hypot(first.x - last.x, first.y - last.y) <=
                PcbScene3dBoardEdgeCutoutBuilder.#GEOMETRY_EPSILON
        ) {
            deduped.pop()
        }

        return deduped
    }
}
