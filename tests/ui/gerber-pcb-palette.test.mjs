import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * Reads one app stylesheet.
 * @param {string} fileName
 * @returns {Promise<string>}
 */
async function readStylesheet(fileName) {
    const cssPath = new URL(`../../src/styles/${fileName}`, import.meta.url)
    return readFile(cssPath, 'utf8')
}

/**
 * Verifies Gerber PCB SVGs use the same app palette override path as the
 * normal PCB renderers.
 */
test('Gerber PCB stylesheet maps renderer output onto the app palette', async () => {
    const css = await readStylesheet('25-kicad-pcb.css')

    assert.match(css, /\.pcb-svg--gerber \.pcb-board/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-track/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper--subsurface/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-pad/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper \.pcb-via/)
    assert.match(css, /\.pcb-svg--app-palette\.pcb-svg--gerber/)
    assert.match(
        css,
        /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-copper--mask-covered\.pcb-region/
    )
    assert.match(
        css,
        /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-copper--mask-open\.pcb-pad/
    )
    assert.match(css, /--pcb-exposed-copper-fill:\s*#d9a61d;/)
    assert.match(css, /--pcb-mask-covered-track-color:/)
    assert.match(
        css,
        /--pcb-subsurface-track-color:\s*rgba\(20,\s*74,\s*31,\s*0\.58\);/
    )
    assert.match(
        css,
        /\.pcb-svg--gerber\s+\.gerber-role-top-silkscreen\s+\.pcb-drawing--silk\.gerber-polarity-dark,[\s\S]*\.pcb-svg--gerber\s+\.gerber-role-bottom-silkscreen\s+\.pcb-drawing--silk\.gerber-polarity-dark\s*\{[\s\S]*fill:\s*var\(--pcb-component-text\);[\s\S]*stroke:\s*var\(--pcb-component-text\);/
    )
    assert.match(css, /\.pcb-svg--gerber \.pcb-via-drill/)
    assert.match(
        css,
        /\.pcb-svg--gerber \.gerber-layer \.gerber-polarity-clear/
    )
})
