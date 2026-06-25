import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitJsonSchematicSvgRenderer } from 'circuitjson-toolkit/renderers'

/**
 * Verifies table grid metadata drives schematic table and cell geometry.
 */
test('CircuitJsonSchematicSvgRenderer computes table grid cells', () => {
    const markup = CircuitJsonSchematicSvgRenderer.render([
        {
            type: 'schematic_sheet',
            schematic_sheet_id: 'sheet_1',
            width: 20,
            height: 12
        },
        {
            type: 'schematic_table',
            schematic_table_id: 'table_1',
            anchor_position: { x: 2, y: 3 },
            anchor: 'top_left',
            column_widths: [4, 6],
            row_heights: [1.5, 2.5],
            cell_padding: 0.25,
            border_width: 0.05
        },
        {
            type: 'schematic_table_cell',
            schematic_table_cell_id: 'cell_header',
            schematic_table_id: 'table_1',
            row: 0,
            column: 0,
            text: 'NET',
            horizontal_align: 'left',
            vertical_align: 'middle',
            font_size: 0.8
        },
        {
            type: 'schematic_table_cell',
            schematic_table_cell_id: 'cell_span',
            schematic_table_id: 'table_1',
            row: 1,
            column: 0,
            col_span: 2,
            text: 'Total',
            horizontal_align: 'right',
            vertical_align: 'middle',
            font_size: 0.7
        }
    ])

    assert.match(
        markup,
        /class="schematic-table" data-schematic-table-id="table_1" x="2" y="3" width="10" height="4" stroke-width="0\.05"/
    )
    assert.match(
        markup,
        /data-schematic-table-cell-id="cell_header"[\s\S]*<rect x="2" y="3" width="4" height="1\.5" stroke-width="0\.05"/
    )
    assert.match(
        markup,
        /<text x="2\.25" y="3\.75" text-anchor="start" dominant-baseline="central" font-size="0\.8">NET/
    )
    assert.match(
        markup,
        /data-schematic-table-cell-id="cell_span"[\s\S]*<rect x="2" y="4\.5" width="10" height="2\.5" stroke-width="0\.05"/
    )
    assert.match(
        markup,
        /<text x="11\.75" y="5\.75" text-anchor="end" dominant-baseline="central" font-size="0\.7">Total/
    )
})
