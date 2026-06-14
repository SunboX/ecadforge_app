import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewGerberRenderSelectionStore } from '../../src/ui/AppViewGerberRenderSelectionStore.mjs'

/**
 * Builds a snapshot with two selectable fabrication files.
 * @returns {object}
 */
function createSnapshot() {
    const documentModel = {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication.zip',
        pcb: {
            fabrication: {
                layers: [
                    { id: 'top-copper', fileName: 'top.gtl' },
                    { id: 'bottom-copper', fileName: 'bottom.gbl' }
                ]
            }
        }
    }

    return {
        activeDocumentId: 'doc-1',
        documentModel,
        documents: [{ id: 'doc-1', documentModel }]
    }
}

/**
 * Verifies Gerber source file clicks toggle into an ordered render subset.
 */
test('AppViewGerberRenderSelectionStore toggles multiple Gerber files', () => {
    const store = new AppViewGerberRenderSelectionStore()
    const snapshot = createSnapshot()

    const first = store.apply(
        {
            documentId: 'doc-1',
            renderMode: 'separated',
            layerId: 'top-copper'
        },
        snapshot
    )
    const second = store.apply(
        {
            documentId: 'doc-1',
            renderMode: 'separated',
            layerId: 'bottom-copper'
        },
        snapshot
    )
    const third = store.apply(
        {
            documentId: 'doc-1',
            renderMode: 'separated',
            layerId: 'top-copper'
        },
        snapshot
    )

    assert.deepEqual(first?.selection.layerIds, ['top-copper'])
    assert.deepEqual(second?.selection.layerIds, [
        'top-copper',
        'bottom-copper'
    ])
    assert.deepEqual(third?.selection.layerIds, ['bottom-copper'])
    assert.deepEqual(store.snapshotValue(), {
        'doc-1': {
            renderMode: 'separated',
            layerId: 'bottom-copper',
            layerIds: ['bottom-copper']
        }
    })
})

/**
 * Verifies the composite row resets a custom file subset.
 */
test('AppViewGerberRenderSelectionStore resets to composite', () => {
    const store = new AppViewGerberRenderSelectionStore()
    const snapshot = createSnapshot()

    store.apply(
        {
            documentId: 'doc-1',
            renderMode: 'separated',
            layerId: 'top-copper'
        },
        snapshot
    )
    const result = store.apply(
        { documentId: 'doc-1', renderMode: 'composite' },
        snapshot
    )

    assert.deepEqual(result?.selection, {
        renderMode: 'composite',
        layerId: '',
        layerIds: []
    })
})
