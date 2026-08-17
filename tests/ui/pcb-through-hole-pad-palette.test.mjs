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
 * Verifies plated through-hole pads remain full-strength and inherit the
 * active surface trace color in both supported source formats.
 */
test('through-hole pad rings use active-side trace copper', async () => {
    const css = await readPcbPaletteStylesheet()
    const paletteRules =
        css.match(
            /\.pcb-svg--app-palette\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''

    assert.match(
        paletteRules,
        /--pcb-through-hole-pad-fill:\s*var\(--pcb-surface-track-color\);/
    )
    assert.match(
        css,
        /\.pcb-svg--altium \.pcb-pad--through-hole \.pcb-pad__ring\s*\{[\s\S]*?fill:\s*var\(--pcb-through-hole-pad-fill\);[\s\S]*?\}/u
    )
    assert.match(
        css,
        /\.pcb-svg--kicad \.pcb-pad\[data-pad-type='thru_hole'\]\s*\{[\s\S]*?fill:\s*var\(--pcb-surface-track-color\);[\s\S]*?stroke:\s*var\(--pcb-surface-track-color\);[\s\S]*?opacity:\s*0\.96;[\s\S]*?\}/u
    )

    const altiumThroughHoleRules =
        css.match(
            /\.pcb-svg--altium \.pcb-pad--through-hole \.pcb-pad__ring\s*\{(?<rules>[\s\S]*?)\}/u
        )?.groups?.rules || ''
    const kicadThroughHoleRules =
        css.match(
            /\.pcb-svg--kicad \.pcb-pad\[data-pad-type='thru_hole'\]\s*\{(?<rules>[\s\S]*?)\}/u
        )?.groups?.rules || ''

    assert.doesNotMatch(altiumThroughHoleRules, /--pcb-opposite-pad-opacity/)
    assert.doesNotMatch(kicadThroughHoleRules, /--pcb-opposite-pad-opacity/)
})
