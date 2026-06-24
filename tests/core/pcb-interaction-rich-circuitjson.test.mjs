import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbDiagnosticFocusModel } from '../../src/core/PcbDiagnosticFocusModel.mjs'
import { PcbInteractionPrimitiveModel } from '../../src/core/PcbInteractionPrimitiveModel.mjs'

/**
 * Builds a standards-shaped board document with richer PCB artwork records.
 * @returns {object[]}
 */
function createRichCircuitJsonDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 12,
            height: 8,
            num_layers: 4
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            width: 1.8,
            height: 1.2,
            layer: 'top',
            pcb_group_id: 'group_1',
            position_mode: 'relative_to_group_anchor',
            positioned_relative_to_pcb_group_id: 'group_1'
        },
        {
            type: 'source_group',
            source_group_id: 'source_group_1',
            name: 'Analog',
            was_automatically_named: false
        },
        {
            type: 'pcb_group',
            pcb_group_id: 'group_1',
            source_group_id: 'source_group_1',
            name: 'Analog',
            center: { x: 1, y: 1 },
            width: 3,
            height: 2,
            anchor_position: { x: 0, y: 0 }
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_rot',
            pcb_component_id: 'pcb_u1',
            shape: 'rotated_rect',
            x: 0.6,
            y: 0.6,
            width: 0.9,
            height: 0.35,
            ccw_rotation: 45,
            layer: 'top',
            net: 'SIG',
            solderMaskExpansion: 0.1,
            solderPasteExpansion: 0.05
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_asym',
            pcb_component_id: 'pcb_u1',
            shape: 'rotated_rect',
            x: -0.8,
            y: 0.1,
            width: 1,
            height: 0.5,
            ccw_rotation: 30,
            layer: 'top',
            net: 'AUX',
            soldermask_margin_left: 0.2,
            soldermask_margin_right: 0.4,
            soldermask_margin_top: 0.1,
            soldermask_margin_bottom: -0.05
        },
        {
            type: 'source_trace',
            source_trace_id: 'source_trace_sig',
            display_name: 'SIG budget',
            max_length: 2.5
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_sig',
            source_trace_id: 'source_trace_sig',
            net: 'SIG',
            route: [
                {
                    route_type: 'wire',
                    x: -1,
                    y: -1,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 2,
                    y: -1,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_pill',
            pcb_component_id: 'pcb_u1',
            shape: 'pill',
            x: 1.4,
            y: 0.6,
            width: 1.1,
            height: 0.35,
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_poly',
            pcb_component_id: 'pcb_u1',
            shape: 'polygon',
            points: [
                { x: 0.4, y: 1.4 },
                { x: 1, y: 1.8 },
                { x: 1.6, y: 1.4 }
            ],
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_plated_hole',
            pcb_plated_hole_id: 'hole_1',
            shape: 'circular_hole_with_rect_pad',
            x: -2,
            y: 1.5,
            outer_diameter: 0.9,
            hole_diameter: 0.35,
            rect_pad_width: 1.4,
            rect_pad_height: 0.8,
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_keepout',
            pcb_keepout_id: 'keepout_1',
            center: { x: -3, y: -2 },
            width: 1.2,
            height: 0.8,
            layer: 'top'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'cutout_1',
            points: [
                { x: 3, y: -1 },
                { x: 4, y: -1 },
                { x: 4, y: 0 },
                { x: 3, y: 0 }
            ],
            layer: 'board'
        },
        {
            type: 'pcb_courtyard',
            pcb_courtyard_id: 'courtyard_1',
            center: { x: 1, y: 1 },
            width: 2.4,
            height: 1.8,
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_silkscreen_text',
            pcb_silkscreen_text_id: 'silk_1',
            text: 'U1',
            x: 1,
            y: 2.2,
            layer: 'top_silkscreen'
        },
        {
            type: 'pcb_fabrication_note_text',
            pcb_fabrication_note_text_id: 'fab_1',
            text: 'PIN 1',
            x: -1,
            y: 2.4,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_copper_text',
            pcb_copper_text_id: 'copper_text_1',
            text: 'SIG',
            x: 2.4,
            y: 1.2,
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_note_text',
            pcb_note_text_id: 'note_1',
            text: 'ASSEMBLY NOTE',
            x: -4,
            y: 2.8,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_line',
            pcb_note_line_id: 'note_line_1',
            x1: -4,
            y1: 2.2,
            x2: -2,
            y2: 2.2,
            width: 0.08,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_rect',
            pcb_note_rect_id: 'note_rect_1',
            center: { x: -3, y: 1.4 },
            width: 1.4,
            height: 0.6,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_dimension',
            pcb_note_dimension_id: 'note_dimension_1',
            start: { x: -5, y: -3 },
            end: { x: -3, y: -3 },
            text: '2mm',
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_fabrication_note_rect',
            pcb_fabrication_note_rect_id: 'fab_rect_1',
            center: { x: 3.4, y: 2.2 },
            width: 1.2,
            height: 0.5,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_fabrication_note_dimension',
            pcb_fabrication_note_dimension_id: 'fab_dimension_1',
            start: { x: 2.8, y: 3 },
            end: { x: 4.2, y: 3 },
            text: '1.4mm',
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_solder_paste',
            pcb_solder_paste_id: 'paste_1',
            center: { x: 0.6, y: -1.6 },
            width: 0.7,
            height: 0.25,
            layer: 'top'
        },
        {
            type: 'pcb_thermal_spoke',
            pcb_thermal_spoke_id: 'thermal_1',
            x1: -1,
            y1: -1,
            x2: -0.2,
            y2: -1,
            width: 0.16,
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_trace_hint',
            pcb_trace_hint_id: 'hint_1',
            route: [
                { x: 2.8, y: -2.2, layer: 'top' },
                { x: 4, y: -2.2, layer: 'top' }
            ],
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_breakout_point',
            pcb_breakout_point_id: 'breakout_1',
            center: { x: 4.4, y: 1.8 },
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_panel',
            pcb_panel_id: 'panel_1',
            center: { x: 0, y: 0 },
            width: 14,
            height: 10
        },
        {
            type: 'pcb_trace_error',
            pcb_trace_error_id: 'err_1',
            pcb_component_id: 'pcb_u1',
            message: 'Trace clearance is below the configured rule.',
            error_type: 'clearance'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Builds a compact board with two unrouted ports on the same source net.
 * @returns {object[]}
 */
function createConnectivityDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 8,
            height: 4,
            num_layers: 2
        },
        {
            type: 'source_net',
            source_net_id: 'source_net_1',
            name: 'SIG'
        },
        {
            type: 'source_port',
            source_port_id: 'source_port_1',
            source_net_id: 'source_net_1'
        },
        {
            type: 'source_port',
            source_port_id: 'source_port_2',
            source_net_id: 'source_net_1'
        },
        {
            type: 'pcb_port',
            pcb_port_id: 'pcb_port_1',
            source_port_id: 'source_port_1',
            x: -2,
            y: 0
        },
        {
            type: 'pcb_port',
            pcb_port_id: 'pcb_port_2',
            source_port_id: 'source_port_2',
            x: 2,
            y: 0
        }
    ]
    Object.assign(documentModel, {
        fileName: 'connectivity.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies richer element-array records are preserved for rendering,
 * visibility, snapping, and in-view diagnostics.
 */
test('PcbInteractionPrimitiveModel builds rich CircuitJSON PCB primitives', () => {
    const model = PcbInteractionPrimitiveModel.build(
        createRichCircuitJsonDocument()
    )
    const kinds = new Set(model.primitives.map((primitive) => primitive.kind))

    assert.equal(
        model.primitives.find((primitive) => primitive.id === 'pad_rot')
            .rotation,
        45
    )
    assert.equal(
        model.primitives.find((primitive) => primitive.id === 'pad_pill').shape,
        'pill'
    )
    assert.equal(
        model.primitives.find((primitive) => primitive.id === 'pad_poly').points
            .length,
        3
    )
    assert.equal(kinds.has('silkscreen'), true)
    assert.equal(kinds.has('fabrication'), true)
    assert.equal(kinds.has('keepout'), true)
    assert.equal(kinds.has('cutout'), true)
    assert.equal(kinds.has('courtyard'), true)
    assert.equal(kinds.has('copper-text'), true)
    assert.equal(kinds.has('note'), true)
    assert.equal(kinds.has('dimension'), true)
    assert.equal(kinds.has('solder-mask'), true)
    assert.equal(kinds.has('solder-paste'), true)
    assert.equal(kinds.has('thermal-spoke'), true)
    assert.equal(kinds.has('route-hint'), true)
    assert.equal(kinds.has('breakout-point'), true)
    assert.equal(kinds.has('panel'), true)
    assert.deepEqual(
        model.primitives
            .filter((primitive) =>
                ['solder-mask', 'solder-paste'].includes(primitive.kind)
            )
            .map((primitive) => ({
                kind: primitive.kind,
                layer: primitive.layer,
                width: primitive.width,
                height: primitive.height
            })),
        [
            {
                kind: 'solder-mask',
                layer: 'top_soldermask',
                width: 1.1,
                height: 0.55
            },
            {
                kind: 'solder-mask',
                layer: 'top_soldermask',
                width: 1.6,
                height: 0.55
            },
            {
                kind: 'solder-paste',
                layer: 'top_paste',
                width: 0.7,
                height: 0.25
            }
        ]
    )
    assert.deepEqual(model.traceLengths, [
        {
            id: 'trace_sig',
            netName: 'SIG',
            length: 3,
            maxLength: 2.5,
            displayName: 'SIG budget',
            overLimit: true,
            label: '3.00 / 2.50 mm (SIG budget)',
            point: { x: 0.5, y: -1 },
            layer: 'top',
            side: 'top'
        }
    ])
    assert.deepEqual(
        model.primitives
            .filter((primitive) => primitive.id === 'pad_asym:solder-mask')
            .map((primitive) => ({
                x: primitive.x,
                y: primitive.y,
                width: primitive.width,
                height: primitive.height,
                rotation: primitive.rotation
            })),
        [
            {
                x: -0.7,
                y: 0.175,
                width: 1.6,
                height: 0.55,
                rotation: 30
            }
        ]
    )
    assert.deepEqual(model.groups, [
        {
            id: 'group_1',
            type: 'pcb_group',
            name: 'Analog',
            bounds: {
                minX: -0.5,
                minY: 0,
                maxX: 2.5,
                maxY: 2,
                width: 3,
                height: 2
            },
            sourceGroupId: 'source_group_1',
            subcircuitId: '',
            componentIds: ['pcb_u1'],
            memberIds: ['pcb_u1'],
            anchor: { x: 0, y: 0 },
            depth: 0
        }
    ])
    assert.deepEqual(model.anchorOffsets, [
        {
            id: 'anchor-offset:group_1:pcb_u1',
            kind: 'group-anchor-offset',
            sourceId: 'group_1',
            targetId: 'pcb_u1',
            targetType: 'component',
            start: { x: 0, y: 0 },
            end: { x: 1, y: 1 },
            label: 'U1'
        }
    ])
    assert.deepEqual(model.diagnostics[0], {
        id: 'err_1',
        kind: 'error',
        severity: 'error',
        category: 'clearance',
        code: 'clearance',
        message: 'Trace clearance is below the configured rule.',
        point: { x: 1, y: 1 },
        componentKey: 'U1',
        netName: ''
    })
})

/**
 * Verifies non-copper artwork and overlay controls surface as virtual layers.
 */
test('PcbInteractionPrimitiveModel exposes CircuitJSON virtual render layers', () => {
    const groups = PcbInteractionPrimitiveModel.resolveLayerGroups(
        createRichCircuitJsonDocument()
    )

    assert.deepEqual(
        groups.virtualLayers.map((layer) => layer.key),
        [
            'top_silkscreen',
            'top_fabrication',
            'top_courtyard',
            'top_soldermask',
            'top_paste',
            'keepouts',
            'cutouts',
            'diagnostics',
            'groups',
            'anchor_offsets',
            'trace_lengths',
            'ratsnest'
        ]
    )
})

/**
 * Verifies multiple board rows render independently and fit one board bounds.
 */
test('PcbInteractionPrimitiveModel merges CircuitJSON multi-board bounds', () => {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_a',
            center: { x: -5, y: 0 },
            width: 4,
            height: 4
        },
        {
            type: 'pcb_board',
            pcb_board_id: 'board_b',
            center: { x: 5, y: 0 },
            width: 4,
            height: 4
        }
    ]
    Object.assign(documentModel, {
        fileName: 'panel.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    const model = PcbInteractionPrimitiveModel.build(documentModel)

    assert.equal(
        model.primitives.filter((primitive) => primitive.kind === 'board')
            .length,
        2
    )
    assert.deepEqual(model.bounds, {
        minX: -7,
        minY: -2,
        maxX: 7,
        maxY: 2,
        width: 14,
        height: 4
    })
})

/**
 * Verifies snap points include center and edge anchors from primitive bounds.
 */
test('PcbInteractionPrimitiveModel snaps to primitive bounds anchors', () => {
    const snap = PcbInteractionPrimitiveModel.resolveSnapPoint(
        createRichCircuitJsonDocument(),
        { x: 0.6, y: 0.44 },
        { tolerance: 0.05 }
    )

    assert.equal(snap.snapped, true)
    assert.deepEqual(snap.point, { x: 0.6, y: 0.425 })
})

/**
 * Verifies source connectivity can be projected into PCB airwires.
 */
test('PcbInteractionPrimitiveModel builds CircuitJSON rats-nest lines', () => {
    const model = PcbInteractionPrimitiveModel.build(
        createConnectivityDocument()
    )

    assert.deepEqual(model.airwires, [
        {
            id: 'airwire:SIG:0',
            netName: 'SIG',
            start: { x: -2, y: 0 },
            end: { x: 2, y: 0 }
        }
    ])
})

/**
 * Verifies optional copper clearance checks can produce in-view diagnostics.
 */
test('PcbInteractionPrimitiveModel reports CircuitJSON copper clearance gaps', () => {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4,
            min_trace_clearance: 0.25
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_a',
            shape: 'rect',
            x: -0.1,
            y: 0,
            width: 0.4,
            height: 0.4,
            layer: 'top',
            net: 'A'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_b',
            shape: 'rect',
            x: 0.3,
            y: 0,
            width: 0.4,
            height: 0.4,
            layer: 'top',
            net: 'B'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'clearance.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    const model = PcbInteractionPrimitiveModel.build(documentModel)
    const clearance = model.diagnostics.find(
        (diagnostic) => diagnostic.category === 'clearance'
    )

    assert.equal(clearance.severity, 'error')
    assert.equal(clearance.code, 'pcb_copper_clearance')
    assert.equal(clearance.netName, 'A / B')
    assert.equal(clearance.clearance.minimum, 0.25)
    assert.equal(clearance.clearance.actual, 0)
    assert.deepEqual(clearance.relatedPrimitiveIds, ['pad_a', 'pad_b'])
    assert.deepEqual(clearance.bounds, {
        minX: -0.3,
        minY: -0.2,
        maxX: 0.5,
        maxY: 0.2,
        width: 0.8,
        height: 0.4
    })
})

/**
 * Verifies copper clearance checks use primitive geometry rather than only
 * axis-aligned bounds.
 */
test('PcbInteractionPrimitiveModel ignores bounding-box-only CircuitJSON copper conflicts', () => {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4,
            minimum_copper_clearance: 0.2
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_a',
            shape: 'circle',
            x: 0,
            y: 0,
            diameter: 1,
            layer: 'top',
            net: 'A'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_b',
            shape: 'circle',
            x: 0.9,
            y: 0.9,
            diameter: 1,
            layer: 'top',
            net: 'B'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'exact-clearance.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    const model = PcbInteractionPrimitiveModel.build(documentModel)

    assert.equal(
        model.diagnostics.some(
            (diagnostic) => diagnostic.code === 'pcb_copper_clearance'
        ),
        false
    )
})

/**
 * Verifies groups and subcircuits are projected onto PCB interaction rows.
 */
test('PcbInteractionPrimitiveModel exposes CircuitJSON group and subcircuit rows', () => {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4
        },
        {
            type: 'source_group',
            source_group_id: 'source_group_power',
            name: 'Power'
        },
        {
            type: 'pcb_group',
            pcb_group_id: 'pcb_group_regulator',
            source_group_id: 'source_group_power',
            name: 'Regulator',
            center: { x: 0, y: 0 },
            width: 3,
            height: 2
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            source_group_id: 'source_group_power',
            subcircuit_id: 'subcircuit_regulator',
            name: 'U1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            pcb_group_id: 'pcb_group_regulator',
            subcircuit_id: 'subcircuit_regulator',
            center: { x: 0, y: 0 },
            layer: 'top'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_u1_1',
            pcb_component_id: 'pcb_u1',
            pcb_group_id: 'pcb_group_regulator',
            subcircuit_id: 'subcircuit_regulator',
            shape: 'rect',
            x: 0,
            y: 0,
            width: 0.6,
            height: 0.3,
            layer: 'top',
            net: 'VIN'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'groups.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    const model = PcbInteractionPrimitiveModel.build(documentModel)

    assert.deepEqual(model.groups, [
        {
            id: 'pcb_group_regulator',
            type: 'pcb_group',
            name: 'Regulator',
            bounds: {
                minX: -1.5,
                minY: -1,
                maxX: 1.5,
                maxY: 1,
                width: 3,
                height: 2
            },
            sourceGroupId: 'source_group_power',
            subcircuitId: '',
            componentIds: ['pcb_u1'],
            memberIds: ['pcb_u1', 'pad_u1_1'],
            anchor: null,
            depth: 0
        }
    ])
    assert.deepEqual(
        model.primitives.find((primitive) => primitive.id === 'pad_u1_1')
            .groupIds,
        ['pcb_group_regulator', 'source_group_power']
    )
    assert.deepEqual(
        model.components.find((component) => component.componentKey === 'U1')
            .subcircuitIds,
        ['subcircuit_regulator']
    )
})

/**
 * Verifies diagnostic focus bounds can resolve related PCB geometry.
 */
test('PcbDiagnosticFocusModel resolves CircuitJSON diagnostic focus bounds', () => {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 8,
            height: 4,
            min_trace_clearance: 0.25
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            net: 'SIG',
            route: [
                { route_type: 'wire', x: 1, y: 1, width: 0.2, layer: 'top' },
                { route_type: 'wire', x: 5, y: 1, width: 0.2, layer: 'top' }
            ]
        },
        {
            type: 'pcb_trace_error',
            pcb_trace_error_id: 'trace_error_1',
            pcb_trace_id: 'trace_1',
            message: 'Trace is over budget.',
            error_type: 'trace_length'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_a',
            shape: 'rect',
            x: -0.1,
            y: 0,
            width: 0.4,
            height: 0.4,
            layer: 'top',
            net: 'A'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_b',
            shape: 'rect',
            x: 0.3,
            y: 0,
            width: 0.4,
            height: 0.4,
            layer: 'top',
            net: 'B'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'diagnostics.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })

    const focus = PcbDiagnosticFocusModel.build(documentModel)

    assert.deepEqual(focus.get('trace_error_1'), {
        id: 'trace_error_1',
        point: { x: 3, y: 1 },
        bounds: { x: 0.9, y: 0.9, width: 4.2, height: 0.2 },
        relatedPrimitiveIds: ['trace_1:segment:0']
    })
    assert.deepEqual(focus.get('clearance:0'), {
        id: 'clearance:0',
        point: { x: 0.1, y: 0 },
        bounds: { x: -0.3, y: -0.2, width: 0.8, height: 0.4 },
        relatedPrimitiveIds: ['pad_a', 'pad_b']
    })
})
