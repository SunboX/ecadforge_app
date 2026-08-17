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
 * Verifies Altium overlay primitives preserve the shared footprint palette.
 * A layer-specific override changes the established silkscreen color on both
 * sides and makes dense bottom artwork appear bleached.
 */
test('Altium overlay primitives preserve the shared footprint palette', async () => {
    const css = await readPcbPaletteStylesheet()

    assert.doesNotMatch(css, /--pcb-silkscreen-color:/)
    assert.doesNotMatch(
        css,
        /\.pcb-svg--altium[\s\S]*?\[data-layer-id='(?:33|34)'\][\s\S]*?--pcb-silkscreen-color/u
    )
})
