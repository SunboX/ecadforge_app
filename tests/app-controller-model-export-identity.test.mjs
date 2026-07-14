import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerPcbAssemblyExport } from '../src/AppControllerPcbAssemblyExport.mjs'
import { AppControllerSelectedPartExport } from '../src/AppControllerSelectedPartExport.mjs'

/**
 * Creates a disabled-search export state with one foreign scoped asset.
 * @returns {{ documentModel: object, foreignAsset: object, snapshot: object, stateValues: Map<string, any>, state: object }}
 */
function createDisabledSearchState() {
    const documentModel = { kind: 'pcb' }
    const foreignAsset = {
        name: 'foreign.step',
        relativePath: 'models/foreign.step',
        file: new Uint8Array([1]),
        documentScope: { id: 'document-a' }
    }
    const snapshot = {
        activeDocumentId: 'document-b',
        documentModel,
        documents: [{ id: 'document-b', documentModel }],
        selectedPcbComponents: { 'document-b': 'U1' },
        autoSearchMissingModels: false,
        sessionAssets: [foreignAsset]
    }
    const stateValues = new Map()

    return {
        documentModel,
        foreignAsset,
        snapshot,
        stateValues,
        state: {
            getSnapshot: () => snapshot,
            setValue: (key, value) => stateValues.set(key, value)
        }
    }
}

test('selected part export filters scoped assets while model search is disabled', async () => {
    const context = createDisabledSearchState()
    const concurrentAsset = {
        name: 'concurrent.step',
        relativePath: 'models/concurrent.step',
        file: new Uint8Array([3])
    }
    const resolverCalls = []
    const exportRequests = []

    await AppControllerSelectedPartExport.handle({
        change: {
            documentId: 'document-b',
            componentKey: 'U1',
            format: 'kicad'
        },
        state: context.state,
        view: {},
        modelSearchService: {
            async resolveSessionAssets(documentModel, options) {
                resolverCalls.push({ documentModel, options })
                context.snapshot.sessionAssets = [
                    context.foreignAsset,
                    concurrentAsset
                ]
                return []
            }
        },
        selectedPartExportService: {
            async export(options) {
                exportRequests.push(options)
                return {
                    archiveName: 'part.zip',
                    archiveBytes: new Uint8Array()
                }
            }
        }
    })

    assert.equal(resolverCalls.length, 1)
    assert.equal(resolverCalls[0].documentModel, context.documentModel)
    assert.equal(resolverCalls[0].options.enabled, false)
    assert.deepEqual(resolverCalls[0].options.sessionAssets, [
        context.foreignAsset
    ])
    assert.deepEqual(exportRequests[0].sessionAssets, [])
    assert.equal(context.stateValues.has('sessionAssets'), false)
    assert.deepEqual(context.snapshot.sessionAssets, [
        context.foreignAsset,
        concurrentAsset
    ])
})

test('PCB assembly export filters scoped assets while model search is disabled', async () => {
    const context = createDisabledSearchState()
    const concurrentAsset = {
        name: 'concurrent.step',
        relativePath: 'models/concurrent.step',
        file: new Uint8Array([3])
    }
    const resolverCalls = []
    const exportRequests = []

    await AppControllerPcbAssemblyExport.handle({
        change: { documentId: 'document-b', format: 'step' },
        state: context.state,
        view: {},
        modelSearchService: {
            async resolveSessionAssets(documentModel, options) {
                resolverCalls.push({ documentModel, options })
                context.snapshot.sessionAssets = [
                    context.foreignAsset,
                    concurrentAsset
                ]
                return []
            }
        },
        pcbAssemblyExportService: {
            async export(options) {
                exportRequests.push(options)
                return {
                    fileName: 'assembly.step',
                    bytes: new Uint8Array(),
                    contentType: 'model/step'
                }
            }
        }
    })

    assert.equal(resolverCalls.length, 1)
    assert.equal(resolverCalls[0].documentModel, context.documentModel)
    assert.equal(resolverCalls[0].options.enabled, false)
    assert.deepEqual(resolverCalls[0].options.sessionAssets, [
        context.foreignAsset
    ])
    assert.deepEqual(exportRequests[0].sessionAssets, [])
    assert.equal(context.stateValues.has('sessionAssets'), false)
    assert.deepEqual(context.snapshot.sessionAssets, [
        context.foreignAsset,
        concurrentAsset
    ])
})

test('selected part export excludes foreign scoped assets while search is enabled', async () => {
    const context = createDisabledSearchState()
    const currentAsset = {
        name: 'current.step',
        relativePath: 'models/current.step',
        file: new Uint8Array([2]),
        documentScope: context.documentModel
    }
    const concurrentAsset = {
        name: 'concurrent.step',
        relativePath: 'models/concurrent.step',
        file: new Uint8Array([3])
    }
    const exportRequests = []
    context.snapshot.autoSearchMissingModels = true

    await AppControllerSelectedPartExport.handle({
        change: {
            documentId: 'document-b',
            componentKey: 'U1',
            format: 'kicad'
        },
        state: context.state,
        view: {},
        modelSearchService: {
            async resolveSessionAssets() {
                context.snapshot.sessionAssets = [
                    context.foreignAsset,
                    concurrentAsset
                ]
                return [currentAsset]
            }
        },
        selectedPartExportService: {
            async export(options) {
                exportRequests.push(options)
                return {
                    archiveName: 'part.zip',
                    archiveBytes: new Uint8Array()
                }
            }
        }
    })

    assert.deepEqual(exportRequests[0].sessionAssets, [currentAsset])
    assert.deepEqual(context.stateValues.get('sessionAssets'), [
        context.foreignAsset,
        concurrentAsset,
        currentAsset
    ])
})

test('PCB assembly export excludes foreign scoped assets while search is enabled', async () => {
    const context = createDisabledSearchState()
    const currentAsset = {
        name: 'current.step',
        relativePath: 'models/current.step',
        file: new Uint8Array([2]),
        documentScope: context.documentModel
    }
    const concurrentAsset = {
        name: 'concurrent.step',
        relativePath: 'models/concurrent.step',
        file: new Uint8Array([3])
    }
    const exportRequests = []
    context.snapshot.autoSearchMissingModels = true

    await AppControllerPcbAssemblyExport.handle({
        change: { documentId: 'document-b', format: 'step' },
        state: context.state,
        view: {},
        modelSearchService: {
            async resolveSessionAssets() {
                context.snapshot.sessionAssets = [
                    context.foreignAsset,
                    concurrentAsset
                ]
                return [currentAsset]
            }
        },
        pcbAssemblyExportService: {
            async export(options) {
                exportRequests.push(options)
                return {
                    fileName: 'assembly.step',
                    bytes: new Uint8Array(),
                    contentType: 'model/step'
                }
            }
        }
    })

    assert.deepEqual(exportRequests[0].sessionAssets, [currentAsset])
    assert.deepEqual(context.stateValues.get('sessionAssets'), [
        context.foreignAsset,
        concurrentAsset,
        currentAsset
    ])
})

test('model exports persist same-file alias enrichment', async () => {
    for (const exportType of ['selected-part', 'pcb-assembly']) {
        const context = createDisabledSearchState()
        const file = new Uint8Array([4])
        const asset = {
            name: 'shared.step',
            relativePath: 'models/shared.step',
            file,
            format: 'step'
        }
        const enrichedAsset = {
            ...asset,
            aliases: ['models/authored.wrl']
        }
        context.snapshot.autoSearchMissingModels = true
        context.snapshot.sessionAssets = [asset]
        const commonOptions = {
            state: context.state,
            view: {},
            modelSearchService: {
                async resolveSessionAssets() {
                    return [enrichedAsset]
                }
            }
        }

        if (exportType === 'selected-part') {
            await AppControllerSelectedPartExport.handle({
                ...commonOptions,
                change: {
                    documentId: 'document-b',
                    componentKey: 'U1',
                    format: 'kicad'
                },
                selectedPartExportService: {
                    async export() {
                        return {
                            archiveName: 'part.zip',
                            archiveBytes: new Uint8Array()
                        }
                    }
                }
            })
        } else {
            await AppControllerPcbAssemblyExport.handle({
                ...commonOptions,
                change: { documentId: 'document-b', format: 'step' },
                pcbAssemblyExportService: {
                    async export() {
                        return {
                            fileName: 'assembly.step',
                            bytes: new Uint8Array(),
                            contentType: 'model/step'
                        }
                    }
                }
            })
        }

        assert.deepEqual(
            context.stateValues.get('sessionAssets'),
            [enrichedAsset],
            exportType
        )
    }
})

test('model exports do not persist assets after the document closes', async () => {
    for (const exportType of ['selected-part', 'pcb-assembly']) {
        const context = createDisabledSearchState()
        const staleAsset = {
            name: 'stale.step',
            relativePath: 'models/stale.step',
            file: new Uint8Array([5]),
            documentScope: context.documentModel
        }
        context.snapshot.autoSearchMissingModels = true
        const commonOptions = {
            state: context.state,
            view: {},
            modelSearchService: {
                async resolveSessionAssets() {
                    context.snapshot.documents = []
                    context.snapshot.documentModel = null
                    context.snapshot.sessionAssets = []
                    return [staleAsset]
                }
            }
        }

        if (exportType === 'selected-part') {
            await AppControllerSelectedPartExport.handle({
                ...commonOptions,
                change: {
                    documentId: 'document-b',
                    componentKey: 'U1',
                    format: 'kicad'
                },
                selectedPartExportService: {
                    async export() {
                        return {
                            archiveName: 'part.zip',
                            archiveBytes: new Uint8Array()
                        }
                    }
                }
            })
        } else {
            await AppControllerPcbAssemblyExport.handle({
                ...commonOptions,
                change: { documentId: 'document-b', format: 'step' },
                pcbAssemblyExportService: {
                    async export() {
                        return {
                            fileName: 'assembly.step',
                            bytes: new Uint8Array(),
                            contentType: 'model/step'
                        }
                    }
                }
            })
        }

        assert.equal(
            context.stateValues.has('sessionAssets'),
            false,
            exportType
        )
    }
})
