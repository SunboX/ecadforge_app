import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerParserData } from '../src/AppControllerParserData.mjs'
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
    const resolvedAsset = createResolvedAsset('Package_FAKE.3dshapes/U1.step')
    const state = new AppState({
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        sessionAssets: [resolvedAsset]
    })
    let renderCount = 0
    state.subscribe(() => {
        renderCount += 1
    })

    AppControllerSessionAssetHandler.handle(
        {
            documentModel,
            sessionAssets: [{ ...resolvedAsset }]
        },
        state
    )

    assert.equal(renderCount, 1)
    assert.equal(state.getSnapshot().sessionAssets.length, 1)
})

test('AppControllerParserData merges exact aliases for one physical model asset', () => {
    const relativePath = 'Package_FAKE.3dshapes/Shared_Body.step'
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        sourceUrl: 'https://models.invalid/Shared_Body.step',
        aliases: ['${MODEL_ROOT_A}/Shared_Body.wrl']
    }
    const secondAsset = {
        ...createResolvedAsset(relativePath),
        file: firstAsset.file,
        componentKey: 'U2',
        aliases: ['${MODEL_ROOT_B}/Shared_Body.wrl']
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 1)
    assert.deepEqual(mergedAssets[0].aliases, [
        '${MODEL_ROOT_A}/Shared_Body.wrl',
        '${MODEL_ROOT_B}/Shared_Body.wrl'
    ])
    assert.equal(
        mergedAssets[0].sourceUrl,
        'https://models.invalid/Shared_Body.step'
    )
    assert.equal(mergedAssets[0].componentKey, 'U2')
})

test('AppControllerParserData normalizes separators in physical asset identity', () => {
    const firstAsset = {
        ...createResolvedAsset('Package_FAKE\\Shared_Body.step'),
        aliases: ['${MODEL_ROOT_A}/Shared_Body.wrl']
    }
    const secondAsset = {
        ...createResolvedAsset('Package_FAKE/Shared_Body.step'),
        file: firstAsset.file,
        aliases: ['${MODEL_ROOT_B}/Shared_Body.wrl']
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 1)
    assert.deepEqual(mergedAssets[0].aliases, [
        '${MODEL_ROOT_A}/Shared_Body.wrl',
        '${MODEL_ROOT_B}/Shared_Body.wrl'
    ])
})

test('AppControllerParserData preserves distinct case-sensitive physical paths', () => {
    const upperPathAsset = createResolvedAsset(
        'https://models.invalid/Package_FAKE/Shared_Body.step'
    )
    const lowerPathAsset = createResolvedAsset(
        'https://models.invalid/package_fake/Shared_Body.step'
    )

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [upperPathAsset],
        [lowerPathAsset]
    )

    assert.deepEqual(
        mergedAssets.map((asset) => asset.relativePath),
        [upperPathAsset.relativePath, lowerPathAsset.relativePath]
    )
})

test('AppControllerParserData preserves conflicting same-path source assets', () => {
    const relativePath = 'download/Shared_Body.step'
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        sourceUrl: 'https://source-a.invalid/Shared_Body.step',
        aliases: ['library_a/Shared_Body.wrl']
    }
    const secondAsset = {
        ...createResolvedAsset(relativePath),
        sourceUrl: 'https://source-b.invalid/Shared_Body.step',
        aliases: ['library_b/Shared_Body.wrl']
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 2)
    assert.deepEqual(
        mergedAssets.map((asset) => ({
            sourceUrl: asset.sourceUrl,
            aliases: asset.aliases
        })),
        [
            {
                sourceUrl: 'https://source-a.invalid/Shared_Body.step',
                aliases: ['library_a/Shared_Body.wrl']
            },
            {
                sourceUrl: 'https://source-b.invalid/Shared_Body.step',
                aliases: ['library_b/Shared_Body.wrl']
            }
        ]
    )
})

test('AppControllerParserData preserves conflicting same-path payloads', () => {
    const relativePath = 'download/Shared_Body.step'
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        file: new Uint8Array([0xa1]),
        aliases: ['library_a/Shared_Body.wrl']
    }
    const secondAsset = {
        ...createResolvedAsset(relativePath),
        file: new Uint8Array([0xb2]),
        aliases: ['library_b/Shared_Body.wrl']
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 2)
    assert.deepEqual(mergedAssets[0].aliases, ['library_a/Shared_Body.wrl'])
    assert.deepEqual(mergedAssets[1].aliases, ['library_b/Shared_Body.wrl'])
    assert.deepEqual([...mergedAssets[0].file], [0xa1])
    assert.deepEqual([...mergedAssets[1].file], [0xb2])
})

test('AppControllerParserData merges equal same-path byte payloads', () => {
    const relativePath = 'download/Shared_Body.step'
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        file: new Uint8Array([0xa1, 0xb2]),
        aliases: ['library_a/Shared_Body.wrl']
    }
    const secondAsset = {
        ...createResolvedAsset(relativePath),
        file: new Uint8Array([0xa1, 0xb2]),
        aliases: ['library_b/Shared_Body.wrl']
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 1)
    assert.deepEqual(mergedAssets[0].aliases, [
        'library_a/Shared_Body.wrl',
        'library_b/Shared_Body.wrl'
    ])
})

test('AppControllerParserData compares unaligned payload words and tail bytes exactly', () => {
    const relativePath = 'download/Shared_Body.step'
    const firstBytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 0]).subarray(
        1,
        8
    )
    const matchingBytes = Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 0]).subarray(
        1,
        8
    )
    const conflictingBytes = Uint8Array.from([
        0, 1, 2, 3, 4, 5, 6, 8, 0
    ]).subarray(1, 8)
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        file: firstBytes
    }

    assert.equal(
        AppControllerParserData.mergeSessionAssets(
            [firstAsset],
            [{ ...firstAsset, file: matchingBytes }]
        ).length,
        1
    )
    assert.equal(
        AppControllerParserData.mergeSessionAssets(
            [firstAsset],
            [{ ...firstAsset, file: conflictingBytes }]
        ).length,
        2
    )
})

test('AppControllerParserData preserves conflicting payloads from one source URL', () => {
    const relativePath = 'download/Shared_Body.step'
    const sourceUrl = 'https://source.invalid/Shared_Body.step'
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        file: new Uint8Array([0xa1]),
        sourceUrl,
        aliases: ['library_a/Shared_Body.wrl']
    }
    const secondAsset = {
        ...createResolvedAsset(relativePath),
        file: new Uint8Array([0xb2]),
        sourceUrl,
        aliases: ['library_b/Shared_Body.wrl']
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 2)
    assert.deepEqual(mergedAssets[0].aliases, ['library_a/Shared_Body.wrl'])
    assert.deepEqual(mergedAssets[1].aliases, ['library_b/Shared_Body.wrl'])
    assert.deepEqual([...mergedAssets[0].file], [0xa1])
    assert.deepEqual([...mergedAssets[1].file], [0xb2])
})

test('AppControllerParserData preserves same-path assets owned by distinct documents', () => {
    const relativePath = 'download/Shared_Body.step'
    const sharedFile = new Uint8Array([1, 2, 3])
    const firstScope = Object.freeze({})
    const secondScope = Object.freeze({})
    const firstAsset = {
        ...createResolvedAsset(relativePath),
        file: sharedFile,
        sourceUrl: 'https://models.invalid/Shared_Body.step',
        aliases: ['library_a/Shared_Body.wrl'],
        documentScope: firstScope
    }
    const secondAsset = {
        ...createResolvedAsset(relativePath),
        file: sharedFile,
        sourceUrl: 'https://models.invalid/Shared_Body.step',
        aliases: ['library_b/Shared_Body.wrl'],
        documentScope: secondScope
    }

    const mergedAssets = AppControllerParserData.mergeSessionAssets(
        [firstAsset],
        [secondAsset]
    )

    assert.equal(mergedAssets.length, 2)
    assert.equal(mergedAssets[0].documentScope, firstScope)
    assert.equal(mergedAssets[1].documentScope, secondScope)
    assert.deepEqual(mergedAssets[0].aliases, ['library_a/Shared_Body.wrl'])
    assert.deepEqual(mergedAssets[1].aliases, ['library_b/Shared_Body.wrl'])
})

test('AppControllerSessionAssetHandler stores alias-only asset changes', () => {
    const documentModel = {
        kind: 'pcb',
        fileName: 'neutral-board.kicad_pcb'
    }
    const relativePath = 'Package_FAKE.3dshapes/Shared_Body.step'
    const resolvedAsset = {
        ...createResolvedAsset(relativePath),
        aliases: ['${MODEL_ROOT_A}/Shared_Body.wrl']
    }
    const state = new AppState({
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        sessionAssets: [resolvedAsset]
    })

    AppControllerSessionAssetHandler.handle(
        {
            documentModel,
            sessionAssets: [
                {
                    ...createResolvedAsset(relativePath),
                    file: resolvedAsset.file,
                    aliases: ['${MODEL_ROOT_B}/Shared_Body.wrl']
                }
            ]
        },
        state
    )

    assert.deepEqual(state.getSnapshot().sessionAssets[0].aliases, [
        '${MODEL_ROOT_A}/Shared_Body.wrl',
        '${MODEL_ROOT_B}/Shared_Body.wrl'
    ])
})
