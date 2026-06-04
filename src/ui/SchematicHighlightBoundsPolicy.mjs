/**
 * Chooses between compact body-only and full symbol schematic highlights.
 */
export class SchematicHighlightBoundsPolicy {
    /**
     * Returns whether a compact body envelope should replace full owner bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bodyBounds Body bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} primitiveBounds Full primitive bounds.
     * @param {number} pinCount Owner-linked pin count.
     * @returns {boolean}
     */
    static prefersBodyBounds(bodyBounds, primitiveBounds, pinCount) {
        if (!bodyBounds || !primitiveBounds) return false
        if (pinCount <= 0 || pinCount > 4) return false

        return (
            SchematicHighlightBoundsPolicy.#maxCoverageRatio(
                bodyBounds,
                primitiveBounds
            ) >= 0.45
        )
    }

    /**
     * Resolves the larger axis coverage ratio.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bodyBounds Body bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} primitiveBounds Full primitive bounds.
     * @returns {number}
     */
    static #maxCoverageRatio(bodyBounds, primitiveBounds) {
        const widthRatio =
            SchematicHighlightBoundsPolicy.#span(bodyBounds, 'x') /
            SchematicHighlightBoundsPolicy.#span(primitiveBounds, 'x')
        const heightRatio =
            SchematicHighlightBoundsPolicy.#span(bodyBounds, 'y') /
            SchematicHighlightBoundsPolicy.#span(primitiveBounds, 'y')

        return Math.max(widthRatio, heightRatio)
    }

    /**
     * Resolves a safe bounds span for one axis.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Bounds.
     * @param {'x' | 'y'} axis Axis.
     * @returns {number}
     */
    static #span(bounds, axis) {
        const minKey = axis === 'x' ? 'minX' : 'minY'
        const maxKey = axis === 'x' ? 'maxX' : 'maxY'

        return Math.max(Number(bounds[maxKey]) - Number(bounds[minKey]), 1)
    }
}
