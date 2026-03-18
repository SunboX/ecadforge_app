import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicJunctionRenderer } from './SchematicJunctionRenderer.mjs'
import { SchematicPortRenderer } from './SchematicPortRenderer.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'
import { SchematicPowerPortRenderer } from './SchematicPowerPortRenderer.mjs'
import { SchematicNoteRenderer } from './SchematicNoteRenderer.mjs'
import { SchematicShapeRenderer } from './SchematicShapeRenderer.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'
import { SchematicSheetChromeRenderer } from './SchematicSheetChromeRenderer.mjs'

const {
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
     * @param {{ fileName?: string, summary: { title?: string }, schematic?: { sheet: { width: number, height: number, sourceWidth?: number, sourceHeight?: number, paperSize?: string, borderOn?: boolean, titleBlockOn?: boolean, marginWidth?: number, xZones?: number, yZones?: number, titleBlock?: { title?: string, revision?: string, documentNumber?: string, sheetNumber?: string, sheetTotal?: string, date?: string, drawnBy?: string } }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, isBus?: boolean }[], polygons?: { points: { x: number, y: number }[], color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number }[], rectangles?: { x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number }[], arcs?: { x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number }[], texts: { x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, sourceOrientation?: number, anchor?: 'start' | 'middle' | 'end', powerPortDirection?: 'up' | 'down' | 'left' | 'right', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }[], components: { x: number, y: number, designator: string }[], pins?: { x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[], ports?: { x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' | 'up' | 'down' }[], crosses?: { x: number, y: number, size: number, color: string }[] } }} documentModel
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
        const polygons = (schematic.polygons || []).slice(0, 1000)
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
        const contentTransform =
            SchematicSvgRenderer.#buildSchematicContentTransform(
                width,
                height,
                schematic.sheet
            )
        const polygonMarkup = polygons.map((polygon) => SchematicShapeRenderer.buildPolygonMarkup(polygon, height)).join('')
        const rectangleMarkup = rectangles.map((rectangle) => SchematicShapeRenderer.buildRectangleMarkup(rectangle, height)).join('')
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
            .map((component) =>
                SchematicSvgRenderer.#buildFallbackComponentMarkup(
                    component,
                    height,
                    schematic.sheet
                )
            )
            .join('')

        const rotatedVerticalNumberOwners = SchematicTypography.collectRotatedVerticalNumberOwners(pins)
        const pinMarkup = pins
            .map((pin) =>
                SchematicSvgRenderer.#buildSchematicPinMarkup(
                    pin,
                    height,
                    schematic.sheet,
                    rotatedVerticalNumberOwners
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
            ports,
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
            '<g class="schematic-content"' +
            contentTransform +
            '>' +
            '<g class="schematic-polygons">' +
            polygonMarkup +
            '</g>' +
            '<g class="schematic-rectangles">' +
            rectangleMarkup +
            '</g>' +
            '<g class="schematic-lines" stroke-linecap="round">' +
            lineMarkup +
            '</g>' +
            '<g class="schematic-arcs" stroke-linecap="round">' +
            arcMarkup +
            '</g>' +
            '<g class="schematic-junctions">' +
            junctionMarkup +
            '</g>' +
            '<g class="schematic-pins" stroke-linecap="round">' +
            pinMarkup +
            '</g>' +
            '<g class="schematic-ports">' +
            portMarkup +
            '</g>' +
            '<g class="schematic-crosses" stroke-linecap="round">' +
            crossMarkup +
            '</g>' +
            '<g class="schematic-components">' +
            componentMarkup +
            '</g>' +
            '<g class="schematic-texts">' +
            textMarkup +
            '</g>' +
            '</g>' +
            frameMarkup +
            '</svg></section>'
        )
    }

    /**
     * Builds one uniform SVG transform that scales recovered schematic
     * primitives from their source inner frame into a larger normalized page.
     * @param {number} width
     * @param {number} height
     * @param {{ marginWidth?: number, sourceWidth?: number, sourceHeight?: number }} sheet
     * @returns {string}
     */
    static #buildSchematicContentTransform(width, height, sheet) {
        const margin = Math.max(Number(sheet?.marginWidth || 20), 10)
        const sourceWidth = Number(sheet?.sourceWidth || 0)
        const sourceHeight = Number(sheet?.sourceHeight || 0)

        if (
            sourceWidth <= margin * 2 ||
            sourceHeight <= margin * 2 ||
            (width <= sourceWidth && height <= sourceHeight)
        ) {
            return ''
        }

        const sourceInnerWidth = sourceWidth - margin * 2
        const sourceInnerHeight = sourceHeight - margin * 2
        const targetInnerWidth = width - margin * 2
        const targetInnerHeight = height - margin * 2
        const scale = Math.min(
            targetInnerWidth / sourceInnerWidth,
            targetInnerHeight / sourceInnerHeight
        )

        if (!Number.isFinite(scale) || scale <= 1) {
            return ''
        }

        const pivotX = margin
        const pivotY = height - margin

        return (
            ' transform="translate(' +
            formatNumber(pivotX) +
            ' ' +
            formatNumber(pivotY) +
            ') scale(' +
            formatNumber(scale) +
            ') translate(' +
            formatNumber(-pivotX) +
            ' ' +
            formatNumber(-pivotY) +
            ')"'
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
                    '--schematic-default-ink-color'
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
        return SchematicSheetChromeRenderer.buildMarkup(
            width,
            height,
            sheet,
            fileName
        )
    }

    /**
     * Builds one free text primitive with font metadata.
     * @param {{ x: number, y: number, text: string, color: string, recordType?: string, style?: number, fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, sourceOrientation?: number, anchor?: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }} text
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
            SchematicTypography.buildSchematicTextRenderOptions(text)
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
     * @param {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor?: string, labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex?: string }} pin
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @param {Set<string>} rotatedVerticalNumberOwners
     * @returns {string}
     */
    static #buildSchematicPinMarkup(
        pin,
        sheetHeight,
        sheet,
        rotatedVerticalNumberOwners
    ) {
        const geometry = SchematicSvgRenderer.#projectSchematicPinGeometry(pin)
        if (!geometry) return ''

        const textOptions =
            SchematicTypography.buildViewerSchematicFontOptions(sheet)
        const projectedY = projectSchematicY(sheetHeight, pin.y)
        const projectedInnerY = projectSchematicY(sheetHeight, geometry.bodyY)
        const projectedOuterY = projectSchematicY(sheetHeight, geometry.outerY)
        const texts = []
        const labelColor = SchematicColorResolver.resolveColor(
            pin.labelColor || pin.color,
            '--schematic-text-color'
        )
        const labelMode = pin.labelMode || 'name-and-number'
        const rotateTopNumber =
            pin.orientation === 'top' &&
            rotatedVerticalNumberOwners.has(String(pin.ownerIndex || ''))

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
                    pin.orientation === 'top' ? geometry.bodyX - 2 : geometry.bodyX - 2,
                    pin.orientation === 'top'
                        ? projectedInnerY - 6
                        : projectedInnerY + 7,
                    pin.designator,
                    labelColor,
                    'middle',
                    pin.orientation === 'top' && !rotateTopNumber
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
                    '--schematic-accent-ink-color'
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
     * Builds one synthetic designator label for a fallback component
     * placement without the old marker circle.
     * @param {{ x: number, y: number, designator?: string }} component
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildFallbackComponentMarkup(component, sheetHeight, sheet) {
        return createSvgText(
            'schematic-designator',
            component.x + 8,
            projectSchematicY(sheetHeight, component.y) - 8,
            component.designator || '',
            'var(--schematic-default-ink-color)',
            'start',
            SchematicTypography.buildViewerSchematicFontOptions(sheet)
        )
    }

    /**
     * Returns true when a component has enough placement data to draw a
     * fallback designator label.
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
