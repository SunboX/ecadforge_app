const SVG_PANEL_HEADER_PATTERN =
    /<header\s+class="svg-panel__header"[\s\S]*?<\/header>/
const PCB_LEGEND_PATTERN = /<aside\s+class="pcb-legend"[\s\S]*?<\/aside>/

/**
 * Removes duplicated SVG panel chrome from renderer output.
 */
export class SvgPanelChromeStripper {
    /**
     * Removes the document metadata chrome from wrapped SVG panels.
     * @param {string} markup Renderer output markup.
     * @returns {string}
     */
    static stripMetadataHeader(markup) {
        const normalizedMarkup = String(markup || '')
        const strippedMarkup = normalizedMarkup
            .replace(SVG_PANEL_HEADER_PATTERN, '')
            .replace(PCB_LEGEND_PATTERN, '')

        if (strippedMarkup === normalizedMarkup) {
            return normalizedMarkup
        }

        return SvgPanelChromeStripper.#markChromeHidden(strippedMarkup)
    }

    /**
     * Marks the owning SVG panel so it can use a single full-height grid row.
     * @param {string} markup Headerless renderer output markup.
     * @returns {string}
     */
    static #markChromeHidden(markup) {
        return String(markup).replace(
            /<section\b([^>]*\bclass=")([^"]*\bsvg-panel\b[^"]*)(")/,
            (_match, prefix, classValue, suffix) => {
                const classes = String(classValue).split(/\s+/)
                if (classes.includes('svg-panel--chrome-hidden')) {
                    return '<section' + prefix + classValue + suffix
                }

                return (
                    '<section' +
                    prefix +
                    classValue +
                    ' svg-panel--chrome-hidden' +
                    suffix
                )
            }
        )
    }
}
