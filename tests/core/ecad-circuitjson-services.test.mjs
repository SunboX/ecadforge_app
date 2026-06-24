import assert from 'node:assert/strict'
import test from 'node:test'
import { DocumentPreferredViewResolver } from '../../src/DocumentPreferredViewResolver.mjs'
import { DocumentViewCompatibility } from '../../src/DocumentViewCompatibility.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

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
                height: 5
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

    assert.equal(Array.isArray(documentModel), true)
    assert.equal(documentModel.sourceFormat, 'circuitjson')
    assert.equal(documentModel.kind, 'pcb')
    assert.equal(result.documents.length, 1)
    assert.equal(result.documents[0].sourceFormat, 'circuitjson')
    assert.equal(
        EcadScene3dService.build(documentModel).pcb.boardOutline.widthMil,
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
        /pcb_board center is required/
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

    assert.equal(clonedDocument.fileName, 'board.json')
    assert.equal(clonedDocument.kind, 'pcb')
    assert.equal(clonedDocument.sourceFormat, 'circuitjson')
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
                anchor_position: { x: 15, y: 5 }
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'sheet.json',
        source.buffer
    )
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(
        DocumentViewCompatibility.supportsView(documentModel, 'schematic'),
        true
    )
    assert.equal(DocumentPreferredViewResolver.resolve(documentModel), 'schematic')
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
                type: 'schematic_symbol',
                schematic_symbol_id: 'symbol_u1',
                source_component_id: 'source_u1',
                center: { x: 12, y: 10 },
                width: 8,
                height: 6
            },
            {
                type: 'schematic_port',
                schematic_port_id: 'port_in',
                name: 'IN+',
                center: { x: 5, y: 10 },
                facing_direction: 'right'
            },
            {
                type: 'schematic_group',
                schematic_group_id: 'group_analog',
                name: 'Analog',
                center: { x: 12, y: 10 },
                width: 12,
                height: 8
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
                start_angle: 0,
                end_angle: 90
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
                center: { x: 30, y: 18 },
                width: 8,
                height: 4
            },
            {
                type: 'schematic_table_cell',
                schematic_table_cell_id: 'cell_1',
                schematic_table_id: 'table_1',
                text: 'A1',
                center: { x: 28, y: 17 },
                width: 4,
                height: 2
            },
            {
                type: 'schematic_text',
                schematic_text_id: 'text_1',
                text: 'GAIN',
                anchor_position: { x: 18, y: 6 },
                font_size: 1.4,
                ccw_rotation: 15
            },
            {
                type: 'schematic_voltage_probe',
                schematic_voltage_probe_id: 'probe_vout',
                name: 'VOUT',
                center: { x: 34, y: 8 }
            },
            {
                type: 'schematic_debug_object',
                schematic_debug_object_id: 'debug_1',
                message: 'Debug bounds',
                center: { x: 18, y: 10 },
                width: 5,
                height: 3
            },
            {
                type: 'schematic_layout_error',
                schematic_layout_error_id: 'layout_1',
                error_type: 'schematic_layout_error',
                message: 'Symbol overlaps a port',
                center: { x: 10, y: 10 }
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'expanded-sheet.json',
        source.buffer
    )
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.match(markup, /class="[^"]*\bschematic-symbol\b/)
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

    assert.deepEqual(documentModel.bom, [
        {
            designators: ['R1', 'R2'],
            quantity: 2,
            value: '10k',
            pattern: 'simple_resistor',
            source: 'RC0402-10K',
            supplierPartNumber: 'DIST-10K'
        }
    ])
    assert.match(markup, /R1, <mark class="bom-table__selected-designator">R2<\/mark>/)
})

/**
 * Verifies parser metadata includes schema coverage and manufacturing outputs.
 */
test('EcadParserService exposes CircuitJSON coverage and manufacturing metadata', () => {
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
                rotation: 45
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
                layer: 'top',
                net: 'SIG'
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'metadata-board.json',
        source.buffer
    )

    assert.equal(documentModel.supportMatrix.sourceFormat, 'circuitjson')
    assert.equal(documentModel.supportMatrix.totals.presentElementTypes, 4)
    assert.equal(
        documentModel.supportMatrix.rows.find(
            (row) => row.type === 'pcb_component'
        ).capabilities.manufacturing,
        'pick-and-place'
    )
    assert.deepEqual(documentModel.manufacturing.pickAndPlaceRows, [
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
    assert.match(documentModel.manufacturing.routingDsn, /\(component U1/)
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
                    name: 'U1'
                },
                {
                    type: 'pcb_component',
                    pcb_component_id: 'pcb_u1',
                    source_component_id: 'source_u1',
                    center: { x: 1, y: 1 },
                    width: 1.2,
                    height: 0.8,
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
                    layer: 'top',
                    net: 'SIG'
                },
                {
                    type: 'pcb_trace',
                    pcb_trace_id: 'trace_1',
                    route: [
                        { x: 1, y: 0.6, layer: 'top', width: 0.18 },
                        { x: 3, y: 0.6, layer: 'top', width: 0.18 }
                    ],
                    net: 'SIG'
                }
            ])
        ).buffer
    )
    const scene = EcadScene3dService.build(documentModel)

    assert.equal(scene.sourceFormat, 'circuitjson')
    assert.equal(scene.pcb.boardOutline.widthMil, 393.700787)
    assert.equal(scene.pcb.components[0].designator, 'U1')
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
                message: 'Trace was not routed'
            }
        ])
    )
    const documentModel = EcadParserService.parseArrayBuffer(
        'board.json',
        source.buffer
    )

    assert.deepEqual(documentModel.diagnostics, [
        {
            severity: 'error',
            sourceFormat: 'circuitjson',
            type: 'pcb_trace_missing_error',
            category: 'connectivity',
            message: 'Trace was not routed',
            elementId: 'missing_trace_1'
        }
    ])
    assert.equal(
        DocumentViewCompatibility.supportsView(documentModel, 'diagnostics'),
        true
    )
})
