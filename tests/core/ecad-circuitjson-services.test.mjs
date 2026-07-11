import assert from 'node:assert/strict'
import test from 'node:test'
import { DocumentPreferredViewResolver } from '../../src/DocumentPreferredViewResolver.mjs'
import { DocumentViewCompatibility } from '../../src/DocumentViewCompatibility.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadCircuitJsonRendererService } from '../../src/core/ecad/EcadCircuitJsonRendererService.mjs'
import { EcadDocumentDiagnostics } from '../../src/core/ecad/EcadDocumentDiagnostics.mjs'
import { EcadFormatRegistry } from '../../src/core/ecad/EcadFormatRegistry.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'
import { ManufacturingService } from 'circuitjson-toolkit/manufacturing'
import {
    CircuitJsonSchematicSvgRenderer,
    CircuitJsonSupportMatrixBuilder
} from 'circuitjson-toolkit/extensions'

/**
 * Builds a compact board source buffer.
 * @returns {Uint8Array}
 */
function createBoardSource() {
    return new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5,
                num_layers: 2
            }
        ])
    )
}

/**
 * Verifies standalone CircuitJSON files are parsed as first-class documents.
 */
test('EcadParserService parses standalone CircuitJSON JSON files', async () => {
    const source = createBoardSource()
    const service = new EcadParserService()
    const documentModel = service.parseArrayBuffer('board.json', source.buffer)
    const result = await service.parseEntries([
        { name: 'board.json', buffer: source.buffer }
    ])

    assert.equal(Array.isArray(documentModel), false)
    assert.equal(documentModel.schema, 'ecad-toolkit.document.v1')
    assert.equal(Array.isArray(documentModel.model), true)
    assert.equal(documentModel.source.format, 'circuitjson')
    assert.equal(DocumentPreferredViewResolver.resolve(documentModel), 'pcb')
    assert.equal(result.documents.length, 1)
    assert.equal(result.documents[0].source.format, 'circuitjson')
    assert.equal(
        Math.round(
            EcadScene3dService.build(documentModel).board.widthMil * 1_000_000
        ) / 1_000_000,
        393.700787
    )
    assert.equal(
        (await EcadScene3dService.prepare(documentModel)).sourceFormat,
        'circuitjson'
    )
    assert.equal(
        EcadScene3dService.createModelRegistry(documentModel, []),
        null
    )
    const markup = EcadRendererService.renderPcb(documentModel)
    assert.match(markup, /class="[^"]*\bpcb-svg\b[^"]*\bpcb-svg--circuitjson\b/)
    assert.match(markup, /class="[^"]*\bpcb-board\b/)
    assert.deepEqual(
        EcadRendererService.resolvePcbInteractionLayers(
            documentModel
        ).physicalLayers.map((layer) => layer.key),
        ['top', 'bottom']
    )
})

/**
 * Verifies standalone CircuitJSON files are validated before the app accepts
 * them as document models.
 */
test('EcadParserService rejects invalid standalone CircuitJSON fields', () => {
    const source = new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                width: 10,
                height: 5
            }
        ])
    )

    assert.throws(
        () => EcadParserService.parseArrayBuffer('board.json', source.buffer),
        /pcb_board.*pinned upstream schema/
    )
})

/**
 * Verifies standalone CircuitJSON metadata survives browser worker-style
 * structured cloning.
 */
test('EcadParserService preserves CircuitJSON identity through structured clone', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'board.json',
        createBoardSource().buffer
    )
    const clonedDocument = structuredClone(documentModel)

    assert.equal(clonedDocument.source.fileName, 'board.json')
    assert.equal(clonedDocument.source.format, 'circuitjson')
    assert.equal(clonedDocument.schema, 'ecad-toolkit.document.v1')
    assert.equal(DocumentPreferredViewResolver.resolve(clonedDocument), 'pcb')
})

/**
 * Verifies schematic-only element arrays can open and render in the schematic
 * viewer path.
 */
test('EcadRendererService renders CircuitJSON schematic documents', () => {
    const source = new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'schematic_sheet',
                schematic_sheet_id: 'sheet_1',
                width: 30,
                height: 20
            },
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip'
            },
            {
                type: 'schematic_component',
                schematic_component_id: 'schematic_u1',
                source_component_id: 'source_u1',
                center: { x: 5, y: 5 },
                size: { width: 6, height: 4 }
            },
            {
                type: 'schematic_line',
                schematic_line_id: 'line_1',
                x1: 8,
                y1: 5,
                x2: 15,
                y2: 5
            },
            {
                type: 'schematic_net_label',
                schematic_net_label_id: 'label_1',
                text: 'VCC',
                source_net_id: 'source_net_vcc',
                anchor_side: 'left',
                center: { x: 15, y: 5 },
                anchor_position: { x: 15, y: 5 }
            },
            {
                type: 'source_net',
                source_net_id: 'source_net_vcc',
                name: 'VCC',
                member_source_group_ids: []
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'sheet.json',
        source.buffer
    )
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.equal(
        DocumentViewCompatibility.supportsView(documentModel, 'schematic'),
        true
    )
    assert.equal(
        DocumentPreferredViewResolver.resolve(documentModel),
        'schematic'
    )
    assert.match(markup, /schematic-svg--circuitjson/)
    assert.match(markup, /data-component-key="U1"/)
    assert.match(markup, />VCC</)
})

/**
 * Verifies expanded schematic drawing, probe, symbol, table, and diagnostic
 * rows render with stable SVG classes and metadata.
 */
test('EcadRendererService renders expanded CircuitJSON schematic elements', () => {
    const source = new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'schematic_sheet',
                schematic_sheet_id: 'sheet_1',
                width: 40,
                height: 24
            },
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_op_amp'
            },
            {
                type: 'schematic_component',
                schematic_component_id: 'symbol_u1',
                source_component_id: 'source_u1',
                center: { x: 12, y: 10 },
                size: { width: 8, height: 6 }
            },
            {
                type: 'source_port',
                source_port_id: 'source_port_in',
                source_component_id: 'source_u1',
                name: 'IN+',
                pin_number: 1
            },
            {
                type: 'schematic_port',
                schematic_port_id: 'port_in',
                source_port_id: 'source_port_in',
                display_pin_label: 'IN+',
                center: { x: 5, y: 10 },
                facing_direction: 'right'
            },
            {
                type: 'schematic_group',
                schematic_group_id: 'group_analog',
                name: 'Analog',
                source_group_id: 'source_group_analog',
                center: { x: 12, y: 10 },
                width: 12,
                height: 8,
                schematic_component_ids: ['symbol_u1']
            },
            {
                type: 'schematic_rect',
                schematic_rect_id: 'rect_1',
                center: { x: 6, y: 17 },
                width: 4,
                height: 2
            },
            {
                type: 'schematic_circle',
                schematic_circle_id: 'circle_1',
                center: { x: 12, y: 18 },
                radius: 1.5
            },
            {
                type: 'schematic_arc',
                schematic_arc_id: 'arc_1',
                center: { x: 24, y: 8 },
                radius: 3,
                start_angle_degrees: 0,
                end_angle_degrees: 90,
                direction: 'clockwise'
            },
            {
                type: 'schematic_path',
                schematic_path_id: 'path_1',
                points: [
                    { x: 20, y: 14 },
                    { x: 24, y: 18 },
                    { x: 28, y: 14 }
                ]
            },
            {
                type: 'schematic_table',
                schematic_table_id: 'table_1',
                anchor_position: { x: 26, y: 16 },
                column_widths: [4, 4],
                row_heights: [2, 2]
            },
            {
                type: 'schematic_table_cell',
                schematic_table_cell_id: 'cell_1',
                schematic_table_id: 'table_1',
                text: 'A1',
                center: { x: 28, y: 17 },
                width: 4,
                height: 2,
                start_column_index: 0,
                end_column_index: 0,
                start_row_index: 0,
                end_row_index: 0
            },
            {
                type: 'schematic_text',
                schematic_text_id: 'text_1',
                text: 'GAIN',
                position: { x: 18, y: 6 },
                font_size: 1.4,
                rotation: 15
            },
            {
                type: 'schematic_voltage_probe',
                schematic_voltage_probe_id: 'probe_vout',
                name: 'VOUT',
                position: { x: 34, y: 8 },
                schematic_trace_id: 'trace_vout'
            },
            {
                type: 'schematic_debug_object',
                shape: 'rect',
                label: 'Debug bounds',
                center: { x: 18, y: 10 },
                size: { width: 5, height: 3 }
            },
            {
                type: 'schematic_layout_error',
                schematic_layout_error_id: 'layout_1',
                error_type: 'schematic_layout_error',
                message: 'Symbol overlaps a port',
                schematic_group_id: 'group_analog',
                source_group_id: 'source_group_analog'
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'expanded-sheet.json',
        source.buffer
    )
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.match(markup, /class="[^"]*\bschematic-component\b/)
    assert.match(markup, /data-component-key="U1"/)
    assert.match(markup, /class="[^"]*\bschematic-port\b/)
    assert.match(markup, />IN\+</)
    assert.match(markup, /class="[^"]*\bschematic-group\b/)
    assert.match(markup, /data-schematic-group-id="group_analog"/)
    assert.match(markup, /class="[^"]*\bschematic-shape--rect\b/)
    assert.match(markup, /class="[^"]*\bschematic-shape--circle\b/)
    assert.match(markup, /class="[^"]*\bschematic-shape--arc\b/)
    assert.match(markup, /class="[^"]*\bschematic-shape--path\b/)
    assert.match(markup, /class="[^"]*\bschematic-table\b/)
    assert.match(markup, /class="[^"]*\bschematic-table-cell\b/)
    assert.match(markup, />A1</)
    assert.match(markup, /class="[^"]*\bschematic-text\b/)
    assert.match(markup, /font-size="1\.4"/)
    assert.match(markup, /rotate\(15 18 6\)/)
    assert.match(markup, />GAIN</)
    assert.match(markup, /class="[^"]*\bschematic-probe\b/)
    assert.match(markup, />VOUT</)
    assert.match(markup, /class="[^"]*\bschematic-debug-object\b/)
    assert.match(markup, /Debug bounds/)
    assert.match(markup, /class="[^"]*\bschematic-diagnostic-marker\b/)
    assert.match(markup, /Symbol overlaps a port/)
})

/**
 * Verifies symbol-library preview rows render source-port labels, three-point
 * arcs, position-based text, and primitive drawing styles.
 */
test('CircuitJsonSchematicSvgRenderer renders symbol preview primitives', () => {
    const markup = CircuitJsonSchematicSvgRenderer.render([
        {
            type: 'schematic_sheet',
            schematic_sheet_id: 'sheet_1',
            width: 12,
            height: 8
        },
        {
            type: 'source_port',
            source_port_id: 'source_u1_pin_7',
            source_component_id: 'source_u1',
            name: 'A0',
            pin_number: 7
        },
        {
            type: 'schematic_port',
            schematic_port_id: 'schematic_u1_pin_7',
            source_port_id: 'source_u1_pin_7',
            center: { x: 2, y: 2 },
            facing_direction: 'right'
        },
        {
            type: 'schematic_line',
            schematic_line_id: 'line_1',
            x1: 1,
            y1: 1,
            x2: 3,
            y2: 1,
            stroke_width: 0.12,
            color: '#123456',
            is_dashed: true,
            dash_length: 0.25,
            dash_gap: 0.1
        },
        {
            type: 'schematic_rect',
            schematic_rect_id: 'rect_1',
            center: { x: 5, y: 2 },
            width: 2,
            height: 1,
            is_filled: true,
            fill_color: '#ffeeaa',
            stroke_color: '#444444'
        },
        {
            type: 'schematic_arc',
            schematic_arc_id: 'arc_1',
            center: { x: 0, y: 0 },
            radius: 1,
            start_angle_degrees: 0,
            end_angle_degrees: 90,
            direction: 'clockwise',
            stroke_width: 0.08
        },
        {
            type: 'schematic_path',
            schematic_path_id: 'path_1',
            points: [
                { x: 7, y: 1 },
                { x: 8, y: 2 },
                { x: 7, y: 3 }
            ],
            is_filled: true,
            fill_color: '#ddeeff'
        },
        {
            type: 'schematic_text',
            schematic_text_id: 'text_1',
            text: 'PIN BANK',
            position: { x: 4, y: 5 },
            font_size: 0.8
        }
    ])

    assert.match(markup, /data-source-port-id="source_u1_pin_7"/)
    assert.match(markup, /data-pin-number="7"/)
    assert.match(markup, />A0</)
    assert.match(markup, /stroke-width="0\.12"/)
    assert.match(markup, /stroke="#123456"/)
    assert.match(markup, /stroke-dasharray="0\.25 0\.1"/)
    assert.match(markup, /fill="#ffeeaa"/)
    assert.match(
        markup,
        /<path class="schematic-shape schematic-shape--arc" d="M 1 0 A 1 1 0 0 1 0 1"/
    )
    assert.match(
        markup,
        /<polygon class="schematic-shape schematic-shape--path"/
    )
    assert.match(markup, /fill="#ddeeff"/)
    assert.match(markup, /<text class="schematic-text" x="4" y="5"/)
    assert.match(markup, />PIN BANK</)
})

/**
 * Verifies source component rows are promoted into the app BOM table shape.
 */
test('EcadParserService derives CircuitJSON BOM rows from source components', () => {
    const source = new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5
            },
            {
                type: 'source_component',
                source_component_id: 'source_r1',
                name: 'R1',
                manufacturer_part_number: 'RC0402-10K',
                supplier_part_number: 'DIST-10K',
                ftype: 'simple_resistor',
                resistance: '10k'
            },
            {
                type: 'source_component',
                source_component_id: 'source_r2',
                name: 'R2',
                manufacturer_part_number: 'RC0402-10K',
                supplier_part_number: 'DIST-10K',
                ftype: 'simple_resistor',
                resistance: '10k'
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'bom-board.json',
        source.buffer
    )
    const markup = EcadRendererService.renderBom(documentModel, {
        selectedComponentKey: 'R2',
        translate: (key) => key
    })

    assert.deepEqual(
        EcadCircuitJsonRendererService.buildBomRows(documentModel),
        [
            {
                designators: ['R1', 'R2'],
                quantity: 2,
                value: '10k',
                pattern: 'simple_resistor',
                source: 'RC0402-10K',
                supplierPartNumber: 'DIST-10K',
                supplierPartNumbers: { supplier: 'DIST-10K' },
                sourceFtype: 'simple_resistor',
                componentType: 'resistor',
                componentIcon: 'resistor'
            }
        ]
    )
    assert.match(
        markup,
        /R1, <mark class="bom-table__selected-designator">R2<\/mark>/
    )
})

/**
 * Verifies shared services expose schema coverage and manufacturing outputs.
 */
test('shared CircuitJSON services expose coverage and manufacturing outputs', () => {
    const source = new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5
            },
            {
                type: 'source_component',
                source_component_id: 'source_u1',
                name: 'U1',
                ftype: 'simple_chip',
                manufacturer_part_number: 'MCU-1'
            },
            {
                type: 'pcb_component',
                pcb_component_id: 'pcb_u1',
                source_component_id: 'source_u1',
                center: { x: 1.5, y: -0.5 },
                layer: 'top',
                rotation: 45,
                width: 1,
                height: 1
            },
            {
                type: 'pcb_smtpad',
                pcb_smtpad_id: 'pad_1',
                pcb_component_id: 'pcb_u1',
                shape: 'rect',
                x: 1.5,
                y: -0.7,
                width: 0.5,
                height: 0.25,
                layer: 'top'
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'metadata-board.json',
        source.buffer
    )
    const supportMatrix = CircuitJsonSupportMatrixBuilder.build(
        documentModel.model
    )
    const manufacturing = ManufacturingService.inspect(documentModel)
    const routingDsn = new TextDecoder().decode(
        ManufacturingService.export(documentModel, { id: 'routing-dsn' }).data
    )

    assert.equal(supportMatrix.sourceFormat, 'circuitjson')
    assert.equal(supportMatrix.totals.presentElementTypes, 4)
    assert.equal(
        supportMatrix.rows.find((row) => row.type === 'pcb_component')
            .capabilities.manufacturing,
        'pick-and-place'
    )
    assert.deepEqual(manufacturing.placements, [
        {
            designator: 'U1',
            componentId: 'pcb_u1',
            sourceComponentId: 'source_u1',
            x: 1.5,
            y: -0.5,
            rotation: 45,
            layer: 'top',
            side: 'top',
            value: '',
            package: 'simple_chip',
            manufacturerPartNumber: 'MCU-1'
        }
    ])
    assert.match(routingDsn, /\(component U1/)
})

/**
 * Verifies CircuitJSON PCB element arrays build a renderer-compatible 3D scene
 * instead of passing the raw element array through unchanged.
 */
test('EcadScene3dService builds CircuitJSON PCB scene descriptions', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'scene-board.json',
        new TextEncoder().encode(
            JSON.stringify([
                {
                    type: 'pcb_board',
                    pcb_board_id: 'board_1',
                    center: { x: 0, y: 0 },
                    width: 10,
                    height: 5
                },
                {
                    type: 'source_component',
                    source_component_id: 'source_u1',
                    name: 'U1',
                    ftype: 'simple_chip'
                },
                {
                    type: 'source_net',
                    source_net_id: 'source_net_sig',
                    name: 'SIG',
                    member_source_group_ids: []
                },
                {
                    type: 'source_trace',
                    source_trace_id: 'source_trace_sig',
                    connected_source_net_ids: ['source_net_sig'],
                    connected_source_port_ids: []
                },
                {
                    type: 'pcb_component',
                    pcb_component_id: 'pcb_u1',
                    source_component_id: 'source_u1',
                    center: { x: 1, y: 1 },
                    width: 1.2,
                    height: 0.8,
                    rotation: 0,
                    layer: 'top'
                },
                {
                    type: 'pcb_smtpad',
                    pcb_smtpad_id: 'pad_1',
                    pcb_component_id: 'pcb_u1',
                    shape: 'rect',
                    x: 1,
                    y: 0.6,
                    width: 0.8,
                    height: 0.35,
                    layer: 'top'
                },
                {
                    type: 'pcb_trace',
                    pcb_trace_id: 'trace_1',
                    source_trace_id: 'source_trace_sig',
                    route: [
                        {
                            route_type: 'wire',
                            x: 1,
                            y: 0.6,
                            layer: 'top',
                            width: 0.18
                        },
                        {
                            route_type: 'wire',
                            x: 3,
                            y: 0.6,
                            layer: 'top',
                            width: 0.18
                        }
                    ]
                }
            ])
        ).buffer
    )
    const scene = EcadScene3dService.build(documentModel)

    assert.equal(scene.sourceFormat, 'circuitjson')
    assert.equal(
        Math.round(scene.board.widthMil * 1_000_000) / 1_000_000,
        393.700787
    )
    assert.equal(scene.components[0].designator, 'U1')
    assert.equal(scene.detail.pads.length, 1)
    assert.equal(scene.detail.tracks.length, 1)
})

/**
 * Verifies warning and error elements appear as parser diagnostics.
 */
test('EcadParserService surfaces CircuitJSON diagnostics', () => {
    const source = new TextEncoder().encode(
        JSON.stringify([
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5
            },
            {
                type: 'pcb_trace_missing_error',
                pcb_trace_missing_error_id: 'missing_trace_1',
                error_type: 'pcb_trace_missing_error',
                message: 'Trace was not routed',
                source_trace_id: 'source_trace_1',
                pcb_component_ids: [],
                pcb_port_ids: []
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'board.json',
        source.buffer
    )

    assert.deepEqual(EcadDocumentDiagnostics.resolve(documentModel), [
        {
            severity: 'error',
            sourceFormat: 'circuitjson',
            type: 'pcb_trace_missing_error',
            category: 'connectivity',
            message: 'Trace was not routed',
            elementId: 'missing_trace_1',
            sourceTraceId: 'source_trace_1'
        }
    ])
    assert.equal(
        DocumentViewCompatibility.supportsView(documentModel, 'diagnostics'),
        true
    )
    assert.equal(
        EcadFormatRegistry.sourceFormatForDocument(documentModel),
        'circuitjson'
    )
})
