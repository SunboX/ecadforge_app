/**
 * Resolves bounds from rendered schematic selected-component marker markup.
 */
export class SchematicSelectionMarkerBoundsResolver {
    /**
     * Centers an SVG viewport on the selected schematic marker when appropriate.
     * @param {{ centerBounds?: (bounds: { x: number, y: number, width: number, height: number } | null) => boolean, centerBoundsIfOutsideViewport?: (bounds: { x: number, y: number, width: number, height: number } | null) => boolean, focusBounds?: (bounds: { x: number, y: number, width: number, height: number } | null) => boolean } | null} viewportController Active viewport controller.
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
        if (!key) {
            return
        }

        const bounds = SchematicSelectionMarkerBoundsResolver.resolve(
            markup,
            key
        )
        if (restoredSchematicViewport) {
            viewportController?.centerBoundsIfOutsideViewport?.(bounds)
            return
        }

        if (typeof viewportController?.focusBounds === 'function') {
            viewportController.focusBounds(bounds)
            return
        }

        viewportController?.centerBounds(bounds)
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
        const groupPattern = new RegExp(
            '<g\\b(?=[^>]*\\bclass="[^"]*\\bschematic-symbol-highlight\\b[^"]*")' +
                '(?=[^>]*\\bdata-schematic-component-key="' +
                key +
                '")[^>]*>([\\s\\S]*?)<\\/g>'
        )
        const groupMatch = groupPattern.exec(String(markup))
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

        return SchematicSelectionMarkerBoundsResolver.#applySceneScale(
            String(markup),
            groupMatch.index,
            { x, y, width, height }
        )
    }

    /**
     * Applies an ancestor schematic-scene scale to marker-local bounds.
     * @param {string} markup Rendered schematic view markup.
     * @param {number} markerIndex Marker group start index.
     * @param {{ x: number, y: number, width: number, height: number }} bounds Marker-local bounds.
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    static #applySceneScale(markup, markerIndex, bounds) {
        const scale = SchematicSelectionMarkerBoundsResolver.#resolveSceneScale(
            markup,
            markerIndex
        )

        return {
            x: bounds.x * scale.x,
            y: bounds.y * scale.y,
            width: bounds.width * scale.x,
            height: bounds.height * scale.y
        }
    }

    /**
     * Resolves the active schematic scene scale before a marker.
     * @param {string} markup Rendered schematic view markup.
     * @param {number} markerIndex Marker group start index.
     * @returns {{ x: number, y: number }}
     */
    static #resolveSceneScale(markup, markerIndex) {
        const scenePattern =
            /<g\b(?=[^>]*\bclass="[^"]*\bschematic-scene\b[^"]*")([^>]*)>/gi
        let sceneMatch = scenePattern.exec(markup)
        let transform = ''
        while (sceneMatch && sceneMatch.index < markerIndex) {
            transform = SchematicSelectionMarkerBoundsResolver.#svgAttribute(
                sceneMatch[1],
                'transform'
            )
            sceneMatch = scenePattern.exec(markup)
        }

        return SchematicSelectionMarkerBoundsResolver.#parseScale(transform)
    }

    /**
     * Parses an SVG scale transform.
     * @param {string} transform Transform attribute value.
     * @returns {{ x: number, y: number }}
     */
    static #parseScale(transform) {
        const match = String(transform || '').match(
            /\bscale\(\s*([+-]?(?:\d+\.?\d*|\.\d+))(?:[\s,]+([+-]?(?:\d+\.?\d*|\.\d+)))?\s*\)/i
        )
        const scaleX = Number(match?.[1])
        const scaleY = Number(match?.[2] ?? match?.[1])
        if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) {
            return { x: 1, y: 1 }
        }

        return { x: scaleX, y: scaleY }
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
