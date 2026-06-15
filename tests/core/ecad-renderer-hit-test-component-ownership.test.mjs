import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Verifies hit-test candidates keep component ownership from footprint tracks.
 */
test('EcadRendererService resolves component keys for owned footprint tracks', () => {
    const documentModel = {
        sourceFormat: 'altium',
        kind: 'pcb',
        pcb: {
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            components: [
                {
                    componentIndex: 7,
                    designator: 'U_FAKE',
                    layer: 'BOTTOM',
                    pattern: '0603'
                }
            ],
            tracks: [
                {
                    x1: 10,
                    y1: 20,
                    x2: 50,
                    y2: 20,
                    width: 8,
                    layerId: 34,
                    componentIndex: 7,
                    netName: 'NET_FAKE'
                }
            ]
        }
    }

    const hits = EcadRendererService.hitTestPcb(
        documentModel,
        { x: 30, y: 20 },
        { side: 'bottom' }
    )

    assert.equal(hits[0]?.type, 'track')
    assert.equal(hits[0]?.netName, 'NET_FAKE')
    assert.equal(hits[0]?.componentKey, 'U_FAKE')
})

/**
 * Verifies footprint interiors remain component-clickable over net copper.
 */
test('EcadRendererService infers component hits inside footprint envelopes', () => {
    const documentModel = {
        sourceFormat: 'altium',
        kind: 'pcb',
        pcb: {
            primitiveLayers: [
                { layerId: 32, name: 'Bottom Layer' },
                { layerId: 34, name: 'Bottom Overlay' }
            ],
            components: [
                {
                    componentIndex: 7,
                    designator: 'U_FAKE',
                    layer: 'BOTTOM',
                    pattern: 'SOIC'
                }
            ],
            tracks: [
                {
                    x1: 10,
                    y1: 10,
                    x2: 50,
                    y2: 10,
                    width: 4,
                    layerId: 34,
                    componentIndex: 7
                },
                {
                    x1: 50,
                    y1: 10,
                    x2: 50,
                    y2: 30,
                    width: 4,
                    layerId: 34,
                    componentIndex: 7
                },
                {
                    x1: 50,
                    y1: 30,
                    x2: 10,
                    y2: 30,
                    width: 4,
                    layerId: 34,
                    componentIndex: 7
                },
                {
                    x1: 10,
                    y1: 30,
                    x2: 10,
                    y2: 10,
                    width: 4,
                    layerId: 34,
                    componentIndex: 7
                }
            ],
            regions: [
                {
                    points: [
                        { x: 0, y: 0 },
                        { x: 60, y: 0 },
                        { x: 60, y: 40 },
                        { x: 0, y: 40 }
                    ],
                    layerId: 32,
                    netName: 'NET_FAKE'
                }
            ]
        }
    }

    const hits = EcadRendererService.hitTestPcb(
        documentModel,
        { x: 30, y: 20 },
        { side: 'bottom' }
    )

    assert.equal(hits[0]?.componentKey, 'U_FAKE')
    assert.equal(hits[0]?.type, 'component')
    assert.equal(hits[1]?.netName, 'NET_FAKE')
})
