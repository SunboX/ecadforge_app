import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbComponentSelectionModel } from '../../src/core/PcbComponentSelectionModel.mjs'

/**
 * Verifies package names do not override explicit board-side metadata.
 */
test('PcbComponentSelectionModel resolves component side from layer metadata', () => {
    assert.equal(
        PcbComponentSelectionModel.resolveComponentSide({
            designator: 'J1',
            layer: 'TOP',
            pattern: 'USB_Micro-B_A'
        }),
        'top'
    )
    assert.equal(
        PcbComponentSelectionModel.resolveComponentSide({
            designator: 'J2',
            layer: 'BOTTOM',
            footprint: 'Connector_USB:USB_Micro-B_A'
        }),
        'bottom'
    )
    assert.equal(
        PcbComponentSelectionModel.resolveComponentSide({
            designator: 'J3',
            pattern: 'USB_Micro-B_A'
        }),
        ''
    )
})
