import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbLayerVisibilityModel } from '../../src/core/PcbLayerVisibilityModel.mjs'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a compact four-layer Altium PCB model with stack rows and legacy
 * primitive-layer aliases.
 * @returns {object}
 */
function createStackLayerPcbDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'stack-layer-only-fake.PcbDoc',
        summary: { title: 'Stack layer visibility fake' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 300,
                heightMil: 120,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 300, y2: 0 },
                    { type: 'line', x1: 300, y1: 0, x2: 300, y2: 120 },
                    { type: 'line', x1: 300, y1: 120, x2: 0, y2: 120 },
                    { type: 'line', x1: 0, y1: 120, x2: 0, y2: 0 }
                ]
            },
            layers: [
                { name: 'Top Layer', layerId: 0x01000001 },
                { name: 'inner 1', layerId: 0x01000002 },
                { name: 'inner 2', layerId: 0x01000003 },
                { name: 'Bottom Layer', layerId: 0x0100ffff },
                { name: 'Top Paste', layerId: 0x01030008 },
                { name: 'Multi-Layer', layerId: 74 }
            ],
            primitiveLayers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'inner 1', layerId: 2 },
                { name: 'inner 2', layerId: 3 },
                { name: 'Bottom Layer', layerId: 32 },
                { name: 'Top Paste', layerId: 35 }
            ],
            polygons: [],
            fills: [
                {
                    x1: 180,
                    y1: 40,
                    x2: 220,
                    y2: 80,
                    layerId: 35
                }
            ],
            tracks: [
                {
                    x1: 10,
                    y1: 30,
                    x2: 120,
                    y2: 30,
                    width: 4,
                    layerId: 2
                },
                {
                    x1: 10,
                    y1: 50,
                    x2: 120,
                    y2: 50,
                    width: 4,
                    layerId: 3
                }
            ],
            arcs: [],
            vias: [
                {
                    x: 60,
                    y: 30,
                    diameter: 12,
                    holeDiameter: 6,
                    layerId: 74
                }
            ],
            pads: [],
            regions: [],
            texts: [],
            components: []
        },
        bom: []
    }
}

/**
 * Extracts the injected layer visibility CSS.
 * @param {string} html Rendered PCB markup.
 * @returns {string}
 */
function layerVisibilityCss(html) {
    return (
        html.match(
            /<style class="pcb-layer-visibility-style">([\s\S]*?)<\/style>/
        )?.[1] || ''
    )
}

/**
 * Extracts the injected internal-layer emphasis CSS.
 * @param {string} html Rendered PCB markup.
 * @returns {string}
 */
function internalLayerEmphasisCss(html) {
    return (
        html.match(
            /<style class="pcb-internal-layer-emphasis-style"[^>]*>([\s\S]*?)<\/style>/
        )?.[1] || ''
    )
}

/**
 * Verifies stack-layer "only" visibility keeps the requested internal layer
 * addressable instead of hiding every subsurface copper primitive.
 */
test('PcbViewRenderer hides Altium stack layers with exact semantic selectors', () => {
    const html = PcbViewRenderer.render(
        createStackLayerPcbDocument(),
        'top',
        null,
        ['Top Layer', 'inner 2', 'Bottom Layer']
    )
    const css = layerVisibilityCss(html)

    assert.match(html, /data-layer-display-name="inner 1"/)
    assert.match(html, /data-layer-display-name="inner 2"/)
    assert.match(
        css,
        /\[data-layer-display-name='inner 2'\]\s*\{\s*display: none/
    )
    assert.doesNotMatch(
        css,
        /\[data-layer-display-name='inner 1'\]\s*\{\s*display: none/
    )
    assert.doesNotMatch(css, /\.pcb-copper--subsurface\s*\{/)
    assert.doesNotMatch(css, /\.pcb-copper--surface\s*\{/)
})

/**
 * Verifies an internal copper-only view hides Multi-Layer copper while keeping
 * shared drill holes visible.
 */
test('PcbViewRenderer keeps drill holes while hiding multi-layer copper', () => {
    const documentModel = createStackLayerPcbDocument()
    const hiddenLayers =
        PcbLayerVisibilityModel.withOnlyLayers({}, 'doc-1', documentModel, [
            'inner 1'
        ])['doc-1'] || []
    const html = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        hiddenLayers
    )
    const css = layerVisibilityCss(html)

    assert.deepEqual(hiddenLayers, [
        'Top Layer',
        'inner 2',
        'Bottom Layer',
        'Top Paste',
        'Multi-Layer'
    ])
    assert.match(html, /class="pcb-via__hole"/)
    assert.match(
        css,
        /\[data-layer-display-name='Multi-Layer'\]\.pcb-via \.pcb-via__pad\s*\{\s*display: none/
    )
    assert.doesNotMatch(
        css,
        /\[data-layer-display-name='Multi-Layer'\]\.pcb-via\s*\{\s*display: none/
    )
})

/**
 * Verifies a fabrication-layer-only view hides shared drill carriers fully
 * while leaving exact layer-tagged paste artwork addressable.
 */
test('PcbViewRenderer hides drill holes for paste-only layer views', () => {
    const documentModel = createStackLayerPcbDocument()
    const hiddenLayers =
        PcbLayerVisibilityModel.withOnlyLayers({}, 'doc-1', documentModel, [
            'Top Paste'
        ])['doc-1'] || []
    const html = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        hiddenLayers
    )
    const css = layerVisibilityCss(html)

    assert.match(html, /data-layer-display-name="Top Paste"/)
    assert.match(
        css,
        /\[data-layer-display-name='Multi-Layer'\]\s*\{\s*display: none/
    )
    assert.doesNotMatch(
        css,
        /\[data-layer-display-name='Multi-Layer'\]\.pcb-via \.pcb-via__pad\s*\{\s*display: none/
    )
    assert.doesNotMatch(css, /\.pcb-footprints\s*\{\s*display: none/)
    assert.doesNotMatch(css, /\.pcb-texts\s*\{\s*display: none/)
    assert.doesNotMatch(
        css,
        /\[data-layer-display-name='Top Paste'\]\s*\{\s*display: none/
    )
})

/**
 * Verifies isolated internal layers render with stronger copper contrast.
 */
test('PcbViewRenderer emphasizes a single visible internal copper layer', () => {
    const documentModel = createStackLayerPcbDocument()
    const hiddenLayers =
        PcbLayerVisibilityModel.withOnlyLayers({}, 'doc-1', documentModel, [
            'inner 1'
        ])['doc-1'] || []
    const html = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        hiddenLayers
    )
    const css = internalLayerEmphasisCss(html)

    assert.match(
        html,
        /class="pcb-internal-layer-emphasis-style" data-visible-internal-layers="1"/
    )
    assert.match(
        css,
        /\.pcb-svg \.pcb-copper--subsurface\s*\{\s*opacity: 0\.95;/
    )
    assert.match(
        css,
        /--pcb-subsurface-track-color: rgba\(112, 84, 62, 0\.78\);/
    )
})

/**
 * Verifies two isolated internal layers use a softer emphasis than one layer.
 */
test('PcbViewRenderer softens emphasis when two internal layers are visible', () => {
    const documentModel = createStackLayerPcbDocument()
    const hiddenLayers =
        PcbLayerVisibilityModel.withOnlyLayers({}, 'doc-1', documentModel, [
            'inner 1',
            'inner 2'
        ])['doc-1'] || []
    const html = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        hiddenLayers
    )
    const css = internalLayerEmphasisCss(html)

    assert.match(
        html,
        /class="pcb-internal-layer-emphasis-style" data-visible-internal-layers="2"/
    )
    assert.match(
        css,
        /\.pcb-svg \.pcb-copper--subsurface\s*\{\s*opacity: 0\.72;/
    )
    assert.match(
        css,
        /--pcb-subsurface-track-color: rgba\(112, 84, 62, 0\.48\);/
    )
})

/**
 * Verifies internal copper keeps normal translucency when shown with surface
 * copper instead of using the isolated-internal contrast boost.
 */
test('PcbViewRenderer keeps default internal styling beside surface copper', () => {
    const documentModel = createStackLayerPcbDocument()
    const hiddenLayers =
        PcbLayerVisibilityModel.withOnlyLayers({}, 'doc-1', documentModel, [
            'Top Layer',
            'inner 1'
        ])['doc-1'] || []
    const html = PcbViewRenderer.render(
        documentModel,
        'top',
        null,
        hiddenLayers
    )

    assert.doesNotMatch(html, /pcb-internal-layer-emphasis-style/)
})

/**
 * Verifies fully visible boards keep the default subsurface styling.
 */
test('PcbViewRenderer keeps default internal copper styling when all layers are visible', () => {
    const html = PcbViewRenderer.render(createStackLayerPcbDocument(), 'top')

    assert.doesNotMatch(html, /pcb-internal-layer-emphasis-style/)
})
