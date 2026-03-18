import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbStreamExtractor } from '../../src/core/altium/PcbStreamExtractor.mjs'

/**
 * Builds synthetic PCB stream payloads for stream-scoped extraction tests.
 */
class PcbStreamTestFactory {
    /**
     * Creates one printable board stream.
     * @returns {Uint8Array}
     */
    static createBoardStream() {
        return new TextEncoder().encode(
            [
                '|HEADER=PCB 6.0 Binary File',
                '|KIND0=0|VX0=0mil|VY0=0mil|CX0=0mil|CY0=0mil|SA0=0|EA0=0|R0=0mil|KIND1=0|VX1=1000mil|VY1=0mil|CX1=0mil|CY1=0mil|SA1=0|EA1=0|R1=0mil|KIND2=0|VX2=1000mil|VY2=500mil|CX2=0mil|CY2=0mil|SA2=0|EA2=0|R2=0mil|KIND3=0|VX3=0mil|VY3=500mil|CX3=0mil|CY3=0mil|SA3=0|EA3=0|R3=0mil',
                '|RECORD=Board|V9_STACK_LAYER1_NAME=Top Layer|V9_STACK_LAYER1_LAYERID=1|V9_STACK_LAYER2_NAME=Bottom Layer|V9_STACK_LAYER2_LAYERID=2'
            ].join('')
        )
    }

    /**
     * Creates one printable component stream.
     * @returns {Uint8Array}
     */
    static createComponentStream() {
        return new TextEncoder().encode(
            '|LAYER=TOP|X=250mil|Y=300mil|PATTERN=0603|ROTATION=0|HEIGHT=12mil|SOURCEDESIGNATOR=R1|SOURCELIBREFERENCE=RES/FAKE/10K|SOURCEDESCRIPTION=Drift resistor'
        )
    }

    /**
     * Creates one printable polygon stream.
     * @returns {Uint8Array}
     */
    static createPolygonStream() {
        return new TextEncoder().encode(
            '|SELECTION=FALSE|LAYER=TOP|POLYGONTYPE=Polygon|KIND0=0|VX0=100mil|VY0=100mil|CX0=0mil|CY0=0mil|SA0=0|EA0=0|R0=0mil|KIND1=0|VX1=200mil|VY1=100mil|CX1=0mil|CY1=0mil|SA1=0|EA1=0|R1=0mil|KIND2=0|VX2=200mil|VY2=200mil|CX2=0mil|CY2=0mil|SA2=0|EA2=0|R2=0mil|KIND3=0|VX3=100mil|VY3=200mil|CX3=0mil|CY3=0mil|SA3=0|EA3=0|R3=0mil'
        )
    }

    /**
     * Creates one synthetic stream map with printable and binary payloads.
     * @returns {Map<string, Uint8Array>}
     */
    static createStreamMap() {
        const streams = new Map()
        const trackStream =
            PcbStreamTestFactory.#createTrackStream()
        const viaStream =
            PcbStreamTestFactory.#createViaStream()
        const fillStream =
            PcbStreamTestFactory.#createFillStream()

        streams.set('Board6/Data', PcbStreamTestFactory.createBoardStream())
        streams.set(
            'Components6/Data',
            PcbStreamTestFactory.createComponentStream()
        )
        streams.set('Polygons6/Data', PcbStreamTestFactory.createPolygonStream())
        streams.set('Tracks6/Header', trackStream.headerBytes)
        streams.set('Tracks6/Data', trackStream.dataBytes)
        streams.set('Vias6/Header', viaStream.headerBytes)
        streams.set('Vias6/Data', viaStream.dataBytes)
        streams.set('Fills6/Header', fillStream.headerBytes)
        streams.set('Fills6/Data', fillStream.dataBytes)

        return streams
    }

    /**
     * Creates one synthetic track stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createTrackStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(54)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        PcbStreamTestFactory.#writeWordSwappedMil(dataView, 20, 1000)
        PcbStreamTestFactory.#writeWordSwappedMil(dataView, 24, 2000)
        PcbStreamTestFactory.#writeWordSwappedMil(dataView, 28, 1500)
        PcbStreamTestFactory.#writeWordSwappedMil(dataView, 32, 2000)
        dataView.setUint16(46, 8, true)
        dataView.setUint16(48, 256, true)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic via stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createViaStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(326)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        PcbStreamTestFactory.#writeMil(dataView, 18, 500)
        PcbStreamTestFactory.#writeMil(dataView, 22, 250)
        PcbStreamTestFactory.#writeMil(dataView, 26, 24)
        PcbStreamTestFactory.#writeMil(dataView, 30, 12)

        return { headerBytes, dataBytes }
    }

    /**
     * Creates one synthetic fill stream pair.
     * @returns {{ headerBytes: Uint8Array, dataBytes: Uint8Array }}
     */
    static #createFillStream() {
        const headerBytes = new Uint8Array(4)
        const dataBytes = new Uint8Array(55)
        const headerView = new DataView(headerBytes.buffer)
        const dataView = new DataView(dataBytes.buffer)

        headerView.setUint32(0, 1, true)
        PcbStreamTestFactory.#writeMil(dataView, 18, 400)
        PcbStreamTestFactory.#writeMil(dataView, 22, 150)
        PcbStreamTestFactory.#writeMil(dataView, 26, 460)
        PcbStreamTestFactory.#writeMil(dataView, 30, 210)
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
 * Verifies stream-aware extraction preserves printable PCB records and decodes
 * binary copper primitives from named streams.
 */
test('PcbStreamExtractor extracts printable and binary PCB streams', () => {
    const extracted = PcbStreamExtractor.extractFromStreams(
        PcbStreamTestFactory.createStreamMap()
    )

    assert.equal(extracted.records.length, 4)
    assert.deepEqual(extracted.streamNames, [
        'Board6/Data',
        'Components6/Data',
        'Fills6/Data',
        'Polygons6/Data',
        'Tracks6/Data',
        'Vias6/Data'
    ])
    assert.deepEqual(extracted.binaryPrimitives.tracks, [
        {
            x1: 1000,
            y1: 2000,
            x2: 1500,
            y2: 2000,
            width: 8,
            layerCode: 256
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.vias, [
        {
            x: 500,
            y: 250,
            diameter: 24,
            holeDiameter: 12
        }
    ])
    assert.deepEqual(extracted.binaryPrimitives.fills, [
        {
            x1: 400,
            y1: 150,
            x2: 460,
            y2: 210,
            layerCode: 256
        }
    ])
})
