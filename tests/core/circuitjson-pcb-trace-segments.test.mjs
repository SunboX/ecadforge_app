import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/renderers'

/**
 * Verifies trace segments are not drawn across route points on different
 * copper layers.
 */
test('PcbInteractionPrimitiveModel skips cross-layer trace segments', () => {
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
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            net: 'SIG',
            route: [
                {
                    route_type: 'wire',
                    x: 0,
                    y: 0,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 1,
                    y: 0,
                    width: 0.2,
                    layer: 'bottom'
                },
                {
                    route_type: 'wire',
                    x: 2,
                    y: 0,
                    width: 0.2,
                    layer: 'bottom'
                }
            ]
        }
    ]
    const tracks = PcbInteractionPrimitiveModel.build(documentModel)
        .primitives.filter((primitive) => primitive.kind === 'track')
        .map((primitive) => ({
            layer: primitive.layer,
            x1: primitive.x1,
            x2: primitive.x2
        }))

    assert.deepEqual(tracks, [{ layer: 'bottom', x1: 1, x2: 2 }])
})

/**
 * Verifies route-level vias keep normalized drilled geometry.
 */
test('PcbInteractionPrimitiveModel keeps route via geometry', () => {
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
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            net: 'SIG',
            route: [
                {
                    route_type: 'wire',
                    x: 0,
                    y: 0,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'via',
                    x: 1,
                    y: 0,
                    outer_diameter: 0.8,
                    hole_diameter: 0.32,
                    from_layer: 'top',
                    to_layer: 'bottom'
                },
                {
                    route_type: 'wire',
                    x: 2,
                    y: 0,
                    width: 0.2,
                    layer: 'bottom'
                }
            ]
        }
    ]
    const via = PcbInteractionPrimitiveModel.build(
        documentModel
    ).primitives.find((primitive) => primitive.kind === 'via')

    assert.deepEqual(
        {
            id: via.id,
            shape: via.shape,
            width: via.width,
            height: via.height,
            diameter: via.diameter,
            holeShape: via.holeShape,
            holeDiameter: via.holeDiameter,
            holeWidth: via.holeWidth,
            holeHeight: via.holeHeight
        },
        {
            id: 'trace_1:via:0',
            shape: 'circle',
            width: 0.8,
            height: 0.8,
            diameter: 0.8,
            holeShape: 'circle',
            holeDiameter: 0.32,
            holeWidth: 0.32,
            holeHeight: 0.32
        }
    )
})

/**
 * Verifies source-trace relationships are surfaced for trace inspection and
 * generated connectivity diagnostics.
 */
test('PcbInteractionPrimitiveModel surfaces source trace connectivity', () => {
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
            source_net_id: 'source_net_sig',
            name: 'SIG'
        },
        {
            type: 'source_port',
            source_port_id: 'source_u1_pin1',
            source_component_id: 'source_u1',
            name: 'pin1'
        },
        {
            type: 'source_trace',
            source_trace_id: 'source_trace_sig',
            display_name: 'SIG route',
            connected_source_port_ids: ['source_u1_pin1'],
            connected_source_net_ids: ['source_net_sig'],
            max_length: 6
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'pcb_trace_sig',
            source_trace_id: 'source_trace_sig',
            net: 'SIG',
            route: [
                {
                    route_type: 'wire',
                    x: 0,
                    y: 0,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 3,
                    y: 0,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'pcb_trace_orphan',
            source_trace_id: 'source_trace_missing',
            net: 'ORPHAN',
            route: [
                {
                    route_type: 'wire',
                    x: 0,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 1,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        }
    ]

    const model = PcbInteractionPrimitiveModel.build(documentModel)
    const traceLength = model.traceLengths.find(
        (row) => row.id === 'pcb_trace_sig'
    )
    const diagnostic = model.diagnostics.find(
        (row) => row.code === 'pcb_trace_missing_source_trace_warning'
    )

    assert.deepEqual(
        {
            sourceTraceId: traceLength.sourceTraceId,
            connectedSourcePortIds: traceLength.connectedSourcePortIds,
            connectedSourceNetIds: traceLength.connectedSourceNetIds,
            displayName: traceLength.displayName
        },
        {
            sourceTraceId: 'source_trace_sig',
            connectedSourcePortIds: ['source_u1_pin1'],
            connectedSourceNetIds: ['source_net_sig'],
            displayName: 'SIG route'
        }
    )
    assert.deepEqual(
        {
            code: diagnostic.code,
            sourceTraceId: diagnostic.sourceTraceId,
            pcbTraceId: diagnostic.pcbTraceId,
            relatedPrimitiveIds: diagnostic.relatedPrimitiveIds
        },
        {
            code: 'pcb_trace_missing_source_trace_warning',
            sourceTraceId: 'source_trace_missing',
            pcbTraceId: 'pcb_trace_orphan',
            relatedPrimitiveIds: ['pcb_trace_orphan:segment:0']
        }
    )
})
