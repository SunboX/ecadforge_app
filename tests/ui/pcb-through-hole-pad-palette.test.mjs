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
 * Verifies plated Altium through-hole pads keep the same copper annulus on
 * both board sides instead of inheriting the selected surface palette.
 */
test('Altium through-hole pad rings use side-neutral copper', async () => {
    const css = await readPcbPaletteStylesheet()
    const paletteRules =
        css.match(
            /\.pcb-svg--app-palette\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''
    const bottomRules =
        css.match(
            /\.pcb-svg--app-palette\.pcb-svg--bottom\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''

    assert.match(
        paletteRules,
        /--pcb-through-hole-pad-fill:\s*rgba\(196,\s*118,\s*70,\s*0\.68\);/
    )
    assert.doesNotMatch(bottomRules, /--pcb-through-hole-pad-fill:/)
    assert.match(
        css,
        /\.pcb-svg--altium \.pcb-pad--through-hole \.pcb-pad__ring\s*\{[\s\S]*?fill:\s*var\(--pcb-through-hole-pad-fill\);[\s\S]*?\}/u
    )
})
