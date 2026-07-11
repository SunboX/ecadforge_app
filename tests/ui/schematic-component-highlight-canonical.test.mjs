import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { SchematicSvgRenderer } from 'circuitjson-toolkit/renderers'
import { SchematicComponentHighlightRenderer } from '../../src/ui/SchematicComponentHighlightRenderer.mjs'

test('canonical schematic components receive direct-coordinate hit targets', () => {
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
                ftype: 'simple_chip'
            },
            {
                type: 'schematic_component',
                schematic_component_id: 'schematic_u1',
                source_component_id: 'source_u1',
                center: { x: 5, y: 4 },
                size: { width: 4, height: 2 }
            }
        ])
    })
    const markup = SchematicComponentHighlightRenderer.inject(
        SchematicSvgRenderer.render(documentModel),
        documentModel,
        'U1'
    )

    assert.match(markup, /schematic-component-highlight-style/)
    assert.match(markup, /class="schematic-symbol-highlight"/)
    assert.match(markup, /class="schematic-symbol-hit-target"/)
    assert.match(markup, /data-schematic-component-key="U1"/)
})
