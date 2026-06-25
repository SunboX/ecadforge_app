import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewportInteractionGateRenderer } from '../../src/ui/ViewportInteractionGateRenderer.mjs'

/**
 * Verifies temporarily disabled interaction gates stay present but hidden even
 * before a controller attaches to the rendered viewport.
 */
test('ViewportInteractionGateRenderer emits hidden gate markup by default', () => {
    const html = ViewportInteractionGateRenderer.render('Interact with view')

    assert.match(
        html,
        /<div class="viewport-interaction-gate" hidden data-viewport-interaction-gate="locked">/
    )
    assert.match(html, /data-viewport-interaction-unlock="true"/)
})
