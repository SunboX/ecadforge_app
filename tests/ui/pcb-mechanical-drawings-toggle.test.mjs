import assert from 'node:assert/strict'
import test from 'node:test'

import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a generic PCB exposing electrical and drawing layers.
 * @returns {object}
 */
function createDrawingBoard() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'drawing-board.fake',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 300,
                segments: []
            },
            layers: [{ name: 'Top Layer', layerId: 1, role: 'copper' }],
            primitiveLayers: [
                { name: 'TopOverlay', layerId: 33, role: 'overlay' },
                { name: 'Mechanical1', layerId: 57, role: 'mechanical' },
                { name: 'Notes', layerId: 60, role: 'documentation' }
            ],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: 0,
                    y1: 0,
                    x2: 100,
                    y2: 0,
                    width: 1,
                    layerId: 57
                },
                {
                    x1: 0,
                    y1: 100,
                    x2: 100,
                    y2: 100,
                    width: 1,
                    layerId: 60
                }
            ],
            arcs: [],
            regions: [],
            vias: [],
            pads: [],
            texts: [],
            dimensions: [],
            components: []
        },
        bom: []
    }
}

/**
 * Verifies the board-side toolbar exposes one aggregate checkbox for all
 * mechanical drawing layers and reflects the current hidden-layer state.
 */
test('PcbViewRenderer renders the mechanical drawings checkbox', () => {
    const documentModel = createDrawingBoard()
    const hiddenHtml = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        ['Mechanical1', 'Notes'],
        [],
        '',
        {},
        '',
        { documentId: 'doc-1' }
    )
    const visibleHtml = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        [],
        [],
        '',
        {},
        '',
        { documentId: 'doc-1' }
    )

    assert.match(
        hiddenHtml,
        /<input[^>]*type="checkbox"[^>]*data-document-id="doc-1"[^>]*data-pcb-layer-keys="\[&quot;Mechanical1&quot;,&quot;Notes&quot;\]"/u
    )
    assert.match(hiddenHtml, />Mechanical drawings<\/span>/)
    assert.doesNotMatch(hiddenHtml, /data-pcb-mechanical-drawings[^>]*checked/)
    assert.match(visibleHtml, /data-pcb-mechanical-drawings[^>]*checked/)
})
