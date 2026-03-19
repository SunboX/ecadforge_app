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
            fills: [{ x1: 340, y1: 120, x2: 420, y2: 180, layerCode: 256, layerId: 1 }],
            tracks: [{ x1: 130, y1: 320, x2: 520, y2: 320, width: 12, layerCode: 256, layerId: 1 }],
            vias: [{ x: 520, y: 320, diameter: 24, holeDiameter: 10 }],
            pads: [
                {
                    x: 120,
                    y: 120,
                    sizeTopX: 126,
                    sizeTopY: 67,
                    sizeMidX: 126,
                    sizeMidY: 67,
                    sizeBottomX: 126,
                    sizeBottomY: 67,
                    holeDiameter: 80,
                    shapeTop: 1,
                    shapeMid: 1,
                    shapeBottom: 1,
                    rotation: 270,
                    isPlated: true,
                    holeShape: 2,
                    holeSlotLength: 98,
                    holeRotation: 0,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
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
    assert.match(markup, /pcb-pad/)
    assert.match(markup, /pcb-pad__hole/)
    assert.match(markup, /pcb-pad__hole--slot/)
    assert.match(markup, /pcb-pad pcb-pad--shaped/)
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
                { x1: 340, y1: 120, x2: 420, y2: 180, layerCode: 256, layerId: 1 },
                { x1: 600, y1: 280, x2: 680, y2: 340, layerCode: 259, layerId: 32 }
            ],
            tracks: [
                { x1: 130, y1: 320, x2: 520, y2: 320, width: 12, layerCode: 256, layerId: 1 },
                { x1: 130, y1: 360, x2: 520, y2: 360, width: 12, layerCode: 259, layerId: 32 }
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
 * Verifies PCB renderer excludes mechanical drawing tracks from the copper
 * presentation so fabrication layers do not distort the view.
 */
test('renderPcbSvg ignores non-copper mechanical tracks and fills', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Filtered board' },
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
            layers: [{ name: 'L1_TOP' }, { name: 'L4_BOT' }],
            polygons: [],
            fills: [
                { x1: 340, y1: 120, x2: 420, y2: 180, layerCode: 256, layerId: 1 },
                { x1: -800, y1: -200, x2: 2200, y2: -120, layerCode: 258, layerId: 68 }
            ],
            tracks: [
                { x1: 130, y1: 320, x2: 520, y2: 320, width: 12, layerCode: 256, layerId: 1 },
                { x1: -1200, y1: -400, x2: 2400, y2: -400, width: 12, layerCode: 258, layerId: 68 }
            ],
            vias: [],
            components: []
        }
    })

    assert.match(markup, /x1="130"/)
    assert.doesNotMatch(markup, /x1="-1200"/)
    assert.doesNotMatch(markup, /x="-800"/)
})

/**
 * Verifies PCB renderer prefers authored footprint detail from SMD pads and
 * top-side documentation layers over the synthetic component-body fallback.
 */
test('renderPcbSvg renders authored footprint detail for top-side packages', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Detailed footprint board' },
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
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [
                { layerId: 59, name: 'M3 Placement Outline' },
                { layerId: 71, name: 'M15 Top RefDes' }
            ],
            polygons: [],
            fills: [],
            tracks: [
                { x1: 160, y1: 180, x2: 240, y2: 180, width: 6, layerCode: 258, layerId: 59 },
                { x1: 240, y1: 180, x2: 240, y2: 260, width: 6, layerCode: 258, layerId: 59 },
                { x1: 240, y1: 260, x2: 160, y2: 260, width: 6, layerCode: 258, layerId: 59 },
                { x1: 160, y1: 260, x2: 160, y2: 180, width: 6, layerCode: 258, layerId: 59 }
            ],
            vias: [],
            pads: [
                {
                    x: 180,
                    y: 220,
                    sizeTopX: 28,
                    sizeTopY: 18,
                    sizeMidX: 28,
                    sizeMidY: 18,
                    sizeBottomX: 28,
                    sizeBottomY: 18,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                },
                {
                    x: 220,
                    y: 220,
                    sizeTopX: 28,
                    sizeTopY: 18,
                    sizeMidX: 28,
                    sizeMidY: 18,
                    sizeBottomX: 28,
                    sizeBottomY: 18,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 220,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.match(markup, /pcb-pad [^"]*pcb-pad--smd/)
    assert.match(markup, /pcb-footprint-track/)
    assert.doesNotMatch(markup, /class="pcb-component pcb-component--top"[^>]*><rect/)
    assert.match(markup, /U1/)
})

/**
 * Verifies large pad-defined packages do not render a synthetic center body
 * when real footprint pads are already present near the component origin.
 */
test('renderPcbSvg omits synthetic bodies for pad-defined packages', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Molded inductor board' },
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
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            polygons: [],
            fills: [],
            tracks: [
                { x1: 65, y1: 95, x2: 335, y2: 95, width: 8, layerCode: 33, layerId: 33 },
                { x1: 335, y1: 95, x2: 335, y2: 305, width: 8, layerCode: 33, layerId: 33 },
                { x1: 335, y1: 305, x2: 65, y2: 305, width: 8, layerCode: 33, layerId: 33 },
                { x1: 65, y1: 305, x2: 65, y2: 95, width: 8, layerCode: 33, layerId: 33 }
            ],
            vias: [],
            pads: [
                {
                    x: 82,
                    y: 200,
                    sizeTopX: 70,
                    sizeTopY: 94,
                    sizeMidX: 70,
                    sizeMidY: 94,
                    sizeBottomX: 70,
                    sizeBottomY: 94,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                },
                {
                    x: 318,
                    y: 200,
                    sizeTopX: 70,
                    sizeTopY: 94,
                    sizeMidX: 70,
                    sizeMidY: 94,
                    sizeBottomX: 70,
                    sizeBottomY: 94,
                    holeDiameter: 0,
                    shapeTop: 2,
                    shapeMid: 2,
                    shapeBottom: 2,
                    rotation: 0,
                    isPlated: false,
                    hasRoundedRect: false,
                    roundedRectShapeTop: null,
                    cornerRadiusTop: null,
                    offsetTopX: 0,
                    offsetTopY: 0
                }
            ],
            components: [
                {
                    designator: 'L1',
                    x: 200,
                    y: 200,
                    rotation: 270,
                    layer: 'TOP',
                    pattern: 'SMD7*7'
                }
            ]
        }
    })

    assert.match(markup, /pcb-footprint-track/)
    assert.doesNotMatch(markup, /class="pcb-component pcb-component--top"[^>]*><rect class="pcb-component__body"/)
    assert.doesNotMatch(markup, /dominant-baseline="middle">L1<\/text>/)
    assert.match(markup, />L1<\/text>/)
})

/**
 * Verifies PCB renderer prefers the top overlay layer over broader fallback
 * documentation layers so one footprint does not render as stacked duplicates.
 */
test('renderPcbSvg prefers top overlay over fallback footprint layers', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Overlay-priority board' },
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
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [
                { layerId: 33, name: 'Top Overlay' },
                { layerId: 59, name: 'M3 Placement Outline' },
                { layerId: 67, name: 'M11 Top Mechanic' }
            ],
            polygons: [],
            fills: [],
            tracks: [
                { x1: 120, y1: 180, x2: 220, y2: 180, width: 6, layerCode: 258, layerId: 33 },
                { x1: 320, y1: 180, x2: 420, y2: 180, width: 6, layerCode: 258, layerId: 59 },
                { x1: 520, y1: 180, x2: 620, y2: 180, width: 6, layerCode: 258, layerId: 67 }
            ],
            vias: [],
            pads: [],
            components: [
                {
                    designator: 'R1',
                    x: 170,
                    y: 180,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: '0402'
                }
            ]
        }
    })

    assert.match(markup, /class="pcb-footprint-track" x1="120"/)
    assert.doesNotMatch(markup, /class="pcb-footprint-track" x1="320"/)
    assert.doesNotMatch(markup, /class="pcb-footprint-track" x1="520"/)
})

/**
 * Verifies authored footprint documentation can extend beyond the board edge
 * while copper primitives remain clipped to the outline.
 */
test('renderPcbSvg does not clip authored footprint outlines to the board edge', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Edge connector board' },
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
            layers: [{ name: 'Top Layer' }],
            primitiveLayers: [{ layerId: 59, name: 'M3 Placement Outline' }],
            polygons: [],
            fills: [],
            tracks: [
                {
                    x1: -180,
                    y1: 180,
                    x2: 120,
                    y2: 180,
                    width: 6,
                    layerCode: 258,
                    layerId: 59
                },
                {
                    x1: 100,
                    y1: 250,
                    x2: 300,
                    y2: 250,
                    width: 8,
                    layerCode: 256,
                    layerId: 1
                }
            ],
            vias: [],
            pads: [],
            components: []
        }
    })

    assert.match(
        markup,
        /<g class="pcb-copper-layers" clip-path="url\(#pcb-board-clip\)">/
    )
    assert.match(markup, /<g class="pcb-footprints">/)
    assert.doesNotMatch(markup, /<g class="pcb-footprints" clip-path=/)
    assert.match(markup, /class="pcb-footprint-track" x1="-180"/)
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
 * Verifies schematic viewer colors use the app and PCB palette family.
 */
test('schematic viewer stylesheet aligns schematic theme variables with the app palette', async () => {
    const cssPath = new URL('../../../src/styles/20-viewer.css', import.meta.url)
    const css = await readFile(cssPath, 'utf8')
    const schematicSvgBlock = css.match(/\.schematic-svg\s*\{[^}]*\}/)?.[0]

    assert.ok(schematicSvgBlock)
    assert.match(schematicSvgBlock, /--schematic-default-ink-color:\s*#0091ac;/)
    assert.match(schematicSvgBlock, /--schematic-accent-ink-color:\s*#14c5e6;/)
    assert.match(schematicSvgBlock, /--schematic-text-color:\s*#121b22;/)
    assert.match(schematicSvgBlock, /--schematic-sheet-label-color:\s*#405662;/)
    assert.match(schematicSvgBlock, /--schematic-power-color:\s*#a84a12;/)
    assert.match(schematicSvgBlock, /--schematic-port-color:\s*#f28724;/)
    assert.match(schematicSvgBlock, /--schematic-alert-color:\s*#da2f70;/)
    assert.match(schematicSvgBlock, /--schematic-fill-color:\s*#f4dec7;/)
    assert.match(schematicSvgBlock, /--schematic-note-fill-color:\s*#efe4d1;/)
    assert.match(schematicSvgBlock, /--schematic-fill-light-color:\s*#fffaf5;/)
    assert.match(schematicSvgBlock, /--schematic-pin-marker-fill:\s*#edf4f3;/)
    assert.match(schematicSvgBlock, /--schematic-note-border-color:\s*#8a725c;/)
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
