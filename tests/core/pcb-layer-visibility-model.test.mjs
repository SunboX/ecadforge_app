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
 * Verifies stack-material rows and generated unused internal defaults are not
 * exposed as layer toggles when explicit stack layers are available.
 */
test('PcbLayerVisibilityModel omits non-rendered stack and generated internal layer rows', () => {
    const groups = PcbLayerVisibilityModel.resolveLayerGroups({
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'stack-material-fake.PcbDoc',
        pcb: {
            layers: [
                { name: 'Top Layer', layerId: 0x01000001 },
                { name: 'Dielectric 1', layerId: 0x01040001 },
                { name: 'inner 1', layerId: 0x01000002 },
                { name: 'inner 2', layerId: 0x01000003 },
                { name: 'Bottom Layer', layerId: 0x0100ffff }
            ],
            primitiveLayers: [
                { name: 'Mid-Layer 3', layerId: 4 },
                { name: 'Internal Plane 1', layerId: 39 },
                { name: 'Mechanical 1', layerId: 57 },
                { name: 'Mechanical 2', layerId: 60 }
            ],
            tracks: [],
            pads: [],
            vias: [],
            regions: [],
            texts: [],
            components: []
        }
    })

    assert.deepEqual(
        groups.physicalLayers.map((layer) => layer.key),
        ['Top Layer', 'inner 1', 'inner 2', 'Bottom Layer', 'Mechanical 1']
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
 * Verifies internal routing layer names are treated as copper instead of
 * documentation layers by visibility presets.
 */
test('PcbLayerVisibilityModel keeps internal Altium signal layers visible for copper preset', () => {
    const nextHidden = PcbLayerVisibilityModel.withPreset(
        {},
        'doc-1',
        {
            sourceFormat: 'altium',
            kind: 'pcb',
            fileName: 'internal-routing.PcbDoc',
            pcb: {
                layers: [
                    { name: 'Top Layer', layerId: 0x01000001 },
                    { name: 'Internal1', layerId: 0x01000002 },
                    { name: 'inner 2', layerId: 0x01000003 },
                    { name: 'Bottom Layer', layerId: 0x0100ffff },
                    { name: 'Mechanical 1', layerId: 57 }
                ],
                primitiveLayers: [
                    { name: 'Mid-Layer 1', layerId: 2 },
                    { name: 'Mid-Layer 2', layerId: 3 }
                ],
                tracks: [],
                pads: [],
                vias: [],
                regions: [],
                texts: [],
                components: []
            }
        },
        'copper'
    )

    assert.deepEqual(nextHidden, { 'doc-1': ['Mechanical 1'] })
})

/**
 * Verifies the "only" layer action hides every physical PCB layer except the
 * requested subset.
 */
test('PcbLayerVisibilityModel shows only requested PCB layers', () => {
    const nextHidden = PcbLayerVisibilityModel.withOnlyLayers(
        {
            'doc-1': ['Top Layer']
        },
        'doc-1',
        {
            kind: 'pcb',
            pcb: {
                layers: [
                    { name: 'Top Layer', layerId: 0x01000001 },
                    { name: 'inner 1', layerId: 0x01000002 },
                    { name: 'inner 2', layerId: 0x01000003 },
                    { name: 'Bottom Layer', layerId: 0x0100ffff }
                ],
                primitiveLayers: [],
                tracks: [],
                pads: [],
                vias: [],
                regions: [],
                texts: [],
                components: []
            }
        },
        ['inner 1']
    )

    assert.deepEqual(nextHidden, {
        'doc-1': ['Top Layer', 'inner 2', 'Bottom Layer']
    })
})

/**
 * Verifies repeating the same "only" action restores normal layer visibility.
 */
test('PcbLayerVisibilityModel toggles repeated only actions back to all layers', () => {
    const documentModel = {
        kind: 'pcb',
        pcb: {
            layers: [
                { name: 'Top Layer', layerId: 0x01000001 },
                { name: 'inner 1', layerId: 0x01000002 },
                { name: 'inner 2', layerId: 0x01000003 },
                { name: 'Bottom Layer', layerId: 0x0100ffff }
            ],
            primitiveLayers: [],
            tracks: [],
            pads: [],
            vias: [],
            regions: [],
            texts: [],
            components: []
        }
    }

    const nextHidden = PcbLayerVisibilityModel.withOnlyLayers(
        {
            'doc-1': ['Top Layer', 'inner 2', 'Bottom Layer']
        },
        'doc-1',
        documentModel,
        ['inner 1']
    )

    assert.deepEqual(nextHidden, {})
})

/**
 * Verifies copper-only views still hide the shared Multi-Layer row itself.
 */
test('PcbLayerVisibilityModel hides multi-layer for copper-only actions', () => {
    const nextHidden = PcbLayerVisibilityModel.withOnlyLayers(
        {},
        'doc-1',
        {
            kind: 'pcb',
            pcb: {
                layers: [
                    { name: 'Top Layer', layerId: 0x01000001 },
                    { name: 'inner 1', layerId: 0x01000002 },
                    { name: 'inner 2', layerId: 0x01000003 },
                    { name: 'Bottom Layer', layerId: 0x0100ffff },
                    { name: 'Multi-Layer', layerId: 74 }
                ],
                primitiveLayers: [],
                tracks: [],
                pads: [],
                vias: [],
                regions: [],
                texts: [],
                components: []
            }
        },
        ['inner 1']
    )

    assert.deepEqual(nextHidden, {
        'doc-1': ['Top Layer', 'inner 2', 'Bottom Layer', 'Multi-Layer']
    })
})

/**
 * Verifies group visibility actions can update a set of layer keys together.
 */
test('PcbLayerVisibilityModel updates several PCB layers together', () => {
    const hidden = PcbLayerVisibilityModel.withLayerKeysVisibility(
        {
            'doc-1': ['Top Layer']
        },
        'doc-1',
        ['inner 1', 'inner 2'],
        false
    )
    const visible = PcbLayerVisibilityModel.withLayerKeysVisibility(
        hidden,
        'doc-1',
        ['Top Layer', 'inner 1'],
        true
    )

    assert.deepEqual(hidden, {
        'doc-1': ['Top Layer', 'inner 1', 'inner 2']
    })
    assert.deepEqual(visible, {
        'doc-1': ['inner 2']
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
