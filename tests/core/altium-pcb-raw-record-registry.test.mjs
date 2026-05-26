import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbBinaryPrimitiveParser } from '../../node_modules/altium-toolkit/src/core/altium/PcbBinaryPrimitiveParser.mjs'
import { PcbRawRecordRegistry } from '../../node_modules/altium-toolkit/src/core/altium/PcbRawRecordRegistry.mjs'
import { PcbStreamExtractor } from '../../node_modules/altium-toolkit/src/core/altium/PcbStreamExtractor.mjs'

/**
 * Builds a little-endian record-count header.
 * @param {number} count Number of primitive records.
 * @returns {Uint8Array}
 */
function createRecordCountHeader(count) {
    const bytes = new Uint8Array(4)
    new DataView(bytes.buffer).setUint32(0, count, true)
    return bytes
}

/**
 * Builds generic fixed-length track records with valid payload lengths.
 * @param {number} count Number of fake track records.
 * @returns {Uint8Array}
 */
function createTrackData(count) {
    const recordByteLength = 49
    const payloadByteLength = 44
    const bytes = new Uint8Array(count * recordByteLength)

    for (let index = 0; index < count; index += 1) {
        const offset = index * recordByteLength
        bytes[offset] = 4
        new DataView(bytes.buffer).setUint32(
            offset + 1,
            payloadByteLength,
            true
        )
    }

    return bytes
}

/**
 * Builds compact length-prefixed via records with only the required geometry.
 * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
 */
function createCompactViaStream() {
    const headerBytes = createRecordCountHeader(2)
    const firstRecord = createCompactViaRecord(320, 240)
    const secondRecord = createCompactViaRecord(360, 260)
    const dataBytes = new Uint8Array(
        firstRecord.byteLength + secondRecord.byteLength
    )

    dataBytes.set(firstRecord, 0)
    dataBytes.set(secondRecord, firstRecord.byteLength)

    return { headerBytes, dataBytes }
}

/**
 * Builds one compact length-prefixed via record.
 * @param {number} x Via X coordinate in mil.
 * @param {number} y Via Y coordinate in mil.
 * @returns {Uint8Array}
 */
function createCompactViaRecord(x, y) {
    const payloadLength = 209
    const bytes = new Uint8Array(5 + payloadLength)
    const view = new DataView(bytes.buffer)

    view.setUint8(0, 3)
    view.setUint32(1, payloadLength, true)
    view.setUint8(5, 74)
    view.setUint16(8, 17, true)
    writeMil(view, 18, x)
    writeMil(view, 22, y)
    writeMil(view, 26, 24)
    writeMil(view, 30, 12)
    view.setUint8(34, 1)
    view.setUint8(35, 32)

    return bytes
}

/**
 * Writes a fixed-point mil value.
 * @param {DataView} view Target view.
 * @param {number} offset Byte offset.
 * @param {number} value Value in mil.
 */
function writeMil(view, offset, value) {
    view.setUint32(offset, Math.round(value * 10000), true)
}

test('PcbRawRecordRegistry collects large PcbDoc raw stream batches iteratively', () => {
    const recordCount = 140000
    const streams = new Map([
        ['Tracks6/Header', createRecordCountHeader(recordCount)],
        ['Tracks6/Data', createTrackData(recordCount)]
    ])

    const records = PcbRawRecordRegistry.collectPcbDocRecords(streams, {
        tracks: []
    })

    assert.equal(records.length, recordCount)
    assert.equal(records.at(0)?.registryId, 'pcbdoc:Tracks6/Data:0')
    assert.equal(
        records.at(-1)?.registryId,
        'pcbdoc:Tracks6/Data:' + (recordCount - 1)
    )
})

test('Altium dependency patch decodes compact via streams', () => {
    const viaStream = createCompactViaStream()
    const extracted = PcbStreamExtractor.extractFromStreams(
        new Map([
            ['Vias6/Header', viaStream.headerBytes],
            ['Vias6/Data', viaStream.dataBytes]
        ])
    )

    assert.equal(
        PcbBinaryPrimitiveParser.parseViaStream(
            viaStream.headerBytes,
            viaStream.dataBytes
        ).length,
        2
    )
    assert.equal(extracted.binaryPrimitives.vias.length, 2)
    assert.equal(extracted.rawRecords.length, 2)
    assert.equal(extracted.rawRecords[0].byteLength, 214)
    assert.equal(extracted.rawRecords[0].payloadByteLength, 209)
})
