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
 * Reads one app stylesheet.
 * @param {string} fileName
 * @returns {Promise<string>}
 */
async function readStylesheet(fileName) {
    const cssPath = new URL(`../../src/styles/${fileName}`, import.meta.url)
    return readFile(cssPath, 'utf8')
}

/**
 * Verifies the primary viewer stage is a bounded work surface on the landing
 * page instead of a full-screen empty panel.
 */
test('viewer stylesheet sizes the main viewer stage as a bounded work surface', async () => {
    const css = await readViewerStylesheet()

    assert.match(css, /\.viewer-stage\s*\{[\s\S]*height:\s*clamp\(205px, 23vh, 270px\);/)
    assert.match(css, /body\.is-viewer-mode \.viewer-stage\s*\{[\s\S]*min-height:\s*520px;/)
    assert.match(css, /\.document-rail\s*\{[\s\S]*max-height:\s*100%;/)
})

/**
 * Verifies demo CTA colors are tied to the ECAD format, not button order.
 */
test('sample CTA styles use explicit Altium and KiCad color classes', async () => {
    const layoutCss = await readStylesheet('10-layout.css')
    const heroCss = await readStylesheet('15-hero.css')
    const viewerCss = await readStylesheet('20-viewer.css')

    assert.match(
        layoutCss,
        /\.file-pill--altium\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*#d85d19,\s*#b9420c\);/
    )
    assert.match(
        layoutCss,
        /\.file-pill--kicad\s*\{[\s\S]*background:\s*linear-gradient\(180deg,\s*#10998f,\s*#08736c\);/
    )
    assert.doesNotMatch(heroCss, /\.hero-actions \.file-pill:first-child/)
    assert.doesNotMatch(heroCss, /\.hero-actions \.file-pill:nth-child/)
    assert.doesNotMatch(
        viewerCss,
        /\.viewer-empty__actions \.file-pill:first-child/
    )
})

/**
 * Verifies the empty viewer illustration is drawn from layered elements instead
 * of the old pseudo-element plus tile.
 */
test('viewer stylesheet draws the layered empty-state illustration', async () => {
    const viewerCss = await readStylesheet('22-viewer-empty.css')

    assert.doesNotMatch(viewerCss, /\.viewer-empty::before/)
    assert.match(viewerCss, /\.viewer-empty__mark\s*\{[\s\S]*position: relative;/)
    assert.match(viewerCss, /\.viewer-empty__screen\s*\{[\s\S]*border: 2px solid var\(--accent\);/)
    assert.match(viewerCss, /\.viewer-empty__plus\s*\{[\s\S]*border-radius: 50%;/)
    assert.match(viewerCss, /\.viewer-empty__spark\s*\{[\s\S]*transform: rotate\(45deg\);/)
})

/**
 * Verifies summary cards use explicit icons and ellipsize long text.
 */
test('viewer stylesheet uses explicit summary icons and clipped text', async () => {
    const viewerCss = await readViewerStylesheet()

    assert.doesNotMatch(viewerCss, /\.summary-card::before/)
    assert.doesNotMatch(viewerCss, /\.summary-grid \.summary-card:nth-child/)
    assert.match(viewerCss, /\.meta-card > span:not\(\.meta-card__icon\)\s*\{[\s\S]*min-width: 0;/)
    assert.match(viewerCss, /\.meta-card strong,[\s\S]*\.summary-card strong\s*\{[\s\S]*text-overflow: ellipsis;/)
    assert.match(viewerCss, /\.summary-card__label\s*\{[\s\S]*text-overflow: ellipsis;/)
})
