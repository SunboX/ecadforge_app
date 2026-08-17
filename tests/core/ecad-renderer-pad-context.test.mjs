import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Verifies opposite-side copper context includes copper-bearing pads while
 * preserving one instance of pads that already belong to both sides.
 */
test('ECAD renderer includes opposite-side KiCad copper pads on both views', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'layered-pad-fake.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 400, heightMil: 400, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Layered Pad Fake',
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 10,
                    maxY: 10,
                    width: 10,
                    height: 10
                },
                outlines: [],
                drawings: [],
                texts: [],
                footprints: [],
                pads: [
                    {
                        number: 'front-pad',
                        type: 'smd',
                        shape: 'rect',
                        x: 2,
                        y: 2,
                        width: 1,
                        height: 1,
                        rotation: 0,
                        drill: 0,
                        layers: ['F.Cu', 'F.Paste', 'F.Mask'],
                        side: 'front'
                    },
                    {
                        number: 'back-pad',
                        type: 'smd',
                        shape: 'rect',
                        x: 4,
                        y: 4,
                        width: 1,
                        height: 1,
                        rotation: 0,
                        drill: 0,
                        layers: ['B.Cu', 'B.Paste', 'B.Mask'],
                        side: 'back'
                    },
                    {
                        number: 'through-pad',
                        type: 'thru_hole',
                        shape: 'circle',
                        x: 6,
                        y: 6,
                        width: 1.8,
                        height: 1.8,
                        rotation: 0,
                        drill: 1,
                        layers: ['*.Cu', '*.Mask'],
                        side: 'both'
                    }
                ]
            }
        },
        bom: []
    }
    const topMarkup = EcadRendererService.renderPcb(kicadPcbDocument, {
        side: 'front'
    })
    const bottomMarkup = EcadRendererService.renderPcb(kicadPcbDocument, {
        side: 'back'
    })

    for (const markup of [topMarkup, bottomMarkup]) {
        assert.match(markup, /data-pad-number="front-pad"/)
        assert.match(markup, /data-pad-number="back-pad"/)
        assert.equal(markup.match(/class="pcb-pad"/gu)?.length, 3)
    }
})

/**
 * Verifies normalized Altium rendering keeps every copper-bearing pad in the
 * composite copper context without duplicating shared through-hole pads.
 */
test('ECAD renderer includes opposite-side Altium copper pads on both views', () => {
    const documentModel = altiumLayeredPadFixture()
    const topMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'front'
    })
    const bottomMarkup = EcadRendererService.renderPcb(documentModel, {
        side: 'back'
    })

    for (const markup of [topMarkup, bottomMarkup]) {
        assert.equal(markup.match(/<g class="pcb-pad pcb-pad--/gu)?.length, 3)
        assert.match(
            markup,
            /data-layer-id="1"[^>]*data-pad-number="front-pad"/u
        )
        assert.match(
            markup,
            /data-layer-id="32"[^>]*data-pad-number="back-pad"/u
        )
    }
})

test('ECAD renderer retains rotated KiCad pad apertures on both board views', () => {
    const source = new TextEncoder().encode(rotatedFrontPadFixture())
    const documentModel = EcadParserService.parseArrayBuffer(
        'rotated-front-pad-fake.kicad_pcb',
        source.buffer
    )

    for (const side of ['front', 'back']) {
        const markup = EcadRendererService.renderPcb(documentModel, { side })

        assert.match(
            markup,
            /<rect class="pcb-pad"(?=[^>]*data-pad-number="1")[^>]*transform="rotate\(270 /u
        )
    }
})

/**
 * Builds a source-neutral normalized Altium fixture with pads authored on the
 * front, back, and shared copper layers.
 * @returns {object}
 */
function altiumLayeredPadFixture() {
    const sharedPad = {
        componentIndex: null,
        holeDiameter: 0,
        rotation: 0,
        shapeMid: 2,
        shapeTop: 2,
        sizeMidX: 40,
        sizeMidY: 30,
        sizeTopX: 40,
        sizeTopY: 30
    }

    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'layered-pad-fake.PcbDoc',
        summary: { title: 'Layered Pad Fake' },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 400,
                segments: []
            },
            layers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Bottom Layer', layerId: 32 },
                { name: 'Multi-Layer', layerId: 74 }
            ],
            primitiveLayers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Bottom Layer', layerId: 32 }
            ],
            polygons: [],
            fills: [],
            tracks: [],
            arcs: [],
            regions: [],
            shapeBasedRegions: [],
            boardRegions: [],
            vias: [],
            texts: [],
            components: [],
            pads: [
                {
                    ...sharedPad,
                    id: 'front-pad',
                    padNumber: 'front-pad',
                    x: 100,
                    y: 100,
                    layerCode: 1,
                    layerId: 1
                },
                {
                    ...sharedPad,
                    id: 'back-pad',
                    padNumber: 'back-pad',
                    x: 200,
                    y: 200,
                    layerCode: 32,
                    layerId: 32,
                    shapeBottom: 2,
                    sizeBottomX: 50,
                    sizeBottomY: 35
                },
                {
                    ...sharedPad,
                    id: 'through-pad',
                    padNumber: 'through-pad',
                    x: 300,
                    y: 300,
                    holeDiameter: 20,
                    layerCode: 74,
                    layerId: 74,
                    shapeBottom: 2,
                    sizeBottomX: 40,
                    sizeBottomY: 30
                }
            ]
        },
        bom: []
    }
}

/**
 * Builds a source-neutral KiCad fixture with board-oriented pad angles.
 * @returns {string}
 */
function rotatedFrontPadFixture() {
    return `(kicad_pcb
        (version 20240108)
        (generator "ecad-forge-test")
        (general (thickness 1.6))
        (layers
            (0 "F.Cu" signal)
            (31 "B.Cu" signal)
            (37 "F.SilkS" user "f.silkscreen")
            (44 "Edge.Cuts" user)
        )
        (footprint "Fake:Rotated_Pair"
            (layer "F.Cu")
            (at 10 20 -90)
            (property "Reference" "X1"
                (at 0 -2 270)
                (layer "F.SilkS")
                (effects (font (size 1 1) (thickness 0.15)))
            )
            (pad "1" smd roundrect
                (at -1 0 270)
                (size 0.6 1.4)
                (layers "F.Cu" "F.Paste" "F.Mask")
                (roundrect_rratio 0.25)
            )
            (pad "2" smd roundrect
                (at 1 0 270)
                (size 0.6 1.4)
                (layers "F.Cu" "F.Paste" "F.Mask")
                (roundrect_rratio 0.25)
            )
        )
    )`
}
