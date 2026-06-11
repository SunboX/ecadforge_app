import assert from 'node:assert/strict'
import test from 'node:test'
import { LoadedDesignNetlistService } from '../../../src/core/webmcp/LoadedDesignNetlistService.mjs'

/**
 * Builds a service over fake loaded documents.
 * @param {object[]} documents Document entries.
 * @param {string} [activeDocumentId] Active document id.
 * @returns {LoadedDesignNetlistService}
 */
function createService(documents, activeDocumentId = 'doc-1') {
    return new LoadedDesignNetlistService({
        getSnapshot: () => ({
            documents,
            activeDocumentId,
            documentModel:
                documents.find((entry) => entry.id === activeDocumentId)
                    ?.documentModel || null
        })
    })
}

/**
 * Builds one fake schematic document to exercise matching PCB selection.
 * @returns {object}
 */
function createSchematicDocument() {
    return {
        fileName: 'logic.SchDoc',
        kind: 'schematic',
        summary: { title: 'Logic Sheet' },
        schematic: {
            components: [{ designator: 'U1', value: 'controller' }],
            nets: [
                {
                    name: 'I2C_SDA',
                    pins: [{ refdes: 'U1', designator: '5', name: 'SDA' }]
                }
            ]
        },
        bom: []
    }
}

/**
 * Builds one fake PCB document with placement, routing, rule, and fab metadata.
 * @returns {object}
 */
function createPcbDocument() {
    return {
        fileName: 'logic.PcbDoc',
        kind: 'pcb',
        summary: { title: 'Logic Board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [{}, {}, {}, {}]
            },
            layers: [
                { layerId: 1, name: 'Top Layer', role: 'copper' },
                { layerId: 16, name: 'Bottom Layer', role: 'copper' },
                { layerId: 21, name: 'Top Overlay', role: 'silkscreen' }
            ],
            components: [
                {
                    designator: 'U1',
                    pattern: 'MCU-FAKE-48',
                    x: 100,
                    y: 200,
                    rotation: 90,
                    layer: 'TOP',
                    modelName: 'MCU_FAKE.step',
                    modelPath: 'models/MCU_FAKE.step',
                    pads: [
                        { designator: '5', net: 'I2C_SDA' },
                        { designator: '3', net: 'PP3V3' }
                    ]
                },
                {
                    designator: 'R1',
                    pattern: 'RC0402-4K7',
                    x: 300,
                    y: 220,
                    rotation: 0,
                    layer: 'BOTTOM',
                    pads: [
                        { designator: '2', net: 'I2C_SDA' },
                        { designator: '1', net: 'PP3V3' }
                    ]
                },
                {
                    designator: 'C1',
                    pattern: 'CC0402-1UF',
                    x: 320,
                    y: 240,
                    rotation: 180,
                    layer: 'TOP',
                    pads: [
                        { designator: '1', net: 'PP3V3' },
                        { designator: '2', net: 'GND' }
                    ]
                }
            ],
            pads: [
                {
                    refdes: 'U1',
                    designator: '5',
                    net: 'I2C_SDA',
                    layer: 'Top Layer',
                    solderMaskExpansion: 2,
                    solderPasteExpansion: 0
                },
                {
                    refdes: 'U1',
                    designator: '3',
                    net: 'PP3V3',
                    layer: 'Top Layer',
                    holeDiameter: 12,
                    isPlated: true,
                    solderMaskExpansion: 2,
                    solderPasteExpansion: 0
                },
                {
                    refdes: 'R1',
                    designator: '2',
                    net: 'I2C_SDA',
                    layer: 'Bottom Layer',
                    solderMaskExpansion: 2,
                    solderPasteExpansion: 0
                },
                {
                    refdes: 'R1',
                    designator: '1',
                    net: 'PP3V3',
                    layer: 'Bottom Layer',
                    solderMaskExpansion: 2,
                    solderPasteExpansion: 0
                },
                {
                    refdes: 'C1',
                    designator: '1',
                    net: 'PP3V3',
                    layer: 'Top Layer',
                    solderMaskExpansion: 2,
                    solderPasteExpansion: 0
                },
                {
                    refdes: 'C1',
                    designator: '2',
                    net: 'GND',
                    layer: 'Top Layer',
                    solderMaskExpansion: 2,
                    solderPasteExpansion: 0
                }
            ],
            nets: [
                {
                    name: 'I2C_SDA',
                    pads: [
                        { refdes: 'U1', designator: '5' },
                        { refdes: 'R1', designator: '2' }
                    ]
                },
                {
                    name: 'PP3V3',
                    pads: [
                        { refdes: 'U1', designator: '3' },
                        { refdes: 'R1', designator: '1' },
                        { refdes: 'C1', designator: '1' }
                    ]
                },
                {
                    name: 'GND',
                    pads: [{ refdes: 'C1', designator: '2' }]
                }
            ],
            tracks: [
                { net: 'I2C_SDA', layer: 'Top Layer', width: 6 },
                { net: 'PP3V3', layer: 'Top Layer', width: 12 }
            ],
            vias: [
                {
                    net: 'PP3V3',
                    layer: 'Top Layer',
                    x: 500,
                    y: 250,
                    diameter: 24,
                    holeDiameter: 12,
                    isPlated: true
                }
            ],
            fills: [{ net: 'GND', layer: 'Bottom Layer' }],
            texts: [
                { text: 'U1', layer: 'Top Overlay' },
                { text: 'R1', layer: 'Top Overlay' },
                { text: 'C1', layer: 'Top Overlay' }
            ],
            rules: [
                {
                    name: 'Default Clearance',
                    enabled: true,
                    priority: 1,
                    scope1Expression: 'All',
                    ruleType: {
                        kind: 'clearance',
                        category: 'electrical',
                        displayName: 'Clearance'
                    },
                    typedConstraints: {
                        clearance: {
                            minimum: { value: 6, unit: 'mil' }
                        }
                    }
                },
                {
                    name: 'Signal Width',
                    enabled: false,
                    priority: 2,
                    scope1Expression: "InNetClass('Default')",
                    ruleType: {
                        kind: 'width',
                        category: 'routing',
                        displayName: 'Track Width'
                    },
                    typedConstraints: {
                        width: {
                            minimum: { value: 6, unit: 'mil' },
                            preferred: { value: 8, unit: 'mil' }
                        }
                    }
                }
            ]
        },
        bom: []
    }
}

/**
 * Verifies query_pcb_component returns placement, pads, and model metadata.
 */
test('LoadedDesignNetlistService queries PCB component placement', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.queryPcbComponent({ refdes: 'u1' }), {
        refdes: 'U1',
        design: 'Logic Board',
        footprint: 'MCU-FAKE-48',
        side: 'top',
        layer: 'TOP',
        position_mil: { x: 100, y: 200 },
        rotation_deg: 90,
        pads: [
            { pad: '3', net: 'PP3V3' },
            { pad: '5', net: 'I2C_SDA' }
        ],
        pad_count: 2,
        model: {
            name: 'MCU_FAKE.step',
            path: 'models/MCU_FAKE.step'
        }
    })
})

/**
 * Verifies query_pcb_net returns physical PCB membership for one net.
 */
test('LoadedDesignNetlistService queries PCB net geometry', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.queryPcbNet({ net_name: 'pp3v3' }), {
        net: 'PP3V3',
        design: 'Logic Board',
        layers: ['Bottom Layer', 'Top Layer'],
        pads: [
            { refdes: 'C1', pad: '1', layer: 'Top Layer' },
            { refdes: 'R1', pad: '1', layer: 'Bottom Layer' },
            { refdes: 'U1', pad: '3', layer: 'Top Layer' }
        ],
        pad_count: 3,
        tracks: [{ layer: 'Top Layer', width_mil: 12 }],
        track_count: 1,
        vias: [
            {
                layer: 'Top Layer',
                x_mil: 500,
                y_mil: 250,
                diameter_mil: 24,
                hole_diameter_mil: 12
            }
        ],
        via_count: 1,
        zones: [],
        zone_count: 0
    })
})

/**
 * Verifies summarize_pcb returns board, component, routing, and stackup counts.
 */
test('LoadedDesignNetlistService summarizes PCB data', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.summarizePcb(), {
        design: 'Logic Board',
        fileName: 'logic.PcbDoc',
        sourceFormat: 'altium',
        board: {
            width_mil: 1000,
            height_mil: 500,
            outline_segments: 4,
            cutouts: 0
        },
        counts: {
            components: 3,
            nets: 3,
            pads: 6,
            tracks: 2,
            vias: 1,
            zones: 1,
            layers: 3
        },
        components: {
            top: 2,
            bottom: 1,
            unknown: 0
        },
        drills: {
            pad_holes: 1,
            via_holes: 1,
            total_holes: 2
        },
        stackup: {
            layer_count: 3,
            copper_layers: 2,
            layers: ['Top Layer', 'Bottom Layer', 'Top Overlay']
        }
    })
})

/**
 * Verifies list_design_rules exposes a compact normalized rule view.
 */
test('LoadedDesignNetlistService lists PCB design rules', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.listDesignRules(), {
        design: 'Logic Board',
        summary: {
            rule_count: 2,
            enabled_rules: 1,
            disabled_rules: 1,
            categories: {
                electrical: 1,
                routing: 1
            },
            kinds: {
                clearance: 1,
                width: 1
            }
        },
        rules: [
            {
                name: 'Default Clearance',
                kind: 'clearance',
                category: 'electrical',
                enabled: true,
                priority: 1,
                scope: 'All',
                constraints: {
                    clearance: {
                        minimum: { value: 6, unit: 'mil' }
                    }
                }
            },
            {
                name: 'Signal Width',
                kind: 'width',
                category: 'routing',
                enabled: false,
                priority: 2,
                scope: "InNetClass('Default')",
                constraints: {
                    width: {
                        minimum: { value: 6, unit: 'mil' },
                        preferred: { value: 8, unit: 'mil' }
                    }
                }
            }
        ]
    })
})

/**
 * Verifies review_fabrication_readiness returns manufacturing-oriented checks.
 */
test('LoadedDesignNetlistService reviews fabrication readiness', () => {
    const service = createService([
        { id: 'doc-1', documentModel: createSchematicDocument() },
        { id: 'doc-2', documentModel: createPcbDocument() }
    ])

    assert.deepEqual(service.reviewFabricationReadiness(), {
        status: 'warning',
        design: 'Logic Board',
        summary: {
            checks: 7,
            passed: 5,
            warnings: 2,
            errors: 0
        },
        checks: [
            {
                code: 'board_outline',
                status: 'pass',
                message: 'Board outline is present.',
                evidence: {
                    width_mil: 1000,
                    height_mil: 500,
                    outline_segments: 4
                }
            },
            {
                code: 'layer_stack',
                status: 'pass',
                message: '3 PCB layers are defined.',
                evidence: {
                    layers: 3,
                    copper_layers: 2
                }
            },
            {
                code: 'drill_data',
                status: 'pass',
                message: '2 drill features are present.',
                evidence: {
                    pad_holes: 1,
                    via_holes: 1
                }
            },
            {
                code: 'footprints',
                status: 'pass',
                message: 'All PCB components have footprint metadata.',
                evidence: {
                    missing: 0
                }
            },
            {
                code: 'component_models',
                status: 'warning',
                message: '2 PCB components do not reference a 3D model.',
                refdes: ['C1', 'R1']
            },
            {
                code: 'paste_mask',
                status: 'pass',
                message: 'Pad paste/mask metadata is available.',
                evidence: {
                    pads: 6
                }
            },
            {
                code: 'silkscreen_values',
                status: 'warning',
                message:
                    'Component value text was not found for 3 PCB components.',
                refdes: ['C1', 'R1', 'U1']
            }
        ]
    })
})
