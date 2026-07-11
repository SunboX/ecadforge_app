import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { PcbComponentSelectionModel } from '../../src/core/PcbComponentSelectionModel.mjs'
import { ViewerSidebarComponentRenderer } from '../../src/ui/ViewerSidebarComponentRenderer.mjs'

test('canonical PCB components render and participate in shared selection', () => {
    const documentModel = Parser.parse({
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
    const html = ViewerSidebarComponentRenderer.render(
        {
            activeDocumentId: 'doc-1',
            documentModel,
            documents: [{ id: 'doc-1', documentModel }]
        },
        (key) => key
    )

    assert.match(html, /sidebar\.footprints/)
    assert.match(html, /data-component-group="back"/)
    assert.match(html, /data-pcb-component-key="R1"/)
    assert.match(html, /viewer-sidebar__component-value">10k/)
    assert.equal(
        PcbComponentSelectionModel.resolveSelectedComponentSide(
            documentModel,
            'R1'
        ),
        'bottom'
    )
    assert.equal(
        PcbComponentSelectionModel.documentHasComponentKey(documentModel, 'R1'),
        true
    )
})
