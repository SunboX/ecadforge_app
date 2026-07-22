import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a compact Gerber PCB document for PCB view controls.
 * @returns {object}
 */
function createGerberPcbDocument() {
    return {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'synthetic-fabrication',
        pcb: {
            bounds: { minX: 0, minY: 0, maxX: 4, maxY: 3 },
            fabrication: {
                layers: [
                    {
                        id: 'gerber-top',
                        fileName: 'sample-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top',
                        primitives: [
                            {
                                type: 'flash',
                                shape: 'circle',
                                x: 1,
                                y: 1,
                                diameter: 0.5
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'gerber-bottom',
                        fileName: 'sample-B_Cu.gbl',
                        role: 'bottom-copper',
                        side: 'bottom',
                        primitives: [
                            {
                                type: 'line',
                                x1: 2,
                                y1: 2,
                                x2: 3,
                                y2: 2,
                                width: 0.3
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'gerber-drill',
                        fileName: 'sample-PTH.drl',
                        role: 'plated-drill',
                        side: 'both',
                        primitives: [],
                        drills: [
                            {
                                x: 2,
                                y: 2,
                                diameter: 0.6,
                                plated: true,
                                tool: 'T01'
                            }
                        ]
                    }
                ]
            }
        },
        bom: []
    }
}

/**
 * Verifies Gerber documents keep file selection outside the PCB view toolbar.
 */
test('PcbViewRenderer omits Gerber file controls from the PCB toolbar', () => {
    const html = PcbViewRenderer.render(createGerberPcbDocument(), 'top')

    assert.doesNotMatch(html, /data-pcb-view-gerber-composite/)
    assert.doesNotMatch(html, /data-pcb-view-gerber-layer-select/)
    assert.match(html, /data-render-mode="composite"/)
})

/**
 * Verifies Gerber layer visibility renders the remaining source files directly
 * instead of painting a composite stack and hiding source groups afterward.
 */
test('PcbViewRenderer resolves Gerber visible layers to separated source files', () => {
    const documentModel = createGerberPcbDocument()
    const originalRenderPcb = EcadRendererService.renderPcb
    let renderOptions = null

    EcadRendererService.renderPcb = (_documentModel, options) => {
        renderOptions = options
        return '<svg class="pcb-svg" viewBox="0 0 4 3"></svg>'
    }

    try {
        PcbViewRenderer.render(documentModel, 'top', null, [
            'sample-F_Cu.gtl',
            'sample-PTH.drl'
        ])

        assert.equal(renderOptions.renderMode, 'separated')
        assert.equal(renderOptions.layerId, 'gerber-bottom')
        assert.deepEqual(renderOptions.layerIds, ['gerber-bottom'])
        assert.equal(renderOptions.side, 'bottom')
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})

/**
 * Verifies bottom Gerber source layers receive the bottom-side palette even
 * when the toolbar side was still top before the layer-only action.
 */
test('PcbViewRenderer styles separated bottom Gerber layers with the bottom palette', () => {
    const html = PcbViewRenderer.render(
        createGerberPcbDocument(),
        'top',
        null,
        ['sample-F_Cu.gtl', 'sample-PTH.drl']
    )

    assert.match(html, /data-render-side="bottom"/)
    assert.match(html, /class="[^"]*\bpcb-svg--bottom\b/)
})

/**
 * Verifies Gerber render-mode controls pass through to the renderer facade.
 */
test('PcbViewRenderer passes Gerber separated layer options', () => {
    const documentModel = createGerberPcbDocument()
    const originalRenderPcb = EcadRendererService.renderPcb
    let renderOptions = null

    EcadRendererService.renderPcb = (_documentModel, options) => {
        renderOptions = options
        return '<svg class="pcb-svg" viewBox="0 0 4 3"></svg>'
    }

    try {
        PcbViewRenderer.render(documentModel, 'top', null, [], [], '', {}, '', {
            gerberRenderMode: 'separated',
            gerberLayerId: 'gerber-drill',
            gerberLayerIds: ['gerber-top', 'gerber-drill']
        })

        assert.equal(renderOptions.renderMode, 'separated')
        assert.equal(renderOptions.layerId, 'gerber-top')
        assert.deepEqual(renderOptions.layerIds, ['gerber-top', 'gerber-drill'])
    } finally {
        EcadRendererService.renderPcb = originalRenderPcb
    }
})
