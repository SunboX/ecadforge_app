import assert from 'node:assert/strict'
import test from 'node:test'
import { Parser } from 'circuitjson-toolkit/parser'
import { ViewerSidebarOverviewRenderer } from '../../src/ui/ViewerSidebarOverviewRenderer.mjs'

/**
 * Returns an identity translation function for renderer tests.
 * @param {string} key Translation key.
 * @returns {string}
 */
function translate(key) {
    return key
}

/**
 * Builds a canonical board model with coverage and manufacturing data.
 * @returns {object}
 */
function createMetadataDocument() {
    return Parser.parse({
        fileName: 'metadata-board.json',
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
                type: 'pcb_fabrication_note_text',
                pcb_fabrication_note_text_id: 'fab_text_1',
                pcb_component_id: 'pcb_u1',
                layer: 'top',
                text: 'Inspect assembly',
                anchor_position: { x: 1, y: 2 },
                font_size: 0.8
            }
        ])
    })
}

/**
 * Verifies schema coverage and manufacturing download actions are visible in
 * the overview sidebar.
 */
test('ViewerSidebarOverviewRenderer renders metadata coverage and downloads', () => {
    const html = ViewerSidebarOverviewRenderer.render(
        createMetadataDocument(),
        translate,
        { documentId: 'doc-1' }
    )

    assert.match(html, /viewer-sidebar__support-coverage/)
    assert.match(html, /sidebar\.boardOverview/)
    assert.match(html, /metadata-board\.json/)
    assert.match(html, /393\.7 x 196\.85 mil/)
    assert.match(html, /1 scene3d\.componentsSuffix/)
    assert.match(html, /Format coverage/)
    assert.match(html, /4 present/)
    assert.match(html, /3 rendered/)
    assert.match(html, /No present coverage gaps\./)
    assert.match(html, /data-document-id="doc-1"/)
    assert.match(html, /data-pcb-assembly-export-format="pick-place-csv"/)
    assert.match(html, /data-pcb-assembly-export-format="routing-dsn"/)
    assert.match(
        html,
        /data-pcb-assembly-export-format="fabrication-notes-json"/
    )
})
