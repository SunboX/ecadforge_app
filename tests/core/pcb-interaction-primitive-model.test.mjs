import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from '../../src/core/PcbInteractionPrimitiveModel.mjs'

/**
 * Builds a compact standards-native PCB document.
 * @returns {object[]}
 */
function createCircuitJsonDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6,
            num_layers: 2
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1',
            ftype: 'simple_chip'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            layer: 'top',
            rotation: 0,
            width: 1.2,
            height: 0.8
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_1',
            pcb_component_id: 'pcb_u1',
            pcb_port_id: 'port_1',
            shape: 'rect',
            x: 1,
            y: 1,
            width: 1.2,
            height: 0.8,
            layer: 'top',
            net: 'VCC'
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            net: 'VCC',
            route: [
                {
                    route_type: 'wire',
                    x: 1,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 3,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                }
            ]
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
 * Verifies CircuitJSON geometry is normalized into renderer-neutral
 * interaction primitives.
 */
test('PcbInteractionPrimitiveModel builds CircuitJSON PCB primitives', () => {
    const model = PcbInteractionPrimitiveModel.build(
        createCircuitJsonDocument()
    )

    assert.deepEqual(
        model.layers.map((layer) => layer.key),
        ['top', 'bottom']
    )
    assert.equal(model.components[0].designator, 'U1')
    assert.equal(model.nets[0].name, 'VCC')
    assert.deepEqual(model.bounds, {
        minX: -5,
        minY: -3,
        maxX: 5,
        maxY: 3,
        width: 10,
        height: 6
    })
    assert.equal(
        model.primitives.some(
            (primitive) =>
                primitive.kind === 'pad' &&
                primitive.componentKey === 'U1' &&
                primitive.netName === 'VCC'
        ),
        true
    )
})

/**
 * Verifies the shared primitive model can snap measurement points to PCB
 * geometry.
 */
test('PcbInteractionPrimitiveModel snaps near primitive anchors', () => {
    const snap = PcbInteractionPrimitiveModel.resolveSnapPoint(
        createCircuitJsonDocument(),
        { x: 1.08, y: 0.94 },
        { tolerance: 0.25 }
    )

    assert.deepEqual(snap, {
        snapped: true,
        point: { x: 1, y: 1 }
    })
})

/**
 * Verifies standards-native PCB geometry handles string units and the broader
 * primitive families used by board viewers.
 */
test('PcbInteractionPrimitiveModel builds rich CircuitJSON PCB primitives', () => {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: '0mm', y: '0mm' },
            width: '20mm',
            height: '10mm',
            outline: [
                { x: -10, y: -5 },
                { x: 10, y: -5 },
                { x: 10, y: 5 },
                { x: -10, y: 5 }
            ],
            num_layers: 4
        },
        {
            type: 'source_component',
            source_component_id: 'source_u2',
            name: 'U2',
            ftype: 'simple_chip'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u2',
            source_component_id: 'source_u2',
            center: { x: '1mm', y: '2mm' },
            layer: 'top',
            rotation: '45deg',
            width: '4mm',
            height: '2mm'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_circle',
            pcb_component_id: 'pcb_u2',
            shape: 'circle',
            x: '1mm',
            y: '2mm',
            radius: '0.5mm',
            layer: 'top',
            pcb_port_id: 'port_a'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_rotated',
            pcb_component_id: 'pcb_u2',
            shape: 'rotated_pill',
            x: '3mm',
            y: '2mm',
            width: '2mm',
            height: '1mm',
            radius: '0.5mm',
            ccw_rotation: '90deg',
            layer: 'top'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_poly',
            pcb_component_id: 'pcb_u2',
            shape: 'polygon',
            points: [
                { x: 4, y: 1 },
                { x: 5, y: 1 },
                { x: 4.5, y: 2 }
            ],
            layer: 'bottom'
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            source_net_id: 'net_vcc',
            route: [
                {
                    route_type: 'wire',
                    x: '1mm',
                    y: '2mm',
                    width: '0.2mm',
                    layer: 'top'
                },
                {
                    route_type: 'via',
                    x: '2mm',
                    y: '2mm',
                    outer_diameter: '0.7mm',
                    hole_diameter: '0.3mm',
                    from_layer: 'top',
                    to_layer: 'bottom'
                },
                {
                    route_type: 'wire',
                    x: '4mm',
                    y: '3mm',
                    width: '0.2mm',
                    layer: 'bottom'
                }
            ]
        },
        {
            type: 'pcb_silkscreen_text',
            pcb_silkscreen_text_id: 'silk_text_1',
            text: 'U2',
            x: '1mm',
            y: '0mm',
            font_size: '1mm',
            layer: 'top'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'cutout_1',
            shape: 'rect',
            center: { x: '0mm', y: '0mm' },
            width: '2mm',
            height: '1mm'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'rich-board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })

    const model = PcbInteractionPrimitiveModel.build(documentModel)
    const kinds = model.primitives.map((primitive) => primitive.kind)

    assert.equal(model.layers.length, 4)
    assert.equal(kinds.includes('silkscreen_text'), true)
    assert.equal(kinds.includes('cutout'), true)
    assert.equal(
        model.primitives.some(
            (primitive) =>
                primitive.kind === 'pad' &&
                primitive.id === 'pad_rotated' &&
                primitive.rotation === 90
        ),
        true
    )
    assert.equal(
        model.primitives.some(
            (primitive) => primitive.kind === 'via' && primitive.sourceRoute
        ),
        true
    )
    assert.equal(
        PcbInteractionPrimitiveModel.hitTest(
            documentModel,
            { x: 1, y: 2 },
            { side: 'top' }
        )[0].componentKey,
        'U2'
    )
})
