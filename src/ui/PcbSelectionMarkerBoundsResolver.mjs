/**
 * Resolves bounds from rendered PCB selected-component marker markup.
 */
export class PcbSelectionMarkerBoundsResolver {
    /**
     * Resolves SVG-space bounds for the rendered selected-component marker.
     * @param {string} markup Rendered PCB view markup.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static resolve(markup, selectedComponentKey) {
        const key = PcbSelectionMarkerBoundsResolver.#escapeRegExp(
            PcbSelectionMarkerBoundsResolver.#escapeHtml(selectedComponentKey)
        )
        const groupMatch = String(markup).match(
            new RegExp(
                '<g\\b(?=[^>]*\\bclass="[^"]*\\bpcb-component-selection-marker\\b[^"]*")' +
                    '(?=[^>]*\\bdata-pcb-selected-component-key="' +
                    key +
                    '")([^>]*)>([\\s\\S]*?)<\\/g>'
            )
        )
        if (!groupMatch) return null

        const rectMatch = groupMatch[2].match(
            /<rect\b(?=[^>]*\bclass="[^"]*\bpcb-component-selection-marker__fill\b[^"]*")([^>]*)>/u
        )
        if (!rectMatch) return null

        const x = PcbSelectionMarkerBoundsResolver.#svgAttributeNumber(
            rectMatch[1],
            'x'
        )
        const y = PcbSelectionMarkerBoundsResolver.#svgAttributeNumber(
            rectMatch[1],
            'y'
        )
        const width = PcbSelectionMarkerBoundsResolver.#svgAttributeNumber(
            rectMatch[1],
            'width'
        )
        const height = PcbSelectionMarkerBoundsResolver.#svgAttributeNumber(
            rectMatch[1],
            'height'
        )
        if (x === null || y === null || width === null || height === null) {
            return null
        }

        const offset = PcbSelectionMarkerBoundsResolver.#svgTransformTranslation(
            PcbSelectionMarkerBoundsResolver.#svgAttribute(
                groupMatch[1],
                'transform'
            )
        )

        return { x: x + offset.x, y: y + offset.y, width, height }
    }

    /**
     * Reads a numeric SVG attribute from an attribute string.
     * @param {string} attributes SVG attribute fragment.
     * @param {string} name Attribute name.
     * @returns {number | null}
     */
    static #svgAttributeNumber(attributes, name) {
        const value = Number(
            PcbSelectionMarkerBoundsResolver.#svgAttribute(attributes, name)
        )
        return Number.isFinite(value) ? value : null
    }

    /**
     * Reads one SVG attribute from an attribute string.
     * @param {string} attributes SVG attribute fragment.
     * @param {string} name Attribute name.
     * @returns {string}
     */
    static #svgAttribute(attributes, name) {
        const pattern = new RegExp(
            '\\b' +
                PcbSelectionMarkerBoundsResolver.#escapeRegExp(name) +
                '="([^"]*)"'
        )
        return String(String(attributes || '').match(pattern)?.[1] || '')
    }

    /**
     * Resolves the first translate offset from an SVG transform attribute.
     * @param {string} value Transform attribute value.
     * @returns {{ x: number, y: number }}
     */
    static #svgTransformTranslation(value) {
        const match = String(value || '').match(
            /\btranslate\(\s*([-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?)(?:[\s,]+([-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?))?/iu
        )
        const x = Number(match?.[1])
        const y = Number(match?.[2])

        return {
            x: Number.isFinite(x) ? x : 0,
            y: Number.isFinite(y) ? y : 0
        }
    }

    /**
     * Escapes a value for use inside a regular expression.
     * @param {string} value Raw value.
     * @returns {string}
     */
    static #escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /**
     * Escapes text the same way renderer-owned marker attributes are escaped.
     * @param {string} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;')
    }
}
