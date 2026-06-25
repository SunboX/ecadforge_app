import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerSidebarSupportCoverageRenderer } from '../../src/ui/ViewerSidebarSupportCoverageRenderer.mjs'

/**
 * Verifies variant-level gaps are visible in the sidebar coverage summary.
 */
test('ViewerSidebarSupportCoverageRenderer renders variant coverage gaps', () => {
    const markup = ViewerSidebarSupportCoverageRenderer.render({
        totals: {
            presentElementTypes: 2,
            renderedElementTypes: 1,
            presentVariantValues: 2
        },
        rows: [
            {
                type: 'pcb_smtpad',
                present: true,
                capabilities: { pcb: 'rendered' },
                notes: []
            },
            {
                type: 'simulation_voltage_source',
                present: true,
                capabilities: { simulation: 'metadata-only' },
                notes: ['Preserved for simulation setup summaries.']
            }
        ],
        variantRows: [
            {
                type: 'pcb_smtpad',
                group: 'shape',
                value: 'rounded_rect',
                present: true,
                status: 'rendered',
                note: 'Shape variant is rendered.'
            },
            {
                type: 'simulation_voltage_source',
                group: 'kind',
                value: 'ac',
                present: true,
                status: 'metadata',
                note: 'Source variant is summarized.'
            }
        ]
    })

    assert.match(markup, /2 variants/)
    assert.match(markup, /simulation_voltage_source\.kind/)
    assert.match(markup, /ac/)
    assert.match(markup, /Source variant is summarized\./)
    assert.doesNotMatch(markup, /pcb_smtpad\.shape/)
})
