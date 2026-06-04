/**
 * Orders external 3D model placements so visible progress starts quickly.
 */
export class PcbScene3dExternalModelLoadOrder {
    /**
     * Sorts placements by estimated import cost while preserving stable ties.
     * @param {any[]} placements External model placements.
     * @returns {any[]}
     */
    static sort(placements) {
        if (!Array.isArray(placements)) {
            return []
        }

        return placements
            .map((placement, index) => ({
                placement,
                index,
                weight: PcbScene3dExternalModelLoadOrder.#resolveWeight(
                    placement
                )
            }))
            .sort((left, right) => {
                if (left.weight !== right.weight) {
                    return left.weight - right.weight
                }

                return left.index - right.index
            })
            .map((entry) => entry.placement)
    }

    /**
     * Resolves one placement's import-cost estimate.
     * @param {{ externalModel?: { payloadText?: string, file?: { size?: number } } }} placement External model placement.
     * @returns {number}
     */
    static #resolveWeight(placement) {
        const model = placement?.externalModel || {}
        const payloadLength =
            typeof model.payloadText === 'string'
                ? model.payloadText.length
                : 0
        const fileSize = Number(model.file?.size || 0)

        if (payloadLength > 0) {
            return payloadLength
        }

        if (Number.isFinite(fileSize) && fileSize > 0) {
            return fileSize
        }

        return Number.POSITIVE_INFINITY
    }
}
