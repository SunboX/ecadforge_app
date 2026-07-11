import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { WebMcpDesignAnalyzer } from '../../../src/core/webmcp/WebMcpDesignAnalyzer.mjs'
import { WebMcpDesignInspector } from '../../../src/core/webmcp/WebMcpDesignInspector.mjs'
import { WebMcpFocusedInspector } from '../../../src/core/webmcp/WebMcpFocusedInspector.mjs'

test('WebMcpDesignAnalyzer reviews canonical connectivity directly', () => {
    const documentModel = Parser.parse({
        fileName: 'sheet.json',
        data: JSON.stringify([
            {
                type: 'schematic_sheet',
                schematic_sheet_id: 'sheet_1',
                width: 20,
                height: 10
            },
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip',
                manufacturer_part_number: 'FAKE-1',
                description: 'Fake controller'
            },
            {
                type: 'source_port',
                source_port_id: 'source_u1_pin_1',
                source_component_id: 'source_u1',
                name: 'IN',
                pin_number: 1
            },
            {
                type: 'source_net',
                source_net_id: 'source_net_signal',
                name: 'SIGNAL',
                member_source_group_ids: []
            },
            {
                type: 'source_trace',
                source_trace_id: 'source_trace_signal',
                connected_source_net_ids: ['source_net_signal'],
                connected_source_port_ids: ['source_u1_pin_1']
            }
        ])
    })
    const entry = {
        id: 'doc-1',
        documentModel,
        sourceFormat: 'circuitjson',
        active: true
    }
    const review = WebMcpDesignAnalyzer.review([entry], [entry])

    assert.equal(WebMcpDesignAnalyzer.hasSchematicNets(documentModel), true)
    assert.equal(WebMcpDesignAnalyzer.entryName(entry), 'sheet.json')
    assert.equal(review.summary.components, 1)
    assert.equal(review.summary.nets, 1)
    assert.equal(review.summary.designs_with_connectivity, 1)
    assert.equal(review.designs[0].kind, 'schematic')

    const queried = WebMcpFocusedInspector.queryNet(entry, {
        net_name: 'signal'
    })
    const singlePin = WebMcpFocusedInspector.listSinglePinNets([entry])
    assert.equal(queried.net, 'SIGNAL')
    assert.deepEqual(queried.components, ['U1'])
    assert.equal(queried.pins[0].pin, '1')
    assert.equal(singlePin.total_count, 1)
    assert.deepEqual(singlePin.nets[0].pins, ['U1.1'])
    const pinConnections = WebMcpDesignInspector.listPinConnections(entry, {
        refdes: 'u1'
    })
    assert.equal(pinConnections.refdes, 'U1')
    assert.deepEqual(pinConnections.pins, [
        { pin: '1', name: 'IN', net: 'SIGNAL' }
    ])
})
