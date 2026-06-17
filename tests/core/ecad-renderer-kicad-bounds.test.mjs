import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Builds a fake KiCad PCB document with two rows of rectangular IC pads.
 * @returns {object}
 */
function createTwoRowPadAxisDocument() {
    const pads = [
        createTwoRowPad('1', 7, 8),
        createTwoRowPad('2', 9, 8),
        createTwoRowPad('3', 11, 8),
        createTwoRowPad('4', 13, 8),
        createTwoRowPad('5', 13, 12),
        createTwoRowPad('6', 11, 12),
        createTwoRowPad('7', 9, 12),
        createTwoRowPad('8', 7, 12)
    ]

    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'two-row-axis-fake.kicad_pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
                heightMil: 2000,
                segments: []
            },
            layers: [],
            components: [
                {
                    componentIndex: 0,
                    designator: 'X1',
                    footprintId: 'footprint:X1:0',
                    layer: 'TOP',
                    pattern: 'FAKE_TWO_ROW',
                    rotation: 90,
                    x: 10,
                    y: 10
                }
            ],
            pads,
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Two Row Axis Fake',
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 20,
                    maxY: 20,
                    width: 20,
                    height: 20
                },
                outlines: [],
                pads,
                drawings: [],
                texts: []
            }
        },
        bom: []
    }
}

/**
 * Builds one fake rectangular surface pad.
 * @param {string} number Pad number.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function createTwoRowPad(number, x, y) {
    return {
        id: 'pad:X1:' + number,
        footprintId: 'footprint:X1:0',
        footprintReference: 'X1',
        componentIndex: 0,
        number,
        type: 'smd',
        shape: 'rect',
        x,
        y,
        rotation: 0,
        width: 1.5,
        height: 0.4,
        sizeTopX: 60,
        sizeTopY: 16,
        shapeTop: 0,
        layers: ['F.Cu'],
        side: 'front'
    }
}

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

/**
 * Verifies slightly mismatched KiCad Edge.Cuts endpoints still render the
 * native rounded outline instead of a rectangular bounds fallback.
 */
test('ECAD renderer snaps near KiCad Edge.Cuts endpoints for PCB outlines', () => {
    const markup = EcadRendererService.renderPcb({
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'rounded-edge-fake.kicad_pcb',
        pcb: {
            boardOutline: {
                widthMil: 2000,
                heightMil: 1000,
                minX: 0,
                minY: 0,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 2000, y2: 0 },
                    { type: 'line', x1: 2000, y1: 0, x2: 2000, y2: 1000 },
                    { type: 'line', x1: 2000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'Rounded Edge Fake',
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 20,
                    maxY: 10,
                    width: 20,
                    height: 10
                },
                outlines: [
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 0.02, y: 2 },
                        end: { x: 0, y: 8 }
                    },
                    {
                        type: 'arc',
                        layer: 'Edge.Cuts',
                        start: { x: 0.02, y: 2 },
                        mid: { x: 1.8, y: 0.3 },
                        end: { x: 4, y: 0 }
                    },
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 3.78, y: 0 },
                        end: { x: 16, y: 0 }
                    },
                    {
                        type: 'arc',
                        layer: 'Edge.Cuts',
                        start: { x: 16, y: 0 },
                        mid: { x: 19.7, y: 0.3 },
                        end: { x: 20, y: 2 }
                    },
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 20, y: 1.78 },
                        end: { x: 20, y: 8 }
                    },
                    {
                        type: 'arc',
                        layer: 'Edge.Cuts',
                        start: { x: 20, y: 8 },
                        mid: { x: 19.7, y: 9.7 },
                        end: { x: 16, y: 10 }
                    },
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 16.22, y: 10 },
                        end: { x: 4, y: 10 }
                    },
                    {
                        type: 'arc',
                        layer: 'Edge.Cuts',
                        start: { x: 4, y: 10 },
                        mid: { x: 1.8, y: 9.7 },
                        end: { x: 0, y: 8 }
                    }
                ],
                pads: [],
                drawings: [],
                texts: []
            }
        },
        bom: []
    })

    assert.match(markup, /<path class="pcb-board"/)
    assert.doesNotMatch(markup, /<rect class="pcb-board"/)
})

/**
 * Verifies row-parallel rectangular IC pads are rotated across the package body.
 */
test('ECAD renderer turns KiCad two-row IC pad axes across the package', () => {
    const markup = EcadRendererService.renderPcb(createTwoRowPadAxisDocument())

    assert.match(markup, /transform="rotate\(90 7 8\)"/)
    assert.doesNotMatch(markup, /transform="rotate\(0 7 8\)"/)
})
