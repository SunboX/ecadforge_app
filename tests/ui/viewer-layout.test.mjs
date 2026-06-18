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
 * Reads the sidebar styles in the same order as the app stylesheet imports them.
 * @returns {Promise<string>}
 */
async function readSidebarStylesheet() {
    const files = [
        '24-viewer-sidebar.css',
        '24-viewer-sidebar-lists.css',
        '24-viewer-sidebar-responsive.css'
    ]
    const chunks = await Promise.all(files.map((file) => readStylesheet(file)))
    return chunks.join('\n')
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
 * Extracts the contents of one top-level media query block.
 * @param {string} css Stylesheet text.
 * @param {string} query Media query condition including parentheses.
 * @returns {string}
 */
function readMediaBlock(css, query) {
    const marker = `@media ${query} {`
    const start = String(css).indexOf(marker)
    if (start < 0) {
        return ''
    }

    const blockStart = start + marker.length
    let depth = 1
    for (let index = blockStart; index < css.length; index += 1) {
        if (css[index] === '{') {
            depth += 1
        }
        if (css[index] === '}') {
            depth -= 1
        }
        if (depth === 0) {
            return css.slice(blockStart, index)
        }
    }

    return ''
}

/**
 * Verifies filtered sidebar rows marked hidden cannot be brought back by
 * component-specific display declarations.
 */
test('core stylesheet keeps hidden elements visually suppressed', async () => {
    const coreCss = await readStylesheet('00-core.css')

    assert.match(coreCss, /\[hidden\]\s*\{[\s\S]*display:\s*none\s*!important;/)
})

/**
 * Verifies preset toolbars reserve space for controls lifted by hover and
 * active states.
 */
test('viewer preset toolbars reserve top space for hover lift', async () => {
    const sceneCss = await readStylesheet('30-scene3d.css')

    assert.match(sceneCss, /\.scene-3d__toolbar\s*\{[\s\S]*padding-top:\s*1px;/)
    assert.match(
        sceneCss,
        /\.scene-3d__preset:hover\s*\{[\s\S]*transform:\s*translateY\(-1px\);/
    )
    assert.match(
        sceneCss,
        /\.scene-3d__preset\.is-active,[\s\S]*\.scene-3d__preset\[aria-pressed='true'\]\s*\{[\s\S]*transform:\s*translateY\(-1px\);/
    )
})

/**
 * Verifies the primary viewer stage is a bounded work surface on the landing
 * page instead of a full-screen empty panel.
 */
test('viewer stylesheet sizes the main viewer stage as a bounded work surface', async () => {
    const coreCss = await readStylesheet('00-core.css')
    const css = await readViewerStylesheet()
    const layoutCss = await readStylesheet('10-layout.css')
    const sceneCss = await readStylesheet('30-scene3d.css')
    const sidebarCss = await readSidebarStylesheet()

    assert.match(coreCss, /--viewer-workbench-gap:\s*0\.65rem;/)
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
        /body\.is-viewer-mode\.is-viewer-schematic \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-3d \.app-shell,[\s\S]*body\.is-viewer-mode\.is-viewer-report \.app-shell\s*\{[\s\S]*height:\s*calc\(100vh - 1\.55rem\);[\s\S]*min-height:\s*0;[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\) auto;/
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
        /body\.is-viewer-mode\.is-viewer-schematic \.viewer-stage,[\s\S]*body\.is-viewer-mode\.is-viewer-pcb \.viewer-stage,[\s\S]*body\.is-viewer-mode\.is-viewer-3d \.viewer-stage,[\s\S]*body\.is-viewer-mode\.is-viewer-report \.viewer-stage\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;[\s\S]*margin-bottom:\s*0;[\s\S]*align-self:\s*stretch;/
    )
    assert.match(css, /\.viewer-main\s*\{[\s\S]*overflow:\s*auto;/)
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
        css,
        /\.svg-panel--chrome-hidden \.pcb-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);/
    )
    assert.match(
        sceneCss,
        /\.scene-3d\s*\{[^}]*grid-template-areas:\s*['"]header['"]\s*['"]toolbar['"]\s*['"]stage['"]\s*['"]diagnostics['"]\s*['"]stats['"];/
    )
    assert.match(
        sceneCss,
        /body\.is-viewer-mode\.is-viewer-3d \.scene-3d\s*\{[\s\S]*height:\s*100%;[\s\S]*grid-template-areas:\s*['"]toolbar['"]\s*['"]stage['"]\s*['"]diagnostics['"];[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/
    )
    assert.match(
        sceneCss,
        /\.scene-3d\s*\{[^}]*gap:\s*var\(--viewer-workbench-gap\);/
    )
    assert.match(
        css,
        /\.pcb-view\s*\{[\s\S]*gap:\s*var\(--viewer-workbench-gap\);/
    )
    assert.match(
        sceneCss,
        /\.scene-3d \.svg-panel__header\s*\{[\s\S]*grid-area:\s*header;/
    )
    assert.match(
        sceneCss,
        /\.scene-3d\s*>\s*\.scene-3d__toolbar\s*\{[\s\S]*grid-area:\s*toolbar;/
    )
    assert.doesNotMatch(
        sceneCss,
        /^\s*\.scene-3d__toolbar\s*\{[\s\S]*grid-area:\s*toolbar;/m
    )
    assert.match(sceneCss, /\.scene-3d__stage\s*\{[\s\S]*grid-area:\s*stage;/)
    assert.match(
        sceneCss,
        /\.scene-3d__diagnostics\s*\{[\s\S]*grid-area:\s*diagnostics;/
    )
    assert.match(sceneCss, /\.scene-3d__stats\s*\{[\s\S]*grid-area:\s*stats;/)
    assert.match(
        sceneCss,
        /body\.is-viewer-mode\.is-viewer-3d\s+\.viewer-stage\.is-sidebar-visible\s+\.viewer-main\s*\{[\s\S]*padding-bottom:\s*var\(--viewer-workbench-gap\);/
    )
    assert.doesNotMatch(
        sceneCss,
        /body\.is-viewer-mode\.is-viewer-3d\s+\.viewer-stage\.is-sidebar-visible\s*\{[\s\S]*gap:/
    )
    assert.match(
        sceneCss,
        /\.scene-3d__controls\s*\{[\s\S]*border-radius:\s*0 28px 28px 0;/
    )
    assert.match(sidebarCss, /\.document-rail\s*\{[\s\S]*max-height:\s*100%;/)
    assert.match(
        sidebarCss,
        /\.viewer-stage\.is-sidebar-visible\s*\{[\s\S]*grid-template-columns:\s*minmax\(25rem,\s*32rem\) minmax\(0,\s*1fr\);/
    )
    assert.match(
        sidebarCss,
        /\.viewer-stage\.is-sidebar-visible\s*\{[\s\S]*gap:\s*var\(--viewer-workbench-gap\);/
    )
    assert.match(sidebarCss, /\.viewer-sidebar__overview\s*\{/)
    assert.match(sidebarCss, /\.viewer-sidebar__preview-card\s*\{/)
    assert.match(sidebarCss, /\.viewer-sidebar__overview-grid\s*\{/)
})

/**
 * Verifies report views keep the main panel scrollable when the document
 * sidebar is visible.
 */
test('sidebar report views keep the main viewer panel scrollable', async () => {
    const sidebarCss = await readSidebarStylesheet()

    assert.match(
        sidebarCss,
        /body\.is-viewer-mode\.is-viewer-report\s+\.viewer-stage\.is-sidebar-visible\s+\.viewer-main\s*\{[\s\S]*overflow:\s*auto;/
    )
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
 * Verifies compact landing-page viewports do not show the large preview card.
 */
test('compact landing view hides the supported views preview card', async () => {
    const heroCss = await readStylesheet('15-hero.css')

    assert.match(
        heroCss,
        /@media \(max-width: 1180px\)[\s\S]*\.hero-proof\s*\{[\s\S]*display:\s*none;/
    )
})

/**
 * Verifies the viewer sidebar switches to a compact stacked layout on mobile.
 */
test('mobile viewer sidebar switches to compact stacked navigation', async () => {
    const css = await readSidebarStylesheet()
    const sceneCss = await readStylesheet('30-scene3d.css')

    assert.match(
        css,
        /@media \(max-width: 860px\)[\s\S]*\.viewer-stage\.is-sidebar-visible\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\) auto auto;/
    )
    assert.match(
        css,
        /@media \(max-width: 860px\)[\s\S]*\.viewer-stage\.is-sidebar-visible \.viewer-main\s*\{[\s\S]*grid-row:\s*1;/
    )
    assert.match(
        css,
        /@media \(max-width: 860px\)[\s\S]*\.viewer-stage\.is-sidebar-visible \.document-rail\s*\{[\s\S]*grid-row:\s*2;/
    )
    assert.match(
        css,
        /@media \(max-width: 860px\)[\s\S]*\.viewer-stage\.is-sidebar-visible \.pcb-styler-cta\s*\{[\s\S]*grid-row:\s*3;/
    )
    assert.match(
        css,
        /@media \(max-width: 860px\)[\s\S]*\.viewer-sidebar\s*\{[\s\S]*grid-template-columns:\s*1fr;[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\);/
    )
    assert.match(
        css,
        /@media \(max-width: 860px\)[\s\S]*\.viewer-sidebar__tabs\s*\{[\s\S]*flex-direction:\s*row;[\s\S]*overflow-x:\s*auto;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.viewer-sidebar__tab\s*\{[\s\S]*width:\s*2\.55rem;[\s\S]*height:\s*2\.55rem;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.document-rail\s*\{[\s\S]*max-height:\s*36rem;/
    )
    assert.match(
        sceneCss,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d__controls\s*\{[\s\S]*border-radius:\s*0 0 28px 28px;/
    )
})

/**
 * Verifies short desktop browser windows keep visual workbench views in the
 * flexible viewport-height row instead of capping them above the footer.
 */
test('compact desktop visual views fill the remaining viewport height', async () => {
    const css = await readViewerStylesheet()
    const layoutCss = await readStylesheet('10-layout.css')
    const sceneCss = await readStylesheet('30-scene3d.css')
    const compactQuery = '(min-width: 761px) and (max-height: 1280px)'
    const compactLayoutCss = readMediaBlock(layoutCss, compactQuery)
    const compactViewerCss = readMediaBlock(css, compactQuery)
    const compactSceneCss = readMediaBlock(sceneCss, compactQuery)

    assert.doesNotMatch(
        compactLayoutCss,
        /body\.is-viewer-mode\.is-viewer-report \.app-shell/
    )
    assert.doesNotMatch(
        compactLayoutCss,
        /body\.is-viewer-mode\.is-viewer-schematic \.app-shell/
    )
    assert.doesNotMatch(
        compactLayoutCss,
        /body\.is-viewer-mode\.is-viewer-pcb \.app-shell/
    )
    assert.doesNotMatch(
        compactViewerCss,
        /body\.is-viewer-mode\.is-viewer-report \.viewer-stage/
    )
    assert.doesNotMatch(
        compactViewerCss,
        /body\.is-viewer-mode\.is-viewer-visual \.viewer-stage/
    )
    assert.match(
        compactViewerCss,
        /body\.is-viewer-mode\.is-viewer-3d \.viewer-stage\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;/
    )
    assert.match(
        compactViewerCss,
        /body\.is-viewer-mode\.is-viewer-3d \.viewer-stage\s*\{[\s\S]*margin-bottom:\s*0;[\s\S]*align-self:\s*stretch;/
    )
    assert.match(
        compactSceneCss,
        /body\.is-viewer-mode\.is-viewer-3d \.scene-3d\s*\{[\s\S]*height:\s*100%;[\s\S]*grid-template-areas:\s*['"]toolbar['"]\s*['"]stage['"]\s*['"]diagnostics['"];[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/
    )
    assert.match(
        css,
        /@media \(min-width: 761px\) and \(max-height: 760px\)[\s\S]*body\.is-viewer-mode\.is-viewer-3d \.viewer-stage\s*\{[\s\S]*height:\s*auto;[\s\S]*min-height:\s*0;/
    )
    assert.match(
        css,
        /@media \(min-width: 761px\) and \(max-height: 760px\)[\s\S]*body\.is-viewer-mode\.is-viewer-3d\s+\.viewer-stage\.is-sidebar-visible\s+\.viewer-main\s*\{[\s\S]*overflow:\s*auto;/
    )
    assert.match(
        sceneCss,
        /@media \(min-width: 761px\) and \(max-height: 760px\)[\s\S]*body\.is-viewer-mode\.is-viewer-3d \.scene-3d\s*\{[\s\S]*grid-template-areas:\s*['"]toolbar['"]\s*['"]stage['"]\s*['"]diagnostics['"];[\s\S]*grid-template-rows:\s*auto minmax\(0,\s*1fr\) auto;/
    )
})

/**
 * Verifies wrapped 3D toggle labels cannot shrink their checkbox controls.
 */
test('3D toggle checkboxes keep a fixed flex size', async () => {
    const sceneCss = await readStylesheet('30-scene3d.css')

    assert.match(
        sceneCss,
        /\.scene-3d__toggle input\s*\{[\s\S]*flex:\s*0 0 1rem;[\s\S]*width:\s*1rem;[\s\S]*height:\s*1rem;/
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

    assert.match(css, /\.viewer-loading\s*\{[\s\S]*align-content:\s*center;/)
})

/**
 * Verifies the PCB Styler tip dismiss action stays anchored in the top-right
 * corner instead of occupying the inline text row.
 */
test('PCB Styler tip close button is anchored to the top right', async () => {
    const css = await readStylesheet('21-pcb-styler-tip.css')

    assert.match(css, /\.pcb-styler-cta\s*\{[\s\S]*position:\s*relative;/)
    assert.match(
        css,
        /\.pcb-styler-cta__dismiss\s*\{[\s\S]*position:\s*absolute;[\s\S]*top:\s*0\.55rem;[\s\S]*right:\s*0\.55rem;/
    )
    assert.match(
        css,
        /\.pcb-styler-cta__dismiss:hover\s*\{[\s\S]*color:\s*var\(--brand-strong\);[\s\S]*background:\s*rgba\(184,\s*90,\s*37,\s*0\.12\);/
    )
    assert.match(
        css,
        /\.viewer-stage\.is-pcb-styler-cta-hidden\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\);[\s\S]*gap:\s*0;/
    )
    assert.doesNotMatch(css, /#c3311d|rgba\(195,\s*49,\s*29,/)
})

/**
 * Verifies the viewer sidebar collapse control is rendered as an icon-only
 * affordance using the same hover treatment as the PCB Styler tip dismiss.
 */
test('viewer sidebar collapse control is a right-aligned icon action', async () => {
    const css = await readSidebarStylesheet()
    const actionBlock =
        css.match(
            /\.viewer-sidebar__collapse,\s*\.viewer-sidebar__expand\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''
    const collapsedRailBlock =
        css.match(
            /\.document-rail\.is-sidebar-collapsed\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''
    const hoverBlock =
        css.match(
            /\.viewer-sidebar__collapse:hover,\s*\.viewer-sidebar__expand:hover\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''

    assert.match(
        actionBlock,
        /width:\s*2rem;[\s\S]*height:\s*2rem;[\s\S]*padding:\s*0;[\s\S]*border:\s*1px solid transparent;[\s\S]*border-radius:\s*999px;[\s\S]*background:\s*transparent;/
    )
    assert.match(
        css,
        /\.viewer-sidebar__collapse\s*\{\s*margin-left:\s*auto;\s*\}/
    )
    assert.match(css, /\.viewer-sidebar__expand\s*\{\s*margin-left:\s*0;\s*\}/)
    assert.match(
        collapsedRailBlock,
        /display:\s*flex;[\s\S]*align-items:\s*flex-start;[\s\S]*justify-content:\s*center;[\s\S]*padding:\s*1rem 0\.65rem;/
    )
    assert.doesNotMatch(actionBlock, /box-shadow:/)
    assert.match(
        hoverBlock,
        /color:\s*var\(--brand-strong\);[\s\S]*background:\s*rgba\(184,\s*90,\s*37,\s*0\.12\);/
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
 * Verifies app-level schematic palette overrides preserve the ECAD Forge theme.
 */
test('viewer stylesheet keeps schematic app colors in app preview wrappers', async () => {
    const css = await readViewerStylesheet()
    const selectorBlocks = [
        '.schematic-svg',
        '.document-preview__svg--schematic'
    ]

    for (const selector of selectorBlocks) {
        const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const rules = [
            ...css.matchAll(
                new RegExp(escapedSelector + '\\s*\\{[^}]*\\}', 'g')
            )
        ].find((match) =>
            match[0].includes('--schematic-default-ink-color')
        )?.[0]

        assert.ok(rules, selector)
        assert.match(rules, /--schematic-default-ink-color:\s*#008aa3;/)
        assert.match(rules, /--schematic-accent-ink-color:\s*#009bb2;/)
        assert.match(rules, /--schematic-text-color:\s*#121b22;/)
        assert.match(rules, /--schematic-sheet-label-color:\s*#405662;/)
        assert.match(rules, /--schematic-power-color:\s*#a44a1b;/)
        assert.match(rules, /--schematic-port-color:\s*#a44a1b;/)
        assert.match(rules, /--schematic-alert-color:\s*#c43a68;/)
        assert.match(rules, /--schematic-fill-color:\s*#f1d8bd;/)
        assert.match(rules, /--schematic-note-fill-color:\s*#efe4d1;/)
        assert.match(rules, /--schematic-fill-light-color:\s*#fffaf5;/)
        assert.match(rules, /--schematic-pin-marker-fill:\s*#edf4f3;/)
        assert.match(rules, /--schematic-note-border-color:\s*#8a725c;/)
    }
})

/**
 * Verifies the app-level PCB board outline stroke stays rounded when the
 * renderer supplies a refined multi-point board contour.
 */
test('viewer stylesheet rounds PCB board outline strokes', async () => {
    const css = await readViewerStylesheet()
    const boardOutlineBlock = css.match(/\.board-outline\s*\{[^}]*\}/)?.[0]

    assert.ok(boardOutlineBlock)
    assert.match(boardOutlineBlock, /stroke-linejoin:\s*round;/)
    assert.match(boardOutlineBlock, /stroke-linecap:\s*round;/)
})

/**
 * Verifies Gerber PCB SVGs use the same app palette override path as the
 * normal PCB renderers.
 */
test('viewer stylesheet maps Gerber PCB output onto the app palette', async () => {
    const css = await readStylesheet('25-kicad-pcb.css')

    assert.match(css, /\.pcb-svg--gerber \.pcb-board/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper--surface \.pcb-track/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper--subsurface/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-pad/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-copper \.pcb-via/)
    assert.match(css, /\.pcb-svg--gerber \.pcb-via-drill/)
    assert.match(
        css,
        /\.pcb-svg--gerber \.gerber-layer \.gerber-polarity-clear/
    )
})

/**
 * Verifies bottom-side PCB renders keep physical bottom layers on the same
 * blue-green palette shown by the layer sidebar.
 */
test('viewer stylesheet maps bottom-side PCB surface output to bottom layer colors', async () => {
    const css = await readStylesheet('25-kicad-pcb.css')
    const bottomPaletteBlock =
        css.match(
            /\.pcb-svg--app-palette\.pcb-svg--bottom\s*\{(?<rules>[\s\S]*?)\}/
        )?.groups?.rules || ''

    assert.match(
        bottomPaletteBlock,
        /--pcb-surface-track-color:\s*rgba\(15,\s*116,\s*108,\s*0\.56\);/
    )
    assert.match(
        bottomPaletteBlock,
        /--pcb-copper-solid-fill:\s*rgba\(15,\s*116,\s*108,\s*0\.56\);/
    )
    assert.match(
        bottomPaletteBlock,
        /--pcb-subsurface-track-color:\s*rgba\(199,\s*82,\s*45,\s*0\.92\);/
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
 * Verifies landing support chips stay compact and only style the outer pill.
 */
test('landing support chips use compact vertical padding', async () => {
    const heroCss = await readStylesheet('15-hero.css')
    const chipBlock =
        heroCss.match(/\.dropzone__tag\s*\{(?<rules>[\s\S]*?)\}/)?.groups
            ?.rules || ''

    assert.match(
        chipBlock,
        /gap:\s*0\.22rem;[\s\S]*padding:\s*0\.02rem 0\.4rem;[\s\S]*border-radius:\s*0\.38rem;[\s\S]*font-size:\s*0\.7rem;[\s\S]*line-height:\s*1\.05;/
    )
    assert.doesNotMatch(chipBlock, /min-height:/)
    assert.doesNotMatch(heroCss, /\.dropzone__chips/)
    assert.doesNotMatch(heroCss, /\.chip-icon/)
    assert.match(
        heroCss,
        /\.support-tag__icon\s*\{[\s\S]*width:\s*0\.72rem;[\s\S]*height:\s*0\.72rem;/
    )
})

/**
 * Verifies the landing status message keeps single-line states compact instead
 * of stretching to the surrounding hero grid row height.
 */
test('landing status box sizes to its rendered message height', async () => {
    const heroCss = await readStylesheet('15-hero.css')
    const statusBlock =
        heroCss.match(/\.dropzone__status\s*\{(?<rules>[\s\S]*?)\}/)?.groups
            ?.rules || ''

    assert.match(statusBlock, /align-self:\s*start;/)
    assert.doesNotMatch(statusBlock, /min-height:/)
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
 * Verifies sidebar overview rows use explicit icons and clipped labels.
 */
test('viewer sidebar overview uses explicit icons and clipped text', async () => {
    const sidebarCss = await readSidebarStylesheet()

    assert.doesNotMatch(sidebarCss, /\.summary-card/)
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__overview-icon\s*\{[\s\S]*display:\s*inline-flex;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__overview-label\s*\{[\s\S]*text-overflow:\s*ellipsis;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__overview-row strong\s*\{[\s\S]*overflow-wrap:\s*anywhere;/
    )
})

/**
 * Verifies open document rows are inset from both panel edges.
 */
test('viewer sidebar document list has horizontal inset', async () => {
    const sidebarCss = await readSidebarStylesheet()

    assert.match(
        sidebarCss,
        /\.viewer-sidebar__list--documents\s*\{[\s\S]*padding-inline:\s*1\.1rem;/
    )
})

/**
 * Verifies component rows reserve stable space for values and the copy action.
 */
test('viewer sidebar component rows reserve copy action space', async () => {
    const sidebarCss = await readSidebarStylesheet()

    assert.match(
        sidebarCss,
        /\.viewer-sidebar__component-row-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 2\.2rem;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__component-row\s*\{[\s\S]*grid-template-columns:\s*max-content minmax\(0,\s*1fr\) max-content;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__component-value\s*\{[\s\S]*justify-self:\s*end;[\s\S]*max-width:\s*7rem;[\s\S]*text-align:\s*right;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__component-copy\s*\{[\s\S]*width:\s*2\.2rem;[\s\S]*height:\s*2\.2rem;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__component-copy-icon\s*\{[\s\S]*stroke:\s*currentColor;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__net-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) max-content;[\s\S]*padding-right:\s*0\.45rem;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__net-detail\s*\{[\s\S]*justify-self:\s*end;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__net-row--label-only\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\);[\s\S]*gap:\s*0;/
    )
})

/**
 * Verifies layer rows follow the same row/action geometry as footprint rows.
 */
test('viewer sidebar layer rows reserve visibility action space', async () => {
    const sidebarCss = await readSidebarStylesheet()

    assert.match(
        sidebarCss,
        /\.viewer-sidebar__layer-list\s*\{[\s\S]*gap:\s*0;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__layer-row-shell\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 2\.2rem;/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__row--layer\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\);/
    )
    assert.match(
        sidebarCss,
        /\.viewer-sidebar__layer-visibility\s*\{[\s\S]*width:\s*2\.2rem;[\s\S]*height:\s*2\.2rem;/
    )
})
