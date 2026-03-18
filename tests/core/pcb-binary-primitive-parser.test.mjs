import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbBinaryPrimitiveParser } from '../../src/core/altium/PcbBinaryPrimitiveParser.mjs'

/**
 * Builds synthetic PCB binary streams for primitive parser tests.
 */
class PcbBinaryPrimitiveTestFactory {
    /**
     * Creates a one-track stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createTrackStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(54)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        PcbBinaryPrimitiveTestFactory.#writeWordSwappedMil(
            dataView,
            20,
            1000
        )
        PcbBinaryPrimitiveTestFactory.#writeWordSwappedMil(
            dataView,
            24,
            2000
        )
        PcbBinaryPrimitiveTestFactory.#writeWordSwappedMil(
            dataView,
            28,
            1500
        )
        PcbBinaryPrimitiveTestFactory.#writeWordSwappedMil(
            dataView,
            32,
            2000
        )
        dataView.setUint16(46, 10, true)
        dataView.setUint16(48, 256, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a one-via stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createViaStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(326)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 18, 11235.2291)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 22, 9079.5466)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 26, 23.622)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 30, 11.811)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates a one-fill stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static createFillStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(55)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 18, 11039.3046)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 22, 8902.9081)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 26, 11049.1471)
        PcbBinaryPrimitiveTestFactory.#writeMil(dataView, 30, 8916.6876)
        dataView.setUint16(46, 256, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Writes one standard little-endian fixed-point mil value.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeMil(dataView, offset, valueMil) {
        dataView.setUint32(offset, Math.round(valueMil * 10000), true)
    }

    /**
     * Writes one fixed-point mil value using the track stream word order.
     * @param {DataView} dataView
     * @param {number} offset
     * @param {number} valueMil
     */
    static #writeWordSwappedMil(dataView, offset, valueMil) {
        const fixedValue = Math.round(valueMil * 10000)

        dataView.setUint16(offset, fixedValue >>> 16, true)
        dataView.setUint16(offset + 2, fixedValue & 0xffff, true)
    }
}

/**
 * Verifies fixed-size binary track records decode copper geometry.
 */
test('PcbBinaryPrimitiveParser decodes track streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createTrackStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseTrackStream(headerBytes, dataBytes),
        [
            {
                x1: 1000,
                y1: 2000,
                x2: 1500,
                y2: 2000,
                width: 10,
                layerCode: 256
            }
        ]
    )
})

/**
 * Verifies binary via records decode plated-hole geometry.
 */
test('PcbBinaryPrimitiveParser decodes via streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createViaStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseViaStream(headerBytes, dataBytes),
        [
            {
                x: 11235.2291,
                y: 9079.5466,
                diameter: 23.622,
                holeDiameter: 11.811
            }
        ]
    )
})

/**
 * Verifies binary fill records decode rectangular copper fills.
 */
test('PcbBinaryPrimitiveParser decodes fill streams', () => {
    const { headerBytes, dataBytes } =
        PcbBinaryPrimitiveTestFactory.createFillStream()

    assert.deepEqual(
        PcbBinaryPrimitiveParser.parseFillStream(headerBytes, dataBytes),
        [
            {
                x1: 11039.3046,
                y1: 8902.9081,
                x2: 11049.1471,
                y2: 8916.6876,
                layerCode: 256
            }
        ]
    )
})
