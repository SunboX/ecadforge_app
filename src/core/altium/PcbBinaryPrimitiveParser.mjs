/**
 * Decodes fixed-size binary PCB primitive streams recovered from OLE-backed
 * PcbDoc files.
 */
export class PcbBinaryPrimitiveParser {
    /**
     * Decodes one fixed-size track stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, width: number, layerCode: number }[]}
     */
    static parseTrackStream(headerBytes, dataBytes) {
        return PcbBinaryPrimitiveParser.#sliceFixedRecords(
            headerBytes,
            dataBytes,
            54
        ).map((view) => ({
            x1: PcbBinaryPrimitiveParser.#readWordSwappedMil(view, 20),
            y1: PcbBinaryPrimitiveParser.#readWordSwappedMil(view, 24),
            x2: PcbBinaryPrimitiveParser.#readWordSwappedMil(view, 28),
            y2: PcbBinaryPrimitiveParser.#readWordSwappedMil(view, 32),
            width: view.getUint16(46, true),
            layerCode: view.getUint16(48, true)
        }))
    }

    /**
     * Decodes one fixed-size via stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x: number, y: number, diameter: number, holeDiameter: number }[]}
     */
    static parseViaStream(headerBytes, dataBytes) {
        return PcbBinaryPrimitiveParser.#sliceFixedRecords(
            headerBytes,
            dataBytes,
            326
        ).map((view) => ({
            x: PcbBinaryPrimitiveParser.#readMil(view, 18),
            y: PcbBinaryPrimitiveParser.#readMil(view, 22),
            diameter: PcbBinaryPrimitiveParser.#readMil(view, 26),
            holeDiameter: PcbBinaryPrimitiveParser.#readMil(view, 30)
        }))
    }

    /**
     * Decodes one fixed-size fill stream.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @returns {{ x1: number, y1: number, x2: number, y2: number, layerCode: number }[]}
     */
    static parseFillStream(headerBytes, dataBytes) {
        return PcbBinaryPrimitiveParser.#sliceFixedRecords(
            headerBytes,
            dataBytes,
            55
        ).map((view) => ({
            x1: PcbBinaryPrimitiveParser.#readMil(view, 18),
            y1: PcbBinaryPrimitiveParser.#readMil(view, 22),
            x2: PcbBinaryPrimitiveParser.#readMil(view, 26),
            y2: PcbBinaryPrimitiveParser.#readMil(view, 30),
            layerCode: view.getUint16(46, true)
        }))
    }

    /**
     * Splits one fixed-length record stream into DataView slices.
     * @param {Uint8Array | ArrayBuffer} headerBytes
     * @param {Uint8Array | ArrayBuffer} dataBytes
     * @param {number} recordByteLength
     * @returns {DataView[]}
     */
    static #sliceFixedRecords(headerBytes, dataBytes, recordByteLength) {
        const normalizedHeader =
            PcbBinaryPrimitiveParser.#toUint8Array(headerBytes)
        const normalizedData = PcbBinaryPrimitiveParser.#toUint8Array(dataBytes)
        const count =
            normalizedHeader.byteLength >= 4
                ? new DataView(
                      normalizedHeader.buffer,
                      normalizedHeader.byteOffset,
                      normalizedHeader.byteLength
                  ).getUint32(0, true)
                : 0

        if (!count) {
            return []
        }

        if (normalizedData.byteLength < count * recordByteLength) {
            return []
        }

        const views = []

        for (let index = 0; index < count; index += 1) {
            views.push(
                new DataView(
                    normalizedData.buffer,
                    normalizedData.byteOffset + index * recordByteLength,
                    recordByteLength
                )
            )
        }

        return views
    }

    /**
     * Normalizes one byte-like input into a Uint8Array view.
     * @param {Uint8Array | ArrayBuffer} bytes
     * @returns {Uint8Array}
     */
    static #toUint8Array(bytes) {
        if (bytes instanceof Uint8Array) {
            return bytes
        }

        return new Uint8Array(bytes)
    }

    /**
     * Reads one signed fixed-point mil coordinate.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readMil(view, offset) {
        return view.getInt32(offset, true) / 10000
    }

    /**
     * Reads one signed fixed-point mil coordinate from the word-swapped track
     * encoding used by `Tracks6/Data`.
     * @param {DataView} view
     * @param {number} offset
     * @returns {number}
     */
    static #readWordSwappedMil(view, offset) {
        const highWord = view.getUint16(offset, true)
        const lowWord = view.getUint16(offset + 2, true)
        const rawValue = highWord * 0x10000 + lowWord
        const signedValue =
            rawValue > 0x7fffffff ? rawValue - 0x100000000 : rawValue

        return signedValue / 10000
    }
}
