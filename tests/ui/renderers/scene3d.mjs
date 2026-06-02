import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Scene3dRenderer } from '../../../src/ui/Scene3dRenderer.mjs'

/**
 * Reads the full application stylesheet in import order.
 * @returns {Promise<string>}
 */
async function readAppStylesheet() {
    const entryUrl = new URL('../../../src/style.css', import.meta.url)
    const entryCss = await readFile(entryUrl, 'utf8')
    const importPaths = [...entryCss.matchAll(/@import\s+'([^']+)';/g)].map(
        (match) => match[1]
    )
    const importedCss = await Promise.all(
        importPaths.map((importPath) => {
            return readFile(new URL(importPath, entryUrl), 'utf8')
        })
    )

    return [entryCss, ...importedCss].join('\n')
}

/**
 * Verifies the 3D renderer emits an interactive scene shell instead of a
 * presentational summary card.
 */
test('renderScene3d emits viewport and control chrome for the 3D scene', () => {
    const markup = Scene3dRenderer.render({
        pcb: {
            boardOutline: { widthMil: 1200, heightMil: 800, segments: [] },
            components: [{ designator: 'U1' }, { designator: 'R1' }]
        },
        bom: [{ quantity: 2 }]
    })

    assert.match(markup, /scene-3d__viewport/)
    assert.match(markup, /data-scene-3d-viewport/)
    assert.match(markup, /data-scene-3d-loading/)
    assert.match(markup, /scene-3d__loading-content/)
    assert.match(markup, /Preparing 3D scene/)
    assert.match(markup, /Top/)
    assert.match(markup, /Bottom/)
    assert.match(markup, /Isometric/)
    assert.match(markup, /Download Models ZIP/)
    assert.match(markup, /data-scene-3d-export="models-zip"/)
    assert.doesNotMatch(markup, /Reset/)
    assert.match(markup, /External models/)
    assert.match(
        markup,
        /<input type="checkbox" data-scene-3d-toggle="fallback-bodies" \/>Fallback bodies/
    )
    assert.match(markup, /scene-3d__selection/)
    assert.match(markup, /Click a component to inspect it\./)
    assert.match(markup, /scene-3d__diagnostics/)
})

/**
 * Verifies the viewer stylesheet includes the interactive 3D scene shell.
 */
test('scene3d stylesheet defines viewport, controls, and canvas layout', async () => {
    const cssPath = new URL(
        '../../../src/styles/30-scene3d.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(css, /\.scene-3d__toolbar\s*\{/)
    assert.match(
        css,
        /\.scene-3d__preset(?:\.is-active|\[aria-pressed='true'\])[\s\S]*\{/
    )
    assert.match(css, /\.scene-3d\s*\{[\s\S]*height:\s*100%;/)
    assert.match(css, /\.scene-3d\s*\{[\s\S]*min-width:\s*0;/)
    assert.match(css, /\.scene-3d\s*\{[\s\S]*width:\s*100%;/)
    assert.match(css, /\.scene-3d\s*\{[\s\S]*max-width:\s*100%;/)
    assert.match(
        css,
        /\.scene-3d\s*\{[\s\S]*grid-template-rows:\s*auto\s+auto\s+minmax\(\s*clamp\(520px,\s*62vh,\s*760px\),\s*1fr\s*\)\s+auto\s+auto;/
    )
    assert.match(css, /\.scene-3d__stage\s*\{[\s\S]*height:\s*100%;/)
    assert.match(css, /\.scene-3d__stage\s*\{[\s\S]*min-height:\s*0;/)
    assert.match(css, /\.scene-3d__stage\s*\{[\s\S]*min-width:\s*0;/)
    assert.match(css, /\.scene-3d__stage\s*\{[\s\S]*max-width:\s*100%;/)
    assert.match(css, /\.scene-3d__viewport\s*\{/)
    assert.match(css, /\.scene-3d__viewport\s*\{[\s\S]*height:\s*100%;/)
    assert.match(css, /\.scene-3d__viewport\s*\{[\s\S]*min-height:\s*0;/)
    assert.match(css, /\.scene-3d__viewport\s*\{[\s\S]*min-width:\s*0;/)
    assert.match(css, /\.scene-3d__viewport\s*\{[\s\S]*max-width:\s*100%;/)
    assert.doesNotMatch(css, /aspect-ratio:\s*4\s*\/\s*3;/)
    assert.match(css, /\.scene-3d__controls\s*\{/)
    assert.match(css, /\.scene-3d__selection\s*\{/)
    assert.match(css, /\.scene-3d__diagnostics\s*\{/)
    assert.match(css, /\.scene-3d__canvas\s*\{/)
    assert.match(css, /\.scene-3d__loading\s*\{[\s\S]*display:\s*flex;/)
    assert.match(css, /\.scene-3d__loading\s*\{[\s\S]*align-items:\s*center;/)
    assert.match(
        css,
        /\.scene-3d__loading\s*\{[\s\S]*justify-content:\s*center;/
    )
    assert.match(
        css,
        /\.scene-3d__loading-content\s*\{[\s\S]*justify-items:\s*center;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d\s*\{[\s\S]*grid-template-rows:\s*auto auto auto auto auto;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d__stage\s*\{[\s\S]*display:\s*block;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d__viewport\s*\{[\s\S]*height:\s*clamp\(360px,\s*58vh,\s*560px\);/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d__controls\s*\{[\s\S]*max-height:\s*none;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d \.svg-panel__header p\s*\{[\s\S]*flex:\s*1 1 100%;/
    )
    assert.match(
        css,
        /@media \(max-width: 760px\)[\s\S]*\.scene-3d__action\s*\{[\s\S]*flex-basis:\s*100%;/
    )
})

/**
 * Verifies newly recovered PCB copper regions inherit the light app palette
 * instead of falling back to black SVG path fills.
 */
test('viewer stylesheet colors PCB copper regions', async () => {
    const cssPath = new URL(
        '../../../src/styles/20-viewer.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(
        css,
        /\.pcb-copper--surface\s+\.pcb-region\s*\{[\s\S]*fill:\s*var\(--pcb-surface-fill\);/
    )
    assert.match(
        css,
        /\.pcb-copper--subsurface\s+\.pcb-region\s*\{[\s\S]*fill:\s*var\(--pcb-subsurface-fill\);/
    )
    assert.match(
        css,
        /--pcb-surface-copper-fill:\s*rgba\(199,\s*109,\s*61,\s*0\.08\);/
    )
    assert.match(
        css,
        /--pcb-surface-fill:\s*rgba\(199,\s*109,\s*61,\s*0\.09\);/
    )
    assert.match(
        css,
        /--pcb-subsurface-fill:\s*rgba\(114,\s*84,\s*62,\s*0\.045\);/
    )
    assert.match(
        css,
        /--pcb-copper-solid-fill:\s*rgba\(196,\s*118,\s*70,\s*0\.54\);/
    )
    assert.match(
        css,
        /--pcb-component-top-fill:\s*rgba\(203,\s*139,\s*96,\s*0\.68\);/
    )
})

/**
 * Verifies Altium top-overlay silkscreen paths and labels use the viewer's
 * yellow footprint color instead of default SVG black fills.
 */
test('viewer stylesheet colors Altium PCB silkscreen regions and text', async () => {
    const cssPath = new URL(
        '../../../src/styles/20-viewer.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(
        css,
        /\.pcb-footprint-region\s*\{[\s\S]*fill:\s*var\(--pcb-footprint-track-color\);/
    )
    assert.match(
        css,
        /\.pcb-text\s*\{[\s\S]*fill:\s*var\(--pcb-footprint-track-color\);/
    )
})

/**
 * Verifies Altium and KiCad PCB renderers can share the same app palette
 * tokens while keeping KiCad-specific selector overrides for presentation
 * attributes.
 */
test('app stylesheet exposes a shared PCB renderer palette', async () => {
    const css = await readAppStylesheet()

    assert.match(
        css,
        /\.pcb-svg--app-palette\s*\{[\s\S]*--pcb-surface-fill:\s*rgba\(199,\s*109,\s*61,\s*0\.24\);/
    )
    assert.match(
        css,
        /\.pcb-svg--app-palette\s*\{[\s\S]*--pcb-surface-track-color:\s*rgba\(199,\s*82,\s*45,\s*0\.92\);/
    )
    assert.match(
        css,
        /\.pcb-svg--app-palette\s*\{[\s\S]*--pcb-subsurface-fill:\s*rgba\(15,\s*116,\s*108,\s*0\.07\);/
    )
    assert.match(
        css,
        /\.pcb-svg--app-palette\s*\{[\s\S]*--pcb-subsurface-track-color:\s*rgba\(15,\s*116,\s*108,\s*0\.56\);/
    )
    assert.match(
        css,
        /\.pcb-svg--app-palette\s*\{[\s\S]*--pcb-footprint-track-color:\s*rgba\(66,\s*93,\s*112,\s*0\.72\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+\.pcb-drawing--silk\s*\{[\s\S]*stroke:\s*rgba\(66,\s*93,\s*112,\s*0\.72\);/
    )
})

/**
 * Verifies Altium bottom PCB output keeps the 2D PCB palette while inverted
 * labels still paint their knockout background with the PCB silkscreen color.
 */
test('app stylesheet keeps Altium bottom PCB palette with knockout labels', async () => {
    const css = await readAppStylesheet()

    assert.match(
        css,
        /\.pcb-svg--altium\s*\{[\s\S]*--pcb-text-knockout-fill:\s*var\(--pcb-footprint-track-color\);/
    )
    assert.doesNotMatch(
        css,
        /\.pcb-svg--altium\.pcb-svg--bottom\s*\{[\s\S]*--pcb-board-fill:\s*#2f6a2c;/
    )
    assert.doesNotMatch(
        css,
        /\.pcb-svg--altium\.pcb-svg--bottom\s*\{[\s\S]*--pcb-footprint-track-color:\s*#ebebeb;/
    )
    assert.doesNotMatch(
        css,
        /\.pcb-svg--altium\.pcb-svg--bottom\s*\{[\s\S]*--pcb-footprint-region-fill:\s*rgba\(235,\s*235,\s*235,\s*0\.96\);/
    )
})

/**
 * Verifies KiCad PCB renderer output is recolored from the toolkit's
 * black/gray presentation attributes into the ECAD Forge viewer palette.
 */
test('app stylesheet recolors KiCad PCB renderer primitives', async () => {
    const css = await readAppStylesheet()

    assert.match(
        css,
        /\.pcb-svg--kicad\s+\.pcb-board\s*\{[\s\S]*fill:\s*var\(--pcb-board-fill\);[\s\S]*stroke:\s*var\(--pcb-board-stroke\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+\.pcb-zone\s*\{[\s\S]*fill:\s*var\(--pcb-surface-fill\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+line\.pcb-segment\s*\{[\s\S]*stroke:\s*var\(--pcb-surface-track-color\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+path\.pcb-arc\s*\{[\s\S]*stroke:\s*var\(--pcb-surface-track-color\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+:is\(circle,\s*rect\)\.pcb-pad\s*\{[\s\S]*fill:\s*var\(--pcb-copper-solid-fill\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+circle\.pcb-via\s*\{[\s\S]*fill:\s*var\(--pcb-via-ring-fill\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+:is\(\.pcb-via-drill,\s*\.pcb-pad-drill\)\s*\{[\s\S]*fill:\s*var\(--pcb-via-hole-fill\);/
    )
    assert.match(
        css,
        /\.pcb-svg--kicad\s+\.pcb-label\s*\{[\s\S]*stroke:\s*var\(--pcb-component-text\);/
    )
})
