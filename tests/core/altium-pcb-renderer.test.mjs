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
 * Verifies the installed Altium side resolver excludes fabrication primitives
 * authored for the opposite board side.
 */
test('Altium PCB renderer filters opposite-side fabrication details', () => {
    const documentModel = createPcbDocument({
        primitiveLayers: [
            { name: 'Top Overlay', layerId: 33 },
            { name: 'Bottom Overlay', layerId: 34 }
        ],
        tracks: [
            {
                x1: 10,
                y1: 10,
                x2: 20,
                y2: 10,
                width: 3,
                layerId: 33,
                layerCode: 33
            },
            {
                x1: 70,
                y1: 70,
                x2: 80,
                y2: 70,
                width: 3,
                layerId: 34,
                layerCode: 34
            }
        ]
    })

    const topMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'top'
    })
    const bottomMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'bottom'
    })

    assert.match(topMarkup, /data-layer-id="33"/)
    assert.doesNotMatch(topMarkup, /data-layer-id="34"/)
    assert.match(bottomMarkup, /data-layer-id="34"/)
    assert.doesNotMatch(bottomMarkup, /data-layer-id="33"/)
})

/**
 * Verifies Altium PCB output opts into the same app-level PCB palette used by
 * the KiCad renderer.
 */
test('Altium PCB renderer uses shared app PCB palette classes', () => {
    const markup = EcadRendererService.renderPcb(createPcbDocument())

    assert.match(markup, /class="[^"]*\bpcb-svg--app-palette\b/)
    assert.match(markup, /class="[^"]*\bpcb-svg--altium\b/)
})

/**
 * Verifies native Altium 3D appearance metadata is preserved for the 3D scene
 * instead of falling back to fixed app colors.
 */
test('Altium PCB parser preserves authored 3D appearance colors', () => {
    const boardRecord = createBoardRecord()
    boardRecord.fields['3DCONFIGURATION'] = [
        'CFG3D.USESYSCOLORSFOR3D=FALSE',
        'CFG3D.BOARDCORECOLOR=13761015',
        'CFG3D.TOPSOLDERMASKCOLOR=7026967',
        'CFG3D.BOTSOLDERMASKCOLOR=7026967',
        'CFG3D.COPPERCOLOR=3323360',
        'CFG3D.TOPSILKSCREENCOLOR=15461355',
        'CFG3D.BOTSILKSCREENCOLOR=15461355'
    ].join('`')

    const documentModel = PcbModelParser.parse('sample.PcbDoc', [boardRecord])

    assert.deepEqual(documentModel.pcb.appearance3d, {
        boardCoreColor: 0xf7f9d1,
        solderMaskTopColor: 0x17396b,
        solderMaskBottomColor: 0x17396b,
        copperColor: 0xe0b532,
        silkscreenTopColor: 0xebebeb,
        silkscreenBottomColor: 0xebebeb
    })
})

/**
 * Verifies the app can request a bottom-facing Altium PCB composite instead
 * of always receiving the default top-facing SVG.
 */
test('Altium PCB renderer switches overlay text for bottom-side views', () => {
    const documentModel = createPcbDocument({
        primitiveLayers: [
            { name: 'Top Layer', layerId: 1 },
            { name: 'Bottom Layer', layerId: 32 },
            { name: 'Top Overlay', layerId: 33 },
            { name: 'Bottom Overlay', layerId: 34 }
        ],
        texts: [
            {
                text: 'TOP_SIDE_MARK',
                x: 20,
                y: 20,
                height: 8,
                layerId: 33,
                visible: true
            },
            {
                text: 'BOTTOM_SIDE_MARK',
                x: 40,
                y: 40,
                height: 8,
                layerId: 34,
                visible: true
            }
        ]
    })

    const topMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'top'
    })
    const bottomMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'bottom'
    })

    assert.match(topMarkup, /Top-facing composite view/)
    assert.match(topMarkup, />TOP_SIDE_MARK<\/text>/)
    assert.doesNotMatch(topMarkup, />BOTTOM_SIDE_MARK<\/text>/)
    assert.match(bottomMarkup, /Bottom-facing composite view/)
    assert.match(bottomMarkup, />BOTTOM_SIDE_MARK<\/text>/)
    assert.doesNotMatch(bottomMarkup, />TOP_SIDE_MARK<\/text>/)
})

/**
 * Verifies bottom-facing Altium PCB output mirrors board-space X coordinates
 * like the 3D bottom preset instead of reusing the top-view placement frame.
 */
test('Altium PCB renderer mirrors bottom-side composite horizontally', () => {
    const documentModel = createPcbDocument({
        primitiveLayers: [
            { name: 'Bottom Layer', layerId: 32 },
            { name: 'Bottom Overlay', layerId: 34 }
        ],
        components: [
            {
                componentIndex: 2,
                designator: 'B1',
                x: 10,
                y: 60,
                layer: 'Bottom Layer',
                pattern: 'SOT23',
                rotation: 0
            }
        ],
        pads: [
            {
                componentIndex: 2,
                x: 30,
                y: 40,
                sizeBottomX: 20,
                sizeBottomY: 10,
                shapeBottom: 2,
                layerId: 32,
                rotation: 0
            }
        ],
        tracks: [
            {
                x1: 10,
                y1: 15,
                x2: 40,
                y2: 15,
                width: 4,
                layerCode: 32,
                layerId: 32
            }
        ],
        texts: [
            {
                text: 'BOTTOM_SIDE_MARK',
                x: 20,
                y: 30,
                height: 8,
                layerId: 34,
                rotation: 270,
                mirrored: true,
                fontTypeName: 'TrueType',
                fontFamily: 'Consolas',
                isInverted: true,
                marginBorderWidth: 2,
                visible: true
            },
            {
                text: 'LARGE_BOTTOM_SIDE_MARK',
                x: 22,
                y: 180,
                height: 160,
                trueTypeFontScale: 0.75,
                layerId: 34,
                rotation: 270,
                mirrored: true,
                fontTypeName: 'TrueType',
                fontFamily: 'Consolas',
                isInverted: true,
                marginBorderWidth: 4,
                visible: true
            }
        ]
    })

    const bottomMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'bottom'
    })

    assert.match(bottomMarkup, /x1="90" y1="15" x2="60" y2="15"/)
    assert.match(bottomMarkup, /class="[^"]*\bpcb-svg--bottom\b/)
    assert.match(bottomMarkup, /transform="translate\(70 40\) rotate\([^)]+\)"/)
    assert.match(
        bottomMarkup,
        /<g class="pcb-texts"[^>]*transform="translate\(100 0\) scale\(-1 1\)"/
    )
    assert.match(
        bottomMarkup,
        /transform="translate\(20 30\) rotate\(270\) scale\(-1 1\)"/
    )
    assert.match(
        bottomMarkup,
        /transform="translate\(22 180\) rotate\(270\) scale\(-1 1\)"/
    )
    assert.match(bottomMarkup, /class="pcb-text__knockout-fill"/)
    assert.match(bottomMarkup, /transform="translate\(90 60\) rotate\([^)]+\)"/)
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
