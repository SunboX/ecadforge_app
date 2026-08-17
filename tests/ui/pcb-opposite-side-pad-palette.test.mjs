import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

/**
 * Reads the app PCB palette stylesheet.
 * @returns {Promise<string>}
 */
async function readPcbPaletteStylesheet() {
    const cssPath = new URL(
        '../../src/styles/25-kicad-pcb.css',
        import.meta.url
    )
    return readFile(cssPath, 'utf8')
}

/**
 * Verifies Altium and KiCad SMD pads authored on the opposite surface use
 * the same subsurface color and visual weight as their matching tracks.
 */
test('viewer stylesheet fades opposite-side SMD pads with their traces', async () => {
    const css = await readPcbPaletteStylesheet()
    const altiumRules =
        css.match(
            /\.pcb-svg--altium \.pcb-copper--subsurface \.pcb-pad--smd \.pcb-pad__ring\s*\{(?<rules>[\s\S]*?)\}/u
        )?.groups?.rules || ''

    assert.match(
        css,
        /\.pcb-svg--altium \.pcb-copper--subsurface \.pcb-pad--smd \.pcb-pad__ring/u
    )
    assert.match(altiumRules, /fill:\s*var\(--pcb-subsurface-track-color\);/u)
    assert.doesNotMatch(altiumRules, /opacity:/u)
    assert.match(
        css,
        /\.pcb-svg--kicad\.pcb-svg--top[\s\S]*?\.pcb-pad\[data-pad-type='smd'\]\[data-layer-id='31'\]/u
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\.pcb-svg--bottom[\s\S]*?\.pcb-pad\[data-pad-type='smd'\]\[data-layer-id='0'\]/u
    )
    assert.match(css, /fill:\s*var\(--pcb-subsurface-track-color\);/u)
    assert.match(css, /--pcb-opposite-pad-opacity:\s*0\.78;/u)
    assert.match(css, /opacity:\s*var\(--pcb-opposite-pad-opacity\);/u)
    assert.match(
        css,
        /\.pcb-svg--kicad\.pcb-svg--top[\s\S]*?line\.pcb-segment\[data-layer='B\.Cu'\]/u
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\.pcb-svg--bottom[\s\S]*?line\.pcb-segment\[data-layer='F\.Cu'\]/u
    )
})
