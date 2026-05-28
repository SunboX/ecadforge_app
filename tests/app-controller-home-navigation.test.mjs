import assert from 'node:assert/strict'
import test from 'node:test'
import { AppController } from '../src/AppController.mjs'
import { AppState } from '../src/core/AppState.mjs'

/**
 * Minimal view fake for home-navigation controller tests.
 */
class FakeHomeView {
    /** @type {(() => void) | null} */
    #homeNavigationCallback

    /** @type {any} */
    latestSnapshot

    constructor() {
        this.#homeNavigationCallback = null
        this.latestSnapshot = null
    }

    /**
     * @param {() => void} _callback
     * @returns {void}
     */
    bindFileSelection(_callback) {}

    /**
     * @param {() => void} _callback
     * @returns {void}
     */
    bindDrop(_callback) {}

    /**
     * @param {() => void} _callback
     * @returns {void}
     */
    bindViewChange(_callback) {}

    /**
     * @param {() => void} callback
     * @returns {void}
     */
    bindHomeNavigation(callback) {
        this.#homeNavigationCallback = callback
    }

    /**
     * @param {string} _status
     * @returns {void}
     */
    setStatus(_status) {}

    /**
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return false
    }

    /**
     * @param {any} snapshot
     * @returns {void}
     */
    render(snapshot) {
        this.latestSnapshot = snapshot
    }

    /**
     * @returns {void}
     */
    goHome() {
        this.#homeNavigationCallback?.()
    }
}

/**
 * Minimal analytics recorder for controller assertions.
 */
class RecordingAnalytics {
    constructor() {
        this.events = []
    }

    /**
     * @param {string} name
     * @param {object} [properties]
     * @returns {void}
     */
    track(name, properties = {}) {
        this.events.push({ name, properties })
    }
}

/**
 * Creates a minimal PCB document model.
 * @returns {object}
 */
function createPcbDocument() {
    return {
        fileName: 'fixture-board.kicad_pcb',
        pcb: { components: [] },
        diagnostics: []
    }
}

/**
 * Verifies the app brand link clears the current session back to the landing
 * page state without a browser reload.
 */
test('AppController clears the open session when the brand home link is clicked', async () => {
    const state = new AppState({
        activeView: 'pcb',
        parseStatus: 'ready',
        statusMessage: 'Design loaded locally.',
        documents: [{ id: 'doc-1', documentModel: createPcbDocument() }],
        activeDocumentId: 'doc-1',
        sessionAssets: [
            {
                name: 'part.step',
                relativePath: 'part.step',
                file: {},
                format: 'step'
            }
        ]
    })
    const view = new FakeHomeView()
    const analytics = new RecordingAnalytics()
    const controller = new AppController({
        state,
        view,
        analytics
    })

    await controller.init()
    view.goHome()

    const snapshot = state.getSnapshot()

    assert.equal(snapshot.activeView, 'schematic')
    assert.equal(snapshot.parseStatus, 'idle')
    assert.equal(snapshot.activeFileName, '')
    assert.equal(snapshot.documentModel, null)
    assert.deepEqual(snapshot.documents, [])
    assert.deepEqual(snapshot.sessionAssets, [])
    assert.match(snapshot.statusMessage, /Drop \.PcbDoc/)
    assert.deepEqual(
        analytics.events.map((event) => event.name),
        ['landing_view', 'landing_view']
    )
})
