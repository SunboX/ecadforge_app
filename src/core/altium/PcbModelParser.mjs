import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { ParserUtils } from './ParserUtils.mjs'

const {
    countMatchingKeys,
    dedupeByDesignator,
    getField,
    parseNumericField,
    stripExtension
} = ParserUtils

/**
 * Normalizes PCB records into the viewer's board model.
 */
export class PcbModelParser {
    /**
     * Parses a normalized PCB model.
     * @param {string} fileName
     * @param {{ raw: string, fields: Record<string, string | string[]>, sourceStream?: string }[]} records
     * @param {{ streamNames: string[], binaryPrimitives: { fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number }[], vias: { x: number, y: number, diameter: number, holeDiameter: number }[] }, diagnostics: { printableRecordCount: number, printableStreamCount: number, binaryPrimitiveCount: number } } | null} pcbExtraction
     * @returns {{ kind: 'pcb', fileType: 'PcbDoc', fileName: string, summary: Record<string, number | string>, diagnostics: { severity: 'info' | 'warning', message: string }[], pcb: { boardOutline: { widthMil: number, heightMil: number, minX: number, minY: number, segments: Array<Record<string, number | string>> }, layers: { index: number, name: string, layerId: number | null }[], components: { designator: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null }[], polygons: { layer: string, segments: Array<Record<string, number | string>> }[], fills: { x1: number, y1: number, x2: number, y2: number, layerCode: number }[], tracks: { x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number }[], vias: { x: number, y: number, diameter: number, holeDiameter: number }[] }, bom: { designators: string[], quantity: number, pattern: string, source: string, value: string }[] }}
     */
    static parse(fileName, records, pcbExtraction = null) {
        const boardRecord =
            records.find(
                (record) =>
                    getField(record.fields, 'KIND0') &&
                    record.sourceStream === 'Board6/Data'
            ) ||
            records.find((record) => getField(record.fields, 'KIND0'))
        const layerRecord =
            records.find(
                (record) =>
                    countMatchingKeys(record.fields, /^V9_STACK_LAYER\d+_NAME$/) > 0 &&
                    record.sourceStream === 'Board6/Data'
            ) ||
            records.find(
                (record) =>
                    countMatchingKeys(record.fields, /^V9_STACK_LAYER\d+_NAME$/) > 0
            )
        const componentRecords = dedupeByDesignator(
            records
                .filter(
                    (record) =>
                        getField(record.fields, 'PATTERN') &&
                        getField(record.fields, 'SOURCEDESIGNATOR')
                )
                .map((record) => ({
                    designator: getField(record.fields, 'SOURCEDESIGNATOR'),
                    x: parseNumericField(record.fields, 'X') || 0,
                    y: parseNumericField(record.fields, 'Y') || 0,
                    layer: getField(record.fields, 'LAYER') || 'TOP',
                    pattern: getField(record.fields, 'PATTERN'),
                    rotation: parseNumericField(record.fields, 'ROTATION') || 0,
                    source:
                        getField(record.fields, 'SOURCELIBREFERENCE') ||
                        getField(record.fields, 'SOURCEFOOTPRINTLIBRARY'),
                    description: getField(record.fields, 'SOURCEDESCRIPTION'),
                    height: parseNumericField(record.fields, 'HEIGHT')
                }))
        )
        const polygonRecords = records.filter(
            (record) =>
                record.sourceStream === 'Polygons6/Data' &&
                getField(record.fields, 'KIND0')
        )
        const boardOutline = AltiumLayoutParser.parseBoardOutline(
            boardRecord?.fields || {}
        )
        const layers = AltiumLayoutParser.parseLayerStack(
            layerRecord?.fields || {}
        )
        const polygons = polygonRecords
            .map((record) => ({
                layer: getField(record.fields, 'LAYER') || 'UNKNOWN',
                segments: AltiumLayoutParser.parseBoardOutline(record.fields)
                    .segments
            }))
            .filter((polygon) => polygon.segments.length > 0)
        const tracks = pcbExtraction?.binaryPrimitives?.tracks || []
        const vias = pcbExtraction?.binaryPrimitives?.vias || []
        const fills = pcbExtraction?.binaryPrimitives?.fills || []
        const bom = PcbModelParser.#groupBomRows(
            componentRecords.map((component) => ({
                designator: component.designator,
                pattern: component.pattern,
                source: component.source,
                value: component.description || component.pattern
            }))
        )

        const diagnostics = [
            {
                severity: 'info',
                message:
                    'Recovered ' + records.length + ' printable PCB records.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    componentRecords.length +
                    ' PCB component placements.'
            },
            {
                severity: 'info',
                message: 'Recovered ' + layers.length + ' layer stack entries.'
            }
        ]

        if (pcbExtraction) {
            diagnostics.push({
                severity: 'info',
                message:
                    'Recovered ' +
                    pcbExtraction.streamNames.length +
                    ' PCB data streams from the compound document.'
            })
            diagnostics.push({
                severity: 'info',
                message:
                    'Decoded ' +
                    tracks.length +
                    ' tracks, ' +
                    vias.length +
                    ' vias, ' +
                    fills.length +
                    ' fills, and ' +
                    polygons.length +
                    ' polygons.'
            })
        }

        if (!boardRecord) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Board geometry record was not found. PCB view uses component extents only.'
            })
        }

        return {
            kind: 'pcb',
            fileType: 'PcbDoc',
            fileName,
            summary: {
                title: stripExtension(fileName),
                componentCount: componentRecords.length,
                layerCount: layers.length,
                outlineSegmentCount: boardOutline.segments.length,
                bomRowCount: bom.length,
                polygonCount: polygons.length,
                trackCount: tracks.length,
                viaCount: vias.length,
                boardWidthMil: Math.round(boardOutline.widthMil),
                boardHeightMil: Math.round(boardOutline.heightMil)
            },
            diagnostics,
            pcb: {
                boardOutline,
                layers,
                components: componentRecords,
                polygons,
                fills,
                tracks,
                vias
            },
            bom
        }
    }

    /**
     * Groups component placements into BOM rows.
     * @param {{ designator: string, pattern: string, source: string, value: string }[]} componentRecords
     * @returns {{ designators: string[], quantity: number, pattern: string, source: string, value: string }[]}
     */
    static #groupBomRows(componentRecords) {
        const groupedRows = new Map()

        for (const component of componentRecords) {
            const groupKey = [
                component.pattern || '',
                component.source || '',
                component.value || ''
            ].join('\u0000')

            if (!groupedRows.has(groupKey)) {
                groupedRows.set(groupKey, {
                    designators: [],
                    quantity: 0,
                    pattern: component.pattern || 'Unknown footprint',
                    source: component.source || 'Unknown source',
                    value: component.value || component.pattern || 'Unknown part'
                })
            }

            const row = groupedRows.get(groupKey)
            row.designators.push(component.designator)
            row.quantity += 1
        }

        return [...groupedRows.values()].sort((left, right) =>
            left.pattern.localeCompare(right.pattern)
        )
    }
}
