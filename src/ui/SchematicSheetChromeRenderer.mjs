import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const {
    basename,
    buildCurrentDateValue,
    createSvgText,
    formatNumber,
    projectSchematicY
} = SchematicSvgUtils

/**
 * Renders synthesized sheet border, zones, and title-block chrome.
 */
export class SchematicSheetChromeRenderer {
    /**
     * Builds page border and title-block chrome from sheet metadata.
     * @param {number} width
     * @param {number} height
     * @param {{ borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, paperSize?: string, sourceWidth?: number, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> } }} sheet
     * @param {string | undefined} fileName
     * @returns {string}
     */
    static buildMarkup(width, height, sheet, fileName) {
        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        let markup = SchematicSheetChromeRenderer.#buildSheetZoneMarkup(
            width,
            height,
            margin,
            sheet
        )

        if (sheet?.borderOn) {
            markup +=
                '<rect class="sheet-frame" x="' +
                formatNumber(margin) +
                '" y="' +
                formatNumber(margin) +
                '" width="' +
                formatNumber(Math.max(width - margin * 2, 10)) +
                '" height="' +
                formatNumber(Math.max(height - margin * 2, 10)) +
                '" />'
        }

        if (!sheet?.titleBlockOn) {
            return markup
        }

        const titleBlock = sheet?.titleBlock || {}
        const resolvedTitleBlock =
            SchematicSheetChromeRenderer.#resolveRenderedTitleBlock(
                width,
                sheet,
                titleBlock
            )
        const titleBlockLayout =
            SchematicSheetChromeRenderer.#resolveSheetTitleBlockLayout(
                width,
                height,
                margin,
                resolvedTitleBlock
            )
        const titleBlockWidth = titleBlockLayout.width
        const titleBlockHeight = titleBlockLayout.height
        const x = titleBlockLayout.x
        const y = titleBlockLayout.y
        const headerY = y + titleBlockHeight * 0.16
        const titleRowY = y + titleBlockHeight * 0.48
        const labelRowY = y + titleBlockHeight * 0.62
        const valueRowY = y + titleBlockHeight * 0.78
        const footerDateY = y + titleBlockHeight * 0.9
        const footerFileY = y + titleBlockHeight * 0.98
        const line1Y = y + titleBlockHeight * 0.18
        const line2Y = y + titleBlockHeight * 0.5
        const line3Y = y + titleBlockHeight * 0.66
        const line4Y = y + titleBlockHeight * 0.82
        const numberX = x + titleBlockWidth * 0.64
        const revisionX = x + titleBlockWidth * 0.84
        const sizeX = x + titleBlockWidth * 0.16
        const sheetX = x + titleBlockWidth * 0.67
        const drawnByX = x + titleBlockWidth * 0.82
        const sheetValue = SchematicSheetChromeRenderer.#buildSheetValue(
            resolvedTitleBlock
        )
        const sheetValueHint =
            SchematicSheetChromeRenderer.#buildSheetValueFooterHint(
                resolvedTitleBlock
            )
        const renderedFileName = basename(fileName)
        const renderedDate =
            resolvedTitleBlock.date || buildCurrentDateValue()

        return (
            markup +
            '<g class="sheet-title-block">' +
            '<rect x="' +
            formatNumber(x) +
            '" y="' +
            formatNumber(y) +
            '" width="' +
            formatNumber(titleBlockWidth) +
            '" height="' +
            formatNumber(titleBlockHeight) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line1Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line1Y) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line2Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line2Y) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line3Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line3Y) +
            '" />' +
            '<line x1="' +
            formatNumber(x) +
            '" y1="' +
            formatNumber(line4Y) +
            '" x2="' +
            formatNumber(x + titleBlockWidth) +
            '" y2="' +
            formatNumber(line4Y) +
            '" />' +
            '<line x1="' +
            formatNumber(numberX) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(numberX) +
            '" y2="' +
            formatNumber(line2Y) +
            '" />' +
            '<line x1="' +
            formatNumber(revisionX) +
            '" y1="' +
            formatNumber(y) +
            '" x2="' +
            formatNumber(revisionX) +
            '" y2="' +
            formatNumber(line2Y) +
            '" />' +
            '<line x1="' +
            formatNumber(sizeX) +
            '" y1="' +
            formatNumber(line2Y) +
            '" x2="' +
            formatNumber(sizeX) +
            '" y2="' +
            formatNumber(y + titleBlockHeight) +
            '" />' +
            '<line x1="' +
            formatNumber(sheetX) +
            '" y1="' +
            formatNumber(line2Y) +
            '" x2="' +
            formatNumber(sheetX) +
            '" y2="' +
            formatNumber(line4Y) +
            '" />' +
            '<line x1="' +
            formatNumber(drawnByX) +
            '" y1="' +
            formatNumber(line4Y) +
            '" x2="' +
            formatNumber(drawnByX) +
            '" y2="' +
            formatNumber(y + titleBlockHeight) +
            '" />' +
            createSvgText(
                'sheet-title-label',
                x + titleBlockWidth * 0.03,
                headerY,
                'Title',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                numberX + titleBlockWidth * 0.03,
                headerY,
                'Number',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                revisionX + titleBlockWidth * 0.02,
                headerY,
                'Revision',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                x + titleBlockWidth * 0.05,
                labelRowY,
                'Size',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                sizeX + titleBlockWidth * 0.05,
                labelRowY,
                'Sheet',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                sizeX + 8,
                footerDateY,
                'Date:',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                sizeX + 8,
                footerFileY,
                'File:',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-label',
                drawnByX + 8,
                footerFileY,
                'Drawn By:',
                'var(--schematic-sheet-label-color)',
                'start'
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.31,
                titleRowY,
                resolvedTitleBlock.title || '',
                'var(--schematic-default-ink-color)',
                resolvedTitleBlock.footerHints?.title,
                height
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.74,
                titleRowY,
                resolvedTitleBlock.documentNumber || '',
                'var(--schematic-text-color)',
                resolvedTitleBlock.footerHints?.documentNumber,
                height
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.92,
                titleRowY,
                resolvedTitleBlock.revision || '',
                'var(--schematic-default-ink-color)',
                resolvedTitleBlock.footerHints?.revision,
                height
            ) +
            createSvgText(
                'sheet-title-value',
                x + titleBlockWidth * 0.08,
                valueRowY,
                sheet?.paperSize || 'A4',
                'var(--schematic-text-color)',
                'middle'
            ) +
            SchematicSheetChromeRenderer.#buildTitleBlockValueMarkup(
                x + titleBlockWidth * 0.415,
                valueRowY,
                sheetValue,
                'var(--schematic-default-ink-color)',
                sheetValueHint,
                height
            ) +
            createSvgText(
                'sheet-title-value',
                sizeX + titleBlockWidth * 0.08,
                footerDateY,
                renderedDate,
                'var(--schematic-text-color)',
                'start'
            ) +
            createSvgText(
                'sheet-title-value',
                sizeX + titleBlockWidth * 0.08,
                footerFileY,
                renderedFileName,
                'var(--schematic-text-color)',
                'start'
            ) +
            '</g>'
        )
    }

    /**
     * Resolves the synthesized title-block bounds, using recovered footer
     * value hints when the source file exposes them.
     * @param {number} width
     * @param {{ sourceWidth?: number }} sheet
     * @param {{ title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }} titleBlock
     * @returns {{ title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string, footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }}
     */
    static #resolveRenderedTitleBlock(width, sheet, titleBlock) {
        const footerHints = titleBlock?.footerHints
        const sourceWidth = Number(sheet?.sourceWidth || 0)

        if (!footerHints || !sourceWidth || width <= sourceWidth) {
            return titleBlock
        }

        const footerOffsetX = width - sourceWidth

        return {
            ...titleBlock,
            footerHints: Object.fromEntries(
                Object.entries(footerHints).map(([key, hint]) => [
                    key,
                    hint
                        ? {
                              ...hint,
                              x: Number(hint.x || 0) + footerOffsetX
                          }
                        : hint
                ])
            )
        }
    }

    /**
     * Resolves the synthesized title-block bounds, using recovered footer
     * value hints when the source file exposes them.
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @param {{ footerHints?: Partial<Record<'title' | 'documentNumber' | 'revision' | 'sheetNumber' | 'sheetTotal', { x: number, y: number }>> }} titleBlock
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    static #resolveSheetTitleBlockLayout(width, height, margin, titleBlock) {
        const defaultWidth = Math.min(
            Math.max(width - margin * 2, 100),
            Math.max(Math.min(480, width * 0.34), 140)
        )
        const defaultHeight = Math.min(
            Math.max(height - margin * 2, 100),
            Math.max(Math.min(138, height * 0.18), 102)
        )
        const footerHints = Object.values(titleBlock?.footerHints || {})

        if (footerHints.length < 3) {
            return {
                x: width - margin - defaultWidth,
                y: height - margin - defaultHeight,
                width: defaultWidth,
                height: defaultHeight
            }
        }

        const minX = Math.min(...footerHints.map((hint) => Number(hint.x || 0)))
        const maxX = Math.max(...footerHints.map((hint) => Number(hint.x || 0)))
        const maxY = Math.max(...footerHints.map((hint) => Number(hint.y || 0)))
        const x = Math.max(minX - 120, margin)
        const titleBlockWidth = Math.max(
            Math.min(maxX - minX + 160, width - margin - x),
            280
        )
        const topDocY = Math.max(maxY + 18, margin + 52)
        const titleBlockHeight = Math.max(topDocY - margin, 72)

        return {
            x,
            y: projectSchematicY(height, topDocY),
            width: titleBlockWidth,
            height: titleBlockHeight
        }
    }

    /**
     * Builds one title-block value, preferring recovered footer hint
     * placement, color, and typography when available.
     * @param {number} fallbackX
     * @param {number} fallbackY
     * @param {string} text
     * @param {string} fallbackColor
     * @param {{ x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number } | undefined} footerHint
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildTitleBlockValueMarkup(
        fallbackX,
        fallbackY,
        text,
        fallbackColor,
        footerHint,
        sheetHeight
    ) {
        if (!footerHint) {
            return createSvgText(
                'sheet-title-value',
                fallbackX,
                fallbackY,
                text,
                fallbackColor,
                'middle'
            )
        }

        return createSvgText(
            'sheet-title-value',
            footerHint.x,
            projectSchematicY(sheetHeight, footerHint.y),
            text,
            SchematicColorResolver.resolveColor(
                footerHint.color,
                fallbackColor.replace(/^var\((.+)\)$/, '$1')
            ),
            'middle',
            {
                fontSize: footerHint.fontSize,
                fontFamily: footerHint.fontFamily,
                fontWeight: footerHint.fontWeight
            }
        )
    }

    /**
     * Builds one combined sheet-value hint from the recovered sheet-number row.
     * @param {{ footerHints?: Partial<Record<'sheetNumber' | 'sheetTotal', { x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number }>> }} titleBlock
     * @returns {{ x: number, y: number, color: string, fontSize: number, fontFamily: string, fontWeight: number } | undefined}
     */
    static #buildSheetValueFooterHint(titleBlock) {
        const sheetNumberHint = titleBlock?.footerHints?.sheetNumber
        const sheetTotalHint = titleBlock?.footerHints?.sheetTotal

        if (!sheetNumberHint || !sheetTotalHint) {
            return undefined
        }

        return {
            x: (sheetNumberHint.x + sheetTotalHint.x) / 2,
            y: Math.max(sheetNumberHint.y, sheetTotalHint.y),
            color: sheetNumberHint.color,
            fontSize: sheetNumberHint.fontSize,
            fontFamily: sheetNumberHint.fontFamily,
            fontWeight: sheetNumberHint.fontWeight
        }
    }

    /**
     * Builds the border zone labels around the sheet frame.
     * @param {number} width
     * @param {number} height
     * @param {number} margin
     * @param {{ borderOn?: boolean, xZones?: number, yZones?: number }} sheet
     * @returns {string}
     */
    static #buildSheetZoneMarkup(width, height, margin, sheet) {
        if (!sheet?.borderOn) return ''

        const xZones = Math.max(Number(sheet?.xZones || 0), 1)
        const yZones = Math.max(Number(sheet?.yZones || 0), 1)
        const innerWidth = Math.max(width - margin * 2, 10)
        const innerHeight = Math.max(height - margin * 2, 10)
        let markup = ''

        for (let index = 0; index < xZones; index += 1) {
            const label = String(index + 1)
            const x = margin + (innerWidth * (index + 0.5)) / xZones

            markup +=
                createSvgText(
                    'sheet-zone-label',
                    x,
                    margin - 6,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-zone-label',
                    x,
                    height - 4,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                )
        }

        for (let index = 0; index < yZones; index += 1) {
            const label = String.fromCharCode(65 + index)
            const y = margin + (innerHeight * (index + 0.5)) / yZones

            markup +=
                createSvgText(
                    'sheet-zone-label',
                    8,
                    y + 2,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-zone-label',
                    width - 8,
                    y + 2,
                    label,
                    'var(--schematic-text-color)',
                    'middle'
                )
        }

        return markup
    }

    /**
     * Formats the sheet numbering shown in the title block.
     * @param {{ sheetNumber?: string, sheetTotal?: string }} titleBlock
     * @returns {string}
     */
    static #buildSheetValue(titleBlock) {
        const sheetNumber = String(titleBlock?.sheetNumber || '').trim()
        const sheetTotal = String(titleBlock?.sheetTotal || '').trim()

        if (sheetNumber && sheetTotal) {
            return 'Sheet ' + sheetNumber + ' of ' + sheetTotal
        }

        return sheetNumber || sheetTotal || ''
    }
}
