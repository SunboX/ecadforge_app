import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'
import { EcadDocumentSummary } from '../../src/core/ecad/EcadDocumentSummary.mjs'

test('EcadDocumentSummary caches canonical PCB display metrics', () => {
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
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                center: { x: 1, y: 2 },
                width: 3,
                height: 2,
                rotation: 0,
                layer: 'top'
            },
            {
                type: 'pcb_via',
                pcb_via_id: 'via_1',
                x: 0,
                y: 0,
                outer_diameter: 0.8,
                hole_diameter: 0.4,
                layers: ['top', 'bottom']
            }
        ])
    })

    const first = EcadDocumentSummary.resolve(document)
    const second = EcadDocumentSummary.resolve(document)
    const context = EcadCircuitJsonContext.prepare(document)

    assert.equal(second, first)
    assert.equal(first.kind, 'pcb')
    assert.equal(first.fileName, 'board.json')
    assert.equal(first.componentCount, 1)
    assert.equal(first.placementCount, 1)
    assert.equal(first.layerCount, 2)
    assert.equal(first.viaCount, 1)
    assert.equal(first.outlineSegmentCount, 4)
    assert.equal(first.boardWidthMil, 393.700787)
    assert.equal(first.boardHeightMil, 196.850394)
    assert.equal(context.statistics.derivedBuilds['document:summary-v1'], 1)
})
