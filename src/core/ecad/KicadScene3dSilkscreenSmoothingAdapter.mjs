const SMOOTH_CIRCLE_SEGMENTS = 256
const SMOOTH_ROUNDED_CORNER_SEGMENTS = 16
const SMOOTH_CAPSULE_CAP_SEGMENTS = 32
const MIN_CIRCULAR_POINT_COUNT = 8
const MAX_CIRCLE_RELATIVE_ERROR = 0.025
const MAX_ARC_RELATIVE_ERROR = 0.03
const GEOMETRY_EPSILON = 0.001

/**
 * Smooths silkscreen cutout polygons before the 3D mesh is built.
 */
export class KicadScene3dSilkscreenSmoothingAdapter {
    /**
     * Returns a scene description with smoothed silkscreen cutout contours.
     * @param {object} sceneDescription Scene description.
     * @returns {object}
     */
    static applyScene(sceneDescription) {
        if (!sceneDescription?.detail?.silkscreen) {
            return sceneDescription
        }

        return {
            ...sceneDescription,
            detail: {
                ...sceneDescription.detail,
                silkscreen: KicadScene3dSilkscreenSmoothingAdapter.apply(
                    sceneDescription.detail.silkscreen
                )
            }
        }
    }

    /**
     * Returns silkscreen detail with dense circular cutout contours.
     * @param {object | undefined} silkscreen Silkscreen detail.
     * @returns {object | undefined}
     */
    static apply(silkscreen) {
        if (!silkscreen || typeof silkscreen !== 'object') {
            return silkscreen
        }

        return {
            ...silkscreen,
            top: KicadScene3dSilkscreenSmoothingAdapter.#smoothSide(
                silkscreen.top
            ),
            bottom: KicadScene3dSilkscreenSmoothingAdapter.#smoothSide(
                silkscreen.bottom
            )
        }
    }

    /**
     * Smooths all circular cutouts on one silkscreen side.
     * @param {object | undefined} side Side-specific silkscreen detail.
     * @returns {object | undefined}
     */
    static #smoothSide(side) {
        if (!side || typeof side !== 'object') {
            return side
        }

        return {
            ...side,
            drillCutouts:
                KicadScene3dSilkscreenSmoothingAdapter.#smoothContours(
                    side.drillCutouts
                ),
            copperCutouts:
                KicadScene3dSilkscreenSmoothingAdapter.#smoothContours(
                    side.copperCutouts
                ),
            fills: KicadScene3dSilkscreenSmoothingAdapter.#smoothFills(
                side.fills
            )
        }
    }

    /**
     * Smooths circular holes copied onto silkscreen fills.
     * @param {object[] | undefined} fills Silkscreen fill list.
     * @returns {object[] | undefined}
     */
    static #smoothFills(fills) {
        if (!Array.isArray(fills)) {
            return fills
        }

        return fills.map((fill) => {
            if (!Array.isArray(fill?.holes)) {
                return fill
            }

            return {
                ...fill,
                holes: KicadScene3dSilkscreenSmoothingAdapter.#smoothContours(
                    fill.holes
                )
            }
        })
    }

    /**
     * Smooths every circular contour in a list.
     * @param {{ x?: number, y?: number }[][] | undefined} contours Contours.
     * @returns {{ x: number, y: number }[][] | undefined}
     */
    static #smoothContours(contours) {
        if (!Array.isArray(contours)) {
            return contours
        }

        return contours.map((contour) =>
            KicadScene3dSilkscreenSmoothingAdapter.#smoothContour(contour)
        )
    }

    /**
     * Returns a dense circular contour when the source polygon is circular.
     * @param {{ x?: number, y?: number }[]} contour Source contour.
     * @returns {{ x: number, y: number }[]}
     */
    static #smoothContour(contour) {
        const points =
            KicadScene3dSilkscreenSmoothingAdapter.#finitePoints(contour)
        const circle =
            KicadScene3dSilkscreenSmoothingAdapter.#resolveCircle(points)

        if (!circle) {
            return (
                KicadScene3dSilkscreenSmoothingAdapter.#smoothRoundedContour(
                    points
                ) ||
                KicadScene3dSilkscreenSmoothingAdapter.#smoothCapsuleContour(
                    points
                ) ||
                points
            )
        }

        return KicadScene3dSilkscreenSmoothingAdapter.#buildCirclePoints(
            circle,
            points
        )
    }

    /**
     * Keeps only finite contour points.
     * @param {{ x?: number, y?: number }[] | undefined} points Source points.
     * @returns {{ x: number, y: number }[]}
     */
    static #finitePoints(points) {
        return (Array.isArray(points) ? points : [])
            .map((point) => ({
                x: Number(point?.x),
                y: Number(point?.y)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
    }

    /**
     * Resolves circular metadata for a sampled polygon.
     * @param {{ x: number, y: number }[]} points Finite contour points.
     * @returns {{ centerX: number, centerY: number, radius: number } | null}
     */
    static #resolveCircle(points) {
        if (
            !Array.isArray(points) ||
            points.length < MIN_CIRCULAR_POINT_COUNT
        ) {
            return null
        }

        const center = KicadScene3dSilkscreenSmoothingAdapter.#centroid(points)
        const radii = points.map((point) =>
            Math.hypot(point.x - center.x, point.y - center.y)
        )
        const radius =
            radii.reduce((sum, value) => sum + value, 0) / radii.length
        const maxError = Math.max(
            ...radii.map((value) => Math.abs(value - radius))
        )
        const tolerance = Math.max(
            GEOMETRY_EPSILON,
            radius * MAX_CIRCLE_RELATIVE_ERROR
        )

        if (
            !Number.isFinite(radius) ||
            radius <= GEOMETRY_EPSILON ||
            maxError > tolerance
        ) {
            return null
        }

        return {
            centerX: center.x,
            centerY: center.y,
            radius
        }
    }

    /**
     * Builds dense circle points while preserving source winding and start.
     * @param {{ centerX: number, centerY: number, radius: number }} circle
     * Circular contour metadata.
     * @param {{ x: number, y: number }[]} sourcePoints Source contour points.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildCirclePoints(circle, sourcePoints) {
        const start = sourcePoints[0] || {
            x: circle.centerX + circle.radius,
            y: circle.centerY
        }
        const startAngle = Math.atan2(
            start.y - circle.centerY,
            start.x - circle.centerX
        )
        const direction =
            KicadScene3dSilkscreenSmoothingAdapter.#signedArea(sourcePoints) < 0
                ? -1
                : 1

        return Array.from({ length: SMOOTH_CIRCLE_SEGMENTS }, (_, index) => {
            const angle =
                startAngle +
                (direction * Math.PI * 2 * index) / SMOOTH_CIRCLE_SEGMENTS

            return {
                x: circle.centerX + Math.cos(angle) * circle.radius,
                y: circle.centerY + Math.sin(angle) * circle.radius
            }
        })
    }

    /**
     * Returns dense rounded-corner contours for sampled rounded rectangles.
     * @param {{ x: number, y: number }[]} points Source contour points.
     * @returns {{ x: number, y: number }[] | null}
     */
    static #smoothRoundedContour(points) {
        const longEdges =
            KicadScene3dSilkscreenSmoothingAdapter.#longStraightEdgeIndexes(
                points
            )
        if (longEdges.length !== 4) {
            return null
        }

        const smoothed = []
        for (let index = 0; index < longEdges.length; index += 1) {
            const startIndex = (longEdges[index] + 1) % points.length
            const endIndex = longEdges[(index + 1) % longEdges.length]
            const arcPoints =
                KicadScene3dSilkscreenSmoothingAdapter.#pointsBetweenIndexes(
                    points,
                    startIndex,
                    endIndex
                )
            const arc = KicadScene3dSilkscreenSmoothingAdapter.#smoothArcPoints(
                arcPoints,
                SMOOTH_ROUNDED_CORNER_SEGMENTS
            )

            if (!arc) {
                return null
            }

            KicadScene3dSilkscreenSmoothingAdapter.#appendUniquePoints(
                smoothed,
                arc
            )
        }

        return smoothed.length > points.length ? smoothed : null
    }

    /**
     * Returns dense rounded-cap contours for sampled obround slots.
     * @param {{ x: number, y: number }[]} points Source contour points.
     * @returns {{ x: number, y: number }[] | null}
     */
    static #smoothCapsuleContour(points) {
        const longEdges =
            KicadScene3dSilkscreenSmoothingAdapter.#longStraightEdgeIndexes(
                points
            )
        if (longEdges.length !== 2) {
            return null
        }

        const smoothed = []
        for (let index = 0; index < longEdges.length; index += 1) {
            const startIndex = (longEdges[index] + 1) % points.length
            const endIndex = longEdges[(index + 1) % longEdges.length]
            const arcPoints =
                KicadScene3dSilkscreenSmoothingAdapter.#pointsBetweenIndexes(
                    points,
                    startIndex,
                    endIndex
                )
            const arc = KicadScene3dSilkscreenSmoothingAdapter.#smoothArcPoints(
                arcPoints,
                SMOOTH_CAPSULE_CAP_SEGMENTS
            )

            if (!arc) {
                return null
            }

            KicadScene3dSilkscreenSmoothingAdapter.#appendUniquePoints(
                smoothed,
                arc
            )
        }

        return smoothed.length > points.length ? smoothed : null
    }

    /**
     * Finds segment indexes that are much longer than local arc segments.
     * @param {{ x: number, y: number }[]} points Source contour points.
     * @returns {number[]}
     */
    static #longStraightEdgeIndexes(points) {
        if (!Array.isArray(points) || points.length < 16) {
            return []
        }

        const lengths = points.map((point, index) =>
            KicadScene3dSilkscreenSmoothingAdapter.#distance(
                point,
                points[(index + 1) % points.length]
            )
        )
        const median = KicadScene3dSilkscreenSmoothingAdapter.#median(lengths)
        const threshold = Math.max(median * 2.5, median + GEOMETRY_EPSILON)

        return lengths
            .map((length, index) => ({ length, index }))
            .filter((edge) => edge.length > threshold)
            .map((edge) => edge.index)
            .sort((a, b) => a - b)
    }

    /**
     * Returns points between two circular indexes, including both ends.
     * @param {{ x: number, y: number }[]} points Source contour points.
     * @param {number} startIndex Start index.
     * @param {number} endIndex End index.
     * @returns {{ x: number, y: number }[]}
     */
    static #pointsBetweenIndexes(points, startIndex, endIndex) {
        const output = []
        let index = startIndex

        while (true) {
            output.push(points[index])
            if (index === endIndex) {
                break
            }
            index = (index + 1) % points.length
            if (output.length > points.length) {
                return []
            }
        }

        return output
    }

    /**
     * Replaces one sampled rounded-corner arc with a denser circular arc.
     * @param {{ x: number, y: number }[]} points Source arc points.
     * @param {number} segmentCount Output segment count.
     * @returns {{ x: number, y: number }[] | null}
     */
    static #smoothArcPoints(points, segmentCount) {
        if (!Array.isArray(points) || points.length < 3) {
            return null
        }

        const circle =
            KicadScene3dSilkscreenSmoothingAdapter.#resolveArcCircle(points)
        if (!circle) {
            return null
        }

        const angles = points.map((point) =>
            Math.atan2(point.y - circle.centerY, point.x - circle.centerX)
        )
        const unwrapped =
            KicadScene3dSilkscreenSmoothingAdapter.#unwrapAngles(angles)
        const startAngle = unwrapped[0]
        const deltaAngle = unwrapped.at(-1) - startAngle

        if (Math.abs(deltaAngle) <= GEOMETRY_EPSILON) {
            return null
        }

        return Array.from({ length: segmentCount + 1 }, (_, index) => {
            const angle = startAngle + (deltaAngle * index) / segmentCount

            return {
                x: circle.centerX + Math.cos(angle) * circle.radius,
                y: circle.centerY + Math.sin(angle) * circle.radius
            }
        })
    }

    /**
     * Fits a circle through one sampled arc and verifies all points match it.
     * @param {{ x: number, y: number }[]} points Source arc points.
     * @returns {{ centerX: number, centerY: number, radius: number } | null}
     */
    static #resolveArcCircle(points) {
        const first = points[0]
        const middle = points[Math.floor(points.length / 2)]
        const last = points.at(-1)
        const circle =
            KicadScene3dSilkscreenSmoothingAdapter.#circleFromThreePoints(
                first,
                middle,
                last
            )

        if (!circle) {
            return null
        }

        const maxError = Math.max(
            ...points.map((point) => {
                const radius = Math.hypot(
                    point.x - circle.centerX,
                    point.y - circle.centerY
                )

                return Math.abs(radius - circle.radius)
            })
        )
        const tolerance = Math.max(
            GEOMETRY_EPSILON,
            circle.radius * MAX_ARC_RELATIVE_ERROR
        )

        return maxError <= tolerance ? circle : null
    }

    /**
     * Resolves a circle through three non-collinear points.
     * @param {{ x: number, y: number }} a First point.
     * @param {{ x: number, y: number }} b Middle point.
     * @param {{ x: number, y: number }} c Last point.
     * @returns {{ centerX: number, centerY: number, radius: number } | null}
     */
    static #circleFromThreePoints(a, b, c) {
        const determinant =
            2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y))

        if (Math.abs(determinant) <= GEOMETRY_EPSILON) {
            return null
        }

        const aSquared = a.x * a.x + a.y * a.y
        const bSquared = b.x * b.x + b.y * b.y
        const cSquared = c.x * c.x + c.y * c.y
        const centerX =
            (aSquared * (b.y - c.y) +
                bSquared * (c.y - a.y) +
                cSquared * (a.y - b.y)) /
            determinant
        const centerY =
            (aSquared * (c.x - b.x) +
                bSquared * (a.x - c.x) +
                cSquared * (b.x - a.x)) /
            determinant
        const radius = Math.hypot(a.x - centerX, a.y - centerY)

        if (!Number.isFinite(centerX + centerY + radius)) {
            return null
        }

        return { centerX, centerY, radius }
    }

    /**
     * Unwraps ordered angles so adjacent deltas stay within one half-turn.
     * @param {number[]} angles Source angles.
     * @returns {number[]}
     */
    static #unwrapAngles(angles) {
        if (!angles.length) {
            return []
        }

        const output = [angles[0]]
        for (let index = 1; index < angles.length; index += 1) {
            let angle = angles[index]
            const previous = output[index - 1]

            while (angle - previous > Math.PI) {
                angle -= Math.PI * 2
            }
            while (angle - previous < -Math.PI) {
                angle += Math.PI * 2
            }

            output.push(angle)
        }

        return output
    }

    /**
     * Appends points while avoiding duplicate adjacent vertices.
     * @param {{ x: number, y: number }[]} target Target list.
     * @param {{ x: number, y: number }[]} points Points to append.
     * @returns {void}
     */
    static #appendUniquePoints(target, points) {
        for (const point of points) {
            const last = target.at(-1)

            if (
                last &&
                KicadScene3dSilkscreenSmoothingAdapter.#distance(last, point) <=
                    GEOMETRY_EPSILON
            ) {
                continue
            }

            target.push(point)
        }
    }

    /**
     * Resolves the median finite value.
     * @param {number[]} values Values.
     * @returns {number}
     */
    static #median(values) {
        const sorted = values
            .filter((value) => Number.isFinite(value))
            .sort((a, b) => a - b)

        if (!sorted.length) {
            return 0
        }

        return sorted[Math.floor(sorted.length / 2)]
    }

    /**
     * Resolves the distance between two points.
     * @param {{ x: number, y: number }} a First point.
     * @param {{ x: number, y: number }} b Second point.
     * @returns {number}
     */
    static #distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y)
    }

    /**
     * Resolves the average point position.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {{ x: number, y: number }}
     */
    static #centroid(points) {
        const total = points.reduce(
            (accumulator, point) => ({
                x: accumulator.x + point.x,
                y: accumulator.y + point.y
            }),
            { x: 0, y: 0 }
        )

        return {
            x: total.x / points.length,
            y: total.y / points.length
        }
    }

    /**
     * Resolves the signed polygon area.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {number}
     */
    static #signedArea(points) {
        return points.reduce((area, point, index) => {
            const next = points[(index + 1) % points.length]

            return area + point.x * next.y - next.x * point.y
        }, 0)
    }
}
