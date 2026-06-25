import assert from 'node:assert/strict'
import test from 'node:test'
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
 * Builds a parsed board model with coverage and manufacturing metadata.
 * @returns {object}
 */
function createMetadataDocument() {
    return {
        fileName: 'metadata-board.json',
        kind: 'pcb',
        pcb: {
            boardOutline: { widthMil: 100, heightMil: 80 },
            components: []
        },
        summary: {
            title: 'Metadata board',
            layerCount: 2,
            trackCount: 1,
            viaCount: 0
        },
        diagnostics: [],
        supportMatrix: {
            totals: {
                knownElementTypes: 6,
                presentElementTypes: 4,
                renderedElementTypes: 3,
                diagnosticElementTypes: 1,
                unknownPresentElementTypes: 1
            },
            rows: [
                {
                    type: 'pcb_board',
                    present: true,
                    capabilities: { pcb: 'rendered' }
                },
                {
                    type: 'pcb_component',
                    present: true,
                    capabilities: {
                        pcb: 'rendered',
                        manufacturing: 'pick-and-place'
                    }
                },
                {
                    type: 'custom_widget',
                    present: true,
                    capabilities: { pcb: 'metadata-only' },
                    notes: ['Preserved for downstream tools.']
                }
            ]
        },
        manufacturing: {
            pickAndPlaceRows: [{ designator: 'U1', x: 1, y: 2 }],
            routingDsn: '(pcb metadata-board)',
            fabricationNotes: [{ type: 'text', id: 'fab_text_1' }]
        },
        simulationResultCircuitJson: [
            {
                type: 'simulation_transient_voltage_graph',
                simulation_transient_voltage_graph_id: 'simulation_graph_vout',
                name: 'VOUT',
                voltage_levels: [0, 3.3],
                timestamps_ms: [0, 1]
            }
        ]
    }
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
    assert.match(html, /Format coverage/)
    assert.match(html, /4 present/)
    assert.match(html, /3 rendered/)
    assert.match(html, /custom_widget/)
    assert.match(html, /Preserved for downstream tools\./)
    assert.match(html, /viewer-sidebar__simulation-results/)
    assert.match(html, /data-simulation-graph-id="simulation_graph_vout"/)
    assert.match(html, /data-document-id="doc-1"/)
    assert.match(html, /data-pcb-assembly-export-format="pick-place-csv"/)
    assert.match(html, /data-pcb-assembly-export-format="routing-dsn"/)
    assert.match(
        html,
        /data-pcb-assembly-export-format="fabrication-notes-json"/
    )
})
