import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * Reads the main viewer stylesheet.
 * @returns {Promise<string>}
 */
async function readViewerStylesheet() {
    const cssPath = new URL('../../src/styles/20-viewer.css', import.meta.url)
    return readFile(cssPath, 'utf8')
}

/**
 * Verifies the primary viewer stage claims the full viewport height.
 */
test('viewer stylesheet sizes the main viewer stage to full viewport height', async () => {
    const css = await readViewerStylesheet()

    assert.match(css, /\.viewer-stage\s*\{[\s\S]*height:\s*100vh;/)
    assert.match(css, /\.document-rail\s*\{[\s\S]*max-height:\s*100%;/)
})
