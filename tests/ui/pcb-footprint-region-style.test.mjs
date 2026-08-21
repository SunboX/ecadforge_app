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
 * Verifies filled footprint regions retain the authored overlay color. Using
 * the generic translucent footprint fill exposes the stroke primitives that
 * make up dense native silkscreen artwork as duplicate dark geometry.
 */
test('viewer stylesheet keeps footprint regions in the overlay color', async () => {
    const css = await readViewerStylesheet()
    const regionBlock =
        css.match(/\.pcb-footprint-region\s*\{(?<rules>[\s\S]*?)\}/)?.groups
            ?.rules || ''

    assert.match(
        regionBlock,
        /fill:\s*var\(--pcb-footprint-region-fill,\s*var\(--pcb-footprint-track-color\)\);/
    )
    assert.doesNotMatch(regionBlock, /fill:\s*var\(--pcb-footprint-fill\);/)
})
