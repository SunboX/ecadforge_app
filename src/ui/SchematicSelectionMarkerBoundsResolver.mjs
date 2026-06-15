/**
 * Resolves bounds from rendered schematic selected-component marker markup.
 */
export class SchematicSelectionMarkerBoundsResolver {
    /**
     * Centers an SVG viewport on the selected schematic marker when appropriate.
     * @param {{ centerBounds?: (bounds: { x: number, y: number, width: number, height: number } | null) => boolean } | null} viewportController Active viewport controller.
     * @param {string} markup Rendered schematic view markup.
     * @param {string} selectedComponentKey Selected component key.
     * @param {boolean} restoredSchematicViewport Whether a preserved viewBox was restored.
     * @returns {void}
     */
    static centerViewport(
        viewportController,
        markup,
        selectedComponentKey,
        restoredSchematicViewport
    ) {
        const key = String(selectedComponentKey || '').trim()
        if (!key || restoredSchematicViewport) {
            return
        }

        viewportController?.centerBounds(
            SchematicSelectionMarkerBoundsResolver.resolve(markup, key)
        )
    }

    /**
     * Resolves SVG-space bounds for the rendered selected schematic component.
     * @param {string} markup Rendered schematic view markup.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static resolve(markup, selectedComponentKey) {
        const key = SchematicSelectionMarkerBoundsResolver.#escapeRegExp(
            SchematicSelectionMarkerBoundsResolver.#escapeHtml(
                selectedComponentKey
            )
        )
        const groupMatch = String(markup).match(
            new RegExp(
                '<g\\b(?=[^>]*\\bclass="[^"]*\\bschematic-symbol-highlight\\b[^"]*")' +
                    '(?=[^>]*\\bdata-schematic-component-key="' +
                    key +
                    '")[^>]*>([\\s\\S]*?)<\\/g>'
            )
        )
        if (!groupMatch) return null

        const rectMatch = groupMatch[1].match(
            /<rect\b(?=[^>]*\bclass="[^"]*\bschematic-symbol-highlight__fill\b)([^>]*)>/u
        )
        if (!rectMatch) return null

        const x = SchematicSelectionMarkerBoundsResolver.#svgAttributeNumber(
            rectMatch[1],
            'x'
        )
        const y = SchematicSelectionMarkerBoundsResolver.#svgAttributeNumber(
            rectMatch[1],
            'y'
        )
        const width =
            SchematicSelectionMarkerBoundsResolver.#svgAttributeNumber(
                rectMatch[1],
                'width'
            )
        const height =
            SchematicSelectionMarkerBoundsResolver.#svgAttributeNumber(
                rectMatch[1],
                'height'
            )
        if (x === null || y === null || width === null || height === null) {
            return null
        }

        return { x, y, width, height }
    }

    /**
     * Reads a numeric SVG attribute from an attribute string.
     * @param {string} attributes SVG attribute fragment.
     * @param {string} name Attribute name.
     * @returns {number | null}
     */
    static #svgAttributeNumber(attributes, name) {
        const value = Number(
            SchematicSelectionMarkerBoundsResolver.#svgAttribute(
                attributes,
                name
            )
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
                SchematicSelectionMarkerBoundsResolver.#escapeRegExp(name) +
                '="([^"]*)"'
        )
        return String(String(attributes || '').match(pattern)?.[1] || '')
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
