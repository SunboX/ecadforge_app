/**
 * Builds a standards-shaped board document with richer PCB artwork records.
 * @returns {object[]}
 */
export function createRichCircuitJsonDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 12,
            height: 8,
            num_layers: 4
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
            width: 1.8,
            height: 1.2,
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
            width: 3,
            height: 2,
            anchor_position: { x: 0, y: 0 }
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_rot',
            pcb_component_id: 'pcb_u1',
            shape: 'rotated_rect',
            x: 0.6,
            y: 0.6,
            width: 0.9,
            height: 0.35,
            ccw_rotation: 45,
            layer: 'top',
            net: 'SIG',
            solderMaskExpansion: 0.1,
            solderPasteExpansion: 0.05
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_asym',
            pcb_component_id: 'pcb_u1',
            shape: 'rotated_rect',
            x: -0.8,
            y: 0.1,
            width: 1,
            height: 0.5,
            ccw_rotation: 30,
            layer: 'top',
            net: 'AUX',
            soldermask_margin_left: 0.2,
            soldermask_margin_right: 0.4,
            soldermask_margin_top: 0.1,
            soldermask_margin_bottom: -0.05
        },
        {
            type: 'source_trace',
            source_trace_id: 'source_trace_sig',
            display_name: 'SIG budget',
            max_length: 2.5
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_sig',
            source_trace_id: 'source_trace_sig',
            net: 'SIG',
            route: [
                {
                    route_type: 'wire',
                    x: -1,
                    y: -1,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 2,
                    y: -1,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_pill',
            pcb_component_id: 'pcb_u1',
            shape: 'pill',
            x: 1.4,
            y: 0.6,
            width: 1.1,
            height: 0.35,
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_poly',
            pcb_component_id: 'pcb_u1',
            shape: 'polygon',
            points: [
                { x: 0.4, y: 1.4 },
                { x: 1, y: 1.8 },
                { x: 1.6, y: 1.4 }
            ],
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_plated_hole',
            pcb_plated_hole_id: 'hole_1',
            shape: 'circular_hole_with_rect_pad',
            x: -2,
            y: 1.5,
            outer_diameter: 0.9,
            hole_diameter: 0.35,
            rect_pad_width: 1.4,
            rect_pad_height: 0.8,
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_hole',
            pcb_hole_id: 'slot_1',
            hole_shape: 'pill',
            x: -3.5,
            y: 1.5,
            width: 1.2,
            height: 0.4,
            layer: 'board'
        },
        {
            type: 'pcb_keepout',
            pcb_keepout_id: 'keepout_1',
            center: { x: -3, y: -2 },
            width: 1.2,
            height: 0.8,
            layer: 'top'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'cutout_1',
            points: [
                { x: 3, y: -1 },
                { x: 4, y: -1 },
                { x: 4, y: 0 },
                { x: 3, y: 0 }
            ],
            layer: 'board'
        },
        {
            type: 'pcb_courtyard',
            pcb_courtyard_id: 'courtyard_1',
            center: { x: 1, y: 1 },
            width: 2.4,
            height: 1.8,
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_silkscreen_text',
            pcb_silkscreen_text_id: 'silk_1',
            text: 'U1',
            x: 1,
            y: 2.2,
            layer: 'top_silkscreen',
            anchor_alignment: 'bottom_right',
            is_knockout: true
        },
        {
            type: 'pcb_silkscreen_path',
            pcb_silkscreen_path_id: 'silk_path_route',
            route: [
                { x: 0.2, y: 2.8 },
                { x: 1, y: 2.8 },
                { x: 1, y: 3.2 }
            ],
            width: 0.08,
            layer: 'top_silkscreen'
        },
        {
            type: 'pcb_fabrication_note_text',
            pcb_fabrication_note_text_id: 'fab_1',
            text: 'PIN 1',
            x: -1,
            y: 2.4,
            layer: 'top_fabrication',
            anchor_alignment: 'top_left'
        },
        {
            type: 'pcb_fabrication_note_path',
            pcb_fabrication_note_path_id: 'fab_path_route',
            route: [
                { x: -1.4, y: 2.8 },
                { x: -0.6, y: 2.8 },
                { x: -0.6, y: 3.2 }
            ],
            width: 0.08,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_copper_text',
            pcb_copper_text_id: 'copper_text_1',
            text: 'SIG',
            x: 2.4,
            y: 1.2,
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_note_text',
            pcb_note_text_id: 'note_1',
            text: 'ASSEMBLY NOTE',
            x: -4,
            y: 2.8,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_line',
            pcb_note_line_id: 'note_line_1',
            x1: -4,
            y1: 2.2,
            x2: -2,
            y2: 2.2,
            width: 0.08,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_rect',
            pcb_note_rect_id: 'note_rect_1',
            center: { x: -3, y: 1.4 },
            width: 1.4,
            height: 0.6,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_note_dimension',
            pcb_note_dimension_id: 'note_dimension_1',
            start: { x: -5, y: -3 },
            end: { x: -3, y: -3 },
            text: '2mm',
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_fabrication_note_rect',
            pcb_fabrication_note_rect_id: 'fab_rect_1',
            center: { x: 3.4, y: 2.2 },
            width: 1.2,
            height: 0.5,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_fabrication_note_dimension',
            pcb_fabrication_note_dimension_id: 'fab_dimension_1',
            start: { x: 2.8, y: 3 },
            end: { x: 4.2, y: 3 },
            text: '1.4mm',
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_solder_paste',
            pcb_solder_paste_id: 'paste_1',
            center: { x: 0.6, y: -1.6 },
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
            route: [
                { x: 2.8, y: -2.2, layer: 'top' },
                { x: 4, y: -2.2, layer: 'top' }
            ],
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_breakout_point',
            pcb_breakout_point_id: 'breakout_1',
            center: { x: 4.4, y: 1.8 },
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_panel',
            pcb_panel_id: 'panel_1',
            center: { x: 0, y: 0 },
            width: 14,
            height: 10
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
