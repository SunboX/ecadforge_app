import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { BomTableRenderer } from '../../../src/ui/BomTableRenderer.mjs'
import { PcbSvgRenderer } from '../../../src/ui/PcbSvgRenderer.mjs'
import { Scene3dRenderer } from '../../../src/ui/Scene3dRenderer.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies PCB renderer emits board geometry, copper primitives, and placements.
 */
test('renderPcbSvg renders board outline, copper primitives, and placements', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Demo board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            polygons: [
                {
                    layer: 'TOP',
                    segments: [
                        { type: 'line', x1: 100, y1: 100, x2: 300, y2: 100 },
                        { type: 'line', x1: 300, y1: 100, x2: 300, y2: 250 },
                        { type: 'line', x1: 300, y1: 250, x2: 100, y2: 250 },
                        { type: 'line', x1: 100, y1: 250, x2: 100, y2: 100 }
                    ]
                }
            ],
            fills: [{ x1: 340, y1: 120, x2: 420, y2: 180, layerCode: 256 }],
            tracks: [{ x1: 130, y1: 320, x2: 520, y2: 320, width: 12, layerCode: 256 }],
            vias: [{ x: 520, y: 320, diameter: 24, holeDiameter: 10 }],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 250,
                    rotation: 90,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.match(markup, /<svg/)
    assert.match(markup, /U1/)
    assert.match(markup, /Top Layer/)
    assert.match(markup, /board-outline/)
    assert.match(markup, /pcb-polygon/)
    assert.match(markup, /pcb-fill/)
    assert.match(markup, /pcb-track/)
    assert.match(markup, /pcb-via/)
})

/**
 * Verifies PCB renderer separates top-facing and buried copper primitives.
 */
test('renderPcbSvg groups surface and subsurface copper separately', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Layered board' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'L1_TOP' }, { name: 'L2_P' }, { name: 'L4_BOT' }],
            polygons: [
                {
                    layer: 'TOP',
                    segments: [
                        { type: 'line', x1: 100, y1: 100, x2: 300, y2: 100 },
                        { type: 'line', x1: 300, y1: 100, x2: 300, y2: 250 },
                        { type: 'line', x1: 300, y1: 250, x2: 100, y2: 250 },
                        { type: 'line', x1: 100, y1: 250, x2: 100, y2: 100 }
                    ]
                },
                {
                    layer: 'BOTTOM',
                    segments: [
                        { type: 'line', x1: 500, y1: 120, x2: 750, y2: 120 },
                        { type: 'line', x1: 750, y1: 120, x2: 750, y2: 240 },
                        { type: 'line', x1: 750, y1: 240, x2: 500, y2: 240 },
                        { type: 'line', x1: 500, y1: 240, x2: 500, y2: 120 }
                    ]
                }
            ],
            fills: [
                { x1: 340, y1: 120, x2: 420, y2: 180, layerCode: 256 },
                { x1: 600, y1: 280, x2: 680, y2: 340, layerCode: 259 }
            ],
            tracks: [
                { x1: 130, y1: 320, x2: 520, y2: 320, width: 12, layerCode: 256 },
                { x1: 130, y1: 360, x2: 520, y2: 360, width: 12, layerCode: 259 }
            ],
            vias: [{ x: 520, y: 320, diameter: 24, holeDiameter: 10 }],
            components: []
        }
    })

    assert.match(markup, /pcb-copper pcb-copper--subsurface/)
    assert.match(markup, /pcb-copper pcb-copper--surface/)
    assert.match(markup, /pcb-polygon pcb-polygon--surface/)
    assert.match(markup, /pcb-polygon pcb-polygon--subsurface/)
    assert.match(markup, /pcb-fill pcb-fill--surface/)
    assert.match(markup, /pcb-fill pcb-fill--subsurface/)
    assert.match(markup, /pcb-track pcb-track--surface/)
    assert.match(markup, /pcb-track pcb-track--subsurface/)
})

/**
 * Verifies PCB viewer colors come from PCB theme variables.
 */
test('pcb viewer stylesheet defines PCB theme variables', async () => {
    const cssPath = new URL('../../../src/styles/20-viewer.css', import.meta.url)
    const css = await readFile(cssPath, 'utf8')
    const pcbSvgBlock = css.match(/\.pcb-svg\s*\{[^}]*\}/)?.[0]
    const boardOutlineBlock = css.match(/\.board-outline\s*\{[^}]*\}/)?.[0]

    assert.ok(pcbSvgBlock)
    assert.ok(boardOutlineBlock)
    assert.match(pcbSvgBlock, /--pcb-board-fill:/)
    assert.match(pcbSvgBlock, /--pcb-copper-fill:/)
    assert.match(boardOutlineBlock, /fill:\s*var\(--pcb-board-fill\);/)
    assert.match(boardOutlineBlock, /stroke:\s*var\(--pcb-board-stroke\);/)
})

/**
 * Verifies PCB viewer designators use the reduced in-view font size.
 */
test('pcb viewer stylesheet reduces component text by one point', async () => {
    const cssPath = new URL('../../../src/styles/20-viewer.css', import.meta.url)
    const css = await readFile(cssPath, 'utf8')
    const pcbComponentTextBlock = css.match(
        /\.pcb-component text\s*\{[^}]*\}/
    )?.[0]

    assert.ok(pcbComponentTextBlock)
    assert.match(pcbComponentTextBlock, /font-size:\s*29px;/)
})

/**
 * Verifies PCB viewer stylesheet differentiates surface and subsurface copper.
 */
test('pcb viewer stylesheet defines surface and subsurface copper styling', async () => {
    const cssPath = new URL('../../../src/styles/20-viewer.css', import.meta.url)
    const css = await readFile(cssPath, 'utf8')

    assert.match(css, /--pcb-surface-copper-fill:/)
    assert.match(css, /--pcb-subsurface-copper-fill:/)
    assert.match(css, /--pcb-surface-track-color:/)
    assert.match(css, /--pcb-subsurface-track-color:/)
    assert.match(css, /\.pcb-copper--surface \.pcb-polygon\s*\{/)
    assert.match(css, /\.pcb-copper--subsurface \.pcb-polygon\s*\{/)
    assert.match(css, /\.pcb-svg\.is-panning\s*\{/)
})

/**
 * Verifies BOM renderer groups rows into a table.
 */
test('renderBomTable renders grouped BOM rows', () => {
    const markup = BomTableRenderer.render([
        {
            designators: ['R1', 'R2'],
            quantity: 2,
            pattern: '0603',
            source: 'RES/10K',
            value: '10K'
        }
    ])

    assert.match(markup, /<table/)
    assert.match(markup, /R1, R2/)
    assert.match(markup, />2</)
    assert.match(markup, /0603/)
})

/**
 * Verifies the 3D renderer emits a presentational scene.
 */
test('renderScene3d renders a board summary scene', () => {
    const markup = Scene3dRenderer.render({
        pcb: {
            boardOutline: { widthMil: 1200, heightMil: 800, segments: [] },
            components: [{ designator: 'U1' }, { designator: 'R1' }]
        },
        bom: [{ quantity: 2 }]
    })

    assert.match(markup, /3D/)
    assert.match(markup, /1200/)
    assert.match(markup, /2 components/)
})
