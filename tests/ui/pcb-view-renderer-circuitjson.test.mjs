import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a compact standards-native PCB model.
 * @returns {object[]}
 */
function createCircuitJsonPcbDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6,
            num_layers: 4
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1'
        },
        {
            type: 'source_component',
            source_component_id: 'source_r1',
            name: 'R1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            layer: 'top',
            rotation: 0,
            width: 1.2,
            height: 0.8
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_r1',
            source_component_id: 'source_r1',
            center: { x: -1, y: -1 },
            layer: 'bottom',
            rotation: 0,
            width: 1.4,
            height: 0.6
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_1',
            pcb_component_id: 'pcb_u1',
            shape: 'rect',
            x: 1,
            y: 1,
            width: 1.2,
            height: 0.8,
            layer: 'top',
            net: 'VCC'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_r1',
            pcb_component_id: 'pcb_r1',
            shape: 'rect',
            x: -1,
            y: -1,
            width: 1,
            height: 0.5,
            layer: 'bottom',
            net: 'GND'
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_1',
            net: 'VCC',
            route: [
                {
                    route_type: 'wire',
                    x: 1,
                    y: 1,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 3,
                    y: 1,
                    width: 0.2,
                    layer: 'inner1'
                },
                {
                    route_type: 'wire',
                    x: 4,
                    y: 2,
                    width: 0.2,
                    layer: 'inner1'
                }
            ]
        }
    ]
    Object.assign(documentModel, {
        fileName: 'board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies standards-native PCB documents render in the 2D PCB tab.
 */
test('PcbViewRenderer renders CircuitJSON PCB artwork and interaction metadata', () => {
    const html = PcbViewRenderer.render(
        createCircuitJsonPcbDocument(),
        'top',
        null,
        ['inner1'],
        [],
        'U1',
        {},
        'VCC'
    )

    assert.match(html, /pcb-svg--circuitjson/)
    assert.match(html, /class="[^"]*\bpcb-board\b/)
    assert.match(html, /class="[^"]*\bpcb-pad\b/)
    assert.match(html, /class="[^"]*\bpcb-track\b/)
    assert.match(html, /data-component-key="U1"/)
    assert.match(html, /data-pcb-net-name="VCC"/)
    assert.match(html, /class="pcb-component-selection-marker"/)
    assert.match(html, /data-viewport-interaction-gate="locked"/)
    assert.match(html, /data-viewport-interaction-unlock="true"/)
    assert.match(html, /\[data-layer='inner1'\]\s*\{\s*display: none/)
    assert.match(html, /\[data-pcb-net-name='VCC'\]/)
})

/**
 * Verifies temporary PCB viewport toolbar controls stay hidden but retained.
 */
test('PcbViewRenderer hides temporary PCB viewport toolbar controls', () => {
    const html = PcbViewRenderer.render(createCircuitJsonPcbDocument(), 'top')

    assert.match(html, /hidden[^>]*data-pcb-view-reset="true"/)
    assert.match(html, /hidden[^>]*data-pcb-hover-focus-toggle="true"/)
    assert.match(html, /hidden[^>]*data-pcb-measure-tool="distance"/)
    assert.match(html, /hidden[^>]*data-pcb-measure-tool="bounds"/)
    assert.match(html, /hidden[^>]*data-pcb-measure-tool="clear"/)
    assert.match(html, /data-pcb-hover-focus-visible="false"/)
    assert.match(html, /aria-pressed="false"/)
})

/**
 * Verifies temporary PCB view settings controls stay hidden but retained.
 */
test('PcbViewRenderer hides PCB view settings controls', () => {
    const html = PcbViewRenderer.render(
        createCircuitJsonPcbDocument(),
        'top',
        null,
        [],
        ['components-bottom', 'silkscreen'],
        '',
        {},
        '',
        { showTraceLengths: true }
    )

    assert.match(html, /hidden[^>]*data-pcb-view-settings="true"/)
    assert.match(html, /data-pcb-view-setting="components-top"/)
    assert.match(
        html,
        /data-pcb-view-setting="components-bottom"[^>]*data-pcb-view-setting-visible="false"/
    )
    ;[
        'rats-nest',
        'solder-mask',
        'solder-paste',
        'silkscreen',
        'fabrication',
        'courtyards',
        'groups',
        'anchor-offsets'
    ].forEach((settingKey) => {
        assert.match(
            html,
            new RegExp('data-pcb-view-setting="' + settingKey + '"')
        )
    })
    assert.match(html, /hidden[^>]*data-pcb-trace-length-toggle="true"/)
    assert.match(html, /data-pcb-component-side="top"/)
    assert.match(
        html,
        /\.pcb-svg \[data-pcb-component-side='bottom'\]\s*\{\s*opacity: 0/
    )
    assert.match(
        html,
        /\.pcb-svg \.pcb-silkscreen\s*\{\s*opacity: 0/
    )
})

/**
 * Verifies richer standards-native PCB primitives are emitted into app SVG.
 */
test('PcbViewRenderer renders rich CircuitJSON PCB primitive families', () => {
    const documentModel = createCircuitJsonPcbDocument()
    documentModel.push(
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_pill',
            pcb_component_id: 'pcb_u1',
            shape: 'rotated_pill',
            x: 2,
            y: 1,
            width: 2,
            height: 0.8,
            radius: 0.4,
            ccw_rotation: 45,
            layer: 'top'
        },
        {
            type: 'pcb_silkscreen_text',
            pcb_silkscreen_text_id: 'ref_u1',
            text: 'U1',
            x: 1,
            y: 0,
            font_size: 0.8,
            layer: 'top'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'slot_1',
            shape: 'rect',
            center: { x: 0, y: 0 },
            width: 2,
            height: 1
        }
    )

    const html = PcbViewRenderer.render(documentModel, 'top')

    assert.match(html, /class="[^"]*\bpcb-pad--rotated_pill\b/)
    assert.match(html, /transform="rotate\(45 2 1\)"/)
    assert.match(html, /class="[^"]*\bpcb-silkscreen-text\b/)
    assert.match(html, /class="[^"]*\bpcb-cutout\b/)
})
