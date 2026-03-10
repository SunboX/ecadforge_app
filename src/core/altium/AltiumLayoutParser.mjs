import { ParserUtils } from './ParserUtils.mjs'
import { SchematicTextParser } from './SchematicTextParser.mjs'

const { getField, parseNumericField } = ParserUtils
const ISO_A_PORTRAIT_SHEETS = [
    { label: 'A5', width: 583, height: 827 },
    { label: 'A4', width: 827, height: 1169 },
    { label: 'A3', width: 1169, height: 1654 },
    { label: 'A2', width: 1654, height: 2339 },
    { label: 'A1', width: 2339, height: 3307 },
    { label: 'A0', width: 3307, height: 4681 }
]
const STANDARD_PAGE_MAX_SLACK_RATIO = 0.12

/**
 * Shared layout helpers for recovered schematic and PCB document geometry.
 */
export class AltiumLayoutParser {
    /**
     * Builds an outline from the serialized board polygon fields.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ widthMil: number, heightMil: number, minX: number, minY: number, segments: Array<Record<string, number | string>> }}
     */
    static parseBoardOutline(fields) {
        const vertices = []

        for (let index = 0; index < 1024; index += 1) {
            const kind = parseNumericField(fields, 'KIND' + index)
            const x = parseNumericField(fields, 'VX' + index)
            const y = parseNumericField(fields, 'VY' + index)

            if (kind === null || x === null || y === null) {
                break
            }

            vertices.push({
                kind,
                x,
                y,
                cx: parseNumericField(fields, 'CX' + index),
                cy: parseNumericField(fields, 'CY' + index),
                radius: parseNumericField(fields, 'R' + index),
                startAngle: parseNumericField(fields, 'SA' + index),
                endAngle: parseNumericField(fields, 'EA' + index)
            })
        }

        if (!vertices.length) {
            return {
                widthMil: 0,
                heightMil: 0,
                minX: 0,
                minY: 0,
                segments: []
            }
        }

        const segments = []
        const xs = vertices.map((vertex) => vertex.x)
        const ys = vertices.map((vertex) => vertex.y)

        for (let index = 0; index < vertices.length; index += 1) {
            const current = vertices[index]
            const next = vertices[(index + 1) % vertices.length]

            if (current.kind === 1 && current.radius) {
                segments.push({
                    type: 'arc',
                    x1: current.x,
                    y1: current.y,
                    x2: next.x,
                    y2: next.y,
                    cx: current.cx || current.x,
                    cy: current.cy || current.y,
                    radius: current.radius,
                    startAngle: current.startAngle || 0,
                    endAngle: current.endAngle || 0
                })
                continue
            }

            segments.push({
                type: 'line',
                x1: current.x,
                y1: current.y,
                x2: next.x,
                y2: next.y
            })
        }

        return {
            widthMil: Math.max(...xs) - Math.min(...xs),
            heightMil: Math.max(...ys) - Math.min(...ys),
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            segments
        }
    }

    /**
     * Extracts the declared layer stack.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ index: number, name: string, layerId: number | null }[]}
     */
    static parseLayerStack(fields) {
        const layers = []

        for (const key of Object.keys(fields)) {
            const match = /^V9_STACK_LAYER(\d+)_NAME$/.exec(key)
            if (!match) continue

            const index = Number.parseInt(match[1], 10)
            layers.push({
                index,
                name: getField(fields, key),
                layerId: parseNumericField(
                    fields,
                    'V9_STACK_LAYER' + index + '_LAYERID'
                )
            })
        }

        return layers.sort((left, right) => left.index - right.index)
    }

    /**
     * Resolves one schematic page size from recovered geometry when the stored
     * custom dimensions leave excessive blank space around visible content.
     * @param {{ width: number, height: number, marginWidth: number, paperSize?: string }} sheet
     * @param {{ fields: Record<string, string | string[]> }[]} textRecords
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number }[]} texts
     * @param {{ x: number, y: number }[]} components
     * @param {{ x: number, y: number }[]} pins
     * @param {{ x: number, y: number, width: number, height: number }[]} rectangles
     * @param {{ x: number, y: number, width: number, height: number }[]} ports
     * @param {{ x: number, y: number }[]} crosses
     * @returns {{ width: number, height: number, marginWidth: number, paperSize?: string }}
     */
    static resolveSchematicSheetSize(
        sheet,
        textRecords,
        lines,
        texts,
        components,
        pins,
        rectangles,
        ports,
        crosses
    ) {
        const bounds = AltiumLayoutParser.#collectSchematicDrawableBounds(
            lines,
            texts,
            components,
            pins,
            rectangles,
            ports,
            crosses
        )
        if (!bounds) {
            return sheet
        }

        const margin = Math.max(Number(sheet?.marginWidth || 20), 20)
        const footerBandHeight =
            AltiumLayoutParser.#measureSchematicFooterBandHeight(
                textRecords,
                Number(sheet?.width || 0)
            )
        const requiredWidth = bounds.maxX + margin * 2
        const requiredHeight =
            bounds.maxY +
            Math.max(footerBandHeight - margin, 0) +
            margin * 2
        const standardSheet = AltiumLayoutParser.#resolveStandardSheetSize(
            requiredWidth,
            requiredHeight
        )

        if (standardSheet) {
            return {
                ...sheet,
                width: standardSheet.width,
                height: standardSheet.height,
                paperSize: standardSheet.label
            }
        }

        const resolvedWidth = AltiumLayoutParser.#pickResolvedSheetAxis(
            sheet.width,
            requiredWidth
        )
        const resolvedHeight = AltiumLayoutParser.#pickResolvedSheetAxis(
            sheet.height,
            requiredHeight
        )
        const resolvedStandardSheet =
            AltiumLayoutParser.#resolveStandardSheetSize(
                resolvedWidth,
                resolvedHeight
            )

        if (resolvedStandardSheet) {
            return {
                ...sheet,
                width: resolvedStandardSheet.width,
                height: resolvedStandardSheet.height,
                paperSize: resolvedStandardSheet.label
            }
        }

        return {
            ...sheet,
            width: resolvedWidth,
            height: resolvedHeight,
            paperSize: sheet?.paperSize
        }
    }

    /**
     * Collects the visible coordinate envelope from recovered schematic
     * primitives.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @param {{ x: number, y: number }[]} texts
     * @param {{ x: number, y: number }[]} components
     * @param {{ x: number, y: number }[]} pins
     * @param {{ x: number, y: number, width: number, height: number }[]} rectangles
     * @param {{ x: number, y: number, width: number, height: number }[]} ports
     * @param {{ x: number, y: number }[]} crosses
     * @returns {{ maxX: number, maxY: number } | null}
     */
    static #collectSchematicDrawableBounds(
        lines,
        texts,
        components,
        pins,
        rectangles,
        ports,
        crosses
    ) {
        const coordinates = []

        for (const line of lines) {
            coordinates.push([line.x1, line.y1], [line.x2, line.y2])
        }

        for (const text of texts) {
            coordinates.push([text.x, text.y])
        }

        for (const component of components) {
            coordinates.push([component.x, component.y])
        }

        for (const pin of pins) {
            coordinates.push([pin.x, pin.y])
        }

        for (const rectangle of rectangles) {
            coordinates.push(
                [rectangle.x, rectangle.y],
                [rectangle.x + rectangle.width, rectangle.y + rectangle.height]
            )
        }

        for (const port of ports) {
            coordinates.push(
                [port.x, port.y],
                [port.x + port.width, port.y + port.height]
            )
        }

        for (const cross of crosses) {
            coordinates.push([cross.x, cross.y])
        }

        if (!coordinates.length) {
            return null
        }

        return {
            maxX: Math.max(...coordinates.map(([x]) => x)),
            maxY: Math.max(...coordinates.map(([, y]) => y))
        }
    }

    /**
     * Measures the visible footer/title-block band recovered from title-block
     * text placeholders.
     * @param {{ fields: Record<string, string | string[]> }[]} textRecords
     * @param {number} sheetWidth
     * @returns {number}
     */
    static #measureSchematicFooterBandHeight(textRecords, sheetWidth) {
        const footerYValues = textRecords
            .filter((record) =>
                SchematicTextParser.isTitleBlockFooterRecord(
                    record.fields,
                    sheetWidth
                )
            )
            .map((record) => parseNumericField(record.fields, 'Location.Y') || 0)

        return footerYValues.length ? Math.max(...footerYValues) : 0
    }

    /**
     * Resolves the smallest matching ISO A sheet when the recovered geometry
     * closely matches a standard page size.
     * @param {number} requiredWidth
     * @param {number} requiredHeight
     * @returns {{ label: string, width: number, height: number } | null}
     */
    static #resolveStandardSheetSize(requiredWidth, requiredHeight) {
        const landscape = requiredWidth >= requiredHeight
        const candidates = ISO_A_PORTRAIT_SHEETS.map((sheet) => ({
            label: sheet.label,
            width: landscape ? sheet.height : sheet.width,
            height: landscape ? sheet.width : sheet.height
        }))
        const matchingSheet =
            candidates.find(
                (sheet) =>
                    sheet.width >= requiredWidth &&
                    sheet.height >= requiredHeight
            ) || null

        if (!matchingSheet) {
            return null
        }

        const widthSlackRatio =
            (matchingSheet.width - requiredWidth) / requiredWidth
        const heightSlackRatio =
            (matchingSheet.height - requiredHeight) / requiredHeight

        return widthSlackRatio <= STANDARD_PAGE_MAX_SLACK_RATIO &&
            heightSlackRatio <= STANDARD_PAGE_MAX_SLACK_RATIO
            ? matchingSheet
            : null
    }

    /**
     * Chooses a sheet axis length, preferring recovered bounds when the stored
     * size is substantially larger than the visible geometry.
     * @param {number} declaredAxis
     * @param {number} inferredAxis
     * @returns {number}
     */
    static #pickResolvedSheetAxis(declaredAxis, inferredAxis) {
        const normalizedDeclared = Math.max(Number(declaredAxis || 0), 100)
        const normalizedInferred = Math.max(Number(inferredAxis || 0), 100)

        if (normalizedDeclared < normalizedInferred) {
            return normalizedInferred
        }

        return normalizedDeclared > normalizedInferred * 1.15
            ? normalizedInferred
            : normalizedDeclared
    }
}
