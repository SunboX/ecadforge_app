import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerModelSearchPreferenceHandler } from '../src/AppControllerModelSearchPreferenceHandler.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Creates a minimal PCB document with one missing model reference.
 * @returns {object}
 */
function createPcbDocument() {
    return {
        kind: 'pcb',
        fileName: 'fake-board.kicad_pcb',
        pcb: {
            boardOutline: {},
            components: [
                {
                    designator: 'U1',
                    modelPath: 'Package_FAKE.3dshapes/U1.step'
                }
            ]
        }
    }
}

test('AppControllerModelSearchPreferenceHandler resolves assets when enabling missing model search', async () => {
    const documentModel = createPcbDocument()
    const state = new AppState({
        activeView: '3d',
        documents: [{ id: 'board', documentModel }],
        activeDocumentId: 'board',
        sessionAssets: []
    })
    const requests = []
    const modelSearchService = {
        /**
         * @param {object} nextDocumentModel Active document model.
         * @param {{ enabled?: boolean, sessionAssets?: object[] }} options Lookup options.
         * @returns {Promise<object[]>}
         */
        async resolveSessionAssets(nextDocumentModel, options) {
            requests.push({ documentModel: nextDocumentModel, options })
            return [
                {
                    name: 'U1.step',
                    relativePath: 'Package_FAKE.3dshapes/U1.step',
                    file: new Uint8Array([1, 2, 3]),
                    format: 'step',
                    source: 'model-search',
                    componentKey: 'U1'
                }
            ]
        }
    }

    await AppControllerModelSearchPreferenceHandler.handle(
        true,
        state,
        modelSearchService
    )

    const snapshot = state.getSnapshot()
    assert.equal(snapshot.autoSearchMissingModels, true)
    assert.equal(requests.length, 1)
    assert.equal(requests[0].documentModel, documentModel)
    assert.deepEqual(requests[0].options, {
        enabled: true,
        sessionAssets: []
    })
    assert.equal(snapshot.sessionAssets.length, 1)
    assert.equal(
        snapshot.sessionAssets[0].relativePath,
        'Package_FAKE.3dshapes/U1.step'
    )
    assert.equal(snapshot.sessionAssets[0].source, 'model-search')
    assert.equal(snapshot.sessionAssets[0].componentKey, 'U1')
})
