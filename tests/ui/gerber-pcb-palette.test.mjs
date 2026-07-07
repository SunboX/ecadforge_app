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
 * Extracts the declarations for a single CSS selector block.
 * @param {string} css Stylesheet source.
 * @param {string} selector CSS selector to find.
 * @returns {string}
 */
function readRuleBlock(css, selector) {
    const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const match = css.match(
        new RegExp(escapedSelector + '\\s*\\{(?<rules>[\\s\\S]*?)\\}')
    )
    assert.ok(match?.groups?.rules, `${selector} rule block exists`)
    return match.groups.rules
}

/**
 * Verifies Gerber PCB SVGs use the same app palette override path as the
 * normal PCB renderers.
 */
test('Gerber PCB stylesheet maps renderer output onto the app palette', async () => {
    const css = await readStylesheet('25-kicad-pcb.css')
    const gerberPalette = readRuleBlock(
        css,
        '.pcb-svg--app-palette.pcb-svg--gerber'
    )
    const surfaceRegionRule = readRuleBlock(
        css,
        '.pcb-svg--gerber .pcb-copper--surface .gerber-region.gerber-polarity-dark'
    )

    assert.match(css, /\.pcb-svg--gerber \.pcb-board/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-track/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper--subsurface/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-pad/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper \.pcb-via/)
    assert.match(css, /\.pcb-svg--app-palette\.pcb-svg--gerber/)
    assert.match(
        css,
        /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-copper--mask-covered\.gerber-region\.gerber-polarity-dark/
    )
    assert.match(
        surfaceRegionRule,
        /fill:\s*var\(--pcb-copper-solid-fill\)\s*!important;/
    )
    assert.match(
        css,
        /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-copper--mask-covered\.gerber-region\.gerber-polarity-dark\s*\{[\s\S]*fill:\s*var\(--pcb-mask-covered-fill\)\s*!important;/
    )
    assert.match(
        css,
        /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-copper--mask-open\.pcb-pad/
    )
    assert.doesNotMatch(gerberPalette, /--pcb-board-fill:/)
    assert.doesNotMatch(gerberPalette, /--pcb-board-stroke:/)
    assert.doesNotMatch(gerberPalette, /#2a5f27|#1c5424|#d9a61d|#9a7a1b/)
    assert.match(
        gerberPalette,
        /--pcb-exposed-copper-fill:\s*var\(--pcb-copper-solid-fill\);/
    )
    assert.match(
        gerberPalette,
        /--pcb-exposed-copper-stroke:\s*var\(--pcb-surface-track-color\);/
    )
    assert.match(
        gerberPalette,
        /--pcb-mask-covered-fill:\s*var\(--pcb-copper-solid-fill\);/
    )
    assert.match(
        gerberPalette,
        /--pcb-mask-covered-track-color:\s*var\(--pcb-surface-track-color\);/
    )
    assert.match(
        gerberPalette,
        /--pcb-mask-covered-pad-fill:\s*var\(--pcb-copper-solid-fill\);/
    )
    assert.match(
        gerberPalette,
        /--pcb-via-ring-fill:\s*var\(--pcb-copper-solid-fill\);/
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
    assert.match(
        css,
        /\.pcb-svg--gerber\s+\.gerber-clear-mask\s+\.gerber-primitive,[\s\S]*fill:\s*#000\s*!important;[\s\S]*stroke:\s*#000\s*!important;/
    )
})
