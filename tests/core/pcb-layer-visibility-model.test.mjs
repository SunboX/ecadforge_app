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

/**
 * Verifies Gerber copper layer presets use source layer roles and file-style
 * names instead of hiding copper files as drawings.
 */
test('PcbLayerVisibilityModel keeps Gerber copper files visible for copper preset', () => {
    const documentModel = {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication.zip',
        pcb: {
            fabrication: {
                layers: [
                    {
                        id: 'top-copper',
                        fileName: 'fabrication/board-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top'
                    },
                    {
                        id: 'bottom-copper',
                        fileName: 'fabrication/board-B_Cu.gbl',
                        role: 'bottom-copper',
                        side: 'bottom'
                    },
                    {
                        id: 'top-mask',
                        fileName: 'fabrication/board-F_Mask.gts',
                        role: 'top-solder-mask',
                        side: 'top'
                    },
                    {
                        id: 'drill-map',
                        fileName: 'fabrication/board-PTH-drl_map.gbr',
                        role: 'drill-map',
                        side: 'all'
                    }
                ]
            }
        }
    }

    const nextHidden = PcbLayerVisibilityModel.withPreset(
        {},
        'doc-gerber',
        documentModel,
        'copper'
    )

    assert.deepEqual(nextHidden, {
        'doc-gerber': [
            'fabrication/board-F_Mask.gts',
            'fabrication/board-PTH-drl_map.gbr'
        ]
    })
})

/**
 * Verifies the Gerber drawings preset keeps documentation-style files visible
 * while hiding electrical and fabrication mask/paste/drill layers.
 */
test('PcbLayerVisibilityModel limits Gerber drawings preset to documentation files', () => {
    const documentModel = {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication.zip',
        pcb: {
            fabrication: {
                layers: [
                    {
                        id: 'top-copper',
                        fileName: 'fabrication/board-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top'
                    },
                    {
                        id: 'bottom-copper',
                        fileName: 'fabrication/board-B_Cu.gbl',
                        role: 'bottom-copper',
                        side: 'bottom'
                    },
                    {
                        id: 'top-mask',
                        fileName: 'fabrication/board-F_Mask.gts',
                        role: 'top-soldermask',
                        side: 'top'
                    },
                    {
                        id: 'bottom-paste',
                        fileName: 'fabrication/board-B_Paste.gbp',
                        role: 'bottom-paste',
                        side: 'bottom'
                    },
                    {
                        id: 'plated-drill',
                        fileName: 'fabrication/board-PTH.drl',
                        role: 'plated-drill',
                        side: 'both'
                    },
                    {
                        id: 'drill-map',
                        fileName: 'fabrication/board-PTH-drl_map.gbr',
                        role: 'drill-map',
                        side: 'both'
                    },
                    {
                        id: 'silkscreen',
                        fileName: 'fabrication/board-F_Silkscreen.gto',
                        role: 'top-silkscreen',
                        side: 'top'
                    },
                    {
                        id: 'edge-cuts',
                        fileName: 'fabrication/board-Edge_Cuts.gm1',
                        role: 'board-outline',
                        side: 'both'
                    }
                ]
            }
        }
    }

    const nextHidden = PcbLayerVisibilityModel.withPreset(
        {},
        'doc-gerber',
        documentModel,
        'drawings'
    )

    assert.deepEqual(nextHidden, {
        'doc-gerber': [
            'fabrication/board-F_Cu.gtl',
            'fabrication/board-B_Cu.gbl',
            'fabrication/board-F_Mask.gts',
            'fabrication/board-B_Paste.gbp',
            'fabrication/board-PTH.drl'
        ]
    })
})
