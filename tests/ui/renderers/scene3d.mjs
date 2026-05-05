import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { Scene3dRenderer } from '../../../src/ui/Scene3dRenderer.mjs'

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
        '../../../src/styles/20-viewer.css',
        import.meta.url
    )
    const css = await readFile(cssPath, 'utf8')

    assert.match(css, /\.scene-3d__toolbar\s*\{/)
    assert.match(
        css,
        /\.scene-3d__preset(?:\.is-active|\[aria-pressed='true'\])[\s\S]*\{/
    )
    assert.match(css, /\.scene-3d__stage\s*\{[\s\S]*align-items:\s*start;/)
    assert.match(css, /\.scene-3d__viewport\s*\{/)
    assert.match(
        css,
        /\.scene-3d__viewport\s*\{[\s\S]*aspect-ratio:\s*4\s*\/\s*3;/
    )
    assert.match(css, /\.scene-3d__controls\s*\{/)
    assert.match(css, /\.scene-3d__selection\s*\{/)
    assert.match(css, /\.scene-3d__diagnostics\s*\{/)
    assert.match(css, /\.scene-3d__canvas\s*\{/)
})
