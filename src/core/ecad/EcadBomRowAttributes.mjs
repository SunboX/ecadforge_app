/**
 * Formats optional semantic attributes for BOM table rows.
 */
export class EcadBomRowAttributes {
    /**
     * Renders optional row attributes for semantic BOM metadata.
     * @param {object} row BOM row.
     * @returns {string}
     */
    static render(row) {
        const attributes = [
            ['data-bom-component-type', row?.componentType],
            ['data-bom-source-ftype', row?.sourceFtype],
            ['data-bom-component-icon', row?.componentIcon]
        ]
            .filter(([_name, value]) => String(value || '').trim())
            .map(
                ([name, value]) =>
                    name +
                    '="' +
                    EcadBomRowAttributes.#escapeHtml(String(value)) +
                    '"'
            )

        return attributes.length ? ' ' + attributes.join(' ') : ''
    }

    /**
     * Escapes text for safe insertion into HTML attributes.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
