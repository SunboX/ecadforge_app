import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbRawRecordRegistry } from '../../node_modules/@sunbox/altium-toolkit/src/core/altium/PcbRawRecordRegistry.mjs'

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
