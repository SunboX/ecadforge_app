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
 * Builds a compact Altium-like PCB model with one bottom-side component.
 * @returns {object}
 */
function createBottomMirroredPcbDocument() {
    return {
        kind: 'pcb',
        fileName: 'bottom-mirror-fake.PcbDoc',
        summary: {
            title: 'Bottom mirror fake'
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
            layers: [
                { name: 'Bottom Layer', layerId: 32 },
                { name: 'Bottom Overlay', layerId: 34 }
            ],
            primitiveLayers: [
                { name: 'Bottom Layer', layerId: 32 },
                { name: 'Bottom Overlay', layerId: 34 }
            ],
            components: [
                {
                    componentIndex: 4,
                    designator: 'A1',
                    layer: 'BOTTOM',
                    pattern: '0603',
                    x: 200,
                    y: 100,
                    rotation: 0
                }
            ],
            pads: [
                {
                    componentIndex: 4,
                    x: 190,
                    y: 100,
                    sizeBottomX: 20,
                    sizeBottomY: 20,
                    layerId: 32,
                    rotation: 0
                },
                {
                    componentIndex: 4,
                    x: 210,
                    y: 100,
                    sizeBottomX: 20,
                    sizeBottomY: 20,
                    layerId: 32,
                    rotation: 0
                }
            ],
            tracks: [],
            vias: []
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
 * Verifies Altium internal signal layer names use the copper visibility path
 * even when they are named without the legacy "Mid-Layer" wording.
 */
test('PcbViewRenderer hides internal Altium signal layers as subsurface copper', () => {
    const documentModel = createPrimitiveLayerPcbDocument()
    documentModel.fileName = 'internal-routing-fake.PcbDoc'
    documentModel.pcb.primitiveLayers = [
        { name: 'Top Layer', layerId: 1 },
        { name: 'Internal1', layerId: 2 },
        { name: 'Internal2', layerId: 3 }
    ]
    documentModel.pcb.tracks = [
        {
            x1: 10,
            y1: 20,
            x2: 80,
            y2: 20,
            width: 4,
            layerCode: 2,
            layerId: 2
        }
    ]

    const html = PcbViewRenderer.render(documentModel, 'top', null, [
        'Internal1'
    ])

    assert.match(html, /\[data-layer='Internal1'\]\s*\{\s*display: none/)
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
    assert.match(html, /drop-shadow\(0 0 1\.4px rgba\(27, 191, 227, 0\.68\)\)/)
    assert.match(html, /drop-shadow\(0 0 3px rgba\(27, 191, 227, 0\.32\)\)/)
    assert.doesNotMatch(html, /#e35417/)
})

/**
 * Verifies selected PCB net names are tagged and highlighted in the rendered
 * SVG.
 */
test('PcbViewRenderer highlights the selected PCB net', () => {
    const documentModel = createWrappedPcbDocument()
    documentModel.pcb.tracks = [
        {
            x1: 100,
            y1: 100,
            x2: 240,
            y2: 100,
            width: 12,
            layerId: 1,
            netName: 'SENSE_A'
        },
        {
            x1: 100,
            y1: 140,
            x2: 240,
            y2: 140,
            width: 12,
            layerId: 1,
            netName: 'RETURN'
        }
    ]

    const html = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        [],
        [],
        '',
        {},
        'SENSE_A'
    )

    assert.match(html, /class="pcb-net-highlight-style"/)
    assert.match(html, /data-pcb-net-name="SENSE_A"/)
    assert.match(html, /data-pcb-net-name="RETURN"/)
    assert.match(html, /\.pcb-net-highlight\s*\{/)
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
    assert.match(html, /fill: rgba\(27, 191, 227, 0\.52\)/)
})

/**
 * Verifies PCB component markers use a high-contrast palette that remains
 * visible over normal board and footprint artwork.
 */
test('PcbViewRenderer renders selected PCB component markers with visible contrast', () => {
    const html = PcbViewRenderer.render(
        createWrappedPcbDocument(),
        'top',
        null,
        [],
        [],
        'A1'
    )

    assert.match(
        html,
        /pcb-component-selection-marker__outline[^}]+stroke: transparent/
    )
    assert.match(
        html,
        /pcb-component-selection-marker__fill[^}]+stroke: transparent/
    )
    assert.match(
        html,
        /pcb-component-selection-marker__fill[^}]+stroke-width: 0/
    )
    assert.match(
        html,
        /pcb-component-selection-marker__fill[^}]+filter: drop-shadow\(0 0 1\.4px rgba\(27, 191, 227, 0\.62\)\)/
    )
    assert.doesNotMatch(html, /rgba\(17, 24, 39/)
})

/**
 * Verifies Altium rendered component ownership provides selection geometry
 * when parsed primitives cannot provide usable bounds.
 */
test('PcbViewRenderer bounds Altium selection markers from rendered component geometry', () => {
    const documentModel = createWrappedPcbDocument()
    const originalRenderPcb = EcadRendererService.renderPcb
    EcadRendererService.renderPcb = () =>
        '<svg class="pcb-svg pcb-svg--altium pcb-svg--top" viewBox="0 0 1000 800">' +
        '<g class="pcb-component" data-component-key="A1" transform="translate(500 250) rotate(0)"></g>' +
        '<line data-component="A1" x1="320" y1="100" x2="680" y2="100"></line>' +
        '<rect data-component="A1" x="300" y="120" width="400" height="360"></rect>' +
        '<rect data-component="A10" x="0" y="0" width="1000" height="800"></rect>' +
        '</svg>'

    try {
        const html = PcbViewRenderer.render(
            documentModel,
            'top',
            null,
            [],
            [],
            'A1'
        )

        assert.match(
            html,
            /pcb-component-selection-marker__fill" x="260" y="60" width="480" height="460"/
        )
        assert.doesNotMatch(
            html,
            /class="pcb-component-selection-marker"[^>]*transform=/
        )
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})

/**
 * Verifies rendered footprint geometry is used when parsed primitive
 * coordinates do not overlap the SVG viewBox.
 */
test('PcbViewRenderer keeps KiCad selection markers on the rendered footprint', () => {
    const documentModel = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'rendered-footprint-fake.kicad_pcb',
        pcb: {
            components: [
                {
                    componentIndex: 11,
                    designator: 'U2',
                    layer: 'TOP',
                    pattern: 'SOIC-8'
                }
            ],
            pads: [
                {
                    componentIndex: 11,
                    x: 3500,
                    y: 3400,
                    sizeTopX: 100,
                    sizeTopY: 60,
                    layerId: 1
                }
            ]
        }
    }
    const originalRenderPcb = EcadRendererService.renderPcb
    EcadRendererService.renderPcb = () =>
        '<svg class="pcb-svg pcb-svg--kicad pcb-svg--top" viewBox="70 66 60 59">' +
        '<line data-footprint-id="footprint:U2:11" x1="90.325" y1="84.55" x2="95.775" y2="90" stroke-width="0.12"></line>' +
        '<rect data-footprint-id="footprint:U2:11" x="88.65" y="85.07" width="1.6" height="0.6" stroke-width="0.12"></rect>' +
        '</svg>'

    try {
        const html = PcbViewRenderer.render(
            documentModel,
            'top',
            null,
            [],
            [],
            'U2'
        )

        assert.match(
            html,
            /pcb-component-selection-marker__fill" x="87\.938" y="83\.837" width="8\.55" height="6\.875"/
        )
        assert.doesNotMatch(
            html,
            /pcb-component-selection-marker__fill" x="3432/
        )
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})

/**
 * Verifies selected rendered footprint markers share the transformed KiCad
 * scene frame used for bottom-side PCB views.
 */
test('PcbViewRenderer mirrors rendered KiCad footprint selection markers with the scene', () => {
    const documentModel = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'mirrored-rendered-footprint-fake.kicad_pcb',
        pcb: {
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    layer: 'BOTTOM',
                    pattern: 'QFN'
                }
            ],
            pads: []
        }
    }
    const originalRenderPcb = EcadRendererService.renderPcb
    EcadRendererService.renderPcb = () =>
        '<svg class="pcb-svg pcb-svg--kicad" viewBox="0 0 100 100">' +
        '<g class="pcb-scene" transform="translate(100 0) scale(-1 1)">' +
        '<rect data-footprint-id="footprint:U1:0" x="70" y="20" width="10" height="5"></rect>' +
        '</g>' +
        '</svg>'

    try {
        const html = PcbViewRenderer.render(
            documentModel,
            'bottom',
            null,
            [],
            [],
            'U1'
        )

        assert.match(
            html,
            /pcb-component-selection-marker__fill" x="18\.8" y="18\.8" width="12\.4" height="7\.4"/
        )
        assert.doesNotMatch(
            html,
            /pcb-component-selection-marker__fill" x="68\.8"/
        )
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})

/**
 * Verifies SVG path arc parameters do not inflate selected footprint markers as
 * if every path number were an x/y coordinate.
 */
test('PcbViewRenderer bounds selected rendered footprint arcs from path coordinates', () => {
    const documentModel = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'rendered-arc-footprint-fake.kicad_pcb',
        pcb: {
            components: [
                {
                    componentIndex: 0,
                    designator: 'X1',
                    layer: 'TOP',
                    pattern: 'ARC-SHAPE'
                }
            ],
            pads: [
                {
                    componentIndex: 0,
                    x: 500,
                    y: 500,
                    sizeTopX: 20,
                    sizeTopY: 20,
                    layerId: 1
                }
            ]
        }
    }
    const originalRenderPcb = EcadRendererService.renderPcb
    EcadRendererService.renderPcb = () =>
        '<svg class="pcb-svg pcb-svg--kicad pcb-svg--top" viewBox="20 20 40 40">' +
        '<path data-footprint-id="footprint:X1:0" d="M 40 30 A 10 10 0 1 1 30 30" stroke-width="0.12" fill="none"></path>' +
        '<circle data-footprint-id="footprint:X1:0" cx="35" cy="45" r="2"></circle>' +
        '</svg>'

    try {
        const html = PcbViewRenderer.render(
            documentModel,
            'top',
            null,
            [],
            [],
            'X1'
        )
        const marker = html.match(
            /pcb-component-selection-marker__fill" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/
        )
        assert.ok(marker)
        const bounds = marker.slice(1).map(Number)

        assert.ok(bounds[0] > 15)
        assert.ok(bounds[1] > 10)
        assert.ok(bounds[2] < 35)
        assert.ok(bounds[3] < 45)
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
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
 * Verifies bottom-side Altium component markers share the mirrored SVG frame.
 */
test('PcbViewRenderer mirrors bottom-side PCB selection marker bounds', () => {
    const html = PcbViewRenderer.render(
        createBottomMirroredPcbDocument(),
        'bottom',
        null,
        [],
        [],
        'A1'
    )

    assert.match(html, /data-component-key="A1"[^>]*translate\(800 100\)/)
    assert.match(
        html,
        /pcb-component-selection-marker__fill" x="762" y="72" width="76" height="56"/
    )
    assert.doesNotMatch(
        html,
        /pcb-component-selection-marker__fill" x="162" y="72" width="76" height="56"/
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
