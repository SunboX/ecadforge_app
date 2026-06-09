import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
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
            components: [
                {
                    componentIndex: 7,
                    designator: 'A1',
                    layer: 'TOP',
                    pattern: 'QFN',
                    x: 500,
                    y: 250,
                    rotation: 0
                }
            ]
        },
        bom: []
    }
}

/**
 * Adds oversized owned footprint primitives to the wrapped PCB fixture.
 * @param {object} documentModel Document model.
 * @returns {object}
 */
function withOwnedFootprintPrimitives(documentModel) {
    documentModel.pcb.pads = [
        {
            componentIndex: 7,
            x: 430,
            y: 250,
            sizeTopX: 40,
            sizeTopY: 120,
            rotation: 0,
            layerId: 1
        },
        {
            componentIndex: 7,
            x: 570,
            y: 250,
            sizeTopX: 40,
            sizeTopY: 120,
            rotation: 0,
            layerId: 1
        }
    ]
    documentModel.pcb.tracks = [
        {
            componentIndex: 7,
            x1: 390,
            y1: 170,
            x2: 610,
            y2: 170,
            width: 10,
            layerId: 33
        },
        {
            componentIndex: 7,
            x1: 610,
            y1: 170,
            x2: 610,
            y2: 330,
            width: 10,
            layerId: 33
        },
        {
            componentIndex: 7,
            x1: 390,
            y1: 330,
            x2: 610,
            y2: 330,
            width: 10,
            layerId: 33
        },
        {
            componentIndex: 7,
            x1: 390,
            y1: 170,
            x2: 390,
            y2: 330,
            width: 10,
            layerId: 33
        }
    ]

    return documentModel
}

/**
 * Builds a PCB model where component array order collides with another
 * component's explicit primitive owner id.
 * @returns {object}
 */
function createOwnerCollisionPcbDocument() {
    const documentModel = createWrappedPcbDocument()
    documentModel.pcb.components = [
        {
            componentIndex: 35,
            designator: 'A1',
            layer: 'TOP',
            pattern: 'SMT_C_0402',
            x: 500,
            y: 250,
            rotation: 0
        },
        {
            componentIndex: 0,
            designator: 'B1',
            layer: 'TOP',
            pattern: 'SMT_R_0402',
            x: 900,
            y: 400,
            rotation: 0
        }
    ]
    documentModel.pcb.pads = [
        {
            componentIndex: 35,
            x: 490,
            y: 250,
            sizeTopX: 20,
            sizeTopY: 20,
            rotation: 0,
            layerId: 1
        },
        {
            componentIndex: 35,
            x: 510,
            y: 250,
            sizeTopX: 20,
            sizeTopY: 20,
            rotation: 0,
            layerId: 1
        },
        {
            componentIndex: 0,
            x: 900,
            y: 400,
            sizeTopX: 20,
            sizeTopY: 20,
            rotation: 0,
            layerId: 1
        }
    ]

    return documentModel
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
 * Verifies repeated UI-state renders reuse the expensive PCB SVG for the same
 * document and side while still applying per-render styles.
 */
test('PcbViewRenderer reuses side SVGs across state-only renders', () => {
    const documentModel = createPcbDocument()
    const originalRenderPcb = EcadRendererService.renderPcb
    let renderCount = 0

    EcadRendererService.renderPcb = (...args) => {
        renderCount += 1
        return originalRenderPcb(...args)
    }

    try {
        const plainHtml = PcbViewRenderer.render(documentModel, 'top')
        const selectedHtml = PcbViewRenderer.render(
            documentModel,
            'top',
            null,
            [],
            [],
            'J1'
        )
        const hiddenHtml = PcbViewRenderer.render(documentModel, 'top', null, [
            'B.Cu'
        ])

        assert.equal(renderCount, 1)
        assert.match(plainHtml, /data-layer="F\.Cu"/)
        assert.match(selectedHtml, /class="pcb-component-highlight-style"/)
        assert.match(hiddenHtml, /\[data-layer='B\.Cu'\]\s*\{\s*display: none/)
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})

/**
 * Verifies ordinary PCB renders skip layer target resolution when no layer is
 * hidden.
 */
test('PcbViewRenderer skips layer target resolution when all layers are visible', () => {
    const originalResolvePcbInteractionLayers =
        EcadRendererService.resolvePcbInteractionLayers
    let resolveCount = 0

    EcadRendererService.resolvePcbInteractionLayers = (...args) => {
        resolveCount += 1
        return originalResolvePcbInteractionLayers(...args)
    }

    try {
        const html = PcbViewRenderer.render(createPcbDocument(), 'top')

        assert.equal(resolveCount, 0)
        assert.doesNotMatch(html, /class="pcb-layer-visibility-style"/)
        assert.match(html, /data-layer="F\.Cu"/)
    } finally {
        EcadRendererService.resolvePcbInteractionLayers =
            originalResolvePcbInteractionLayers
    }
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
    assert.match(html, /rgba\(27, 191, 227, 0\.86\)/)
    assert.doesNotMatch(html, /#e35417/)
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
    assert.match(html, /class="pcb-component-selection-marker"/)
    assert.match(html, /data-pcb-selected-component-key="A1"/)
    assert.match(html, /pcb-component-selection-marker__fill/)
    assert.match(html, /fill: rgba\(27, 191, 227, 0\.34\)/)
})

/**
 * Verifies PCB component markers cover owned footprint primitives.
 */
test('PcbViewRenderer sizes PCB selection markers from owned footprint primitives', () => {
    const html = PcbViewRenderer.render(
        withOwnedFootprintPrimitives(createWrappedPcbDocument()),
        'top',
        null,
        [],
        [],
        'A1'
    )

    assert.match(
        html,
        /class="pcb-component-selection-marker"[^>]*data-pcb-selected-component-key="A1"/
    )
    assert.match(
        html,
        /pcb-component-selection-marker__fill" x="367" y="147" width="266" height="206"/
    )
    assert.doesNotMatch(
        html,
        /transform="translate\(500 250\) rotate\(0\)"[^>]*aria-hidden="true"/
    )
})

/**
 * Verifies explicit primitive owner ids do not collide with component row order.
 */
test('PcbViewRenderer ignores row-index owner collisions for PCB selection markers', () => {
    const html = PcbViewRenderer.render(
        createOwnerCollisionPcbDocument(),
        'top',
        null,
        [],
        [],
        'A1'
    )

    assert.match(
        html,
        /pcb-component-selection-marker__fill" x="462" y="222" width="76" height="56"/
    )
    assert.doesNotMatch(
        html,
        /pcb-component-selection-marker__fill" x="462" y="222" width="466"/
    )
})

/**
 * Verifies component key tagging follows the rendered board side.
 */
test('PcbViewRenderer skips opposite-side components when tagging PCB groups', () => {
    const documentModel = createWrappedPcbDocument()
    documentModel.pcb.components.unshift({
        designator: 'B1',
        layer: 'BOTTOM',
        pattern: 'SOT23',
        x: 100,
        y: 100,
        rotation: 0
    })

    const html = PcbViewRenderer.render(documentModel, 'top')

    assert.match(html, /data-component-key="A1"/)
    assert.doesNotMatch(html, /data-component-key="B1"/)
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
