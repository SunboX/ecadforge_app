import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbDiagnosticFocusModel } from 'circuitjson-toolkit/extensions'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'

/**
 * Builds a board with source-level pin diagnostics.
 * @returns {object[]}
 */
function createDiagnosticDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 8,
            height: 4
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1',
            ftype: 'simple_chip'
        },
        {
            type: 'source_port',
            source_port_id: 'source_port_1',
            source_component_id: 'source_u1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 0 },
            width: 1.2,
            height: 0.8,
            layer: 'top'
        },
        {
            type: 'pcb_port',
            pcb_port_id: 'pcb_port_1',
            source_port_id: 'source_port_1',
            x: 1.4,
            y: 0.2
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_1',
            pcb_component_id: 'pcb_u1',
            pcb_port_id: 'pcb_port_1',
            shape: 'rect',
            x: 1.4,
            y: 0.2,
            width: 0.5,
            height: 0.3,
            layer: 'top',
            net: 'IO'
        },
        {
            type: 'source_component_pins_underspecified_warning',
            source_component_pins_underspecified_warning_id: 'pin_warning_1',
            warning_type: 'source_component_pins_underspecified_warning',
            source_component_id: 'source_u1',
            source_port_id: 'source_port_1',
            message: 'Pin definition is incomplete.'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'diagnostic-board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies source-level diagnostics attach to visible PCB primitives.
 */
test('PcbInteractionPrimitiveModel links source diagnostics to PCB geometry', () => {
    const model = PcbInteractionPrimitiveModel.build(createDiagnosticDocument())
    const diagnostic = model.diagnostics.find(
        (row) => row.id === 'pin_warning_1'
    )

    assert.deepEqual(
        {
            severity: diagnostic.severity,
            category: diagnostic.category,
            componentKey: diagnostic.componentKey,
            netName: diagnostic.netName,
            relatedPrimitiveIds: diagnostic.relatedPrimitiveIds
        },
        {
            severity: 'warning',
            category: 'pin-definition',
            componentKey: 'U1',
            netName: 'IO',
            relatedPrimitiveIds: ['pad_1']
        }
    )
})

/**
 * Verifies diagnostic focus can jump from a source warning to the board pad.
 */
test('PcbDiagnosticFocusModel focuses source diagnostic related pads', () => {
    const focus = PcbDiagnosticFocusModel.build(createDiagnosticDocument())

    assert.deepEqual(focus.get('pin_warning_1'), {
        id: 'pin_warning_1',
        point: { x: 1.4, y: 0.2 },
        bounds: { x: 1.15, y: 0.05, width: 0.5, height: 0.3 },
        relatedPrimitiveIds: ['pad_1']
    })
})
