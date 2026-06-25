import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerSidebarNetRenderer } from '../../src/ui/ViewerSidebarNetRenderer.mjs'

/**
 * Returns a stable translation string for sidebar tests.
 * @param {string} key Translation key.
 * @returns {string}
 */
function translate(key) {
    return (
        {
            'sidebar.nets': 'Nets',
            'sidebar.noNets': 'No nets',
            'sidebar.searchNets': 'Search nets',
            'sidebar.search': 'Search',
            'sidebar.copyNetName': 'Copy net name'
        }[key] || key
    )
}

/**
 * Verifies explicit PCB net colors are visible in the selectable net list.
 */
test('ViewerSidebarNetRenderer renders CircuitJSON net color swatches', () => {
    const documentModel = [
        {
            type: 'source_net',
            source_net_id: 'source_net_signal',
            name: 'SIGNAL'
        },
        {
            type: 'pcb_net',
            pcb_net_id: 'pcb_net_signal',
            source_net_id: 'source_net_signal',
            highlight_color: '#ff3366'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_signal',
            shape: 'rect',
            x: 0,
            y: 0,
            width: 0.8,
            height: 0.5,
            layer: 'top',
            net: 'SIGNAL'
        }
    ]
    Object.assign(documentModel, {
        sourceFormat: 'circuitjson',
        kind: 'pcb',
        fileName: 'net-sidebar.json'
    })

    const html = ViewerSidebarNetRenderer.render(
        {
            activeDocumentId: 'doc-1',
            documentModel,
            selectedNets: {}
        },
        translate
    )

    assert.match(html, /data-pcb-net-key="SIGNAL"/)
    assert.match(html, /viewer-sidebar__net-swatch/)
    assert.match(html, /data-net-color="#ff3366"/)
    assert.match(html, /style="--net-color: #ff3366"/)
})
