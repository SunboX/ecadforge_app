import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for sidebar controller tests.
 */
class FakeView {
    /** @type {((files: File[]) => void | Promise<void>) | null} */
    #fileSelectionCallback

    /** @type {((tabName: string) => void) | null} */
    #sidebarTabSelectionCallback

    /** @type {((change: { documentId: string, layerKey: string, visible: boolean }) => void) | null} */
    #layerVisibilityCallback

    /** @type {((change: { documentId: string, objectKey: string, opacity: number }) => void) | null} */
    #objectOpacityCallback

    /** @type {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} */
    #componentSelectionCallback

    /** @type {((change: { documentId: string, preset: string }) => void) | null} */
    #layerPresetCallback

    /** @type {((change: { documentId: string, componentKey: string, format: string }) => void | Promise<void>) | null} */
    #selectedPartExportCallback

    /** @type {((change: { documentId: string, format: string }) => void | Promise<void>) | null} */
    #pcbAssemblyExportCallback

    /** @type {{ fileName: string, bytes: Uint8Array, contentType?: string }[]} */
    downloadedArchives

    /** @type {string[]} */
    statuses

    /** @type {object[]} */
    exportProgressEvents

    constructor() {
        this.#fileSelectionCallback = null
        this.#sidebarTabSelectionCallback = null
        this.#layerVisibilityCallback = null
        this.#objectOpacityCallback = null
        this.#componentSelectionCallback = null
        this.#layerPresetCallback = null
        this.#selectedPartExportCallback = null
        this.#pcbAssemblyExportCallback = null
        this.downloadedArchives = []
        this.statuses = []
        this.exportProgressEvents = []
    }

    /**
     * @param {(files: File[]) => void | Promise<void>} callback
     * @returns {void}
     */
    bindFileSelection(callback) {
        this.#fileSelectionCallback = callback
    }

    /**
     * @param {(files: File[]) => void | Promise<void>} _callback
     * @returns {void}
     */
    bindDrop(_callback) {}

    /**
     * @param {(viewName: string) => void} _callback
     * @returns {void}
     */
    bindViewChange(_callback) {}

    /**
     * @param {(tabName: string) => void} callback
     * @returns {void}
     */
    bindSidebarTabSelection(callback) {
        this.#sidebarTabSelectionCallback = callback
    }

    /**
     * @param {(change: { documentId: string, layerKey: string, visible: boolean }) => void} callback
     * @returns {void}
     */
    bindPcbLayerVisibilityChange(callback) {
        this.#layerVisibilityCallback = callback
    }

    /**
     * @param {(change: { documentId: string, objectKey: string, opacity: number }) => void} callback
     * @returns {void}
     */
    bindPcbObjectOpacityChange(callback) {
        this.#objectOpacityCallback = callback
    }

    /**
     * @param {(change: { documentId: string, componentKey: string, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbComponentSelectionChange(callback) {
        this.#componentSelectionCallback = callback
    }

    /**
     * @param {(change: { documentId: string, preset: string }) => void} callback
     * @returns {void}
     */
    bindPcbLayerPresetSelection(callback) {
        this.#layerPresetCallback = callback
    }

    /**
     * @param {(change: { documentId: string, componentKey: string, format: string }) => void | Promise<void>} callback
     * @returns {void}
     */
    bindSelectedPartExport(callback) {
        this.#selectedPartExportCallback = callback
    }

    /**
     * @param {(change: { documentId: string, format: string }) => void | Promise<void>} callback
     * @returns {void}
     */
    bindPcbAssemblyExport(callback) {
        this.#pcbAssemblyExportCallback = callback
    }

    /**
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return false
    }

    /**
     * @param {string} _status
     * @returns {void}
     */
    setStatus(status) {
        this.statuses.push(status)
    }

    /**
     * @param {string} fileName Downloaded file name.
     * @param {Uint8Array} bytes Download bytes.
     * @param {string} [contentType] Content type.
     * @returns {void}
     */
    downloadBytes(fileName, bytes, contentType) {
        this.downloadedArchives.push({ fileName, bytes, contentType })
    }

    /**
     * @param {object} progress Initial export progress.
     * @returns {void}
     */
    showExportProgress(progress) {
        this.exportProgressEvents.push({ type: 'show', ...progress })
    }

    /**
     * @param {object} progress Updated export progress.
     * @returns {void}
     */
    updateExportProgress(progress) {
        this.exportProgressEvents.push({ type: 'update', ...progress })
    }

    /**
     * @returns {void}
     */
    hideExportProgress() {
        this.exportProgressEvents.push({ type: 'hide' })
    }

    /**
     * @param {any} _snapshot
     * @returns {void}
     */
    render(_snapshot) {}

    /**
     * @param {File[]} files
     * @returns {Promise<void>}
     */
    async chooseFiles(files) {
        await this.#fileSelectionCallback?.(files)
    }

    /**
     * @param {string} tabName
     * @returns {void}
     */
    selectSidebarTab(tabName) {
        this.#sidebarTabSelectionCallback?.(tabName)
    }

    /**
     * @param {{ documentId: string, layerKey: string, visible: boolean }} change
     * @returns {void}
     */
    toggleLayer(change) {
        this.#layerVisibilityCallback?.(change)
    }

    /**
     * @param {{ documentId: string, objectKey: string, opacity: number, preview?: boolean }} change
     * @returns {void}
     */
    setObjectOpacity(change) {
        this.#objectOpacityCallback?.(change)
    }

    /**
     * @param {{ documentId: string, componentKey: string, source?: string }} change
     * @returns {void}
     */
    selectComponent(change) {
        this.#componentSelectionCallback?.(change)
    }

    /**
     * @param {{ documentId: string, preset: string }} change
     * @returns {void}
     */
    selectLayerPreset(change) {
        this.#layerPresetCallback?.(change)
    }

    /**
     * @param {{ documentId: string, componentKey: string, format: string }} change
     * @returns {Promise<void>}
     */
    async exportSelectedPart(change) {
        await this.#selectedPartExportCallback?.(change)
    }

    /**
     * @param {{ documentId: string, format: string }} change
     * @returns {Promise<void>}
     */
    async exportPcbAssembly(change) {
        await this.#pcbAssemblyExportCallback?.(change)
    }
}

/**
 * Minimal file fake.
 */
class FakeFile {
    /** @type {string} */
    name

    /**
     * @param {string} name
     */
    constructor(name) {
        this.name = name
    }

    /**
     * @returns {Promise<ArrayBuffer>}
     */
    async arrayBuffer() {
        return new ArrayBuffer(8)
    }
}

/**
 * Minimal parser fake.
 */
class FakeParser {
    /**
     * @param {string} fileName
     * @param {ArrayBuffer} _buffer
     * @returns {object}
     */
    parseArrayBuffer(fileName, _buffer) {
        if (fileName.endsWith('.PcbDoc')) {
            return {
                fileName,
                kind: 'pcb',
                diagnostics: [],
                summary: { title: fileName },
                pcb: {
                    boardOutline: { widthMil: 100, heightMil: 100 },
                    layers: [
                        { name: 'Top Layer', layerId: 1 },
                        { name: 'Bottom Layer', layerId: 32 },
                        { name: 'Top Overlay', layerId: 33 }
                    ],
                    components: [],
                    tracks: [],
                    vias: []
                },
                bom: []
            }
        }

        return {
            fileName,
            kind: 'schematic',
            diagnostics: [],
            summary: { title: fileName },
            schematic: {
                sheet: { width: 200, height: 100 },
                components: [],
                pins: [],
                ports: []
            },
            bom: []
        }
    }
}

/**
 * Verifies sidebar tab selection is stored in central app state.
 */
test('AppController updates active sidebar tab from the view binding', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.SchDoc')])
    view.selectSidebarTab('layers')

    assert.equal(state.getSnapshot().activeSidebarTab, 'layers')
})

/**
 * Verifies controller layer visibility events update central hidden-layer state.
 */
test('AppController updates hidden PCB layers from sidebar controls', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.toggleLayer({
        documentId,
        layerKey: 'Top Layer',
        visible: false
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {
        [documentId]: ['Top Layer']
    })

    view.toggleLayer({
        documentId,
        layerKey: 'Top Layer',
        visible: true
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {})
})

/**
 * Verifies controller object opacity events update central state.
 */
test('AppController updates PCB object opacity from sidebar controls', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.setObjectOpacity({
        documentId,
        objectKey: 'tracks',
        opacity: 35
    })

    assert.deepEqual(state.getSnapshot().pcbObjectOpacities, {
        [documentId]: {
            tracks: 35
        }
    })

    view.setObjectOpacity({
        documentId,
        objectKey: 'tracks',
        opacity: 100
    })

    assert.deepEqual(state.getSnapshot().pcbObjectOpacities, {
        [documentId]: {
            tracks: 100
        }
    })
})

/**
 * Verifies live object opacity previews do not commit central state.
 */
test('AppController previews PCB object opacity without storing it', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.setObjectOpacity({
        documentId,
        objectKey: 'tracks',
        opacity: 35,
        preview: true
    })

    assert.deepEqual(state.getSnapshot().pcbObjectOpacities, {})
})

/**
 * Verifies controller component selections update central state.
 */
test('AppController updates selected PCB component from sidebar controls', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.selectComponent({
        documentId,
        componentKey: 'U1'
    })

    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {
        [documentId]: 'U1'
    })

    view.selectComponent({
        documentId,
        componentKey: 'U1'
    })

    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {})
})

/**
 * Verifies PCB-originated component selections open the footprints panel.
 */
test('AppController opens footprints for PCB component selections', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.selectSidebarTab('layers')
    view.selectComponent({
        documentId,
        componentKey: 'U1',
        source: 'pcb-board'
    })

    assert.equal(state.getSnapshot().activeSidebarTab, 'components')
    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {
        [documentId]: 'U1'
    })
})

/**
 * Verifies 3D-originated component selections open the 3D model parameters tab.
 */
test('AppController opens 3D model parameters for 3D scene selections', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.selectSidebarTab('layers')
    view.selectComponent({
        documentId,
        componentKey: 'U1',
        source: '3d-scene'
    })

    assert.equal(state.getSnapshot().activeSidebarTab, 'model3d')
    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {
        [documentId]: 'U1'
    })
})

/**
 * Verifies selected-part export requests are resolved and downloaded.
 */
test('AppController exports the selected part from sidebar controls', async () => {
    const state = new AppState()
    const view = new FakeView()
    const exportRequests = []
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser(),
        selectedPartExportService: {
            async export(options) {
                exportRequests.push(options)
                return {
                    archiveName: 'U1-kicad-part.zip',
                    archiveBytes: new Uint8Array([1, 2, 3])
                }
            }
        }
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId
    state.setValue('sessionAssets', [
        {
            name: 'body.step',
            relativePath: 'parts/body.step',
            file: new Uint8Array([1]),
            format: 'step'
        }
    ])

    await view.exportSelectedPart({
        documentId,
        componentKey: 'U1',
        format: 'kicad'
    })

    assert.equal(exportRequests.length, 1)
    assert.equal(exportRequests[0].format, 'kicad')
    assert.equal(exportRequests[0].documentId, documentId)
    assert.equal(exportRequests[0].selectedComponentKey, 'U1')
    assert.equal(exportRequests[0].documentModel.fileName, 'alpha.PcbDoc')
    assert.equal(
        exportRequests[0].sessionAssets[0].relativePath,
        'parts/body.step'
    )
    assert.deepEqual(view.downloadedArchives, [
        {
            fileName: 'U1-kicad-part.zip',
            bytes: new Uint8Array([1, 2, 3]),
            contentType: 'application/zip'
        }
    ])
    assert.match(view.statuses.at(-1), /Exported U1-kicad-part\.zip/)
})

/**
 * Verifies whole-PCB assembly export requests are resolved and downloaded.
 */
test('AppController exports the active PCB assembly from sidebar controls', async () => {
    const state = new AppState()
    const view = new FakeView()
    const exportRequests = []
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser(),
        pcbAssemblyExportService: {
            async export(options) {
                exportRequests.push(options)
                options.onProgress?.({
                    value: 63,
                    message: 'Writing STEP assembly'
                })
                return {
                    fileName: 'alpha-assembly.step',
                    bytes: new Uint8Array([4, 5, 6]),
                    contentType: 'model/step',
                    diagnostics: [
                        {
                            severity: 'warning',
                            code: 'component_model_missing',
                            message: 'No model.'
                        }
                    ]
                }
            }
        }
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId
    state.setValue('sessionAssets', [
        {
            name: 'body.wrl',
            relativePath: 'parts/body.wrl',
            file: new Uint8Array([1]),
            format: 'wrl'
        }
    ])

    await view.exportPcbAssembly({
        documentId,
        format: 'step'
    })

    assert.equal(exportRequests.length, 1)
    assert.equal(exportRequests[0].format, 'step')
    assert.equal(exportRequests[0].documentId, documentId)
    assert.equal(exportRequests[0].documentModel.fileName, 'alpha.PcbDoc')
    assert.equal(typeof exportRequests[0].onProgress, 'function')
    assert.equal(
        exportRequests[0].sessionAssets[0].relativePath,
        'parts/body.wrl'
    )
    assert.deepEqual(view.downloadedArchives.at(-1), {
        fileName: 'alpha-assembly.step',
        bytes: new Uint8Array([4, 5, 6]),
        contentType: 'model/step'
    })
    assert.match(
        view.statuses.at(-1),
        /Exported alpha-assembly\.step with 1 warning/
    )
    assert.deepEqual(view.exportProgressEvents, [
        {
            type: 'show',
            value: 0,
            message: 'Preparing PCB assembly export',
            title: 'Exporting PCB assembly'
        },
        {
            type: 'update',
            value: 63,
            message: 'Writing STEP assembly'
        },
        { type: 'hide' }
    ])
})

/**
 * Verifies selected-part exports can use auto-discovered model assets.
 */
test('AppController resolves missing model assets before selected part export', async () => {
    const state = new AppState({ autoSearchMissingModels: true })
    const view = new FakeView()
    const searchRequests = []
    const exportRequests = []
    const searchedAsset = {
        name: '10103594.stp',
        relativePath: '10103594.stp',
        file: new Uint8Array([5, 6, 7]),
        format: 'step'
    }
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser(),
        modelSearchService: {
            async resolveSessionAssets(documentModel, options) {
                searchRequests.push({ documentModel, options })
                return [...options.sessionAssets, searchedAsset]
            }
        },
        selectedPartExportService: {
            async export(options) {
                exportRequests.push(options)
                return {
                    archiveName: 'USB-kicad-part.zip',
                    archiveBytes: new Uint8Array([1, 2, 3])
                }
            }
        }
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    await view.exportSelectedPart({
        documentId,
        componentKey: 'U1',
        format: 'kicad'
    })

    assert.equal(searchRequests.length, 1)
    assert.equal(searchRequests[0].documentModel.fileName, 'alpha.PcbDoc')
    assert.equal(searchRequests[0].options.enabled, true)
    assert.deepEqual(searchRequests[0].options.sessionAssets, [])
    assert.equal(exportRequests.length, 1)
    assert.equal(
        exportRequests[0].sessionAssets.at(-1).relativePath,
        '10103594.stp'
    )
    assert.equal(
        state.getSnapshot().sessionAssets.at(-1).relativePath,
        '10103594.stp'
    )
})

/**
 * Verifies schematic-originated component selections open the symbols panel.
 */
test('AppController opens symbols for schematic component selections', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.SchDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.selectSidebarTab('layers')
    view.selectComponent({
        documentId,
        componentKey: 'U1',
        source: 'schematic'
    })

    assert.equal(state.getSnapshot().activeSidebarTab, 'components')
    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {
        [documentId]: 'U1'
    })
})

/**
 * Verifies layer presets derive hidden layers from the active PCB document.
 */
test('AppController applies PCB layer visibility presets', async () => {
    const state = new AppState()
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: new FakeParser()
    })

    await controller.init()
    await view.chooseFiles([new FakeFile('alpha.PcbDoc')])
    const documentId = state.getSnapshot().activeDocumentId

    view.selectLayerPreset({
        documentId,
        preset: 'front'
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {
        [documentId]: ['Bottom Layer']
    })
})
