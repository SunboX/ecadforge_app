import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitJsonManufacturingDownloadBuilder } from 'circuitjson-toolkit/renderers'

/**
 * Decodes UTF-8 download bytes.
 * @param {Uint8Array} bytes Download bytes.
 * @returns {string}
 */
function decode(bytes) {
    return new TextDecoder().decode(bytes)
}

/**
 * Builds a fake parsed document with manufacturing metadata.
 * @returns {object}
 */
function createDocument() {
    return {
        fileName: 'metadata-board.json',
        manufacturing: {
            pickAndPlaceRows: [
                {
                    designator: 'U1',
                    componentId: 'pcb_u1',
                    sourceComponentId: 'source_u1',
                    x: 1.5,
                    y: -0.5,
                    rotation: 90,
                    layer: 'bottom',
                    side: 'bottom',
                    value: 'MCU, fake',
                    package: 'simple_chip',
                    manufacturerPartNumber: 'FAKE-1'
                }
            ],
            routingDsn: '(pcb metadata-board)\n(component U1)\n',
            fabricationNotes: [
                {
                    type: 'text',
                    id: 'fab_text_1',
                    layer: 'top_fabrication',
                    text: 'Inspect solder jumpers',
                    anchor: { x: 1, y: 2 }
                }
            ]
        }
    }
}

/**
 * Verifies placement metadata is exported as a quoted CSV download.
 */
test('CircuitJsonManufacturingDownloadBuilder builds placement CSV downloads', () => {
    const download = CircuitJsonManufacturingDownloadBuilder.build(
        createDocument(),
        'pick-place-csv'
    )

    assert.equal(download.fileName, 'metadata-board-pick-place.csv')
    assert.equal(download.contentType, 'text/csv;charset=utf-8')
    assert.match(decode(download.bytes), /Designator,Component ID/)
    assert.match(decode(download.bytes), /U1,pcb_u1,source_u1,1\.5,-0\.5,90/)
    assert.match(decode(download.bytes), /"MCU, fake"/)
})

/**
 * Verifies routing exchange metadata is exported as a text download.
 */
test('CircuitJsonManufacturingDownloadBuilder builds routing DSN downloads', () => {
    const download = CircuitJsonManufacturingDownloadBuilder.build(
        createDocument(),
        'routing-dsn'
    )

    assert.equal(download.fileName, 'metadata-board-routing.dsn')
    assert.equal(download.contentType, 'application/specctra-dsn')
    assert.match(decode(download.bytes), /\(component U1\)/)
})

/**
 * Verifies fabrication notes are exported as structured manufacturing JSON.
 */
test('CircuitJsonManufacturingDownloadBuilder builds fabrication notes JSON downloads', () => {
    const download = CircuitJsonManufacturingDownloadBuilder.build(
        createDocument(),
        'fabrication-notes-json'
    )
    const payload = JSON.parse(decode(download.bytes))

    assert.equal(download.fileName, 'metadata-board-fabrication-notes.json')
    assert.equal(download.contentType, 'application/json;charset=utf-8')
    assert.deepEqual(payload, {
        fileName: 'metadata-board.json',
        notes: [
            {
                type: 'text',
                id: 'fab_text_1',
                layer: 'top_fabrication',
                text: 'Inspect solder jumpers',
                anchor: { x: 1, y: 2 }
            }
        ]
    })
})
