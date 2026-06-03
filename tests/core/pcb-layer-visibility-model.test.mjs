import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerVisibilityModel } from '../../src/core/PcbLayerVisibilityModel.mjs'

/**
 * Verifies app layer visibility metadata separates board layers from virtual
 * render controls.
 */
test('PcbLayerVisibilityModel resolves physical and virtual PCB layer groups', () => {
    const groups = PcbLayerVisibilityModel.resolveLayerGroups({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'layer-groups.PcbDoc',
        pcb: {
            layers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Bottom Layer', layerId: 32 }
            ],
            primitiveLayers: [{ name: 'Top Overlay', layerId: 33 }],
            tracks: [
                {
                    x1: 0,
                    y1: 0,
                    x2: 10,
                    y2: 0,
                    width: 1,
                    layerId: 1
                }
            ],
            pads: [
                {
                    x: 5,
                    y: 5,
                    sizeTopX: 2,
                    sizeTopY: 2,
                    layerId: 1
                }
            ],
            vias: [{ x: 5, y: 5, diameter: 2, holeDiameter: 0.5 }],
            regions: [
                {
                    layerId: 1,
                    points: [
                        { x: 0, y: 0 },
                        { x: 10, y: 0 },
                        { x: 10, y: 10 },
                        { x: 0, y: 10 }
                    ]
                }
            ],
            texts: [
                {
                    text: 'U1',
                    x: 5,
                    y: 6,
                    height: 1,
                    layerId: 33,
                    visible: true
                }
            ],
            components: []
        }
    })

    assert.deepEqual(
        groups.physicalLayers.map((layer) => layer.key),
        ['Top Layer', 'Bottom Layer', 'Top Overlay']
    )
    assert.deepEqual(
        groups.virtualLayers.map((layer) => layer.key),
        ['tracks', 'vias', 'pads', 'holes', 'zones', 'footprint-text']
    )
    assert.deepEqual(
        PcbLayerVisibilityModel.resolveLayers({
            pcb: { layers: [{ name: 'Top Layer', layerId: 1 }] }
        }).map((layer, index) =>
            PcbLayerVisibilityModel.resolveLayerKey(layer, index)
        ),
        ['Top Layer']
    )
})
