import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { SchematicSvgRenderer } from 'circuitjson-toolkit/renderers'
import { SchematicNetHighlightRenderer } from '../../src/ui/SchematicNetHighlightRenderer.mjs'

test('canonical schematic traces receive direct-coordinate net overlays', () => {
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
                type: 'source_net',
                source_net_id: 'source_net_signal',
                name: 'SIGNAL',
                member_source_group_ids: []
            },
            {
                type: 'source_trace',
                source_trace_id: 'source_trace_signal',
                connected_source_net_ids: ['source_net_signal'],
                connected_source_port_ids: []
            },
            {
                type: 'schematic_trace',
                schematic_trace_id: 'schematic_trace_signal',
                schematic_sheet_id: 'sheet_1',
                source_trace_id: 'source_trace_signal',
                junctions: [],
                edges: [
                    {
                        from: { x: 2, y: 3 },
                        to: { x: 8, y: 3 }
                    },
                    {
                        from: { x: 8, y: 3 },
                        to: { x: 8, y: 6 }
                    }
                ]
            }
        ])
    })
    const markup = SchematicNetHighlightRenderer.inject(
        SchematicSvgRenderer.render(documentModel),
        documentModel,
        'SIGNAL'
    )

    assert.match(markup, /schematic-net-highlight-style/)
    assert.match(markup, /class="schematic-net-highlight"/)
    assert.match(markup, /class="schematic-net-hit-target"/)
    assert.match(markup, /data-schematic-net-name="SIGNAL"/)
    assert.match(markup, /d="M2 3 L8 3"/)
    assert.match(markup, /d="M8 3 L8 6"/)
})
