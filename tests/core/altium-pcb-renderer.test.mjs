import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../node_modules/altium-toolkit/src/core/altium/PcbModelParser.mjs'
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

/**
 * Verifies Altium PCB renderer summarizes decoded primitive layers when the
 * formal stack layer table is absent.
 */
test('Altium PCB renderer summarizes primitive layers without stack layers', () => {
    const markup = EcadRendererService.renderPcb(
        createPcbDocument({
            layers: [],
            primitiveLayers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Top Overlay', layerId: 33 }
            ]
        })
    )

    assert.match(markup, /0 placements, 2 layers/)
    assert.match(markup, /<li>Top Layer<\/li>/)
    assert.match(markup, /<li>Top Overlay<\/li>/)
})

/**
 * Verifies unowned top-overlay labels from the Altium dependency remain visible
 * instead of inheriting hidden component-comment flags.
 */
test('Altium PCB renderer keeps unowned overlay text visible', () => {
    const documentModel = PcbModelParser.parse(
        'sample.PcbDoc',
        [
            createBoardRecord(),
            {
                sourceStream: 'Components6/Data',
                fields: {
                    LAYER: 'TOP',
                    X: '100mil',
                    Y: '120mil',
                    PATTERN: 'QFN-56',
                    ROTATION: '0',
                    SOURCEDESIGNATOR: 'U1',
                    NAMEON: 'TRUE',
                    COMMENTON: 'FALSE'
                }
            }
        ],
        {
            streamNames: ['Texts6/Data'],
            binaryPrimitives: {
                texts: [
                    {
                        text: 'BOARD-SILK',
                        ownerIndex: null,
                        x: 120,
                        y: 140,
                        height: 10,
                        layerId: 33,
                        kind: 1,
                        visibilityFlags: 0,
                        rotation: 0
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 2,
                printableStreamCount: 2,
                binaryPrimitiveCount: 1
            }
        }
    )
    const markup = EcadRendererService.renderPcb(documentModel)

    assert.equal(documentModel.pcb.texts[0].visible, true)
    assert.match(markup, />BOARD-SILK<\/text>/)
})

/**
 * Creates the standard synthetic rectangular board record for parser-backed
 * renderer tests.
 * @returns {{ sourceStream: string, fields: Record<string, string> }}
 */
function createBoardRecord() {
    return {
        sourceStream: 'Board6/Data',
        fields: {
            KIND0: '0',
            VX0: '0mil',
            VY0: '0mil',
            CX0: '0mil',
            CY0: '0mil',
            SA0: '0',
            EA0: '0',
            R0: '0mil',
            KIND1: '0',
            VX1: '1000mil',
            VY1: '0mil',
            CX1: '0mil',
            CY1: '0mil',
            SA1: '0',
            EA1: '0',
            R1: '0mil',
            KIND2: '0',
            VX2: '1000mil',
            VY2: '500mil',
            CX2: '0mil',
            CY2: '0mil',
            SA2: '0',
            EA2: '0',
            R2: '0mil',
            KIND3: '0',
            VX3: '0mil',
            VY3: '500mil',
            CX3: '0mil',
            CY3: '0mil',
            SA3: '0',
            EA3: '0',
            R3: '0mil',
            V9_LAYER1_NAME: 'Top Layer',
            V9_LAYER1_LAYERID: '1',
            V9_LAYER2_NAME: 'Top Overlay',
            V9_LAYER2_LAYERID: '33'
        }
    }
}
