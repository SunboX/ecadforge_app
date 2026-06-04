import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for cross-view component selection tests.
 */
class FakeView {
    /** @type {((viewName: string) => void) | null} */
    #viewChangeCallback
    /** @type {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} */
    #componentSelectionCallback

    constructor() {
        this.#viewChangeCallback = null
        this.#componentSelectionCallback = null
    }

    /** @param {() => void} _callback @returns {void} */
    bindFileSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindDrop(_callback) {}

    /** @param {(viewName: string) => void} callback @returns {void} */
    bindViewChange(callback) {
        this.#viewChangeCallback = callback
    }

    /** @param {() => void} _callback @returns {void} */
    bindDocumentSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindDemoSelection(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindLocalOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindGitHubOpen(_callback) {}

    /** @param {() => void} _callback @returns {void} */
    bindPcbStylerClick(_callback) {}

    /**
     * @param {(change: { documentId: string, componentKey: string, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbComponentSelectionChange(callback) {
        this.#componentSelectionCallback = callback
    }

    /** @returns {boolean} */
    hasLocaleSelect() {
        return false
    }

    /** @returns {void} */
    setStatus() {}

    /** @returns {void} */
    render() {}

    /** @param {string} viewName @returns {void} */
    changeView(viewName) {
        this.#viewChangeCallback?.(viewName)
    }

    /**
     * @param {{ documentId: string, componentKey: string, source?: string }} change
     * @returns {void}
     */
    selectComponent(change) {
        this.#componentSelectionCallback?.(change)
    }
}

/**
 * Builds a schematic document with one shared component designator.
 * @returns {object}
 */
function createSchematicDocument() {
    return {
        fileName: 'demo.SchDoc',
        kind: 'schematic',
        diagnostics: [],
        summary: { title: 'demo.SchDoc' },
        schematic: {
            sheet: { width: 200, height: 100 },
            components: [{ designator: 'U1', libraryReference: 'MCU' }],
            pins: [],
            ports: []
        },
        bom: []
    }
}

/**
 * Builds a PCB document with one shared component designator.
 * @returns {object}
 */
function createPcbDocument() {
    return {
        fileName: 'demo.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: { title: 'demo.PcbDoc' },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            components: [{ designator: 'U1', pattern: 'SOP-16' }]
        },
        bom: []
    }
}

test('AppController preserves selected component when switching schematic, PCB, and 3D views', async () => {
    const state = new AppState({
        activeView: 'schematic',
        documents: [
            { id: 'schematic-doc', documentModel: createSchematicDocument() },
            { id: 'pcb-doc', documentModel: createPcbDocument() }
        ],
        activeDocumentId: 'schematic-doc'
    })
    const view = new FakeView()
    const controller = new AppController({
        state,
        view,
        parser: {}
    })

    await controller.init()
    view.selectComponent({
        documentId: 'schematic-doc',
        componentKey: 'U1',
        source: 'schematic'
    })

    view.changeView('pcb')
    let snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedPcbComponents['pcb-doc'], 'U1')

    view.changeView('3d')
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'pcb-doc')
    assert.equal(snapshot.selectedPcbComponents['pcb-doc'], 'U1')

    view.changeView('schematic')
    snapshot = state.getSnapshot()

    assert.equal(snapshot.activeDocumentId, 'schematic-doc')
    assert.equal(snapshot.selectedPcbComponents['schematic-doc'], 'U1')

    view.selectComponent({
        documentId: 'schematic-doc',
        componentKey: 'U1',
        source: 'schematic'
    })

    assert.deepEqual(state.getSnapshot().selectedPcbComponents, {})
})
