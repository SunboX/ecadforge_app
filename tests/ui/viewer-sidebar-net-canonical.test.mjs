import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { NetSelectionModel } from '../../src/core/NetSelectionModel.mjs'
import { ViewerSidebarNetRenderer } from '../../src/ui/ViewerSidebarNetRenderer.mjs'

test('canonical source nets render and participate in shared selection', () => {
    const documentModel = Parser.parse({
        fileName: 'sheet.json',
        data: JSON.stringify([
            {
                type: 'source_net',
                source_net_id: 'source_net_power',
                name: 'POWER',
                member_source_group_ids: []
            }
        ])
    })
    const html = ViewerSidebarNetRenderer.render(
        {
            activeDocumentId: 'doc-1',
            documentModel,
            selectedNets: { 'doc-1': 'POWER' }
        },
        (key) => key
    )

    assert.match(html, /data-pcb-net-key="POWER"/)
    assert.match(html, /aria-pressed="true"/)
    assert.equal(
        NetSelectionModel.documentHasNetKey(documentModel, 'power'),
        true
    )
})
