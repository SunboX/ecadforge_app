import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbDiagnosticFocusModel } from 'circuitjson-toolkit/extensions'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'

/**
 * Builds a compact board with a diagnostic that references plural IDs.
 * @returns {object[]}
 */
function createPluralDiagnosticDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_a',
            shape: 'rect',
            x: -1,
            y: 0,
            width: 0.6,
            height: 0.4,
            layer: 'top',
            net: 'A'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_b',
            shape: 'rect',
            x: 1,
            y: 0,
            width: 0.8,
            height: 0.4,
            layer: 'top',
            net: 'B'
        },
        {
            type: 'pcb_pad_pad_clearance_error',
            pcb_pad_pad_clearance_error_id: 'pad_gap_error',
            pcb_smtpad_ids: ['pad_a', 'pad_b'],
            error_type: 'pcb_pad_pad_clearance',
            message: 'Pad clearance is below the configured rule.'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'plural-diagnostics.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies plural diagnostic relation arrays focus the related PCB geometry.
 */
test('PcbInteractionPrimitiveModel resolves plural diagnostic relations', () => {
    const documentModel = createPluralDiagnosticDocument()
    const model = PcbInteractionPrimitiveModel.build(documentModel)
    const diagnostic = model.diagnostics.find(
        (row) => row.id === 'pad_gap_error'
    )
    const focus =
        PcbDiagnosticFocusModel.build(documentModel).get('pad_gap_error')

    assert.deepEqual(diagnostic.relatedPrimitiveIds, ['pad_a', 'pad_b'])
    assert.deepEqual(diagnostic.bounds, {
        minX: -1.3,
        minY: -0.2,
        maxX: 1.4,
        maxY: 0.2,
        width: 2.7,
        height: 0.4
    })
    assert.deepEqual(
        {
            x: Number(diagnostic.point.x.toFixed(6)),
            y: Number(diagnostic.point.y.toFixed(6))
        },
        { x: 0.05, y: 0 }
    )
    assert.deepEqual(focus, {
        id: 'pad_gap_error',
        point: { x: 0.05, y: 0 },
        bounds: { x: -1.3, y: -0.2, width: 2.7, height: 0.4 },
        relatedPrimitiveIds: ['pad_a', 'pad_b']
    })
})
