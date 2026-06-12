/**
 * Shared helpers for post-processing rendered schematic SVG markup.
 */
export class SchematicMarkupTools {
    /**
     * Finds the end of a rendered rectangle matching bounds.
     * @param {string} markup SVG markup.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Rectangle bounds.
     * @returns {number | null}
     */
    static findRectEndIndex(markup, bounds) {
        if (!SchematicMarkupTools.isValidBounds(bounds)) return null

        const x = SchematicMarkupTools.#escapeRegex(
            SchematicMarkupTools.formatNumber(bounds.minX)
        )
        const y = SchematicMarkupTools.#escapeRegex(
            SchematicMarkupTools.formatNumber(bounds.minY)
        )
        const width = SchematicMarkupTools.#escapeRegex(
            SchematicMarkupTools.formatNumber(bounds.maxX - bounds.minX)
        )
        const height = SchematicMarkupTools.#escapeRegex(
            SchematicMarkupTools.formatNumber(bounds.maxY - bounds.minY)
        )
        const pattern = new RegExp(
            '<rect\\b(?=[^>]*\\bx="' +
                x +
                '")(?=[^>]*\\by="' +
                y +
                '")(?=[^>]*\\bwidth="' +
                width +
                '")(?=[^>]*\\bheight="' +
                height +
                '")[^>]*>',
            'i'
        )
        const match = String(markup).match(pattern)
        return match && match.index !== undefined
            ? match.index + match[0].length
            : null
    }

    /**
     * Finds the closing tag index for the first SVG group with a class.
     * @param {string} markup SVG markup.
     * @param {string} className Group class to locate.
     * @returns {number | null}
     */
    static findGroupEndIndex(markup, className) {
        const groupPattern = new RegExp(
            '<g\\b(?=[^>]*\\bclass="[^"]*\\b' + className + '\\b)[^>]*>',
            'i'
        )
        const groupMatch = String(markup).match(groupPattern)
        if (!groupMatch || groupMatch.index === undefined) return null

        const tagPattern = /<\/?g\b[^>]*\/?>/gi
        tagPattern.lastIndex = groupMatch.index + groupMatch[0].length
        let depth = 1
        let tagMatch = tagPattern.exec(markup)

        while (tagMatch) {
            const tag = tagMatch[0]
            if (tag.startsWith('</')) {
                depth -= 1
                if (depth === 0) return tagMatch.index
            } else if (!tag.endsWith('/>')) {
                depth += 1
            }
            tagMatch = tagPattern.exec(markup)
        }

        return null
    }

    /**
     * Formats an SVG number.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static formatNumber(value) {
        return Number.isFinite(value)
            ? Number(value.toFixed(3)).toString()
            : '0'
    }

    /**
     * Escapes markup text.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }

    /**
     * Returns whether bounds are finite and usable.
     * @param {any} bounds Bounds candidate.
     * @returns {boolean}
     */
    static isValidBounds(bounds) {
        return (
            Number.isFinite(bounds?.minX) &&
            Number.isFinite(bounds?.minY) &&
            Number.isFinite(bounds?.maxX) &&
            Number.isFinite(bounds?.maxY) &&
            bounds.maxX >= bounds.minX &&
            bounds.maxY >= bounds.minY
        )
    }

    /**
     * Escapes text for a regular expression.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static #escapeRegex(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }
}
