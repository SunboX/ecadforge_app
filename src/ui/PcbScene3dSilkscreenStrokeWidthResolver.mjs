/**
 * Resolves 3D silkscreen stroke widths without changing sparse linework.
 */
export class PcbScene3dSilkscreenStrokeWidthResolver {
    static #DENSE_HAIRLINE_COUNT = 128
    static #HAIRLINE_MAX_WIDTH_MIL = 1
    static #DENSE_HAIRLINE_EXTRA_WIDTH_MIL = 0.63

    /**
     * Finds the repeated hairline width used by dense raster-style artwork.
     * @param {{ width?: number }[]} tracks
     * @returns {{ widthKey: string, renderWidth: number } | null}
     */
    static resolveDenseHairline(tracks) {
        const counts = new Map()

        for (const track of Array.isArray(tracks) ? tracks : []) {
            const width = Number(track?.width || 0)
            if (
                !Number.isFinite(width) ||
                width <= 0 ||
                width >
                    PcbScene3dSilkscreenStrokeWidthResolver
                        .#HAIRLINE_MAX_WIDTH_MIL
            ) {
                continue
            }

            const widthKey =
                PcbScene3dSilkscreenStrokeWidthResolver.#buildWidthKey(width)
            counts.set(widthKey, (counts.get(widthKey) || 0) + 1)
        }

        const denseWidth = [...counts.entries()].find(
            ([, count]) =>
                count >=
                PcbScene3dSilkscreenStrokeWidthResolver.#DENSE_HAIRLINE_COUNT
        )
        if (!denseWidth) {
            return null
        }

        const width = Number(denseWidth[0])
        return {
            widthKey: denseWidth[0],
            renderWidth:
                width +
                PcbScene3dSilkscreenStrokeWidthResolver
                    .#DENSE_HAIRLINE_EXTRA_WIDTH_MIL
        }
    }

    /**
     * Resolves the rendered width for one track.
     * @param {number} width
     * @param {{ widthKey: string, renderWidth: number } | null} denseHairline
     * @returns {number}
     */
    static resolveTrackWidth(width, denseHairline) {
        const numericWidth = Number(width || 0)
        if (
            !denseHairline ||
            PcbScene3dSilkscreenStrokeWidthResolver.#buildWidthKey(
                numericWidth
            ) !== denseHairline.widthKey
        ) {
            return numericWidth
        }

        return Math.max(numericWidth, denseHairline.renderWidth)
    }

    /**
     * Builds a stable key for comparing near-identical parsed widths.
     * @param {number} width
     * @returns {string}
     */
    static #buildWidthKey(width) {
        return Number(width || 0).toFixed(2)
    }
}
