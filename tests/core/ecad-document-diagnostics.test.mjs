import assert from 'node:assert/strict'
import test from 'node:test'

import { Parser } from 'circuitjson-toolkit/parser'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'
import { EcadDocumentDiagnostics } from '../../src/core/ecad/EcadDocumentDiagnostics.mjs'

test('EcadDocumentDiagnostics exposes canonical model diagnostics through one shared index', () => {
    const document = Parser.parse({
        fileName: 'board.json',
        data: JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5
            },
            {
                type: 'pcb_trace_missing_error',
                pcb_trace_missing_error_id: 'missing_trace_1',
                message: 'Trace was not routed',
                source_trace_id: 'source_trace_1',
                pcb_component_ids: [],
                pcb_port_ids: []
            }
        ])
    })

    const first = EcadDocumentDiagnostics.resolve(document)
    const second = EcadDocumentDiagnostics.resolve(document)
    const context = EcadCircuitJsonContext.prepare(document)

    assert.equal(first.length, 1)
    assert.equal(first[0].type, 'pcb_trace_missing_error')
    assert.equal(first[0].message, 'Trace was not routed')
    assert.deepEqual(second, first)
    assert.equal(context.statistics.indexBuilds.connectivity, 1)
})

test('EcadDocumentDiagnostics preserves explicit native diagnostics', () => {
    const diagnostics = [{ severity: 'warning', message: 'Native warning' }]
    const document = { sourceFormat: 'altium', diagnostics }

    assert.equal(EcadDocumentDiagnostics.resolve(document), diagnostics)
})
