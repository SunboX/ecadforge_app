import { PrintableTextDecoder } from './PrintableTextDecoder.mjs'

/**
 * Converts printable text runs into key/value record objects.
 */
export class AsciiRecordParser {
    /**
     * Parses printable records from a binary buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @returns {{ raw: string, fields: Record<string, string | string[]> }[]}
     */
    static parse(arrayBuffer) {
        const runs = PrintableTextDecoder.extractRuns(arrayBuffer)
        const records = []

        for (const run of runs) {
            const chunks = run.split(
                /(?=\|(?:HEADER|RECORD|UNICODE|SELECTION|KIND)=)/g
            )

            for (const chunk of chunks) {
                const candidate = chunk.trim()
                if (!AsciiRecordParser.#isRecordCandidate(candidate)) continue
                records.push(AsciiRecordParser.#parseRecord(candidate))
            }
        }

        return records
    }

    /**
     * Returns true when a printable run looks like an Altium record block.
     * @param {string} candidate
     * @returns {boolean}
     */
    static #isRecordCandidate(candidate) {
        if (!candidate.startsWith('|')) return false
        if (!candidate.includes('=')) return false
        return candidate.split('|').length >= 4
    }

    /**
     * Parses one pipe-delimited record into a field object.
     * @param {string} raw
     * @returns {{ raw: string, fields: Record<string, string | string[]> }}
     */
    static #parseRecord(raw) {
        const fields = {}
        const segments = raw
            .replace(/\n/g, '')
            .split('|')
            .map((segment) => segment.trim())
            .filter(Boolean)

        for (const segment of segments) {
            const separatorIndex = segment.indexOf('=')
            if (separatorIndex === -1) continue

            const rawKey = segment.slice(0, separatorIndex).trim()
            const value = segment.slice(separatorIndex + 1).trim()
            const isUtf8Field = rawKey.startsWith('%UTF8%')
            const key = rawKey.replace(/^%UTF8%/, '')
            if (!key) continue

            if (isUtf8Field) {
                AsciiRecordParser.#appendFieldValue(
                    fields,
                    'UTF8:' + key,
                    value
                )
            }

            AsciiRecordParser.#appendFieldValue(fields, key, value)
        }

        return { raw, fields }
    }

    /**
     * Appends one parsed field value while preserving duplicates.
     * @param {Record<string, string | string[]>} fields
     * @param {string} key
     * @param {string} value
     */
    static #appendFieldValue(fields, key, value) {
        if (!(key in fields)) {
            fields[key] = value
            return
        }

        const previous = fields[key]
        if (Array.isArray(previous)) {
            previous.push(value)
            return
        }

        fields[key] = [previous, value]
    }
}
