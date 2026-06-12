/**
 * Resolves SVG elliptical arc path segment bounds.
 */
export class SvgArcBoundsResolver {
    /**
     * Resolves one SVG elliptical arc segment.
     * @param {{ x: number, y: number }} start Start point.
     * @param {number} rx Raw x radius.
     * @param {number} ry Raw y radius.
     * @param {number} xAxisRotation Rotation in degrees.
     * @param {number} largeArcFlag Large-arc flag.
     * @param {number} sweepFlag Sweep flag.
     * @param {{ x: number, y: number }} end End point.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static resolve(start, rx, ry, xAxisRotation, largeArcFlag, sweepFlag, end) {
        let bounds = SvgArcBoundsResolver.#includeSegmentBounds(
            null,
            start,
            end
        )
        let radiusX = Math.abs(rx)
        let radiusY = Math.abs(ry)
        if (
            radiusX <= 0 ||
            radiusY <= 0 ||
            (start.x === end.x && start.y === end.y)
        ) {
            return bounds
        }

        const radians = (xAxisRotation * Math.PI) / 180
        const cosine = Math.cos(radians)
        const sine = Math.sin(radians)
        const midpointDx = (start.x - end.x) / 2
        const midpointDy = (start.y - end.y) / 2
        const startPrime = {
            x: cosine * midpointDx + sine * midpointDy,
            y: -sine * midpointDx + cosine * midpointDy
        }
        const radiusScale =
            startPrime.x ** 2 / radiusX ** 2 + startPrime.y ** 2 / radiusY ** 2
        if (radiusScale > 1) {
            const scale = Math.sqrt(radiusScale)
            radiusX *= scale
            radiusY *= scale
        }

        const centerPrime = SvgArcBoundsResolver.#resolveCenterPrime(
            startPrime,
            radiusX,
            radiusY,
            Boolean(Number(largeArcFlag)),
            Boolean(Number(sweepFlag))
        )
        const center = {
            x:
                cosine * centerPrime.x -
                sine * centerPrime.y +
                (start.x + end.x) / 2,
            y:
                sine * centerPrime.x +
                cosine * centerPrime.y +
                (start.y + end.y) / 2
        }
        const startVector = {
            x: (startPrime.x - centerPrime.x) / radiusX,
            y: (startPrime.y - centerPrime.y) / radiusY
        }
        const endVector = {
            x: (-startPrime.x - centerPrime.x) / radiusX,
            y: (-startPrime.y - centerPrime.y) / radiusY
        }
        const startAngle = SvgArcBoundsResolver.#vectorAngle(
            { x: 1, y: 0 },
            startVector
        )
        let sweepAngle = SvgArcBoundsResolver.#vectorAngle(
            startVector,
            endVector
        )
        if (!sweepFlag && sweepAngle > 0) sweepAngle -= Math.PI * 2
        if (sweepFlag && sweepAngle < 0) sweepAngle += Math.PI * 2

        for (const angle of SvgArcBoundsResolver.#extremaAngles(
            radiusX,
            radiusY,
            radians
        )) {
            if (
                !SvgArcBoundsResolver.#angleIsInSweep(
                    angle,
                    startAngle,
                    sweepAngle
                )
            ) {
                continue
            }
            const point = SvgArcBoundsResolver.#point(
                center,
                radiusX,
                radiusY,
                radians,
                angle
            )
            bounds = SvgArcBoundsResolver.#includePoint(
                bounds,
                point.x,
                point.y
            )
        }

        return bounds
    }

    /**
     * Resolves the center point in transformed arc coordinates.
     * @param {{ x: number, y: number }} startPrime Transformed start point.
     * @param {number} radiusX Adjusted x radius.
     * @param {number} radiusY Adjusted y radius.
     * @param {boolean} largeArc Whether the large arc is selected.
     * @param {boolean} sweep Whether the sweep arc is selected.
     * @returns {{ x: number, y: number }}
     */
    static #resolveCenterPrime(startPrime, radiusX, radiusY, largeArc, sweep) {
        const numerator =
            radiusX ** 2 * radiusY ** 2 -
            radiusX ** 2 * startPrime.y ** 2 -
            radiusY ** 2 * startPrime.x ** 2
        const denominator =
            radiusX ** 2 * startPrime.y ** 2 + radiusY ** 2 * startPrime.x ** 2
        const scale =
            (largeArc === sweep ? -1 : 1) *
            Math.sqrt(Math.max(0, numerator / denominator || 0))

        return {
            x: (scale * radiusX * startPrime.y) / radiusY,
            y: (-scale * radiusY * startPrime.x) / radiusX
        }
    }

    /**
     * Resolves ellipse parameter angles where x or y reaches an extremum.
     * @param {number} radiusX Arc x radius.
     * @param {number} radiusY Arc y radius.
     * @param {number} radians Arc rotation in radians.
     * @returns {number[]}
     */
    static #extremaAngles(radiusX, radiusY, radians) {
        const xAngle = Math.atan2(
            -radiusY * Math.sin(radians),
            radiusX * Math.cos(radians)
        )
        const yAngle = Math.atan2(
            radiusY * Math.cos(radians),
            radiusX * Math.sin(radians)
        )

        return [xAngle, xAngle + Math.PI, yAngle, yAngle + Math.PI]
    }

    /**
     * Resolves one point on a rotated ellipse.
     * @param {{ x: number, y: number }} center Arc center.
     * @param {number} radiusX Arc x radius.
     * @param {number} radiusY Arc y radius.
     * @param {number} radians Arc rotation in radians.
     * @param {number} angle Ellipse parameter angle.
     * @returns {{ x: number, y: number }}
     */
    static #point(center, radiusX, radiusY, radians, angle) {
        const cosine = Math.cos(radians)
        const sine = Math.sin(radians)

        return {
            x:
                center.x +
                radiusX * Math.cos(angle) * cosine -
                radiusY * Math.sin(angle) * sine,
            y:
                center.y +
                radiusX * Math.cos(angle) * sine +
                radiusY * Math.sin(angle) * cosine
        }
    }

    /**
     * Returns true when an angle lies within an arc sweep.
     * @param {number} angle Candidate angle.
     * @param {number} startAngle Arc start angle.
     * @param {number} sweepAngle Arc sweep angle.
     * @returns {boolean}
     */
    static #angleIsInSweep(angle, startAngle, sweepAngle) {
        const fullCircle = Math.PI * 2
        if (Math.abs(sweepAngle) >= fullCircle - 1e-9) return true
        if (sweepAngle >= 0) {
            return (
                SvgArcBoundsResolver.#normalizeRadians(angle - startAngle) <=
                sweepAngle + 1e-9
            )
        }

        return (
            SvgArcBoundsResolver.#normalizeRadians(startAngle - angle) <=
            -sweepAngle + 1e-9
        )
    }

    /**
     * Normalizes an angle to the positive turn interval.
     * @param {number} radians Raw angle.
     * @returns {number}
     */
    static #normalizeRadians(radians) {
        const fullCircle = Math.PI * 2

        return ((radians % fullCircle) + fullCircle) % fullCircle
    }

    /**
     * Returns the signed angle from one vector to another.
     * @param {{ x: number, y: number }} from Source vector.
     * @param {{ x: number, y: number }} to Target vector.
     * @returns {number}
     */
    static #vectorAngle(from, to) {
        return Math.atan2(
            from.x * to.y - from.y * to.x,
            from.x * to.x + from.y * to.y
        )
    }

    /**
     * Includes the endpoints of one segment.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #includeSegmentBounds(bounds, start, end) {
        return SvgArcBoundsResolver.#includePoint(
            SvgArcBoundsResolver.#includePoint(bounds, start.x, start.y),
            end.x,
            end.y
        )
    }

    /**
     * Includes one point in raw SVG bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {number} x Point x.
     * @param {number} y Point y.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #includePoint(bounds, x, y) {
        if (!bounds) return { minX: x, minY: y, maxX: x, maxY: y }

        return {
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y)
        }
    }
}
