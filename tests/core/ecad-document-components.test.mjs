import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'
import { EcadDocumentComponents } from '../../src/core/ecad/EcadDocumentComponents.mjs'
import { EcadDocumentType } from '../../src/core/ecad/EcadDocumentType.mjs'

test('canonical PCB component projection is cached and source-aware', () => {
    const document = Parser.parse({
        fileName: 'board.json',
        data: JSON.stringify([
            {
                type: 'source_component',
                source_component_id: 'source_r1',
                name: 'R1',
                ftype: 'simple_resistor',
                resistance: '10k'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_r1',
                source_component_id: 'source_r1',
                center: { x: 1, y: 2 },
                width: 2,
                height: 1,
                rotation: 0,
                layer: 'bottom'
            }
        ])
    })

    const first = EcadDocumentComponents.resolve(document)
    const second = EcadDocumentComponents.resolve(document)
    const context = EcadCircuitJsonContext.prepare(document)

    assert.equal(second, first)
    assert.equal(EcadDocumentType.kind(document), 'pcb')
    assert.equal(EcadDocumentType.fileName(document), 'board.json')
    assert.deepEqual(first[0], {
        designator: 'R1',
        reference: 'R1',
        refdes: 'R1',
        name: 'R1',
        pcbComponentId: 'pcb_r1',
        sourceComponentId: 'source_r1',
        layer: 'bottom',
        side: 'bottom',
        mountSide: 'bottom',
        pattern: 'simple_resistor',
        footprint: 'simple_resistor',
        source: 'simple_resistor',
        value: '10k',
        mpn: '',
        description: ''
    })
    assert.equal(context.statistics.indexBuilds.elements, 1)
    assert.equal(context.statistics.derivedBuilds['document:components-v1'], 1)
})

test('canonical schematic component projection selects source rows', () => {
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
                type: 'schematic_component',
                schematic_component_id: 'schematic_u1',
                source_component_id: 'source_u1',
                center: { x: 1, y: 2 },
                size: { width: 4, height: 3 }
            }
        ])
    })

    assert.equal(EcadDocumentType.kind(document), 'schematic')
    assert.deepEqual(
        EcadDocumentComponents.resolve(document).map((row) => row.designator),
        ['U1']
    )
})
