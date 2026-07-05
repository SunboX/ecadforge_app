import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * Reads one app stylesheet.
 * @param {string} fileName Stylesheet file name.
 * @returns {Promise<string>}
 */
async function readStylesheet(fileName) {
    return readFile(
        new URL('../../src/styles/' + fileName, import.meta.url),
        'utf8'
    )
}

/**
 * Verifies app palette CSS covers Altium detail-layer SVG classes.
 */
test('PCB detail layer stylesheet colors paste and mask apertures', async () => {
    const entryCss = await readFile(
        new URL('../../src/style.css', import.meta.url),
        'utf8'
    )
    const css = await readStylesheet('26-pcb-detail-layers.css')

    assert.match(entryCss, /26-pcb-detail-layers\.css/)
    assert.match(css, /--pcb-detail-paste-fill:\s*rgba\(146, 146, 146, 0\.94\)/)
    assert.match(css, /\.pcb-pad-mask-aperture--paste\s*\{/)
    assert.match(css, /fill:\s*var\(--pcb-detail-paste-fill\)/)
    assert.match(css, /\.pcb-pad-mask-aperture--solder-mask\s*\{/)
    assert.match(css, /fill:\s*var\(--pcb-detail-mask-fill\)/)
})
