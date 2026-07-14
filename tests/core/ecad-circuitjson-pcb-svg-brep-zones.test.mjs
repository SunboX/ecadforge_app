import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitJsonPcbSvgRenderer } from 'circuitjson-toolkit/extensions'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a board with solved copper area geometry for SVG rendering.
 * @returns {object[]}
 */
function createSolvedAreaDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 8,
            height: 6,
            num_layers: 2
        },
        {
            type: 'pcb_copper_pour',
            pcb_copper_pour_id: 'pour_1',
            shape: 'brep',
            layer: 'top',
            net: 'GND',
            source_net_id: 'source_net_1',
            covered_with_solder_mask: true,
            brep_shape: {
                outerRing: {
                    cwVertices: [
                        { x: -3, y: -2 },
                        { x: 3, y: -2 },
                        { x: 3, y: 2 },
                        { x: -3, y: 2 }
                    ]
                },
                innerRings: [
                    {
                        cwVertices: [
                            { x: -0.5, y: -0.5 },
                            { x: 0.5, y: -0.5 },
                            { x: 0.5, y: 0.5 },
                            { x: -0.5, y: 0.5 }
                        ]
                    }
                ]
            }
        }
    ]
    Object.assign(documentModel, {
        fileName: 'solved-area.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Builds a board with malformed solved copper area geometry.
 * @returns {object[]}
 */
function createMalformedAreaDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4,
            num_layers: 2
        },
        {
            type: 'pcb_copper_pour',
            pcb_copper_pour_id: 'pour_bad',
            shape: 'brep',
            layer: 'top',
            net: 'GND',
            brep_shape: {
                outerRing: {
                    cwVertices: [
                        { x: -2, y: -1 },
                        { x: 2, y: -1 },
                        { x: 2, y: 1 },
                        { x: -2, y: 1 }
                    ]
                },
                innerRings: [
                    {
                        cwVertices: [
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0 }
                        ]
                    }
                ]
            }
        }
    ]
    Object.assign(documentModel, {
        fileName: 'malformed-area.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies solved copper areas render as even-odd paths.
 */
test('CircuitJsonPcbSvgRenderer renders solved copper area holes', () => {
    const svg = CircuitJsonPcbSvgRenderer.render(createSolvedAreaDocument())

    assert.match(svg, /<path class="pcb-zone"/)
    assert.match(svg, /fill-rule="evenodd"/)
    assert.match(svg, /clip-rule="evenodd"/)
    assert.match(svg, /data-source-net-id="source_net_1"/)
    assert.match(svg, /data-solder-mask-covered="true"/)
    assert.match(
        svg,
        /d="M -3 -2 L 3 -2 L 3 2 L -3 2 Z M -0\.5 -0\.5 L 0\.5 -0\.5 L 0\.5 0\.5 L -0\.5 0\.5 Z"/
    )
})

/**
 * Verifies malformed solved copper areas appear in prepared PCB diagnostics.
 */
test('PcbViewRenderer reports malformed solved copper areas', () => {
    const html = PcbViewRenderer.render(
        createMalformedAreaDocument(),
        'top',
        null,
        [],
        [],
        '',
        {},
        '',
        { measurement: { mode: 'distance' } }
    )

    assert.match(html, /class="[^"]*\bpcb-diagnostic-panel\b/)
    assert.match(html, /pcb_zone_brep_ring_dropped/)
    assert.match(html, /Copper area ring was ignored/)
})
