// SPDX-FileCopyrightText: 2026 André Fiedler
// SPDX-License-Identifier: GPL-3.0-or-later

import { KicadStrokeFont } from './KicadStrokeFont.mjs'
import { SchematicSvgShapeRenderer } from './SchematicSvgShapeRenderer.mjs'

const displayScale = 10
const worksheetFrameInset = 2
const worksheetTitleBlockLeft = 110
const worksheetTitleBlockRight = 2
const worksheetTitleBlockTop = 34
const worksheetTitleBlockBottom = 2
const worksheetZoneStep = 50
const kicadTextLineSpacingRatio = 1.61
const kicadFirstLineHeightRatio = 1.17
const kicadStrokeBaselineFudgeRatio = 0.052
const wireColor = 'var(--schematic-default-ink-color)'
const symbolColor = 'var(--schematic-power-color)'
const sheetGraphicColor = 'var(--schematic-accent-ink-color)'
const labelColor = 'var(--schematic-text-color)'
const globalLabelColor = 'var(--schematic-alert-color)'
const frameColor = 'var(--schematic-sheet-frame-stroke)'
const symbolFillColor = 'var(--schematic-fill-color)'
const pinMarkerFillColor = 'var(--schematic-pin-marker-fill)'

/**
 * Renders normalized KiCad schematic documents to deterministic SVG.
 */
export class SchematicSvgRenderer {
    /**
     * Renders one schematic document.
     * @param {object | null} documentModel Document model.
     * @returns {string}
     */
    static render(documentModel) {
        const schematic = documentModel?.schematic
        if (!schematic) return SchematicSvgRenderer.renderEmpty()

        const sheet = schematic.sheet || { width: 100, height: 80 }
        const sourceWidth = Number(sheet.width || 100)
        const sourceHeight = Number(sheet.height || 80)
        const width = sourceWidth * displayScale
        const height = sourceHeight * displayScale
        const title =
            documentModel.summary?.title ||
            documentModel.fileName ||
            'Schematic'
        const lineCount = (schematic.lines || []).length
        const componentCount = (schematic.components || []).length
        const shapeTheme = {
            resolveFillColor: resolveSchematicFillColor,
            resolveInkColor: resolveSchematicInkColor
        }
        return [
            '<section class="svg-panel">',
            `<header class="svg-panel__header"><h3>${escapeHtml(title)}</h3><p>${lineCount} line segments, ${componentCount} components</p></header>`,
            `<svg xmlns="http://www.w3.org/2000/svg" class="schematic-svg" viewBox="0 0 ${formatNumber(width)} ${formatNumber(height)}" role="img" aria-label="${escapeAttribute(documentModel.summary?.title || documentModel.fileName || 'Schematic')}">`,
            `<rect class="sheet-backdrop" x="0" y="0" width="${formatNumber(width)}" height="${formatNumber(height)}" rx="0"/>`,
            SchematicSvgShapeRenderer.renderGrid(sheet, width, height, {
                displayScale,
                frameColor
            }),
            renderSheetChrome(sheet, width, height, documentModel?.fileName),
            `<g class="schematic-scene" transform="scale(${formatNumber(displayScale)})">`,
            renderSheetSymbols(schematic.sheetSymbols || []),
            SchematicSvgShapeRenderer.renderPolygons(
                schematic.polygons || [],
                shapeTheme
            ),
            renderRectangles(schematic.rectangles || []),
            SchematicSvgShapeRenderer.renderEllipses(
                schematic.ellipses || [],
                shapeTheme
            ),
            SchematicSvgShapeRenderer.renderArcs(
                schematic.arcs || [],
                shapeTheme
            ),
            SchematicSvgShapeRenderer.renderBeziers(
                schematic.beziers || [],
                shapeTheme
            ),
            renderLines(schematic.lines || []),
            renderPins(schematic.pins || []),
            renderJunctions(schematic.junctions || []),
            renderCrosses(schematic.crosses || []),
            renderTexts(schematic.texts || []),
            '</g></svg></section>'
        ].join('')
    }

    /**
     * Renders empty schematic SVG.
     * @returns {string}
     */
    static renderEmpty() {
        return [
            '<svg xmlns="http://www.w3.org/2000/svg" class="schematic-svg schematic-svg--empty" viewBox="0 0 100 60" role="img" aria-label="Drop schematic file">',
            '<rect x="1" y="1" width="98" height="58" rx="2" fill="#f8fafc" stroke="#94a3b8" stroke-width="0.4" stroke-dasharray="1.5 1"/>',
            '<text x="50" y="31" text-anchor="middle" fill="#1f2937" font-size="5">Drop schematic file</text>',
            '</svg>'
        ].join('')
    }
}

/**
 * Renders schematic lines.
 * @param {object[]} lines Lines.
 * @returns {string}
 */
function renderLines(lines) {
    return lines
        .map(
            (line) =>
                `<line class="schematic-line${line.isBus ? ' schematic-line--bus' : ''}" x1="${formatNumber(line.x1)}" y1="${formatNumber(line.y1)}" x2="${formatNumber(line.x2)}" y2="${formatNumber(line.y2)}" stroke="${resolveSchematicInkColor(line)}" stroke-width="${formatNumber(line.width || 0.15)}" stroke-linecap="round"/>`
        )
        .join('')
}

/**
 * Renders rectangles.
 * @param {object[]} rectangles Rectangles.
 * @returns {string}
 */
function renderRectangles(rectangles) {
    return rectangles
        .map(
            (rectangle) =>
                `<rect class="schematic-rect" x="${formatNumber(rectangle.x)}" y="${formatNumber(rectangle.y)}" width="${formatNumber(rectangle.width)}" height="${formatNumber(rectangle.height)}" fill="${resolveSchematicFillColor(rectangle)}" stroke="${resolveSchematicInkColor(rectangle)}" stroke-width="${formatNumber(rectangle.lineWidth || 0.15)}"/>`
        )
        .join('')
}

/**
 * Renders hierarchical sheet symbols.
 * @param {object[]} sheets Sheets.
 * @returns {string}
 */
function renderSheetSymbols(sheets) {
    return sheets
        .map(
            (sheet) =>
                `<g class="schematic-sheet-symbol"><rect x="${formatNumber(sheet.x)}" y="${formatNumber(sheet.y)}" width="${formatNumber(sheet.width)}" height="${formatNumber(sheet.height)}" fill="none" stroke="${sheetGraphicColor}" stroke-width="0.2"/><text class="schematic-label" x="${formatNumber(sheet.x + 1)}" y="${formatNumber(sheet.y + 3)}" font-size="2.5" fill="${labelColor}">${escapeHtml(sheet.name || '')}</text></g>`
        )
        .join('')
}

/**
 * Renders pins.
 * @param {object[]} pins Pins.
 * @returns {string}
 */
function renderPins(pins) {
    return pins
        .map((pin) => {
            if (pin.visible === false) return ''
            const end = pinConnectionPoint(pin)
            return [
                `<line class="schematic-pin-line" x1="${formatNumber(pin.x)}" y1="${formatNumber(pin.y)}" x2="${formatNumber(end.x)}" y2="${formatNumber(end.y)}" stroke="${symbolColor}" stroke-width="0.08"/>`,
                renderPinEndpoint(pin),
                renderPinNumber(pin)
            ].join('')
        })
        .join('')
}

/**
 * Renders text nodes.
 * @param {object[]} texts Texts.
 * @returns {string}
 */
function renderTexts(texts) {
    return texts
        .map((text) =>
            renderStrokeText({
                className: resolveSchematicTextClass(text),
                x: text.x,
                y: text.y,
                value: text.text || text.value || '',
                color: resolveSchematicTextColor(text),
                sizeX: resolveTextWidth(text),
                sizeY: resolveTextHeight(text),
                hAlign: resolveTextHAlign(text),
                vAlign: resolveTextVAlign(text),
                rotation: resolveRenderedTextRotation(text)
            })
        )
        .join('')
}

/**
 * Renders junction dots.
 * @param {object[]} junctions Junctions.
 * @returns {string}
 */
function renderJunctions(junctions) {
    return junctions
        .map(
            (junction) =>
                `<g class="schematic-node"><circle class="schematic-junction" cx="${formatNumber(junction.x)}" cy="${formatNumber(junction.y)}" r="${formatNumber((junction.diameter || 0.9) / 2)}" fill="${wireColor}"/></g>`
        )
        .join('')
}

/**
 * Renders no-connect crosses.
 * @param {object[]} crosses Crosses.
 * @returns {string}
 */
function renderCrosses(crosses) {
    return crosses
        .map((cross) => {
            const size = Number(cross.size || 1.5) / 2
            return `<path class="schematic-cross" d="M ${formatNumber(cross.x - size)} ${formatNumber(cross.y - size)} L ${formatNumber(cross.x + size)} ${formatNumber(cross.y + size)} M ${formatNumber(cross.x + size)} ${formatNumber(cross.y - size)} L ${formatNumber(cross.x - size)} ${formatNumber(cross.y + size)}" stroke="${globalLabelColor}" stroke-width="0.15"/>`
        })
        .join('')
}

/**
 * Renders sheet frame, zone labels, and title block.
 * @param {object} sheet Sheet metadata.
 * @param {number} width Sheet width.
 * @param {number} height Sheet height.
 * @returns {string}
 */
function renderSheetChrome(sheet, width, height, fileName) {
    const margin = Number(sheet.marginWidth || 10) * displayScale
    const markup = []

    if (sheet.borderOn !== false) {
        markup.push(renderSheetFrame(sheet, width, height, margin))
    }

    if (sheet.titleBlockOn !== false) {
        markup.push(
            renderTitleBlock(sheet.titleBlock || {}, width, height, margin, {
                paperSize: sheet.paperSize,
                fileName
            })
        )
    }

    return markup.join('')
}

/**
 * Renders a sheet border and zone labels.
 * @param {object} sheet Sheet metadata.
 * @param {number} width Sheet width.
 * @param {number} height Sheet height.
 * @param {number} margin Sheet margin.
 * @returns {string}
 */
function renderSheetFrame(sheet, width, height, margin) {
    const left = margin
    const top = margin
    const right = Math.max(width - margin, left)
    const bottom = Math.max(height - margin, top)
    const frameWidth = Math.max(right - left, 0)
    const frameHeight = Math.max(bottom - top, 0)
    const innerInset = worksheetFrameInset * displayScale
    const zoneStep = worksheetZoneStep * displayScale
    const xZones = Math.max(Number(sheet.xZones || 0), 0)
    const yZones = Math.max(Number(sheet.yZones || 0), 0)
    const parts = [
        `<rect class="sheet-frame" x="${formatNumber(left)}" y="${formatNumber(top)}" width="${formatNumber(frameWidth)}" height="${formatNumber(frameHeight)}"/>`,
        `<rect class="sheet-frame sheet-frame--inner" x="${formatNumber(left + innerInset)}" y="${formatNumber(top + innerInset)}" width="${formatNumber(Math.max(frameWidth - innerInset * 2, 0))}" height="${formatNumber(Math.max(frameHeight - innerInset * 2, 0))}"/>`
    ]

    for (let index = 1; index < xZones; index += 1) {
        const x = resolveWorksheetZoneCoordinate(
            left,
            right,
            xZones,
            index,
            zoneStep
        )
        parts.push(
            `<line class="sheet-zone-separator" x1="${formatNumber(x)}" y1="${formatNumber(top + innerInset)}" x2="${formatNumber(x)}" y2="${formatNumber(top)}"/>`,
            `<line class="sheet-zone-separator" x1="${formatNumber(x)}" y1="${formatNumber(bottom - innerInset)}" x2="${formatNumber(x)}" y2="${formatNumber(bottom)}"/>`
        )
    }

    for (let index = 0; index < xZones; index += 1) {
        const label = String(index + 1)
        const x = resolveWorksheetZoneCoordinate(
            left,
            right,
            xZones,
            index + 0.5,
            zoneStep
        )
        parts.push(
            renderWorksheetText({
                className: 'sheet-zone-label',
                x,
                y: top + innerInset / 2,
                value: label,
                color: frameColor,
                size: 13,
                hAlign: 'center',
                vAlign: 'center',
                thickness: 1.5
            }),
            renderWorksheetText({
                className: 'sheet-zone-label',
                x,
                y: bottom - innerInset / 2,
                value: label,
                color: frameColor,
                size: 13,
                hAlign: 'center',
                vAlign: 'center',
                thickness: 1.5
            })
        )
    }

    for (let index = 1; index < yZones; index += 1) {
        const y = resolveWorksheetZoneCoordinate(
            top,
            bottom,
            yZones,
            index,
            zoneStep
        )
        parts.push(
            `<line class="sheet-zone-separator" x1="${formatNumber(left)}" y1="${formatNumber(y)}" x2="${formatNumber(left + innerInset)}" y2="${formatNumber(y)}"/>`,
            `<line class="sheet-zone-separator" x1="${formatNumber(right - innerInset)}" y1="${formatNumber(y)}" x2="${formatNumber(right)}" y2="${formatNumber(y)}"/>`
        )
    }

    for (let index = 0; index < yZones; index += 1) {
        const label = String.fromCharCode(65 + index)
        const y = resolveWorksheetZoneCoordinate(
            top,
            bottom,
            yZones,
            index + 0.5,
            zoneStep
        )
        parts.push(
            renderWorksheetText({
                className: 'sheet-zone-label',
                x: left + innerInset / 2,
                y,
                value: label,
                color: frameColor,
                size: 13,
                hAlign: 'center',
                vAlign: 'center',
                thickness: 1.5
            }),
            renderWorksheetText({
                className: 'sheet-zone-label',
                x: right - innerInset / 2,
                y,
                value: label,
                color: frameColor,
                size: 13,
                hAlign: 'center',
                vAlign: 'center',
                thickness: 1.5
            })
        )
    }

    return parts.join('')
}

/**
 * Resolves a worksheet zone coordinate using KiCad's 50 mm default cadence.
 * @param {number} start Frame start.
 * @param {number} end Frame end.
 * @param {number} zoneCount Zone count.
 * @param {number} index Zone index or center offset.
 * @param {number} step Default zone step.
 * @returns {number}
 */
function resolveWorksheetZoneCoordinate(start, end, zoneCount, index, step) {
    const fixed = start + step * index
    if (fixed <= end) return fixed
    return start + ((end - start) / Math.max(zoneCount, 1)) * index
}

/**
 * Renders KiCad's default worksheet title block.
 * @param {object} titleBlock Title block metadata.
 * @param {number} width Sheet width.
 * @param {number} height Sheet height.
 * @param {number} margin Sheet margin.
 * @returns {string}
 */
function renderTitleBlock(titleBlock, width, height, margin, options = {}) {
    const anchorRight = width - margin
    const anchorBottom = height - margin
    const x = anchorRight - worksheetTitleBlockLeft * displayScale
    const y = anchorBottom - worksheetTitleBlockTop * displayScale
    const blockRight = anchorRight - worksheetTitleBlockRight * displayScale
    const blockBottom = anchorBottom - worksheetTitleBlockBottom * displayScale
    const blockWidth = blockRight - x
    const blockHeight = blockBottom - y
    const title = titleBlock.title || ''
    const revision = titleBlock.revision || ''
    const date = titleBlock.date || ''
    const company = titleBlock.documentNumber || ''
    const fileName = basename(options.fileName || '')
    const paperSize = options.paperSize || ''
    const commentValues = titleBlock.comments || {}
    const fromRight = (value) => anchorRight - value * displayScale
    const fromBottom = (value) => anchorBottom - value * displayScale
    const sheetValue = titleBlock.sheetName || '/'
    const idValue = titleBlock.sheetTotal
        ? `${titleBlock.sheetNumber || '1'}/${titleBlock.sheetTotal}`
        : '1/1'

    return [
        '<g class="sheet-title-block">',
        `<rect x="${formatNumber(x)}" y="${formatNumber(y)}" width="${formatNumber(blockWidth)}" height="${formatNumber(blockHeight)}"/>`,
        renderWorksheetLine(x, fromBottom(5.5), blockRight, fromBottom(5.5)),
        renderWorksheetLine(x, fromBottom(8.5), blockRight, fromBottom(8.5)),
        renderWorksheetLine(x, fromBottom(12.5), blockRight, fromBottom(12.5)),
        renderWorksheetLine(x, fromBottom(18.5), blockRight, fromBottom(18.5)),
        renderWorksheetLine(
            fromRight(90),
            fromBottom(8.5),
            fromRight(90),
            fromBottom(5.5)
        ),
        renderWorksheetLine(
            fromRight(26),
            fromBottom(8.5),
            fromRight(26),
            fromBottom(2)
        ),
        renderTitleText({
            className: 'sheet-title-value sheet-title-value--company',
            x: fromRight(109),
            y: fromBottom(20),
            value: company,
            color: labelColor,
            thickness: 2.4
        }),
        renderTitleText({
            className: 'sheet-title-label',
            x: fromRight(109),
            y: fromBottom(17),
            value: `Sheet: ${sheetValue}`,
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label',
            x: fromRight(109),
            y: fromBottom(14.3),
            value: `File: ${fileName}`,
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-value sheet-title-value--title',
            x: fromRight(109),
            y: fromBottom(10.7),
            value: `Title: ${title}`,
            color: wireColor,
            size: 20,
            thickness: 4
        }),
        renderTitleText({
            className: 'sheet-title-label',
            x: fromRight(109),
            y: fromBottom(6.9),
            value: `Size: ${paperSize}`,
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label',
            x: fromRight(87),
            y: fromBottom(6.9),
            value: `Date: ${date}`,
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-value sheet-title-value--revision',
            x: fromRight(24),
            y: fromBottom(6.9),
            value: `Rev: ${revision}`,
            color: wireColor,
            thickness: 3
        }),
        renderTitleText({
            className: 'sheet-title-label',
            x: fromRight(109),
            y: fromBottom(4.1),
            value: 'KiCad E.D.A.',
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label',
            x: fromRight(24),
            y: fromBottom(4.1),
            value: `Id: ${idValue}`,
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label sheet-title-comment',
            x: fromRight(109),
            y: fromBottom(23),
            value: commentValues['0'] || '',
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label sheet-title-comment',
            x: fromRight(109),
            y: fromBottom(26),
            value: commentValues['1'] || '',
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label sheet-title-comment',
            x: fromRight(109),
            y: fromBottom(29),
            value: commentValues['2'] || '',
            color: labelColor
        }),
        renderTitleText({
            className: 'sheet-title-label sheet-title-comment',
            x: fromRight(109),
            y: fromBottom(32),
            value: commentValues['3'] || '',
            color: labelColor
        }),
        '</g>'
    ].join('')
}

/**
 * Renders one worksheet line.
 * @param {number} x1 Start x.
 * @param {number} y1 Start y.
 * @param {number} x2 End x.
 * @param {number} y2 End y.
 * @returns {string}
 */
function renderWorksheetLine(x1, y1, x2, y2) {
    return `<line x1="${formatNumber(x1)}" y1="${formatNumber(y1)}" x2="${formatNumber(x2)}" y2="${formatNumber(y2)}"/>`
}

/**
 * Renders one title-block text element.
 * @param {{ className: string, x: number, y: number, value: string, color: string, size?: number, hAlign?: string, vAlign?: string, thickness?: number }} options Text options.
 * @returns {string}
 */
function renderTitleText(options) {
    return renderWorksheetText({
        size: 15,
        hAlign: 'left',
        vAlign: 'bottom',
        thickness: 1.5,
        ...options
    })
}

/**
 * Renders one worksheet text element with KiCad's stroke font.
 * @param {{ className: string, x: number, y: number, value: string, color: string, size: number, hAlign: string, vAlign: string, thickness: number }} options Text options.
 * @returns {string}
 */
function renderWorksheetText(options) {
    if (!String(options.value || '').trim()) return ''
    return renderStrokeText({
        className: options.className,
        x: options.x,
        y: options.y,
        value: options.value,
        color: options.color,
        sizeX: options.size,
        sizeY: options.size,
        hAlign: options.hAlign,
        vAlign: options.vAlign,
        rotation: 0,
        thickness: options.thickness
    })
}

/**
 * Renders one visible KiCad pin endpoint at the symbol body.
 * @param {object} pin Pin.
 * @returns {string}
 */
function renderPinEndpoint(pin) {
    if (!pin.endpointVisible) return ''
    return `<circle class="schematic-pin-endpoint" cx="${formatNumber(pin.x)}" cy="${formatNumber(pin.y)}" r="0.42" fill="${pinMarkerFillColor}" stroke="${symbolColor}" stroke-width="0.12"/>`
}

/**
 * Renders one KiCad pin number near the symbol body.
 * @param {object} pin Pin.
 * @returns {string}
 */
function renderPinNumber(pin) {
    const label = String(pin.designator || '').trim()
    if (!label || label === '~' || pin.numberVisible === false) return ''
    const offset = 0.35
    const fontSize = Number(pin.numberFontSize || 0.85)
    const x =
        pin.orientation === 'left'
            ? pin.x - offset
            : pin.orientation === 'right'
              ? pin.x + offset
              : pin.x + offset
    const y =
        pin.orientation === 'top'
            ? pin.y + offset
            : pin.orientation === 'bottom'
              ? pin.y - offset
              : pin.y - offset
    return renderStrokeText({
        className: 'schematic-pin-number',
        x,
        y,
        value: label,
        color: symbolColor,
        sizeX: fontSize,
        sizeY: fontSize,
        hAlign: pin.orientation === 'left' ? 'right' : 'left',
        vAlign:
            pin.orientation === 'top'
                ? 'top'
                : pin.orientation === 'bottom'
                  ? 'bottom'
                  : 'center',
        rotation: 0
    })
}

/**
 * Resolves the visible color of a KiCad symbol pin line.
 * @param {object} pin Pin.
 * @returns {string}
 */
/**
 * Resolves schematic primitive stroke color.
 * @param {object} primitive Primitive.
 * @returns {string}
 */
function resolveSchematicInkColor(primitive) {
    if (primitive?.ownerIndex) return symbolColor
    if (primitive?.sourceType === 'polyline') return sheetGraphicColor
    if (primitive?.isBus) return sheetGraphicColor
    return wireColor
}

/**
 * Resolves schematic rectangle fill color.
 * @param {object} primitive Primitive.
 * @returns {string}
 */
function resolveSchematicFillColor(primitive) {
    if (primitive?.fill === 'outline') {
        return symbolColor
    }

    if (primitive?.fill && primitive.fill !== 'none') {
        return symbolFillColor
    }

    return 'none'
}

/**
 * Resolves schematic text class names.
 * @param {object} text Text primitive.
 * @returns {string}
 */
function resolveSchematicTextClass(text) {
    return text?.labelKind ? 'schematic-text schematic-label' : 'schematic-text'
}

/**
 * Resolves schematic text color.
 * @param {object} text Text primitive.
 * @returns {string}
 */
function resolveSchematicTextColor(text) {
    if (text?.ownerIndex) return labelColor
    if (text?.labelKind === 'global') return globalLabelColor
    if (text?.labelKind === 'hierarchical') return sheetGraphicColor
    if (text?.labelKind === 'local') return labelColor
    return labelColor
}

/**
 * Renders one KiCad stroke-font text item.
 * @param {{ className: string, x: number, y: number, value: string, color: string, sizeX: number, sizeY: number, hAlign: string, vAlign: string, rotation: number }} text Text item.
 * @returns {string}
 */
function renderStrokeText(text) {
    const lines = String(text.value || '').split('\n')
    const lineSpacing = textLineSpacing(text)
    const strokeWidth = textStrokeWidth(text)
    const attrs = [
        `class="${text.className}"`,
        `aria-label="${escapeAttribute(text.value)}"`,
        'fill="none"',
        `stroke="${text.color}"`,
        `stroke-width="${formatNumber(strokeWidth)}"`,
        'stroke-linecap="round"',
        'stroke-linejoin="round"',
        renderStrokeTextTransform(text)
    ].join(' ')

    return `<g ${attrs}>${lines.map((line, index) => renderStrokeTextLine(text, line, index, lines.length, lineSpacing)).join('')}</g>`
}

/**
 * Renders one KiCad stroke-font text line.
 * @param {object} text Text item.
 * @param {string} line Line value.
 * @param {number} index Line index.
 * @param {number} lineCount Total line count.
 * @param {number} lineSpacing Line spacing.
 * @returns {string}
 */
function renderStrokeTextLine(text, line, index, lineCount, lineSpacing) {
    const sizeX = textWidth(text)
    const sizeY = textHeight(text)
    const lineWidth = KicadStrokeFont.measureLine(line, sizeX)
    const x = textLineX(text, lineWidth)
    const y = textLineY(text, index, lineCount, lineSpacing)
    const strokes = KicadStrokeFont.strokeLine(line, { x, y, sizeX, sizeY })
    const attrs = [
        'class="schematic-text-line"',
        `data-line="${escapeAttribute(line)}"`,
        `data-x="${formatNumber(x)}"`,
        `data-y="${formatNumber(y)}"`
    ].join(' ')

    return `<g ${attrs}>${strokes.map(renderStrokeTextStroke).join('')}</g>`
}

/**
 * Renders one KiCad stroke-font stroke.
 * @param {{ x: number, y: number }[]} points Stroke points.
 * @returns {string}
 */
function renderStrokeTextStroke(points) {
    return `<path class="schematic-text-stroke" d="${pathFromPoints(points)}"/>`
}

/**
 * Resolves KiCad's horizontal text justification.
 * @param {object} text Text primitive.
 * @returns {'left' | 'center' | 'right'}
 */
function resolveTextHAlign(text) {
    if (text?.symbolKind === 'power') return 'center'
    if (text?.anchor === 'end') return 'right'
    if (text?.anchor === 'middle') return 'center'
    const hAlign = text?.font?.hAlign
    if (hAlign === 'right') return 'right'
    if (hAlign === 'center') return 'center'
    return 'left'
}

/**
 * Resolves KiCad's vertical text justification.
 * @param {object} text Text primitive.
 * @returns {string}
 */
function resolveTextVAlign(text) {
    const vAlign = text?.vAlign || text?.font?.vAlign
    if (vAlign === 'top') return 'top'
    if (vAlign === 'center') return 'center'
    return 'bottom'
}

/**
 * Resolves KiCad's horizontal stroke size.
 * @param {object} text Text primitive.
 * @returns {number}
 */
function resolveTextWidth(text) {
    return positiveTextSize(text?.font?.width, text?.fontSize || text?.size)
}

/**
 * Resolves KiCad's vertical stroke size.
 * @param {object} text Text primitive.
 * @returns {number}
 */
function resolveTextHeight(text) {
    return positiveTextSize(text?.font?.height, text?.fontSize || text?.size)
}

/**
 * Resolves a KiCad stroke-font size.
 * @param {number | undefined} primary Primary value.
 * @param {number | undefined} secondary Secondary value.
 * @returns {number}
 */
function positiveTextSize(primary, secondary) {
    const value = Number(primary) || Number(secondary) || 1
    return Math.max(value, 0.001)
}

/**
 * Renders a rotation transform for KiCad stroke text.
 * @param {object} text Text primitive.
 * @returns {string}
 */
function renderStrokeTextTransform(text) {
    const rotation = Number(text.rotation || 0)
    if (Math.abs(rotation) < 0.001) return ''
    return `transform="rotate(${formatNumber(rotation)} ${formatNumber(text.x)} ${formatNumber(text.y)})"`
}

/**
 * Resolves the SVG rotation direction for one rendered text node.
 * @param {object} text Text primitive.
 * @returns {number}
 */
function resolveRenderedTextRotation(text) {
    const rotation = -resolveReadableTextRotation(text)
    if (text?.symbolKind !== 'power') return rotation
    if (Math.abs(Math.abs(rotation) - 90) > 0.001) return rotation
    return rotation < 0 ? rotation + 180 : rotation - 180
}

/**
 * Resolves the display rotation for KiCad text while keeping flipped labels readable.
 * @param {object} text Text primitive.
 * @returns {number}
 */
function resolveReadableTextRotation(text) {
    const rotation = Number(text?.rotation || 0)
    if (!Number.isFinite(rotation)) return 0
    const normalized = ((rotation % 360) + 360) % 360
    if (Math.abs(normalized - 180) < 0.001) return 0
    if (normalized > 180) return normalized - 360
    return normalized
}

/**
 * Resolves pin connection point.
 * @param {object} pin Pin.
 * @returns {{ x: number, y: number }}
 */
function pinConnectionPoint(pin) {
    if (pin.orientation === 'left') return { x: pin.x - pin.length, y: pin.y }
    if (pin.orientation === 'right') return { x: pin.x + pin.length, y: pin.y }
    if (pin.orientation === 'top') return { x: pin.x, y: pin.y - pin.length }
    return { x: pin.x, y: pin.y + pin.length }
}

/**
 * Calculates KiCad-like baseline spacing for multiline text.
 * @param {object} text Text item.
 * @returns {number}
 */
function textLineSpacing(text) {
    return textHeight(text) * kicadTextLineSpacingRatio
}

/**
 * Resolves KiCad's vertical stroke size for font and baseline metrics.
 * @param {object} text Text item.
 * @returns {number}
 */
function textHeight(text) {
    return positiveTextSize(text.sizeY, text.sizeX)
}

/**
 * Resolves KiCad's horizontal stroke size for glyph scaling.
 * @param {object} text Text item.
 * @returns {number}
 */
function textWidth(text) {
    return positiveTextSize(text.sizeX, text.sizeY)
}

/**
 * Calculates line origin from KiCad horizontal justification.
 * @param {object} text Text item.
 * @param {number} lineWidth Line width.
 * @returns {number}
 */
function textLineX(text, lineWidth) {
    if (text.hAlign === 'left') return text.x
    if (text.hAlign === 'right') return text.x - lineWidth
    return text.x - lineWidth / 2
}

/**
 * Calculates one line baseline from KiCad vertical justification.
 * @param {object} text Text item.
 * @param {number} index Line index.
 * @param {number} lineCount Total line count.
 * @param {number} lineSpacing Line spacing.
 * @returns {number}
 */
function textLineY(text, index, lineCount, lineSpacing) {
    const height = textHeight(text)
    const blockHeight =
        height * kicadFirstLineHeightRatio + lineSpacing * (lineCount - 1)
    let baseline = text.y + height - textStrokeBaselineFudge(text)

    if (text.vAlign === 'bottom') {
        baseline -= blockHeight
    } else if (text.vAlign === 'center') {
        baseline -= blockHeight / 2
    }

    return baseline + lineSpacing * index
}

/**
 * Mirrors KiCad's small stroke-font baseline adjustment.
 * @param {object} text Text item.
 * @returns {number}
 */
function textStrokeBaselineFudge(text) {
    return textStrokeWidth(text) * kicadStrokeBaselineFudgeRatio
}

/**
 * Resolves KiCad text stroke width.
 * @param {object} text Text item.
 * @returns {number}
 */
function textStrokeWidth(text) {
    return Math.max(Number(text.thickness) || 0.12, 0.01)
}

/**
 * Converts points to an SVG path.
 * @param {{ x: number, y: number }[]} points Points.
 * @returns {string}
 */
function pathFromPoints(points) {
    if (!points.length) return ''
    const [first, ...rest] = points
    const commands = [`M ${formatNumber(first.x)} ${formatNumber(first.y)}`]
    rest.forEach((point) => {
        commands.push(`L ${formatNumber(point.x)} ${formatNumber(point.y)}`)
    })
    return commands.join(' ')
}

/**
 * Returns the file basename.
 * @param {string} value Path-like value.
 * @returns {string}
 */
function basename(value) {
    return (
        String(value || '')
            .split(/[\\/]/u)
            .filter(Boolean)
            .at(-1) || ''
    )
}

/**
 * Formats a number.
 * @param {number} value Number.
 * @returns {string}
 */
function formatNumber(value) {
    return Number(value || 0)
        .toFixed(3)
        .replace(/\.?0+$/, '')
}

/**
 * Escapes HTML content.
 * @param {unknown} value Raw value.
 * @returns {string}
 */
function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
}

/**
 * Escapes attribute content.
 * @param {unknown} value Raw value.
 * @returns {string}
 */
function escapeAttribute(value) {
    return escapeHtml(value).replaceAll("'", '&#39;')
}
