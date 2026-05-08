import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Creates a minimal Altium PCB document for renderer behavior tests.
 * @param {object} overrides Model overrides.
 * @returns {object}
 */
function createPcbDocument(overrides = {}) {
    return {
        kind: 'pcb',
        fileName: 'sample.PcbDoc',
        summary: { title: 'sample' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
                    { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100 },
                    { type: 'line', x1: 100, y1: 100, x2: 0, y2: 100 },
                    { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer', layerId: 1 }],
            primitiveLayers: [{ name: 'Top Layer', layerId: 1 }],
            components: [],
            pads: [],
            ...overrides
        },
        bom: []
    }
}

/**
 * Verifies component-owned pad geometry suppresses fallback bodies even when
 * the recovered component origin is outside the board outline.
 */
test('Altium PCB renderer omits fallback body when off-board component owns recovered pad', () => {
    const documentModel = createPcbDocument({
        components: [
            {
                componentIndex: 7,
                designator: 'A1',
                x: 500,
                y: 50,
                layer: 'TOP',
                pattern: 'TP2',
                rotation: 0
            }
        ],
        pads: [
            {
                componentIndex: 7,
                x: 50,
                y: 50,
                sizeTopX: 20,
                sizeTopY: 20,
                shapeTop: 1,
                layerId: 1,
                rotation: 0
            }
        ]
    })

    const markup = EcadRendererService.renderPcb(documentModel)

    assert.match(markup, /pcb-pad/)
    assert.doesNotMatch(markup, /pcb-component__body/)
})
