import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'
import { EcadDocumentConnectivity } from '../../src/core/ecad/EcadDocumentConnectivity.mjs'

test('EcadDocumentConnectivity reuses the common canonical query netlist', () => {
    const document = Parser.parse({
        fileName: 'sheet.json',
        data: JSON.stringify([
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip'
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

    const first = EcadDocumentConnectivity.resolve(document)
    const second = EcadDocumentConnectivity.resolve(document)
    const context = EcadCircuitJsonContext.prepare(document)

    assert.equal(second, first)
    assert.equal(first.components[0].designator, 'U1')
    assert.equal(first.nets[0].name, 'SIGNAL')
    assert.equal(first.nets[0].pinCount, 1)
    assert.equal(first.nets[0].pins[0].refdes, 'U1')
    assert.equal(context.statistics.derivedBuilds['query:netlist-v1'], 1)
    assert.equal(
        context.statistics.derivedBuilds['document:connectivity-v1'],
        1
    )
})
