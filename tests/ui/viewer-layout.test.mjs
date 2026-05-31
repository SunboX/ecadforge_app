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
 * Reads the browser app shell markup.
 * @returns {Promise<string>}
 */
async function readIndexMarkup() {
    const indexPath = new URL('../../src/index.html', import.meta.url)
    return readFile(indexPath, 'utf8')
}

/**
 * Verifies the primary viewer stage is a bounded work surface on the landing
 * page instead of a full-screen empty panel.
 */
test('viewer stylesheet sizes the main viewer stage as a bounded work surface', async () => {
    const css = await readViewerStylesheet()
    const layoutCss = await readStylesheet('10-layout.css')
    const sceneCss = await readStylesheet('30-scene3d.css')

    assert.match(
        layoutCss,
        /\.app-shell\s*\{[\s\S]*width:\s*min\(2200px, 100% - clamp\(1rem, 2vw, 3rem\)\);/
    )
    assert.match(
        layoutCss,
        /body\.is-viewer-mode\.is-viewer-visual \.app-shell\s*\{[\s\S]*min-height:\s*calc\(100vh - 1\.55rem\);/
    )
    assert.match(
        layoutCss,
        /body\.is-viewer-mode\.is-viewer-visual \.app-shell\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto;/
    )
    assert.match(
        layoutCss,
        /body\.is-viewer-mode\.is-viewer-schematic \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-report \.app-shell\s*\{[\s\S]*height:\s*calc\(100vh - 1\.55rem\);/
    )
    assert.doesNotMatch(
        layoutCss,
        /body\.is-viewer-mode \.app-shell\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto;/
    )
    assert.match(
        css,
        /\.viewer-stage\s*\{[\s\S]*height:\s*clamp\(260px, 32vh, 420px\);/
    )
    assert.match(
        css,
        /body\.is-viewer-mode\.is-viewer-visual \.viewer-stage\s*\{[\s\S]*height:\s*auto;/
    )
    assert.match(
        css,
        /body\.is-viewer-mode\.is-viewer-visual \.viewer-stage\s*\{[\s\S]*align-self:\s*stretch;/
    )
    assert.match(
        css,
        /body\.is-viewer-mode\.is-viewer-visual \.viewer-stage\s*\{[\s\S]*min-height:\s*360px;/
    )
    assert.match(
        css,
        /\.viewer-main\s*\{[\s\S]*overflow:\s*auto;/
    )
    assert.doesNotMatch(css, /\.bom-panel\s*\{[^}]*overflow(?:-x)?:/)
    assert.match(css, /\.bom-panel\s*\{[\s\S]*max-width:\s*100%;/)
    assert.match(
        css,
        /body\.is-viewer-mode\.is-viewer-schematic \.viewer-main,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.viewer-main,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.pcb-view,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.pcb-view__content\s*\{[\s\S]*overflow:\s*hidden;/
    )
    assert.match(
        css,
        /body\.is-viewer-mode\.is-viewer-schematic \.schematic-svg,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.pcb-svg\s*\{[\s\S]*display:\s*block;/
    )
    assert.match(
        css,
        /body\.is-viewer-mode\.is-viewer-pcb \.pcb-svg\s*\{[\s\S]*display:\s*block;/
    )
    assert.match(
        sceneCss,
        /body\.is-viewer-mode\.is-viewer-3d \.scene-3d\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto auto;/
    )
    assert.match(css, /\.document-rail\s*\{[\s\S]*max-height:\s*100%;/)
})

/**
 * Verifies narrow detail views can scroll vertically instead of letting the
 * fixed desktop workbench height collapse content behind summaries.
 */
test('mobile detail views keep the app shell scrollable with visible content space', async () => {
    const css = await readViewerStylesheet()
    const layoutCss = await readStylesheet('10-layout.css')

    assert.match(
        layoutCss,
        /@media \(max-width: 720px\)[\s\S]*body\.is-viewer-mode\.is-viewer-schematic \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-report \.app-shell\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*calc\(100vh - 1\.55rem\);/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*body\.is-viewer-mode\.is-viewer-schematic \.viewer-stage,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.viewer-stage,[\s\S]*body\.is-viewer-mode\.is-viewer-report \.viewer-stage\s*\{[\s\S]*min-height:\s*clamp\(420px,\s*60vh,\s*620px\);/
    )
})

/**
 * Verifies the landing page gives the empty drop area the remaining viewport
 * space instead of leaving it as a shallow fixed panel.
 */
test('landing viewer stage scales the empty drop area into the viewport', async () => {
    const css = await readViewerStylesheet()
    const layoutCss = await readStylesheet('10-layout.css')
    const emptyCss = await readStylesheet('22-viewer-empty.css')

    assert.match(
        layoutCss,
        /body:not\(\.is-viewer-mode\) \.app-shell\s*\{[\s\S]*min-height:\s*calc\(100vh - 1\.55rem\);/
    )
    assert.match(
        layoutCss,
        /body:not\(\.is-viewer-mode\) \.app-shell\s*\{[\s\S]*grid-template-rows:\s*auto auto auto minmax\(min\(34vh, 27\.5rem\), 1fr\) auto auto;/
    )
    assert.match(
        css,
        /body:not\(\.is-viewer-mode\) \.viewer-stage\s*\{[\s\S]*height:\s*auto;/
    )
    assert.match(
        css,
        /body:not\(\.is-viewer-mode\) \.viewer-stage\s*\{[\s\S]*min-height:\s*clamp\(340px, 34vh, 440px\);/
    )
    assert.match(
        css,
        /body:not\(\.is-viewer-mode\) \.viewer-stage\s*\{[\s\S]*align-self:\s*stretch;/
    )
    assert.match(
        emptyCss,
        /body:not\(\.is-viewer-mode\) \.viewer-empty\s*\{[\s\S]*align-content:\s*center;/
    )
})

/**
 * Verifies the transient parser loading prompt is centered in the same
 * full-height stage as the empty drop prompt.
 */
test('viewer loading state centers the spinner in the stage', async () => {
    const css = await readViewerStylesheet()

    assert.match(
        css,
        /\.viewer-loading\s*\{[\s\S]*align-content:\s*center;/
    )
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
    assert.match(
        layoutCss,
        /\.file-pill--altium \.icon,\s*\.file-pill--kicad \.icon\s*\{[\s\S]*width:\s*1\.25rem;[\s\S]*height:\s*1\.25rem;[\s\S]*color:\s*#fff;/
    )
    assert.match(
        layoutCss,
        /\.file-pill \.icon path,[\s\S]*\.file-pill \.icon rect,[\s\S]*\.file-pill \.icon circle,/
    )
    assert.doesNotMatch(heroCss, /\.hero-actions \.file-pill:first-child/)
    assert.doesNotMatch(heroCss, /\.hero-actions \.file-pill:nth-child/)
    assert.doesNotMatch(
        viewerCss,
        /\.viewer-empty__actions \.file-pill:first-child/
    )
})

/**
 * Verifies the GitHub URL intake starts below the sample CTAs with enough
 * breathing room for the landing-page action cluster.
 */
test('landing hero separates GitHub URL intake from sample CTAs', async () => {
    const heroCss = await readStylesheet('15-hero.css')

    assert.match(
        heroCss,
        /\.github-open\s*\{[\s\S]*margin-top:\s*clamp\(1\.25rem,\s*1\.7vw,\s*1\.75rem\);/
    )
})

/**
 * Verifies the app header matches the reference lockup with a full-width
 * eyebrow above the large logo and ECAD Forge wordmark.
 */
test('topbar renders the reference ECAD Forge brand lockup', async () => {
    const indexRaw = await readIndexMarkup()
    const layoutCss = await readStylesheet('10-layout.css')
    const faviconRaw = await readFile(
        new URL('../../src/favicon.svg', import.meta.url),
        'utf8'
    )

    assert.match(
        indexRaw,
        /<a[\s\S]*id="brandHomeLink"[\s\S]*class="brand-lockup"[\s\S]*href="\/"[\s\S]*>\s*<p class="eyebrow"[^>]*>[\s\S]*Local Browser Viewer[\s\S]*<\/p>\s*<span class="brand-mark"/
    )
    assert.match(
        indexRaw,
        /<\/span>\s*<h1 data-i18n="app\.title">ECAD Forge<\/h1>\s*<\/a>/
    )
    assert.match(
        layoutCss,
        /\.topbar\s*\{[\s\S]*min-height:\s*clamp\(5\.8rem,\s*6\.5vw,\s*6rem\);/
    )
    assert.match(layoutCss, /\.topbar__description\s*\{[\s\S]*display:\s*none;/)
    assert.match(
        layoutCss,
        /\.brand-lockup\s*\{[\s\S]*grid-template-areas:\s*'eyebrow eyebrow'\s*'mark title';/
    )
    assert.match(
        layoutCss,
        /\.brand-lockup \.eyebrow\s*\{[\s\S]*grid-area:\s*eyebrow;/
    )
    assert.match(
        layoutCss,
        /\.brand-mark\s*\{[\s\S]*grid-area:\s*mark;[\s\S]*width:\s*clamp\(3rem,\s*4vw,\s*3\.2rem\);/
    )
    assert.match(
        layoutCss,
        /\.brand-lockup h1\s*\{[\s\S]*grid-area:\s*title;[\s\S]*font-size:\s*clamp\(2\.3rem,\s*3\.2vw,\s*2\.9rem\);/
    )
    assert.match(
        faviconRaw,
        /<rect x="6" y="6" width="52" height="52" rx="14" fill="#0d1a2a"/
    )
    assert.match(faviconRaw, /M18 22h22M18 32h32M18 42h22M52 22v20M42 32h10/)
    assert.match(faviconRaw, /<circle cx="42" cy="32" r="3" fill="#f8fafc"/)
    assert.doesNotMatch(faviconRaw, /<circle cx="18" cy="32"/)
})

/**
 * Verifies the empty viewer illustration is drawn from layered elements instead
 * of the old pseudo-element plus tile.
 */
test('viewer stylesheet draws the layered empty-state illustration', async () => {
    const viewerCss = await readStylesheet('22-viewer-empty.css')

    assert.doesNotMatch(viewerCss, /\.viewer-empty::before/)
    assert.match(
        viewerCss,
        /\.viewer-empty__mark\s*\{[\s\S]*position: relative;/
    )
    assert.match(
        viewerCss,
        /\.viewer-empty__screen\s*\{[\s\S]*border: 2px solid var\(--accent\);/
    )
    assert.match(
        viewerCss,
        /\.viewer-empty__plus\s*\{[\s\S]*border-radius: 50%;/
    )
    assert.match(
        viewerCss,
        /\.viewer-empty__spark\s*\{[\s\S]*transform: rotate\(45deg\);/
    )
})

/**
 * Verifies summary cards use explicit icons and ellipsize long text.
 */
test('viewer stylesheet uses explicit summary icons and clipped text', async () => {
    const viewerCss = await readViewerStylesheet()

    assert.doesNotMatch(viewerCss, /\.summary-card::before/)
    assert.doesNotMatch(viewerCss, /\.summary-grid \.summary-card:nth-child/)
    assert.match(
        viewerCss,
        /\.meta-card > span:not\(\.meta-card__icon\)\s*\{[\s\S]*min-width: 0;/
    )
    assert.match(
        viewerCss,
        /\.meta-card strong,[\s\S]*\.summary-card strong\s*\{[\s\S]*text-overflow: ellipsis;/
    )
    assert.match(
        viewerCss,
        /\.summary-card__label\s*\{[\s\S]*text-overflow: ellipsis;/
    )
})
