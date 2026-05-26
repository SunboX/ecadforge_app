import assert from 'node:assert/strict'
import test from 'node:test'
import { SummaryCardRenderer } from '../../src/ui/SummaryCardRenderer.mjs'

/**
 * Builds a minimal PCB document model for summary rendering.
 * @returns {any}
 */
function createPcbDocumentModel() {
    return {
        kind: 'pcb',
        summary: {
            componentCount: 34,
            layerCount: 13,
            outlineSegmentCount: 4,
            boardWidthMil: 2047,
            boardHeightMil: 2008
        }
    }
}

/**
 * Verifies loaded PCB summary cards render explicit SVG icons.
 */
test('SummaryCardRenderer renders loaded PCB cards with explicit icons', () => {
    const html = SummaryCardRenderer.render(createPcbDocumentModel())

    assert.match(html, /data-summary-icon="placements"/)
    assert.match(html, /data-summary-icon="layers"/)
    assert.match(html, /data-summary-icon="outline"/)
    assert.match(html, /data-summary-icon="envelope"/)
    assert.match(html, /class="summary-card__icon" aria-hidden="true"/)
    assert.match(html, /<svg class="icon" viewBox="0 0 24 24">/)
    assert.match(html, /Board envelope/)
    assert.match(html, /2047 x 2008 mil/)
})

/**
 * Verifies the unloaded summary cards also use explicit icons.
 */
test('SummaryCardRenderer renders default cards with explicit icons', () => {
    const html = SummaryCardRenderer.render(null)

    assert.match(html, /data-summary-icon="status"/)
    assert.match(html, /data-summary-icon="formats"/)
    assert.match(html, /data-summary-icon="parser"/)
    assert.match(html, /data-summary-icon="views"/)
    assert.match(html, /Waiting for file/)
})
