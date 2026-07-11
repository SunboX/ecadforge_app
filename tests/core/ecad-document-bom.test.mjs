import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'
import { EcadDocumentBom } from '../../src/core/ecad/EcadDocumentBom.mjs'

test('EcadDocumentBom derives and reuses canonical grouped rows', () => {
    const document = Parser.parse({
        fileName: 'bom.json',
        data: JSON.stringify([
            {
                type: 'source_component',
                source_component_id: 'source_r1',
                name: 'R1',
                ftype: 'simple_resistor',
                resistance: '10k'
            },
            {
                type: 'source_component',
                source_component_id: 'source_r2',
                name: 'R2',
                ftype: 'simple_resistor',
                resistance: '10k'
            }
        ])
    })

    const first = EcadDocumentBom.resolve(document)
    const second = EcadDocumentBom.resolve(document)
    const context = EcadCircuitJsonContext.prepare(document)

    assert.equal(second, first)
    assert.deepEqual(first[0].designators, ['R1', 'R2'])
    assert.equal(first[0].quantity, 2)
    assert.equal(context.statistics.derivedBuilds['bom:app-rows-v1'], 1)
})

test('EcadDocumentBom preserves native BOM row identity', () => {
    const bom = [{ designators: ['U1'], quantity: 1 }]

    assert.equal(EcadDocumentBom.resolve({ bom }), bom)
})
