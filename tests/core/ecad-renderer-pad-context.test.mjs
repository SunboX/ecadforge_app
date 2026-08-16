import assert from 'node:assert/strict'
import test from 'node:test'
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
