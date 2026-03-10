import { AsciiRecordParser } from './AsciiRecordParser.mjs'
import { ParserUtils } from './ParserUtils.mjs'
import { SchematicTextParser } from './SchematicTextParser.mjs'
import { SchematicTextPostProcessor } from './SchematicTextPostProcessor.mjs'
import { SchematicAnnotationParser } from './SchematicAnnotationParser.mjs'
import { SchematicPinParser } from './SchematicPinParser.mjs'
import { SchematicPrimitiveParser } from './SchematicPrimitiveParser.mjs'
import { AltiumLayoutParser } from './AltiumLayoutParser.mjs'
import { SchematicMultipartOwnerMatcher } from './SchematicMultipartOwnerMatcher.mjs'
const {
    countMatchingKeys,
    getDisplayText,
    getField,
    parseBoolean,
    parseNumericField,
    toColor,
    dedupeByDesignator,
    stripExtension
} = ParserUtils
const {
    extractSchematicFonts,
    extractSchematicMetadata,
    extractSchematicTitleBlock,
    normalizeSchematicTextRecord
} = SchematicTextParser
const { buildSchematicSyntheticTexts } = SchematicAnnotationParser
const {
    parseSchematicCrosses,
    parseSchematicPins,
    parseSchematicPolygon,
    parseSchematicPolyline,
    parseSchematicPorts
} = SchematicPinParser

/**
 * Parses native Altium files into normalized viewer models.
 */
export class AltiumParser {
    /**
     * Parses a native Altium buffer into a normalized viewer model.
     * @param {string} fileName
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{
     * kind: 'schematic' | 'pcb',
     * fileType: 'SchDoc' | 'PcbDoc',
     * fileName: string,
     * summary: Record<string, number | string>,
     * diagnostics: { severity: 'info' | 'warning', message: string }[],
     * schematic?: { sheet: { width: number, height: number, paperSize?: string, visibleGrid: number, snapGrid: number, borderOn: boolean, titleBlockOn: boolean, marginWidth: number, xZones: number, yZones: number, fonts: Record<string, { size: number, family: string, bold: boolean, rotation: number }>, titleBlock: { title: string, revision: string, documentNumber: string, sheetNumber: string, sheetTotal: string, date: string, drawnBy: string } }, lines: { x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle?: number, ownerIndex?: string, isBus?: boolean }[], rectangles: { x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[], arcs: { x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number, ownerIndex?: string }[], texts: { x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, anchor: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }[], components: { x: number, y: number, libReference: string, designator: string, value: string, uniqueId: string }[], pins: { x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor: string, labelMode: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[], ports: { x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[], crosses: { x: number, y: number, size: number, color: string }[] },
     * pcb?: { boardOutline: { widthMil: number, heightMil: number, minX: number, minY: number, segments: Array<Record<string, number | string>> }, layers: { index: number, name: string, layerId: number | null }[], components: { designator: string, x: number, y: number, layer: string, pattern: string, rotation: number, source: string, description: string, height: number | null }[] }
     * bom: { designators: string[], quantity: number, pattern: string, source: string, value: string }[]
     * }}
     */
    static parseArrayBuffer(fileName, arrayBuffer) {
        const records = AsciiRecordParser.parse(arrayBuffer)
        const fileType = AltiumParser.#sniffFileType(fileName, records)
        if (fileType === 'SchDoc') return AltiumParser.#parseSchematic(fileName, records)
        if (fileType === 'PcbDoc') return AltiumParser.#parsePcb(fileName, records)
        throw new Error('Unsupported file type: ' + fileName)
    }

    /**
     * Chooses the format based on extension and content.
     * @param {string} fileName
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {'SchDoc' | 'PcbDoc'}
     */
    static #sniffFileType(fileName, records) {
        const normalized = String(fileName || '').toLowerCase()
        if (normalized.endsWith('.schdoc')) return 'SchDoc'
        if (normalized.endsWith('.pcbdoc')) return 'PcbDoc'

        const hasSchematicHeader = records.some((record) =>
            getField(record.fields, 'HEADER').includes('Schematic')
        )
        return hasSchematicHeader ? 'SchDoc' : 'PcbDoc'
    }
    /**
     * Normalizes a schematic document.
     * @param {string} fileName
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} records
     * @returns {ReturnType<typeof AltiumParser.parseArrayBuffer>}
     */
    static #parseSchematic(fileName, records) {
        const componentRecords = records.filter(
            (record) => getField(record.fields, 'RECORD') === '1'
        )
        const ownersWithImplicitDisplayMode =
            AltiumParser.#collectOwnersWithImplicitDisplayMode(records)
        const activeMultipartOwnerParts =
            SchematicMultipartOwnerMatcher.collectActiveMultipartOwnerParts(
                records,
                componentRecords
            )
        const sheetRecord = records.find(
            (record) => getField(record.fields, 'RECORD') === '31'
        )
        const textRecords = records.filter((record) =>
            AltiumParser.#hasDisplayText(record.fields)
        )
        const drawableRecords = records.filter((record) =>
            AltiumParser.#isDrawableSchematicRecord(
                record.fields,
                ownersWithImplicitDisplayMode,
                activeMultipartOwnerParts
            )
        )
        const drawableTextRecords = textRecords.filter((record) =>
            AltiumParser.#isDrawableSchematicRecord(
                record.fields,
                ownersWithImplicitDisplayMode,
                activeMultipartOwnerParts
            )
        )
        const lineRecords = records.filter(
            (record) =>
                AltiumParser.#isDrawableSchematicRecord(
                    record.fields,
                    ownersWithImplicitDisplayMode,
                    activeMultipartOwnerParts
                ) &&
                getField(record.fields, 'RECORD') !== '14' &&
                !AltiumParser.#hasDisplayText(record.fields) &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Corner')
        )
        const rectangleRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '14' &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Corner')
        )
        const arcRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '12' &&
                AltiumParser.#hasCoordinatePair(record.fields, 'Location') &&
                parseNumericField(record.fields, 'Radius') !== null
        )
        const polylineRecords = drawableRecords.filter(
            (record) =>
                getField(record.fields, 'RECORD') === '26' ||
                getField(record.fields, 'RECORD') === '27' ||
                getField(record.fields, 'RECORD') === '6'
        )
        const polygonRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '7'
        )
        const pinRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '2'
        )
        const portRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '18'
        )
        const crossRecords = drawableRecords.filter(
            (record) => getField(record.fields, 'RECORD') === '22'
        )
        const relatedTexts = new Map()

        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            if (!ownerIndex) continue
            if (!relatedTexts.has(ownerIndex)) {
                relatedTexts.set(ownerIndex, [])
            }
            relatedTexts.get(ownerIndex).push(record)
        }

        const metadataTexts = extractSchematicMetadata(textRecords)
        const schematicFonts = extractSchematicFonts(sheetRecord?.fields)
        const sheetWidth =
            parseNumericField(sheetRecord?.fields, 'CustomX') || 1500
        const sheetHeight =
            parseNumericField(sheetRecord?.fields, 'CustomY') || 950
        const sheetMargin =
            parseNumericField(sheetRecord?.fields, 'CustomMarginWidth') || 20
        const sheet = {
            width: sheetWidth,
            height: sheetHeight,
            visibleGrid:
                parseNumericField(sheetRecord?.fields, 'VisibleGridSize') || 10,
            snapGrid: parseNumericField(sheetRecord?.fields, 'SnapGridSize') || 5,
            borderOn: parseBoolean(sheetRecord?.fields.BorderOn),
            titleBlockOn: parseBoolean(sheetRecord?.fields.TitleBlockOn),
            marginWidth: sheetMargin,
            xZones: Math.max(
                (parseNumericField(sheetRecord?.fields, 'CustomXZones') || 6) -
                    2,
                1
            ),
            yZones: Math.max(
                parseNumericField(sheetRecord?.fields, 'CustomYZones') || 4,
                1
            ),
            fonts: schematicFonts,
            titleBlock: extractSchematicTitleBlock(
                textRecords,
                metadataTexts,
                sheetWidth
            )
        }

        const lines = [
            ...lineRecords.map((record) => ({
                x1: parseNumericField(record.fields, 'Location.X') || 0,
                y1: parseNumericField(record.fields, 'Location.Y') || 0,
                x2: parseNumericField(record.fields, 'Corner.X') || 0,
                y2: parseNumericField(record.fields, 'Corner.Y') || 0,
                color: toColor(record.fields.Color, '#a44a1b'),
                width: parseNumericField(record.fields, 'LineWidth') || 1,
                lineStyle: parseNumericField(record.fields, 'LineStyle') || 0,
                ownerIndex: getField(record.fields, 'OwnerIndex') || undefined
            })),
            ...polylineRecords.flatMap((record) =>
                parseSchematicPolyline(record.fields, {
                    isBus: getField(record.fields, 'RECORD') === '26'
                }).map((line) => ({
                    ...line,
                    ownerIndex: getField(record.fields, 'OwnerIndex') || undefined
                }))
            ),
            ...polygonRecords.flatMap((record) =>
                parseSchematicPolygon(record.fields).map((line) => ({
                    ...line,
                    ownerIndex: getField(record.fields, 'OwnerIndex') || undefined
                }))
            )
        ]
        const rectangles =
            SchematicPrimitiveParser.parseSchematicRectangles(rectangleRecords)
        const arcs = SchematicPrimitiveParser.parseSchematicArcs(arcRecords)

        const pins = parseSchematicPins(pinRecords)
        const ports = parseSchematicPorts(portRecords, lines)
        const crosses = parseSchematicCrosses(crossRecords)
        let texts = drawableTextRecords
            .map((record) =>
                normalizeSchematicTextRecord(
                    record.fields,
                    metadataTexts,
                    sheet,
                    schematicFonts
                )
            )
            .filter(Boolean)
        texts = SchematicTextPostProcessor.dropDuplicatePortLabels(
            texts,
            ports
        )
        texts = SchematicTextPostProcessor.decorateMultipartDesignators(
            texts,
            activeMultipartOwnerParts
        )
        texts.push(
            ...buildSchematicSyntheticTexts(records, pins, schematicFonts).filter(
                (syntheticText) =>
                    !texts.some(
                        (text) =>
                            text.text === syntheticText.text &&
                            Math.abs(text.x - syntheticText.x) <= 80 &&
                            Math.abs(text.y - syntheticText.y) <= 20
                    )
            )
        )
        const anchoredTexts =
            SchematicTextPostProcessor.anchorWireLabelsNearDesignators(
                SchematicTextPostProcessor.anchorComponentTextsFromOwnerBounds(
                    texts,
                    lines,
                    pins,
                    ports
                ),
                lines,
                pins,
                ports
            )

        const components = componentRecords.map((record) => {
            const x = parseNumericField(record.fields, 'Location.X') || 0
            const y = parseNumericField(record.fields, 'Location.Y') || 0
            const libReference =
                getField(record.fields, 'LibReference') ||
                getField(record.fields, 'DesignItemId')
            const ownerIndex = String(
                (parseNumericField(record.fields, 'IndexInSheet') || 0) + 1
            )
            const ownerTexts = relatedTexts.get(ownerIndex) || []

            return {
                x,
                y,
                libReference,
                designator:
                    AltiumParser.#resolveComponentDesignator(
                        ownerTexts,
                        anchoredTexts,
                        {
                            x,
                            y,
                            libReference
                        }
                    ) || 'U?',
                value: AltiumParser.#resolveComponentValue(ownerTexts, anchoredTexts, { x, y, libReference }),
                uniqueId: getField(record.fields, 'UniqueID')
            }
        })
        const resolvedSheet = AltiumLayoutParser.resolveSchematicSheetSize(
            sheet,
            textRecords,
            lines,
            anchoredTexts,
            components,
            pins,
            rectangles,
            ports,
            crosses
        )

        const title = AltiumParser.#findNamedText(textRecords, 'Title') || stripExtension(fileName)
        const bom = AltiumParser.#groupBomRows(
            components.map((component) => ({
                designator: component.designator,
                pattern: '',
                source: component.libReference,
                value: component.value || component.libReference
            }))
        )

        const diagnostics = [
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    records.length +
                    ' printable schematic records.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    components.length +
                    ' schematic components.'
            },
            {
                severity: 'info',
                message:
                    'Recovered ' +
                    lines.length +
                    ' drawable line segments.'
            }
        ]

        if (!sheetRecord) {
            diagnostics.push({
                severity: 'warning',
                message:
                    'Sheet metadata record 31 was not found. Using fallback dimensions.'
            })
        }

        return {
            kind: 'schematic',
            fileType: 'SchDoc',
            fileName,
            summary: {
                title,
                componentCount: components.length,
                lineCount: lines.length,
                textCount: anchoredTexts.length,
                bomRowCount: bom.length
            },
            diagnostics,
            schematic: {
                sheet: resolvedSheet,
                lines,
                rectangles,
                arcs,
                texts: anchoredTexts,
                components,
                pins,
                ports,
                crosses
            },
            bom
        }
    }

    /**
     * Normalizes a PCB document.
     * @param {string} fileName
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} records
     * @returns {ReturnType<typeof AltiumParser.parseArrayBuffer>}
     */
    static #parsePcb(fileName, records) {
        const boardRecord = records.find((record) =>
            getField(record.fields, 'KIND0')
        )
        const layerRecord = records.find(
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

        const boardOutline = AltiumLayoutParser.parseBoardOutline(
            boardRecord?.fields || {}
        )
        const layers = AltiumLayoutParser.parseLayerStack(
            layerRecord?.fields || {}
        )
        const bom = AltiumParser.#groupBomRows(
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
                boardWidthMil: Math.round(boardOutline.widthMil),
                boardHeightMil: Math.round(boardOutline.heightMil)
            },
            diagnostics,
            pcb: {
                boardOutline,
                layers,
                components: componentRecords
            },
            bom
        }
    }

    /**
     * Finds a visible text string with a given logical name.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string} logicalName
     * @returns {string}
     */
    static #findNamedText(records, logicalName) {
        const match = records.find(
            (record) =>
                getField(record.fields, 'Name').toLowerCase() ===
                logicalName.toLowerCase()
        )
        return match ? getDisplayText(match.fields) : ''
    }

    /**
     * Finds a related text value by name.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {string} logicalName
     * @returns {string}
     */
    static #findRelatedText(records, logicalName) {
        const match = records.find(
            (record) =>
                getField(record.fields, 'Name').toLowerCase() ===
                logicalName.toLowerCase()
        )
        return match ? getDisplayText(match.fields) : ''
    }

    /**
     * Collects owners whose active symbol primitives already exist without an
     * explicit display-mode selector.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Set<string>}
    */
    static #collectOwnersWithImplicitDisplayMode(records) {
        const owners = new Set()
        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            const ownerPartId = getField(record.fields, 'OwnerPartId')

            if (
                ownerIndex &&
                ownerPartId &&
                ownerPartId !== '-1' &&
                !getField(record.fields, 'OwnerPartDisplayMode') &&
                AltiumParser.#isDisplayModeSelectablePrimitive(record.fields)
            ) {
                owners.add(ownerIndex)
            }
        }

        return owners
    }

    /**
     * Returns true when one schematic record belongs to the active symbol
     * display mode for its owner.
     * @param {Record<string, string | string[]>} fields
     * @param {Set<string>} ownersWithImplicitDisplayMode
     * @returns {boolean}
     */
    static #isActiveSchematicDisplayModeRecord(
        fields,
        ownersWithImplicitDisplayMode
    ) {
        const ownerIndex = getField(fields, 'OwnerIndex')
        const ownerPartDisplayMode = getField(fields, 'OwnerPartDisplayMode')
        if (!ownerIndex || !ownerPartDisplayMode) {
            return true
        }

        return !ownersWithImplicitDisplayMode.has(ownerIndex)
    }

    /**
     * Returns true when one schematic record belongs to both the active
     * display mode and the active multipart owner part for its owner.
     * @param {Record<string, string | string[]>} fields
     * @param {Set<string>} ownersWithImplicitDisplayMode
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {boolean}
     */
    static #isDrawableSchematicRecord(
        fields,
        ownersWithImplicitDisplayMode,
        activeMultipartOwnerParts
    ) {
        return (
            AltiumParser.#isActiveSchematicDisplayModeRecord(
                fields,
                ownersWithImplicitDisplayMode
            ) &&
            SchematicMultipartOwnerMatcher.isActiveOwnerPartRecord(
                fields,
                activeMultipartOwnerParts
            )
        )
    }

    /**
     * Returns true when a schematic primitive participates in owner display
     * mode selection.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #isDisplayModeSelectablePrimitive(fields) {
        const recordType = getField(fields, 'RECORD')

        return (
            recordType === '2' ||
            recordType === '6' ||
            recordType === '12' ||
            recordType === '13' ||
            recordType === '27' ||
            (AltiumParser.#hasCoordinatePair(fields, 'Location') &&
                AltiumParser.#hasCoordinatePair(fields, 'Corner'))
        )
    }

    /**
     * Resolves a component designator from owner-linked text or nearby visible
     * schematic labels when the owner link is missing.
     * @param {{ fields: Record<string, string | string[]> }[]} ownerTexts
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number, libReference: string }} component
     * @returns {string}
     */
    static #resolveComponentDesignator(ownerTexts, texts, component) {
        const ownerDesignator = AltiumParser.#findRelatedText(
            ownerTexts,
            'Designator'
        )
        if (AltiumParser.#isResolvedComponentText(ownerDesignator)) {
            return ownerDesignator
        }

        return AltiumParser.#findNearbyComponentDesignator(texts, component)
    }

    /**
     * Resolves a component value from owner-linked text or nearby visible
     * schematic labels when the owner link still contains template placeholders.
     * @param {{ fields: Record<string, string | string[]> }[]} ownerTexts
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number, libReference: string }} component
     * @returns {string}
     */
    static #resolveComponentValue(ownerTexts, texts, component) {
        const ownerValue =
            AltiumParser.#findRelatedText(ownerTexts, 'Comment') ||
            AltiumParser.#findRelatedText(ownerTexts, 'VALUE')
        if (AltiumParser.#isResolvedComponentText(ownerValue)) {
            return ownerValue
        }

        return (
            AltiumParser.#findNearbyComponentText(
                texts,
                component,
                ['comment', 'value'],
                '',
                AltiumParser.#inferComponentValueHint(component.libReference)
            ) || ownerValue
        )
    }

    /**
     * Finds the closest nearby designator text for one component.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number, libReference: string }} component
     * @returns {string}
     */
    static #findNearbyComponentDesignator(texts, component) {
        const expectedPrefix = AltiumParser.#inferComponentDesignatorPrefix(
            component.libReference
        )
        const expectedValueHint = AltiumParser.#inferComponentValueHint(
            component.libReference
        )
        const candidates = AltiumParser.#collectNearbyComponentTextCandidates(
            texts,
            component,
            ['designator']
        )
        const scopedCandidates = expectedPrefix
            ? candidates.filter((candidate) =>
                  candidate.text
                      .toUpperCase()
                      .startsWith(expectedPrefix.toUpperCase())
              )
            : candidates
        const usableCandidates = scopedCandidates.length
            ? scopedCandidates
            : candidates
        const rankedCandidates = usableCandidates
            .map((candidate) => ({
                ...candidate,
                score:
                    candidate.distance +
                    AltiumParser.#scoreAssociatedValueMismatch(
                        texts,
                        candidate,
                        expectedValueHint
                    )
            }))
            .sort((left, right) => left.score - right.score)

        return rankedCandidates[0]?.text || ''
    }

    /**
     * Finds the closest nearby visible text for one component.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number }} component
     * @param {string[]} logicalNames
     * @param {string} expectedPrefix
     * @param {string} expectedTextHint
     * @returns {string}
     */
    static #findNearbyComponentText(
        texts,
        component,
        logicalNames,
        expectedPrefix = '',
        expectedTextHint = ''
    ) {
        const candidates = AltiumParser.#collectNearbyComponentTextCandidates(
            texts,
            component,
            logicalNames
        )
        const prefixedCandidates = expectedPrefix
            ? candidates.filter((candidate) =>
                  candidate.text
                      .toUpperCase()
                      .startsWith(expectedPrefix.toUpperCase())
              )
            : candidates
        const scopedCandidates = prefixedCandidates.length
            ? prefixedCandidates
            : candidates
        const hintedCandidates = expectedTextHint
            ? scopedCandidates.filter((candidate) =>
                  AltiumParser.#normalizeTextMatch(candidate.text).includes(
                      AltiumParser.#normalizeTextMatch(expectedTextHint)
                  )
              )
            : scopedCandidates
        const usableCandidates = hintedCandidates.length
            ? hintedCandidates
            : scopedCandidates

        return usableCandidates.sort(
            (left, right) => left.distance - right.distance
        )[0]?.text
    }

    /**
     * Collects nearby visible schematic text candidates around one component.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number }} component
     * @param {string[]} logicalNames
     * @returns {{ x: number, y: number, text: string, distance: number }[]}
     */
    static #collectNearbyComponentTextCandidates(texts, component, logicalNames) {
        const allowedNames = new Set(logicalNames.map((name) => name.toLowerCase()))

        return texts
            .filter((text) =>
                allowedNames.has(String(text.name || '').trim().toLowerCase())
            )
            .map((text) => ({
                x: text.x,
                y: text.y,
                text: text.text,
                distance:
                    Math.abs(text.x - component.x) +
                    Math.abs(text.y - component.y)
            }))
            .filter(
                (text) =>
                    Math.abs(text.x - component.x) <= 80 &&
                    Math.abs(text.y - component.y) <= 80
            )
    }

    /**
     * Penalizes a designator candidate when its nearby value text does not
     * match the library-derived value hint.
     * @param {{ x: number, y: number, text: string, name: string }[]} texts
     * @param {{ x: number, y: number }} candidate
     * @param {string} expectedValueHint
     * @returns {number}
     */
    static #scoreAssociatedValueMismatch(texts, candidate, expectedValueHint) {
        if (!expectedValueHint) {
            return 0
        }

        const associatedValue = AltiumParser.#findNearbyComponentText(
            texts,
            candidate,
            ['comment', 'value']
        )
        if (!associatedValue) {
            return 0
        }

        return AltiumParser.#normalizeTextMatch(associatedValue).includes(
            AltiumParser.#normalizeTextMatch(expectedValueHint)
        )
            ? -30
            : 30
    }

    /**
     * Returns true when a recovered owner-linked text is usable as a component
     * display value.
     * @param {string} value
     * @returns {boolean}
     */
    static #isResolvedComponentText(value) {
        const normalized = String(value || '').trim()

        return Boolean(normalized && normalized !== '*' && !normalized.startsWith('='))
    }

    /**
     * Infers the visible designator prefix from a library reference.
     * @param {string} libReference
     * @returns {string}
     */
    static #inferComponentDesignatorPrefix(libReference) {
        const normalized = String(libReference || '').trim().toUpperCase()

        if (normalized.startsWith('RES/')) return 'R'
        if (normalized.startsWith('CAP/')) return 'C'
        if (normalized.startsWith('DIODE/')) return 'D'
        if (normalized.startsWith('CON/')) return 'J'
        if (normalized.startsWith('IC/')) return 'U'

        return ''
    }

    /**
     * Infers the visible value label from a library reference.
     * @param {string} libReference
     * @returns {string}
     */
    static #inferComponentValueHint(libReference) {
        const segments = String(libReference || '')
            .split('/')
            .map((segment) => segment.trim())
            .filter(Boolean)

        for (let index = segments.length - 1; index >= 0; index -= 1) {
            const segment = segments[index]

            if (
                AltiumParser.#isPackageLikeComponentSegment(segment) ||
                /\s/.test(segment)
            ) {
                continue
            }

            if (
                /^(?:\d+(?:\.\d+)?(?:R|K|M|UF|NF|PF)|1N[A-Z0-9-]+)$/i.test(
                    segment
                )
            ) {
                return segment
            }

            if (
                /[A-Z]/i.test(segment) &&
                /\d/.test(segment) &&
                segment.length >= 6
            ) {
                return segment
            }
        }

        return ''
    }

    /**
     * Returns true when one library segment behaves like a package or rating
     * rather than a user-facing value.
     * @param {string} segment
     * @returns {boolean}
     */
    static #isPackageLikeComponentSegment(segment) {
        return /^(?:CE|\d{4}|SC\d+|SOD-\d+|\d+(?:\.\d+)?V|\d+(?:\.\d+)?[%％])$/i.test(
            String(segment || '').trim()
        )
    }

    /**
     * Normalizes a text fragment for proximity matching.
     * @param {string} value
     * @returns {string}
     */
    static #normalizeTextMatch(value) {
        return String(value || '')
            .toUpperCase()
            .replaceAll(/\s+/g, '')
            .replaceAll('％', '%')
    }

    /**
     * Groups designators into BOM rows.
     * @param {{ designator: string, pattern: string, source: string, value: string }[]} entries
     * @returns {{ designators: string[], quantity: number, pattern: string, source: string, value: string }[]}
     */
    static #groupBomRows(entries) {
        const groups = new Map()

        for (const entry of entries) {
            const key = [entry.pattern, entry.source, entry.value].join('::')
            if (!groups.has(key)) {
                groups.set(key, {
                    designators: [],
                    quantity: 0,
                    pattern: entry.pattern,
                    source: entry.source,
                    value: entry.value
                })
            }

            const row = groups.get(key)
            row.designators.push(entry.designator)
            row.quantity += 1
        }

        return [...groups.values()]
            .map((row) => ({
                ...row,
                designators: row.designators.sort((left, right) =>
                    left.localeCompare(right, undefined, { numeric: true })
                )
            }))
            .sort((left, right) =>
                left.designators[0].localeCompare(
                    right.designators[0],
                    undefined,
                    {
                        numeric: true
                    }
                )
            )
    }

    /**
     * Returns true when a record has a text payload.
     * @param {Record<string, string | string[]>} fields
     * @returns {boolean}
     */
    static #hasDisplayText(fields) {
        return Boolean(getDisplayText(fields))
    }

    /**
     * Returns true when both X and Y exist for a point prefix.
     * @param {Record<string, string | string[]>} fields
     * @param {string} prefix
     * @returns {boolean}
     */
    static #hasCoordinatePair(fields, prefix) {
        return (
            parseNumericField(fields, prefix + '.X') !== null &&
            parseNumericField(fields, prefix + '.Y') !== null
        )
    }
}
