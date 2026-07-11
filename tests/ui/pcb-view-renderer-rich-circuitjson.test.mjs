import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'

/**
 * Builds a standards-shaped PCB document with detailed artwork and diagnostics.
 * @returns {object[]}
 */
function createRichCircuitJsonDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6,
            num_layers: 2
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            width: 1.2,
            height: 0.8,
            layer: 'top',
            pcb_group_id: 'group_1',
            position_mode: 'relative_to_group_anchor',
            positioned_relative_to_pcb_group_id: 'group_1'
        },
        {
            type: 'source_group',
            source_group_id: 'source_group_1',
            name: 'Analog',
            was_automatically_named: false
        },
        {
            type: 'pcb_group',
            pcb_group_id: 'group_1',
            source_group_id: 'source_group_1',
            name: 'Analog',
            center: { x: 1, y: 1 },
            width: 2.4,
            height: 1.6,
            anchor_position: { x: 0, y: 0 }
        },
        {
            type: 'source_net',
            source_net_id: 'source_net_1',
            name: 'SIG',
            member_source_group_ids: []
        },
        {
            type: 'source_port',
            source_port_id: 'source_port_1',
            source_net_id: 'source_net_1'
        },
        {
            type: 'source_port',
            source_port_id: 'source_port_2',
            source_net_id: 'source_net_1'
        },
        {
            type: 'pcb_port',
            pcb_port_id: 'pcb_port_1',
            source_port_id: 'source_port_1',
            x: 0.4,
            y: 0.6
        },
        {
            type: 'pcb_port',
            pcb_port_id: 'pcb_port_2',
            source_port_id: 'source_port_2',
            x: 3.4,
            y: 0.6
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_1',
            pcb_component_id: 'pcb_u1',
            pcb_port_id: 'pcb_port_1',
            shape: 'pill',
            x: 0.4,
            y: 0.6,
            width: 1,
            height: 0.35,
            layer: 'top',
            net: 'SIG',
            solderMaskExpansion: 0.08
        },
        {
            type: 'source_trace',
            source_trace_id: 'source_trace_sig',
            display_name: 'SIG budget',
            max_length: 1.5
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_sig',
            source_trace_id: 'source_trace_sig',
            net: 'SIG',
            route: [
                {
                    route_type: 'wire',
                    x: 0.4,
                    y: 0.6,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 2.4,
                    y: 0.6,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        },
        {
            type: 'pcb_silkscreen_text',
            pcb_silkscreen_text_id: 'silk_1',
            text: 'U1',
            x: 1,
            y: 2,
            layer: 'top_silkscreen',
            anchor_alignment: 'bottom_right',
            is_knockout: true
        },
        {
            type: 'pcb_silkscreen_path',
            pcb_silkscreen_path_id: 'silk_path_1',
            pcb_component_id: 'pcb_u1',
            route: [
                { x: 1.4, y: 2.4 },
                { x: 2, y: 2.4 },
                { x: 2, y: 2.8 }
            ],
            width: 0.05,
            layer: 'top_silkscreen'
        },
        {
            type: 'pcb_fabrication_note_text',
            pcb_fabrication_note_text_id: 'fab_1',
            text: 'PIN 1',
            x: -1,
            y: 2,
            layer: 'top_fabrication',
            anchor_alignment: 'top_left'
        },
        {
            type: 'pcb_fabrication_note_path',
            pcb_fabrication_note_path_id: 'fab_path_1',
            pcb_component_id: 'pcb_u1',
            route: [
                { x: -1.4, y: 2.4 },
                { x: -0.8, y: 2.4 }
            ],
            width: 0.05,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_dimension',
            pcb_note_dimension_id: 'note_dimension_1',
            from: { x: -4, y: -2 },
            to: { x: -2, y: -2 },
            text: '2mm',
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_silkscreen_circle',
            pcb_silkscreen_circle_id: 'silk_circle_1',
            center: { x: 3.2, y: 2 },
            radius: 0.35,
            layer: 'top_silkscreen'
        },
        {
            type: 'pcb_silkscreen_rect',
            pcb_silkscreen_rect_id: 'silk_rect_1',
            center: { x: 3.8, y: 2 },
            width: 0.6,
            height: 0.4,
            layer: 'top_silkscreen'
        },
        {
            type: 'pcb_solder_paste',
            pcb_solder_paste_id: 'paste_1',
            center: { x: 0.4, y: -1.6 },
            width: 0.7,
            height: 0.25,
            layer: 'top'
        },
        {
            type: 'pcb_thermal_spoke',
            pcb_thermal_spoke_id: 'thermal_1',
            x1: -1,
            y1: -1,
            x2: -0.2,
            y2: -1,
            width: 0.16,
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_trace_hint',
            pcb_trace_hint_id: 'hint_1',
            pcb_port_id: 'pcb_port_1',
            pcb_component_id: 'pcb_u1',
            route: [
                { x: 2.4, y: -1.8 },
                { x: 3.4, y: -1.8 }
            ],
            net: 'SIG'
        },
        {
            type: 'pcb_breakout_point',
            pcb_breakout_point_id: 'breakout_1',
            center: { x: 3.8, y: 0.6 },
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_plated_hole',
            pcb_plated_hole_id: 'hole_rect_1',
            shape: 'circular_hole_with_rect_pad',
            x: -2.8,
            y: 0.8,
            rect_pad_width: 1.2,
            rect_pad_height: 0.7,
            hole_diameter: 0.3,
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_hole',
            pcb_hole_id: 'slot_1',
            hole_shape: 'pill',
            x: -2.8,
            y: -0.2,
            width: 1.1,
            height: 0.35,
            layer: 'board'
        },
        {
            type: 'pcb_panel',
            pcb_panel_id: 'panel_1',
            center: { x: 0, y: 0 },
            width: 12,
            height: 8
        },
        {
            type: 'pcb_keepout',
            pcb_keepout_id: 'keepout_1',
            center: { x: -2.4, y: -1.4 },
            width: 1.2,
            height: 0.8,
            layer: 'top'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'cutout_1',
            center: { x: 2.4, y: -1.4 },
            width: 0.8,
            height: 0.6,
            layer: 'board'
        },
        {
            type: 'pcb_courtyard',
            pcb_courtyard_id: 'courtyard_1',
            center: { x: 1, y: 1 },
            width: 2,
            height: 1.4,
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_courtyard_outline',
            pcb_courtyard_outline_id: 'courtyard_line_1',
            pcb_component_id: 'pcb_u1',
            outline: [
                { x: -1.8, y: 2.8 },
                { x: -1.2, y: 2.8 }
            ],
            layer: 'top'
        },
        {
            type: 'pcb_courtyard_outline',
            pcb_courtyard_outline_id: 'courtyard_outline_1',
            pcb_component_id: 'pcb_u1',
            outline: [
                { x: 2.6, y: 2.4 },
                { x: 3.2, y: 2.4 },
                { x: 3.2, y: 3 },
                { x: 2.6, y: 3 }
            ],
            layer: 'top'
        },
        {
            type: 'pcb_trace_error',
            pcb_trace_error_id: 'err_1',
            pcb_component_id: 'pcb_u1',
            message: 'Trace clearance is below the configured rule.',
            error_type: 'clearance'
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
 * Verifies detailed standards-shaped PCB artwork renders as selectable SVG.
 */
test('PcbViewRenderer renders rich CircuitJSON artwork and diagnostics', () => {
    const html = PcbViewRenderer.render(
        createRichCircuitJsonDocument(),
        'top',
        null,
        ['top_silkscreen'],
        [],
        '',
        {},
        '',
        { hoveredNetName: 'SIG', showTraceLengths: true }
    )

    assert.match(html, /class="[^"]*\bpcb-silkscreen\b/)
    assert.match(html, /class="[^"]*\bpcb-fabrication\b/)
    assert.match(html, /class="[^"]*\bpcb-keepout\b/)
    assert.match(html, /class="[^"]*\bpcb-cutout\b/)
    assert.match(html, /class="[^"]*\bpcb-courtyard\b/)
    assert.match(
        html,
        /class="[^"]*\bpcb-silkscreen\b[^"]*"[^>]*x1="1\.4" y1="2\.4" x2="2" y2="2\.4" stroke-width="0\.05"/
    )
    assert.match(
        html,
        /class="[^"]*\bpcb-fabrication\b[^"]*"[^>]*x1="-1\.4" y1="2\.4" x2="-0\.8" y2="2\.4" stroke-width="0\.05"/
    )
    assert.match(
        html,
        /class="[^"]*\bpcb-courtyard\b[^"]*"[^>]*x1="-1\.8" y1="2\.8" x2="-1\.2" y2="2\.8" stroke-width="0\.05"/
    )
    assert.match(
        html,
        /class="[^"]*\bpcb-silkscreen-text--knockout\b[^"]*"[^>]*data-pcb-primitive-id="silk_1"[^>]*data-knockout="true"[^>]*text-anchor="end" dominant-baseline="text-after-edge"/
    )
    assert.match(
        html,
        /class="[^"]*\bpcb-fabrication\b[^"]*"[^>]*data-pcb-primitive-id="fab_1"[^>]*text-anchor="start" dominant-baseline="text-before-edge"/
    )
    assert.match(html, /class="[^"]*\bpcb-dimension\b/)
    assert.match(html, /class="[^"]*\bpcb-solder-mask\b/)
    assert.match(html, /class="[^"]*\bpcb-solder-paste\b/)
    assert.match(html, /class="[^"]*\bpcb-thermal-spoke\b/)
    assert.match(html, /class="[^"]*\bpcb-route-hint\b/)
    assert.match(html, /class="[^"]*\bpcb-breakout-point\b/)
    assert.match(html, /class="[^"]*\bpcb-via--rect\b/)
    assert.match(html, /class="[^"]*\bpcb-via-hole--circle\b/)
    assert.match(html, /class="[^"]*\bpcb-via--pill\b/)
    assert.match(html, /class="[^"]*\bpcb-via-hole--pill\b/)
    assert.match(html, /class="[^"]*\bpcb-panel-outline\b/)
    assert.match(html, /class="[^"]*\bpcb-group-outline\b/)
    assert.match(html, /class="[^"]*\bpcb-anchor-offset\b/)
    assert.match(html, /data-pcb-trace-length-toggle/)
    assert.match(html, /data-pcb-trace-length-visible="true"/)
    assert.match(html, /class="[^"]*\bpcb-trace-length-label\b/)
    assert.match(html, /class="[^"]*\bpcb-trace-length-label--over-limit\b/)
    assert.match(html, />2\.00 \/ 1\.50 mm \(SIG budget\)<\/text>/)
    assert.match(html, /class="[^"]*\bpcb-diagnostic-panel\b/)
    assert.match(html, /class="pcb-diagnostic-panel__group"/)
    assert.match(html, /<summary class="pcb-diagnostic-panel__group-summary">/)
    assert.match(html, /data-pcb-diagnostic-focus="err_1"/)
    assert.match(
        html,
        /data-pcb-diagnostic-copy="Trace clearance is below the configured rule\."/
    )
    assert.match(html, /class="[^"]*\bpcb-diagnostic-marker\b/)
    assert.match(html, /Trace clearance is below the configured rule\./)
    assert.match(html, /class="[^"]*\bpcb-ratsnest-line\b/)
    assert.match(html, /data-pcb-ratsnest-net="SIG"/)
    assert.match(html, /\[data-layer='top_silkscreen'\]\s*\{\s*display: none/)
})

/**
 * Verifies completed bounds measurements include a copy action.
 */
test('PcbViewRenderer renders copyable CircuitJSON measurement bounds', () => {
    const html = PcbViewRenderer.render(
        createRichCircuitJsonDocument(),
        'top',
        null,
        [],
        [],
        '',
        {},
        '',
        {
            measurement: {
                tool: 'bounds',
                mode: '',
                start: { x: 0, y: 0 },
                end: { x: 2, y: 1 }
            }
        }
    )

    assert.match(
        html,
        /data-pcb-measure-copy="minX: 0\.00, minY: 0\.00, maxX: 2\.00, maxY: 1\.00"/
    )
    assert.match(html, /class="[^"]*\bpcb-measurement-copy\b/)
})

/**
 * Verifies completed bounds measurements expose workflow actions.
 */
test('PcbViewRenderer renders CircuitJSON measurement bounds actions', () => {
    const html = PcbViewRenderer.render(
        createRichCircuitJsonDocument(),
        'top',
        null,
        [],
        [],
        '',
        {},
        '',
        {
            measurement: {
                tool: 'bounds',
                mode: '',
                start: { x: 0, y: 0 },
                end: { x: 2, y: 1 }
            }
        }
    )

    ;['zoom', 'select', 'export-svg', 'export-png'].forEach((action) => {
        assert.match(
            html,
            new RegExp('data-pcb-measure-action="' + action + '"')
        )
    })
    assert.match(html, /data-pcb-bounds-min-x="0"/)
    assert.match(html, /data-pcb-bounds-max-x="2"/)
    assert.match(html, /class="[^"]*\bpcb-measurement-actions\b/)
})

/**
 * Verifies active measurement tools render nearby snap targets.
 */
test('PcbViewRenderer renders CircuitJSON measurement snap targets', () => {
    const html = PcbViewRenderer.render(
        createRichCircuitJsonDocument(),
        'top',
        null,
        [],
        [],
        '',
        {},
        '',
        { measurement: { tool: 'distance', mode: 'distance' } }
    )

    assert.match(html, /class="[^"]*\bpcb-measurement-snap-targets\b/)
    assert.match(html, /class="[^"]*\bpcb-measurement-snap-target\b/)
})
