import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicJunctionRenderer } from './SchematicJunctionRenderer.mjs'
import { SchematicPortRenderer } from './SchematicPortRenderer.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'
import { SchematicPowerPortRenderer } from './SchematicPowerPortRenderer.mjs'
import { SchematicNoteRenderer } from './SchematicNoteRenderer.mjs'
import { SchematicShapeRenderer } from './SchematicShapeRenderer.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const {
    basename,
    buildCurrentDateValue,
    createSvgText,
    escapeHtml,
    formatNumber,
    projectSchematicY
} = SchematicSvgUtils

/**
 * Renders normalized schematic models into presentational SVG.
 */
export class SchematicSvgRenderer {
    /**
     * Renders a normalized schematic model into SVG markup.
     * @param {{ fileName?: string, summary: { title?: string }, schematic?: { sheet: { width: number, height: number, paperSize?: string, borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string } }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean }[], rectangles?: { x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number }[], texts: { x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, anchor?: 'start' | 'middle' | 'end', powerPortDirection?: 'up' | 'down' | 'left' | 'right', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }[], components: { x: number, y: number, designator: string }[], pins?: { x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[], ports?: { x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[], crosses?: { x: number, y: number, size: number, color: string }[] } }} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        const schematic = documentModel?.schematic
        if (!schematic) {
            return '<section class="viewer-empty">No schematic entities were recovered from this file.</section>'
        }

        const width = Math.max(schematic.sheet.width || 1000, 100)
        const height = Math.max(schematic.sheet.height || 700, 100)
        const allTexts = schematic.texts || []
        const lines = schematic.lines.slice(0, 2500)
        const rectangles = (schematic.rectangles || []).slice(0, 500)
        const arcs = (schematic.arcs || []).slice(0, 1000)
        const texts = allTexts
        const components = schematic.components.slice(0, 180)
        const pins = (schematic.pins || []).slice(0, 1000)
        const ports = (schematic.ports || []).slice(0, 250)
        const crosses = (schematic.crosses || []).slice(0, 250)
        const drawableComponents = components.filter(
            (component) =>
                SchematicSvgRenderer.#isDrawableSchematicComponent(component) &&
                !SchematicTypography.hasNearbyVisibleDesignatorText(
                    component,
                    allTexts
                )
        )
        const frameMarkup = SchematicSvgRenderer.#buildSheetChromeMarkup(
            width,
            height,
            schematic.sheet,
            documentModel?.fileName
        )
        const rectangleMarkup = rectangles
            .map((rectangle) =>
                SchematicShapeRenderer.buildRectangleMarkup(rectangle, height)
            )
            .join('')

        const lineMarkup = lines
            .map((line) =>
                SchematicSvgRenderer.#buildSchematicLineMarkup(line, height)
            )
            .join('')
        const arcMarkup = arcs
            .map((arc) => SchematicShapeRenderer.buildArcMarkup(arc, height))
            .join('')

        const textMarkup = texts
            .map((text) =>
                SchematicSvgRenderer.#buildSchematicTextMarkup(
                    text,
                    width,
                    height,
                    schematic.sheet,
                    lines,
                    pins
                )
            )
            .join('')

        const componentMarkup = drawableComponents
            .map(
                (component) =>
                    '<g class="schematic-node"><circle cx="' +
                    formatNumber(component.x) +
                    '" cy="' +
                    formatNumber(projectSchematicY(height, component.y)) +
                    '" r="4" />' +
                    createSvgText(
                        'schematic-designator',
                        component.x + 8,
                        projectSchematicY(height, component.y) - 8,
                        component.designator || '',
                        'var(--schematic-blue-color)',
                        'start',
                        SchematicTypography.buildDefaultSchematicFontOptions(
                            schematic.sheet
                        )
                    ) +
                    '</g>'
            )
            .join('')

        const pinMarkup = pins
            .map((pin) =>
                SchematicSvgRenderer.#buildSchematicPinMarkup(
                    pin,
                    height,
                    schematic.sheet
                )
            )
            .join('')
        const portMarkup = SchematicPortRenderer.buildMarkup(
            ports,
            height,
            schematic.sheet
        )
        const junctionMarkup = SchematicJunctionRenderer.buildMarkup(
            lines,
            crosses,
            height
        )
        const crossMarkup = crosses
            .map((cross) =>
                SchematicSvgRenderer.#buildSchematicCrossMarkup(cross, height)
            )
            .join('')

        return (
            '<section class="svg-panel">' +
            '<header class="svg-panel__header"><h3>' +
            escapeHtml(documentModel?.summary?.title || 'Schematic') +
            '</h3><p>' +
            lines.length +
            ' line segments, ' +
            components.length +
            ' components</p></header>' +
            '<svg class="schematic-svg" viewBox="0 0 ' +
            formatNumber(width) +
            ' ' +
            formatNumber(height) +
            '" preserveAspectRatio="xMidYMid meet" aria-label="Schematic view">' +
            '<rect class="sheet-backdrop" x="0" y="0" width="' +
            formatNumber(width) +
            '" height="' +
            formatNumber(height) +
            '" rx="18" />' +
            frameMarkup +
            '<g class="schematic-rectangles">' +
            rectangleMarkup +
            '</g>' +
            '<g class="schematic-lines">' +
            lineMarkup +
            '</g>' +
            '<g class="schematic-arcs">' +
            arcMarkup +
            '</g>' +
            '<g class="schematic-junctions">' +
            junctionMarkup +
            '</g>' +
            '<g class="schematic-pins">' +
            pinMarkup +
            '</g>' +
            '<g class="schematic-ports">' +
            portMarkup +
            '</g>' +
            '<g class="schematic-crosses">' +
            crossMarkup +
            '</g>' +
            '<g class="schematic-components">' +
            componentMarkup +
            '</g>' +
            '<g class="schematic-texts">' +
            textMarkup +
            '</g>' +
            '</svg></section>'
        )
    }

    /**
     * Builds one schematic line segment, preserving dashed line styles when
     * the source primitive requests them.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean }} line
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSchematicLineMarkup(line, sheetHeight) {
        return (
            '<line x1="' +
            formatNumber(line.x1) +
            '" y1="' +
            formatNumber(projectSchematicY(sheetHeight, line.y1)) +
            '" x2="' +
            formatNumber(line.x2) +
            '" y2="' +
            formatNumber(projectSchematicY(sheetHeight, line.y2)) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    line.color,
                    '--schematic-blue-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(SchematicSvgRenderer.#resolveSchematicLineWidth(line)) +
            '"' +
            SchematicSvgRenderer.#buildSchematicLineStyleAttributes(line) +
            ' />'
        )
    }

    /**
     * Resolves the visible SVG stroke width for one schematic line primitive.
     * @param {{ width: number, isBus?: boolean }} line
     * @returns {number}
     */
    static #resolveSchematicLineWidth(line) {
        const baseWidth = Math.max(Number(line.width || 0), 0.8)

        if (line.isBus !== true) {
            return baseWidth
        }

        return Math.max(baseWidth * 3, 3)
    }

    /**
     * Returns SVG stroke attributes for one schematic line style.
     * @param {{ width: number, lineStyle?: number }} line
     * @returns {string}
     */
    static #buildSchematicLineStyleAttributes(line) {
        if (Number(line.lineStyle || 0) !== 1) {
            return ''
        }

        const dashLength = Math.max(Number(line.width || 1) * 8, 8)
        const gapLength = Math.max(Number(line.width || 1) * 5, 5)

        return (
            ' stroke-dasharray="' +
            formatNumber(dashLength) +
            ' ' +
            formatNumber(gapLength) +
            '" stroke-linecap="round"'
        )
    }

    /**
     * Builds page border and title-block chrome from sheet metadata.
     * @param {number} width
     * @param {number} height
     * @param {{ borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, paperSize?: string, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string } }} sheet
     * @param {string | undefined} fileName
     * @returns {string}
     */
    static #buildSheetChromeMarkup(width, height, sheet, fileName) {
        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        let markup = SchematicSvgRenderer.#buildSheetZoneMarkup(
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

        if (sheet?.titleBlockOn) {
            const titleBlockWidth = Math.min(
                Math.max(width - margin * 2, 100),
                Math.max(Math.min(480, width * 0.34), 140)
            )
            const titleBlockHeight = Math.min(
                Math.max(height - margin * 2, 100),
                Math.max(Math.min(138, height * 0.18), 102)
            )
            const x = width - margin - titleBlockWidth
            const y = height - margin - titleBlockHeight
            const titleBlock = sheet?.titleBlock || {}
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
            const sheetValue = SchematicSvgRenderer.#buildSheetValue(titleBlock)
            const renderedFileName = basename(fileName)
            const renderedDate = titleBlock.date || buildCurrentDateValue()

            markup +=
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
                createSvgText(
                    'sheet-title-value',
                    x + titleBlockWidth * 0.31,
                    titleRowY,
                    titleBlock.title || '',
                    'var(--schematic-blue-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-title-value',
                    x + titleBlockWidth * 0.74,
                    titleRowY,
                    titleBlock.documentNumber || '',
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-title-value',
                    x + titleBlockWidth * 0.92,
                    titleRowY,
                    titleBlock.revision || '',
                    'var(--schematic-blue-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-title-value',
                    x + titleBlockWidth * 0.08,
                    valueRowY,
                    sheet?.paperSize || 'A4',
                    'var(--schematic-text-color)',
                    'middle'
                ) +
                createSvgText(
                    'sheet-title-value',
                    x + titleBlockWidth * 0.415,
                    valueRowY,
                    sheetValue,
                    'var(--schematic-blue-color)',
                    'middle'
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
        }

        return markup
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
     * Builds one free text primitive with font metadata.
     * @param {{ x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, anchor?: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }} text
     * @param {number} sheetWidth
     * @param {number} sheetHeight
     * @param {{ marginWidth?: number }} sheet
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {string}
     */
    static #buildSchematicTextMarkup(
        text,
        sheetWidth,
        sheetHeight,
        sheet,
        lines,
        pins
    ) {
        if (text.recordType === '17') {
            return SchematicPowerPortRenderer.buildMarkup(
                text,
                lines,
                pins,
                sheetHeight
            )
        }

        if (text.recordType === '209' || text.recordType === '28') {
            return SchematicNoteRenderer.buildMarkup(text, sheetHeight)
        }

        const placement = SchematicSvgRenderer.#resolveSchematicTextPlacement(
            text,
            sheetWidth,
            sheetHeight,
            sheet
        )

        return createSvgText(
            'schematic-label',
            placement.x,
            placement.y,
            text.text,
            SchematicColorResolver.resolveColor(
                text.color,
                '--schematic-text-color'
            ),
            placement.anchor,
            {
                fontSize: text.fontSize,
                fontFamily: text.fontFamily,
                fontWeight: text.fontWeight,
                rotation: text.rotation ? -text.rotation : 0
            }
        )
    }

    /**
     * Resolves final text placement for schematic free-text annotations.
     * @param {{ x: number, y: number, text: string, recordType?: string, fontSize?: number, rotation?: number, anchor?: 'start' | 'middle' | 'end' }} text
     * @param {number} sheetWidth
     * @param {number} sheetHeight
     * @param {{ marginWidth?: number }} sheet
     * @returns {{ x: number, y: number, anchor: 'start' | 'middle' | 'end' }}
     */
    static #resolveSchematicTextPlacement(
        text,
        sheetWidth,
        sheetHeight,
        sheet
    ) {
        if (SchematicSvgRenderer.#isSheetHeaderText(text)) {
            const margin = Math.max(Number(sheet?.marginWidth || 20), 10)

            return {
                x: sheetWidth / 2,
                y: Math.max(
                    sheetHeight * 0.16,
                    margin * 2 + (text.fontSize || 0) * 0.5
                ),
                anchor: 'middle'
            }
        }

        return {
            x: text.x,
            y: projectSchematicY(sheetHeight, text.y),
            anchor: text.anchor || 'start'
        }
    }

    /**
     * Returns true when a text primitive behaves like a page title.
     * @param {{ recordType?: string, fontSize?: number, rotation?: number }} text
     * @returns {boolean}
     */
    static #isSheetHeaderText(text) {
        return (
            text.recordType === '4' &&
            !text.rotation &&
            Number(text.fontSize || 0) >= 20
        )
    }

    /**
     * Builds one schematic pin including its stub and visible labels.
     * @param {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }} pin
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildSchematicPinMarkup(pin, sheetHeight, sheet) {
        const geometry = SchematicSvgRenderer.#projectSchematicPinGeometry(pin)
        if (!geometry) return ''

        const textOptions =
            SchematicTypography.buildDefaultSchematicFontOptions(sheet)
        const projectedY = projectSchematicY(sheetHeight, pin.y)
        const projectedInnerY = projectSchematicY(sheetHeight, geometry.bodyY)
        const projectedOuterY = projectSchematicY(sheetHeight, geometry.outerY)
        const texts = []
        const labelColor = SchematicColorResolver.resolveColor(
            pin.labelColor || pin.color,
            '--schematic-text-color'
        )
        const labelMode = pin.labelMode || 'name-and-number'

        if (pin.orientation === 'left') {
            if (labelMode !== 'hidden' && labelMode !== 'name-only') {
                texts.push(
                    createSvgText(
                        'schematic-pin-number',
                        geometry.bodyX - 2,
                        projectedY - 1,
                        pin.designator,
                        labelColor,
                        'end',
                        textOptions
                    )
                )
            }

            if (
                labelMode !== 'hidden' &&
                labelMode !== 'number-only' &&
                pin.name &&
                pin.name !== pin.designator
            ) {
                texts.push(
                    createSvgText(
                        'schematic-pin-name',
                        geometry.bodyX + (labelMode === 'name-only' ? 10 : 4),
                        projectedY + 3,
                        pin.name,
                        labelColor,
                        'start',
                        textOptions
                    )
                )
            }
        }

        if (pin.orientation === 'right') {
            if (labelMode !== 'hidden' && labelMode !== 'name-only') {
                texts.push(
                    createSvgText(
                        'schematic-pin-number',
                        geometry.bodyX + 2,
                        projectedY - 1,
                        pin.designator,
                        labelColor,
                        'start',
                        textOptions
                    )
                )
            }

            if (
                labelMode !== 'hidden' &&
                labelMode !== 'number-only' &&
                pin.name &&
                pin.name !== pin.designator
            ) {
                texts.push(
                    createSvgText(
                        'schematic-pin-name',
                        geometry.bodyX - (labelMode === 'name-only' ? 10 : 4),
                        projectedY + 3,
                        pin.name,
                        labelColor,
                        'end',
                        textOptions
                    )
                )
            }
        }

        if (
            labelMode !== 'hidden' &&
            labelMode !== 'name-only' &&
            (pin.orientation === 'top' || pin.orientation === 'bottom')
        ) {
            texts.push(
                createSvgText(
                    'schematic-pin-number',
                    pin.orientation === 'top' ? geometry.bodyX : geometry.bodyX - 2,
                    pin.orientation === 'top'
                        ? projectedInnerY - 6
                        : projectedInnerY + 7,
                    pin.designator,
                    labelColor,
                    'middle',
                    pin.orientation === 'top'
                        ? textOptions
                        : { ...textOptions, rotation: -90 }
                )
            )
        }

        if (
            labelMode !== 'hidden' &&
            labelMode !== 'number-only' &&
            pin.name &&
            pin.name !== pin.designator &&
            (pin.orientation === 'top' || pin.orientation === 'bottom')
        ) {
            texts.push(
                createSvgText(
                    'schematic-pin-name',
                    pin.orientation === 'top' ? geometry.bodyX : geometry.bodyX + 4,
                    pin.orientation === 'top'
                        ? projectedInnerY + 4
                        : projectedInnerY - 4,
                    pin.name,
                    labelColor,
                    pin.orientation === 'top' ? 'end' : 'start',
                    { ...textOptions, rotation: -90 }
                )
            )
        }

        return (
            '<g class="schematic-pin"><line class="schematic-pin-line" x1="' +
            formatNumber(geometry.bodyX) +
            '" y1="' +
            formatNumber(projectedInnerY) +
            '" x2="' +
            formatNumber(geometry.outerX) +
            '" y2="' +
            formatNumber(projectedOuterY) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    pin.color,
                    '--schematic-bright-blue-color'
                )
            ) +
            '" />' +
            texts.join('') +
            '</g>'
        )
    }

    /**
     * Computes the inner endpoint for a schematic pin stub.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ bodyX: number, bodyY: number, outerX: number, outerY: number } | null}
     */
    static #projectSchematicPinGeometry(pin) {
        switch (pin.orientation) {
            case 'left':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x - pin.length,
                    outerY: pin.y
                }
            case 'right':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x + pin.length,
                    outerY: pin.y
                }
            case 'top':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x,
                    outerY: pin.y + pin.length
                }
            case 'bottom':
                return {
                    bodyX: pin.x,
                    bodyY: pin.y,
                    outerX: pin.x,
                    outerY: pin.y - pin.length
                }
            default:
                return null
        }
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

    /**
     * Builds one schematic cross marker.
     * @param {{ x: number, y: number, size: number, color: string }} cross
     * @param {number} sheetHeight
     * @returns {string}
     */
    static #buildSchematicCrossMarkup(cross, sheetHeight) {
        const x = cross.x
        const y = projectSchematicY(sheetHeight, cross.y)
        const half = Math.max(Number(cross.size || 6), 4) / 2

        return (
            '<g class="schematic-cross"><line x1="' +
            formatNumber(x - half) +
            '" y1="' +
            formatNumber(y - half) +
            '" x2="' +
            formatNumber(x + half) +
            '" y2="' +
            formatNumber(y + half) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    cross.color,
                    '--schematic-alert-color'
                )
            ) +
            '" /><line x1="' +
            formatNumber(x - half) +
            '" y1="' +
            formatNumber(y + half) +
            '" x2="' +
            formatNumber(x + half) +
            '" y2="' +
            formatNumber(y - half) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    cross.color,
                    '--schematic-alert-color'
                )
            ) +
            '" /></g>'
        )
    }

    /**
     * Returns true when a component has enough placement data to draw a marker.
     * @param {{ x?: number, y?: number, designator?: string }} component
     * @returns {boolean}
     */
    static #isDrawableSchematicComponent(component) {
        if (!component) return false

        const hasCoordinates =
            Number.isFinite(component.x) &&
            Number.isFinite(component.y) &&
            (component.x !== 0 || component.y !== 0)
        const hasResolvedDesignator =
            Boolean(component.designator) && component.designator !== 'U?'

        return hasCoordinates && hasResolvedDesignator
    }
}
