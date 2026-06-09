import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Verifies partial KiCad PCB models use the normalized PCB renderer fallback.
 */
test('ECAD renderer does not crash on partial KiCad PCB models', () => {
    const markup = EcadRendererService.renderPcb({
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'partial-fake.kicad_pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            layers: [],
            components: []
        },
        bom: []
    })

    assert.match(markup, /class="pcb-svg[^"]*pcb-svg--kicad/)
    assert.doesNotMatch(markup, /pcb-svg--altium/)
})

/**
 * Verifies shorthand KiCad bounds are completed before native SVG rendering.
 */
test('ECAD renderer completes shorthand KiCad board bounds', () => {
    const markup = EcadRendererService.renderPcb({
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'shorthand-bounds-fake.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 100, heightMil: 50, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Shorthand Bounds Fake',
                bounds: {
                    minX: 1,
                    minY: 2,
                    width: 3,
                    height: 4
                },
                outlines: [],
                pads: [],
                drawings: [],
                texts: []
            }
        },
        bom: []
    })

    assert.match(markup, /viewBox="-3 -2 11 12"/)
})
