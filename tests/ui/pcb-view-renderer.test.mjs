import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a compact PCB model with two rendered board layers.
 * @returns {object}
 */
function createPcbDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'layer-toggle-fake.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 400, heightMil: 400, segments: [] },
            components: [{ designator: 'J1', pattern: 'PINHD', layer: 'TOP' }],
            pads: [],
            tracks: [],
            vias: [],
            layers: [{ name: 'F.Cu' }, { name: 'B.Cu' }],
            kicadBoard: {
                title: 'Layer Toggle Fake',
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 10,
                    maxY: 10,
                    width: 10,
                    height: 10
                },
                outlines: [],
                pads: [],
                drawings: [
                    {
                        type: 'segment',
                        layer: 'F.Cu',
                        material: 'copper',
                        side: 'front',
                        start: { x: 1, y: 2 },
                        end: { x: 4, y: 2 },
                        strokeWidth: 0.8
                    },
                    {
                        type: 'segment',
                        layer: 'B.Cu',
                        material: 'copper',
                        side: 'back',
                        start: { x: 1, y: 4 },
                        end: { x: 4, y: 4 },
                        strokeWidth: 0.4
                    },
                    {
                        type: 'segment',
                        layer: 'F.SilkS',
                        material: 'silk',
                        ownerId: 'footprint:J1:0',
                        side: 'front',
                        start: { x: 2, y: 6 },
                        end: { x: 6, y: 6 },
                        strokeWidth: 0.2
                    }
                ],
                texts: []
            }
        },
        bom: []
    }
}

/**
 * Builds a compact PCB model that uses the wrapped SVG panel renderer path.
 * @returns {object}
 */
function createWrappedPcbDocument() {
    return {
        kind: 'pcb',
        fileName: 'wrapped-panel-fake.PcbDoc',
        summary: {
            title: 'Wrapped panel fake',
            componentCount: 60,
            lineSegmentCount: 449
        },
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
            tracks: [],
            vias: [],
            components: [{ designator: 'A1', layer: 'TOP', pattern: 'QFN' }]
        },
        bom: []
    }
}

/**
 * Builds a compact Altium-like PCB model with primitive layer metadata.
 * @returns {object}
 */
function createPrimitiveLayerPcbDocument() {
    return {
        kind: 'pcb',
        fileName: 'primitive-layer-fake.PcbDoc',
        summary: { title: 'Primitive layer fake' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 120,
                heightMil: 100,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 120, y2: 0 },
                    { type: 'line', x1: 120, y1: 0, x2: 120, y2: 100 },
                    { type: 'line', x1: 120, y1: 100, x2: 0, y2: 100 },
                    { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                ]
            },
            layers: [],
            primitiveLayers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Mid-Layer 1', layerId: 2 },
                { name: 'Top Overlay', layerId: 33 }
            ],
            components: [],
            pads: [],
            tracks: [
                {
                    x1: 10,
                    y1: 20,
                    x2: 80,
                    y2: 20,
                    width: 4,
                    layerCode: 2,
                    layerId: 2
                }
            ],
            vias: []
        },
        bom: []
    }
}

/**
 * Verifies hidden layer keys are applied to the PCB SVG by layer attribute.
 */
test('PcbViewRenderer hides requested PCB layers by data-layer attribute', () => {
    const html = PcbViewRenderer.render(createPcbDocument(), 'top', null, [
        'B.Cu'
    ])

    assert.doesNotMatch(html, /svg-panel__header/)
    assert.match(html, /data-layer="F\.Cu"/)
    assert.match(html, /data-layer="B\.Cu"/)
    assert.match(html, /class="pcb-layer-visibility-style"/)
    assert.match(html, /\[data-layer='B\.Cu'\]\s*\{\s*display: none/)
    assert.doesNotMatch(html, /\[data-layer='F\.Cu'\]\s*\{\s*display: none/)
})

/**
 * Verifies primitive layer aliases can hide rendered Altium layers.
 */
test('PcbViewRenderer hides primitive PCB layers by sidebar layer key', () => {
    const html = PcbViewRenderer.render(
        createPrimitiveLayerPcbDocument(),
        'top',
        null,
        ['Mid-Layer 1']
    )

    assert.match(html, /class="pcb-layer-visibility-style"/)
    assert.match(html, /\[data-layer='Mid-Layer 1'\]\s*\{\s*display: none/)
    assert.match(html, /\.pcb-copper--subsurface\s*\{\s*display: none/)
})

/**
 * Verifies PCB object opacity values are applied through SVG-local CSS.
 */
test('PcbViewRenderer applies requested PCB object opacity categories', () => {
    const html = PcbViewRenderer.render(
        createPcbDocument(),
        'top',
        null,
        [],
        [],
        '',
        {
            tracks: 40,
            vias: 0,
            pads: 75,
            holes: 25,
            zones: 60,
            grid: 15,
            page: 5
        }
    )

    assert.match(html, /class="pcb-object-opacity-style"/)
    assert.match(html, /\.pcb-svg \.pcb-track/)
    assert.match(html, /\.pcb-svg \.pcb-via/)
    assert.match(html, /\.pcb-svg \.pcb-pad/)
    assert.match(html, /\.pcb-svg \.pcb-via__hole/)
    assert.match(html, /\.pcb-svg \.pcb-zone/)
    assert.match(html, /\.pcb-svg \.pcb-grid/)
    assert.match(html, /\.pcb-svg \.pcb-board/)
    assert.match(html, /\.pcb-svg \.pcb-track\s*\{\s*opacity: 0\.4 !important;/)
    assert.match(html, /\.pcb-svg \.pcb-via\s*\{\s*opacity: 0 !important;/)
    assert.doesNotMatch(html, /display: none/)
})

/**
 * Verifies selected PCB components are emphasized by SVG-local CSS.
 */
test('PcbViewRenderer highlights the selected PCB component', () => {
    const html = PcbViewRenderer.render(
        createPcbDocument(),
        'top',
        null,
        [],
        [],
        'J1'
    )

    assert.match(html, /class="pcb-component-highlight-style"/)
    assert.match(html, /\[data-footprint-id\^='footprint:J1:'\]/)
    assert.match(html, /drop-shadow/)
})

/**
 * Verifies wrapped PCB component groups receive selectable component keys.
 */
test('PcbViewRenderer tags wrapped component groups for highlighting', () => {
    const html = PcbViewRenderer.render(
        createWrappedPcbDocument(),
        'top',
        null,
        [],
        [],
        'A1'
    )

    assert.match(html, /data-component-key="A1"/)
    assert.match(html, /\[data-component-key='A1'\]/)
})

/**
 * Verifies document metadata is not duplicated above wrapped PCB SVG panels.
 */
test('PcbViewRenderer omits wrapped PCB metadata header', () => {
    const html = PcbViewRenderer.render(createWrappedPcbDocument())

    assert.doesNotMatch(html, /svg-panel__header/)
    assert.match(html, /svg-panel--chrome-hidden/)
})

/**
 * Verifies board stack metadata is moved out of the PCB view chrome.
 */
test('PcbViewRenderer omits wrapped PCB board stack legend', () => {
    const html = PcbViewRenderer.render(createPrimitiveLayerPcbDocument())

    assert.doesNotMatch(html, /pcb-legend/)
    assert.doesNotMatch(html, /Board stack/)
    assert.doesNotMatch(html, /Top-facing composite view/)
    assert.match(html, /class="pcb-svg/)
})
