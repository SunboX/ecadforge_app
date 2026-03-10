import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders boxed schematic notes recovered from Altium note records.
 */
export class SchematicNoteRenderer {
    /**
     * Builds one boxed schematic note/callout with wrapped text rows.
     * @param {{ x: number, y: number, color: string, fontSize?: number, fontFamily?: string, fontWeight?: number, cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }} text
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(text, sheetHeight) {
        const left = Math.min(text.x, text.cornerX || text.x)
        const right = Math.max(text.x, text.cornerX || text.x)
        const top = Math.min(
            projectSchematicY(sheetHeight, text.y),
            projectSchematicY(sheetHeight, text.cornerY || text.y)
        )
        const bottom = Math.max(
            projectSchematicY(sheetHeight, text.y),
            projectSchematicY(sheetHeight, text.cornerY || text.y)
        )
        const width = Math.max(right - left, 24)
        const height = Math.max(bottom - top, 18)
        const foldSize = Math.min(Math.max(Math.min(width, height) * 0.16, 8), 14)
        const textMargin = Math.max(Number(text.textMargin || 4), 3)
        const textSize = Math.max(Number(text.fontSize || 8), 5)
        const lineHeight = Math.max(textSize * 1.35, 8)
        const noteFill =
            text.isSolid === false ? 'transparent' : text.fill || '#eceb94'
        const borderColor = text.borderColor || '#7b7753'
        const noteLines = text.noteLines || []
        const textMarkup = noteLines
            .map((line, index) =>
                SchematicNoteRenderer.#buildNoteLineMarkup(
                    line,
                    index,
                    left,
                    right,
                    top,
                    foldSize,
                    textMargin,
                    lineHeight,
                    textSize,
                    text
                )
            )
            .join('')

        return (
            '<g class="schematic-note">' +
            '<path class="schematic-note-box" d="M ' +
            formatNumber(left) +
            ' ' +
            formatNumber(top) +
            ' L ' +
            formatNumber(right) +
            ' ' +
            formatNumber(top) +
            ' L ' +
            formatNumber(right) +
            ' ' +
            formatNumber(bottom - foldSize) +
            ' L ' +
            formatNumber(right - foldSize) +
            ' ' +
            formatNumber(bottom) +
            ' L ' +
            formatNumber(left) +
            ' ' +
            formatNumber(bottom) +
            ' Z" fill="' +
            escapeHtml(noteFill) +
            '" stroke="' +
            escapeHtml(text.showBorder === false ? 'none' : borderColor) +
            '" />' +
            '<path class="schematic-note-fold" d="M ' +
            formatNumber(right - foldSize) +
            ' ' +
            formatNumber(bottom) +
            ' L ' +
            formatNumber(right - foldSize) +
            ' ' +
            formatNumber(bottom - foldSize) +
            ' L ' +
            formatNumber(right) +
            ' ' +
            formatNumber(bottom - foldSize) +
            ' Z" fill="#e1e0d6" stroke="' +
            escapeHtml(text.showBorder === false ? 'none' : borderColor) +
            '" />' +
            '<path class="schematic-note-flag" d="M ' +
            formatNumber(left + 2) +
            ' ' +
            formatNumber(top + 14) +
            ' L ' +
            formatNumber(left + 8) +
            ' ' +
            formatNumber(top + 4) +
            ' L ' +
            formatNumber(left + 14) +
            ' ' +
            formatNumber(top + 14) +
            ' Z" fill="#f6d46d" stroke="' +
            escapeHtml(borderColor) +
            '" />' +
            textMarkup +
            '</g>'
        )
    }

    /**
     * Builds one rendered line inside a schematic note box.
     * @param {string} line
     * @param {number} index
     * @param {number} left
     * @param {number} right
     * @param {number} top
     * @param {number} foldSize
     * @param {number} textMargin
     * @param {number} lineHeight
     * @param {number} textSize
     * @param {{ color: string, fontFamily?: string, fontWeight?: number }} text
     * @returns {string}
     */
    static #buildNoteLineMarkup(
        line,
        index,
        left,
        right,
        top,
        foldSize,
        textMargin,
        lineHeight,
        textSize,
        text
    ) {
        const x = left + textMargin + 10
        const y = top + textMargin + textSize + index * lineHeight

        if (/^_+$/.test(String(line || '').trim())) {
            return (
                '<line class="schematic-note-rule" x1="' +
                formatNumber(x) +
                '" y1="' +
                formatNumber(y - textSize * 0.35) +
                '" x2="' +
                formatNumber(right - textMargin - foldSize - 4) +
                '" y2="' +
                formatNumber(y - textSize * 0.35) +
                '" stroke="' +
                escapeHtml(text.color) +
                '" />'
            )
        }

        return (
            '<text class="schematic-note-text" x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" fill="' +
            escapeHtml(text.color) +
            '" text-anchor="start" font-size="' +
            formatNumber(textSize) +
            '" font-family="' +
            escapeHtml(text.fontFamily || 'Times New Roman') +
            '" font-weight="' +
            formatNumber(text.fontWeight || 400) +
            '" xml:space="preserve">' +
            escapeHtml(line) +
            '</text>'
        )
    }
}
