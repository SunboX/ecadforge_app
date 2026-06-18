import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewComponentSelectionScrollGuard } from '../../src/ui/AppViewComponentSelectionScrollGuard.mjs'

/**
 * Creates a snapshot with a selected PCB component.
 * @param {string} componentKey Selected component key.
 * @param {string} [documentId] Active document id.
 * @returns {{ activeDocumentId: string, selectedPcbComponents: { [documentId: string]: string } }}
 */
function createSnapshot(componentKey, documentId = 'doc-1') {
    return {
        activeDocumentId: documentId,
        selectedPcbComponents: { [documentId]: componentKey }
    }
}

/**
 * Verifies sidebar-origin component selections suppress auto-scroll across
 * delayed re-renders until a rendered view emits a selection.
 */
test('AppViewComponentSelectionScrollGuard keeps sidebar-origin selections stable', () => {
    const guard = new AppViewComponentSelectionScrollGuard()
    const received = []
    const change = { documentId: 'doc-1', componentKey: 'C128' }

    guard.runSidebarSelection(change, (selection) => {
        received.push(selection)
        assert.equal(guard.shouldSuppress(createSnapshot('C128')), true)
    })

    assert.deepEqual(received, [change])
    assert.equal(guard.shouldSuppress(createSnapshot('C128')), true)
    assert.equal(guard.shouldSuppress(createSnapshot('C129')), false)
    assert.equal(guard.shouldSuppress(createSnapshot('C128', 'doc-2')), false)

    guard.clearSidebarSelection()

    assert.equal(guard.shouldSuppress(createSnapshot('C128')), false)
})
