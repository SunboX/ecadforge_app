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

    /** @type {((change: { documentId: string, componentKey: string }) => void) | null} */
    #componentSelectionCallback

    /** @type {((change: { documentId: string, preset: string }) => void) | null} */
    #layerPresetCallback

    constructor() {
        this.#fileSelectionCallback = null
        this.#sidebarTabSelectionCallback = null
        this.#layerVisibilityCallback = null
        this.#objectOpacityCallback = null
        this.#componentSelectionCallback = null
        this.#layerPresetCallback = null
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
     * @param {(change: { documentId: string, componentKey: string }) => void} callback
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
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return false
    }

    /**
     * @param {string} _status
     * @returns {void}
     */
    setStatus(_status) {}

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
     * @param {{ documentId: string, componentKey: string }} change
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
