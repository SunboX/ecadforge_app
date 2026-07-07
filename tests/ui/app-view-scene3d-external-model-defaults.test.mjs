import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewScene3dShellRenderer } from '../../src/ui/AppViewScene3dShellRenderer.mjs'

/**
 * Creates a minimal 3D-capable PCB document model.
 * @param {string} sourceFormat Source format.
 * @returns {object}
 */
function createPcbDocument(sourceFormat) {
    return {
        sourceFormat,
        kind: 'pcb',
        pcb: {
            boardOutline: {
                widthMil: 1000,
                heightMil: 800
            },
            components: []
        },
        bom: []
    }
}

/**
 * Verifies Altium 3D scenes start from the board-detail view while keeping
 * external component models available as an explicit user option.
 */
test('AppViewScene3dShellRenderer hides Altium external models initially', () => {
    const markup = AppViewScene3dShellRenderer.render(
        createPcbDocument('altium'),
        (key) => key
    )

    assert.match(
        markup,
        /<input type="checkbox" data-scene-3d-toggle="external-models" \/>External models/
    )
})

/**
 * Verifies non-Altium native scenes keep the existing component-model default.
 */
test('AppViewScene3dShellRenderer keeps KiCad external models initially visible', () => {
    const markup = AppViewScene3dShellRenderer.render(
        createPcbDocument('kicad'),
        (key) => key
    )

    assert.match(
        markup,
        /<input type="checkbox" checked data-scene-3d-toggle="external-models" \/>External models/
    )
})
