import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerSessionAssetHandler } from '../src/AppControllerSessionAssetHandler.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Creates a fake model asset for session asset state tests.
 * @param {string} relativePath Asset path.
 * @param {number} size Byte size.
 * @returns {{ name: string, relativePath: string, file: Blob | Uint8Array, format: string, source: string, componentKey: string }}
 */
function createResolvedAsset(relativePath, size = 3) {
    return {
        name: relativePath.split('/').pop() || 'model.step',
        relativePath,
        file:
            typeof Blob === 'function'
                ? new Blob([new Uint8Array(size)])
                : new Uint8Array(size),
        format: 'step',
        source: 'model-search',
        componentKey: 'U1'
    }
}

test('AppControllerSessionAssetHandler ignores equivalent resolved assets', () => {
    const documentModel = {
        kind: 'pcb',
        fileName: 'fake-board.kicad_pcb'
    }
    const state = new AppState({
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        sessionAssets: [
            createResolvedAsset('Package_FAKE.3dshapes/U1.step')
        ]
    })
    let renderCount = 0
    state.subscribe(() => {
        renderCount += 1
    })

    AppControllerSessionAssetHandler.handle(
        {
            documentModel,
            sessionAssets: [
                createResolvedAsset('Package_FAKE.3dshapes/U1.step')
            ]
        },
        state
    )

    assert.equal(renderCount, 1)
    assert.equal(state.getSnapshot().sessionAssets.length, 1)
})
