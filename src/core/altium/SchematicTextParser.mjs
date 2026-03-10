import { ParserUtils } from './ParserUtils.mjs'

/**
 * Helpers for normalized schematic text extraction.
 */
export class SchematicTextParser {
    /**
     * Extracts hidden sheet metadata text values.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {Record<string, string>}
     */
    static extractSchematicMetadata(records) {
        const metadata = {}

        for (const record of records) {
            const name = ParserUtils.getField(record.fields, 'Name').trim()
            const value = ParserUtils.getDisplayText(record.fields)

            if (!name || !value || value === '*') {
                continue
            }

            metadata[name.toLowerCase()] = value
        }

        return metadata
    }

    /**
     * Builds a font table from the sheet header.
     * @param {Record<string, string | string[]> | undefined} fields
     * @returns {Record<string, { size: number, family: string, bold: boolean, rotation: number }>}
     */
    static extractSchematicFonts(fields) {
        const count = ParserUtils.parseNumericField(fields, 'FontIdCount') || 0
        const fonts = {}

        for (let index = 1; index <= count; index += 1) {
            fonts[String(index)] = {
                size: ParserUtils.parseNumericField(fields, 'Size' + index) || 10,
                family: SchematicTextParser.#sanitizeFontFamily(
                    ParserUtils.getField(fields, 'FontName' + index)
                ),
                bold: ParserUtils.parseBoolean(fields?.['Bold' + index]),
                rotation:
                    ParserUtils.parseNumericField(fields, 'Rotation' + index) || 0
            }
        }

        return fonts
    }

    /**
     * Normalizes one schematic text record into a drawable text node.
     * @param {Record<string, string | string[]>} fields
     * @param {Record<string, string>} metadata
     * @param {{ width: number, marginWidth: number }} sheet
     * @param {Record<string, { size: number, family: string, bold: boolean, rotation: number }>} fonts
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, anchor: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] } | null}
     */
    static normalizeSchematicTextRecord(fields, metadata, sheet, fonts) {
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')
        const hidden = ParserUtils.parseBoolean(fields.IsHidden)
        const name = ParserUtils.getField(fields, 'Name')
        const rawText = ParserUtils.getDisplayText(fields)
        const text = SchematicTextParser.#resolveSchematicTemplateText(
            rawText,
            metadata
        )

        if (hidden || x === null || y === null || !text) {
            return null
        }

        if (
            SchematicTextParser.#shouldSkipSchematicText(
                fields,
                name,
                rawText,
                text,
                sheet
            )
        ) {
            return null
        }

        const font =
            fonts[ParserUtils.getField(fields, 'FontID')] ||
            SchematicTextParser.#defaultSchematicFont()
        const recordType = ParserUtils.getField(fields, 'RECORD')
        const rotation = SchematicTextParser.#resolveTextRotation(
            fields,
            font,
            recordType
        )
        const textRecord = {
            x,
            y,
            text,
            color:
                recordType === '209'
                    ? ParserUtils.toColor(fields.Color, '#000000')
                    : ParserUtils.toColor(fields.Color, '#2c3134'),
            hidden,
            name,
            ownerIndex: ParserUtils.getField(fields, 'OwnerIndex') || undefined,
            recordType,
            style: ParserUtils.parseNumericField(fields, 'Style') || 0,
            fontSize: SchematicTextParser.#toSvgFontSize(font.size),
            fontFamily: font.family,
            fontWeight: font.bold ? 700 : 400,
            rotation,
            anchor: SchematicTextParser.#inferTextAnchor(
                recordType,
                name,
                text,
                font,
                rotation
            )
        }

        if (recordType === '209') {
            return SchematicTextParser.#normalizeSchematicNoteRecord(
                textRecord,
                fields
            )
        }

        return textRecord
    }

    /**
     * Extracts footer metadata used for the synthesized title block.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {Record<string, string>} metadata
     * @param {number} sheetWidth
     * @returns {{ title: string, revision: string, documentNumber: string, sheetNumber: string, sheetTotal: string, date: string, drawnBy: string }}
     */
    static extractSchematicTitleBlock(records, metadata, sheetWidth) {
        const footerTexts = records
            .filter((record) =>
                SchematicTextParser.isTitleBlockFooterRecord(
                    record.fields,
                    sheetWidth
                )
            )
            .map((record) => ({
                text: ParserUtils.getDisplayText(record.fields),
                x: ParserUtils.parseNumericField(record.fields, 'Location.X') || 0
            }))
            .filter((record) => record.text)
            .sort((left, right) => left.x - right.x)
        const numericFooterTexts = footerTexts.filter((record) =>
            /^\d+$/.test(record.text)
        )

        return {
            title: SchematicTextParser.#cleanMetadataValue(metadata.title),
            revision: SchematicTextParser.#cleanMetadataValue(metadata.revision),
            documentNumber: SchematicTextParser.#cleanMetadataValue(
                metadata.documentnumber
            ),
            sheetNumber:
                numericFooterTexts[0]?.text ||
                SchematicTextParser.#cleanMetadataValue(metadata.sheetnumber),
            sheetTotal:
                numericFooterTexts[1]?.text ||
                SchematicTextParser.#cleanMetadataValue(metadata.sheettotal),
            date: SchematicTextParser.#cleanMetadataValue(
                metadata.currentdate || metadata.date
            ),
            drawnBy: SchematicTextParser.#cleanMetadataValue(metadata.drawnby)
        }
    }

    /**
     * Returns true when the text primitive belongs to the page footer template.
     * @param {Record<string, string | string[]>} fields
     * @param {number} sheetWidth
     * @returns {boolean}
     */
    static isTitleBlockFooterRecord(fields, sheetWidth) {
        const recordType = ParserUtils.getField(fields, 'RECORD')
        const x = ParserUtils.parseNumericField(fields, 'Location.X')
        const y = ParserUtils.parseNumericField(fields, 'Location.Y')

        return (
            recordType === '4' &&
            x !== null &&
            y !== null &&
            x >= sheetWidth * 0.55 &&
            y <= 100
        )
    }

    /**
     * Resolves visible title-block placeholders from hidden sheet metadata.
     * @param {string} text
     * @param {Record<string, string>} metadata
     * @returns {string}
     */
    static #resolveSchematicTemplateText(text, metadata) {
        const normalized = String(text || '').trim()
        if (!normalized.startsWith('=')) {
            return normalized
        }

        const replacement = metadata[normalized.slice(1).toLowerCase()]
        return replacement ? replacement : normalized
    }

    /**
     * Returns true when a text record is metadata rather than sheet content.
     * @param {Record<string, string | string[]>} fields
     * @param {string} name
     * @param {string} rawText
     * @param {string} text
     * @param {{ width: number, marginWidth: number }} sheet
     * @returns {boolean}
     */
    static #shouldSkipSchematicText(fields, name, rawText, text, sheet) {
        const normalizedName = String(name || '').trim().toLowerCase()
        const normalizedRawText = String(rawText || '').trim()
        const normalizedText = String(text || '').trim()
        const nonDrawableNames = new Set([
            'kind',
            'subkind',
            'spice prefix',
            'netlist',
            'model',
            'part number',
            'pkg type',
            'description'
        ])

        if (nonDrawableNames.has(normalizedName)) return true
        if (!normalizedText || normalizedText === '*') return true
        if (/^=/.test(normalizedText)) return true
        if (SchematicTextParser.isTitleBlockFooterRecord(fields, sheet.width)) {
            return true
        }
        if (/^=/.test(normalizedRawText)) return true

        return /@designator|initial voltage/i.test(normalizedText)
    }

    /**
     * Picks a visible text anchor from the recovered font metadata.
     * @param {string} recordType
     * @param {string} name
     * @param {string} text
     * @param {{ size: number }} font
     * @param {number} rotation
     * @returns {'start' | 'middle' | 'end'}
     */
    static #inferTextAnchor(recordType, name, text, font, rotation) {
        const normalizedName = String(name || '').trim().toLowerCase()

        if (recordType === '17') return 'middle'
        if (font.size >= 20 && !normalizedName && /\S/.test(text)) {
            return 'middle'
        }

        return 'start'
    }

    /**
     * Resolves text rotation from font and record metadata.
     * @param {Record<string, string | string[]>} fields
     * @param {{ rotation: number }} font
     * @param {string} recordType
     * @returns {number}
     */
    static #resolveTextRotation(fields, font, recordType) {
        if (recordType === '17') return 0

        const explicitRotation = ParserUtils.parseNumericField(fields, 'Rotation')
        if (explicitRotation !== null) return explicitRotation
        if (font.rotation) return font.rotation
        if (ParserUtils.parseNumericField(fields, 'Orientation') === 1) {
            return 90
        }
        return 0
    }

    /**
     * Coerces malformed font names into a stable browser family.
     * @param {string} family
     * @returns {string}
     */
    static #sanitizeFontFamily(family) {
        const normalized = String(family || '').trim()
        if (!normalized || /["|]/.test(normalized)) {
            return 'Times New Roman'
        }

        return normalized
    }

    /**
     * Returns the default schematic font when no sheet font entry exists.
     * @returns {{ size: number, family: string, bold: boolean, rotation: number }}
     */
    static #defaultSchematicFont() {
        return {
            size: 10,
            family: 'Times New Roman',
            bold: false,
            rotation: 0
        }
    }

    /**
     * Converts Altium point sizes into approximate SVG pixels.
     * @param {number} size
     * @returns {number}
     */
    static #toSvgFontSize(size) {
        return Number(size || 10)
    }

    /**
     * Normalizes placeholder metadata values.
     * @param {string | undefined} value
     * @returns {string}
     */
    static #cleanMetadataValue(value) {
        return value && value !== '*' ? value : ''
    }

    /**
     * Adds note box metadata to one decoded schematic note record.
     * @param {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, anchor: 'start' | 'middle' | 'end' }} textRecord
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number, text: string, color: string, hidden: boolean, name: string, ownerIndex?: string, recordType: string, style: number, fontSize: number, fontFamily: string, fontWeight: number, rotation: number, anchor: 'start' | 'middle' | 'end', cornerX?: number, cornerY?: number, fill?: string, borderColor?: string, isSolid?: boolean, showBorder?: boolean, textMargin?: number, noteLines?: string[] }}
     */
    static #normalizeSchematicNoteRecord(textRecord, fields) {
        const noteLines = SchematicTextParser.#decodeSchematicNoteLines(
            textRecord.text
        )

        return {
            ...textRecord,
            text: noteLines.join('\n'),
            cornerX: ParserUtils.parseNumericField(fields, 'Corner.X') || textRecord.x,
            cornerY: ParserUtils.parseNumericField(fields, 'Corner.Y') || textRecord.y,
            fill: ParserUtils.toColor(fields.AreaColor, '#eceb94'),
            borderColor: ParserUtils.toColor(fields.Color, '#7b7753'),
            isSolid: ParserUtils.parseBoolean(fields.IsSolid),
            showBorder: ParserUtils.parseBoolean(fields.ShowBorder),
            textMargin: ParserUtils.parseNumericField(fields, 'TextMargin') || 4,
            noteLines
        }
    }

    /**
     * Decodes Altium note control codes into visible text rows.
     * @param {string} text
     * @returns {string[]}
     */
    static #decodeSchematicNoteLines(text) {
        return String(text || '')
            .replace(/~2/g, '|')
            .split(/~1/g)
            .map((line) => line.replace(/\s+$/g, ''))
            .filter((line) => line.trim())
    }
}
