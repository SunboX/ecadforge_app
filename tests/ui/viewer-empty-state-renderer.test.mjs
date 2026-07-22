import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewerEmptyStateRenderer } from '../../src/ui/ViewerEmptyStateRenderer.mjs'

/**
 * Verifies the empty viewer state uses the requested layered schematic-plus
 * illustration instead of a plain plus box.
 */
test('ViewerEmptyStateRenderer renders the schematic plus illustration', () => {
    const html = ViewerEmptyStateRenderer.render()

    assert.match(html, /<figure class="viewer-empty__mark" aria-hidden="true">/)
    assert.match(html, /class="viewer-empty__screen"/)
    assert.match(html, /class="viewer-empty__trace-line"/)
    assert.match(html, /class="viewer-empty__plus"/)
    assert.match(
        html,
        /class="viewer-empty__spark viewer-empty__spark--orange"/
    )
    assert.match(html, /Try KiCad sample/)
    assert.match(html, /Try Altium sample/)
})
