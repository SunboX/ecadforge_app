/**
 * Extracts long printable runs from binary Altium documents.
 */
export class PrintableTextDecoder {
    /**
     * Returns printable ASCII-like runs from a binary buffer.
     * @param {ArrayBuffer} arrayBuffer
     * @param {{ minLength?: number }} [options]
     * @returns {string[]}
     */
    static extractRuns(arrayBuffer, options = {}) {
        const minLength = Number(options.minLength) || 24
        const bytes = new Uint8Array(arrayBuffer)
        const decoder = new TextDecoder('utf-8')
        const runs = []
        let start = -1

        for (let index = 0; index < bytes.length; index += 1) {
            if (PrintableTextDecoder.#isPrintableByte(bytes[index])) {
                if (start === -1) {
                    start = index
                }
                continue
            }

            if (start !== -1) {
                PrintableTextDecoder.#pushRun(
                    runs,
                    decoder,
                    bytes,
                    start,
                    index,
                    minLength
                )
                start = -1
            }
        }

        if (start !== -1) {
            PrintableTextDecoder.#pushRun(
                runs,
                decoder,
                bytes,
                start,
                bytes.length,
                minLength
            )
        }

        return runs
    }

    /**
     * Normalizes one printable slice and appends it if meaningful.
     * @param {string[]} runs
     * @param {TextDecoder} decoder
     * @param {Uint8Array} bytes
     * @param {number} start
     * @param {number} end
     * @param {number} minLength
     */
    static #pushRun(runs, decoder, bytes, start, end, minLength) {
        const length = end - start
        if (length < minLength) return

        const raw = decoder.decode(bytes.slice(start, end))
        const normalized = raw
            .replace(/\r/g, '\n')
            .replace(/\n{2,}/g, '\n')
            .trim()

        if (normalized.length < minLength) return
        if (!normalized.includes('|') || !normalized.includes('=')) return

        runs.push(normalized)
    }

    /**
     * Returns true for bytes commonly preserved in printable record runs.
     * @param {number} value
     * @returns {boolean}
     */
    static #isPrintableByte(value) {
        return (
            value === 9 ||
            value === 10 ||
            value === 13 ||
            (value >= 32 && value <= 126) ||
            value >= 128
        )
    }
}
