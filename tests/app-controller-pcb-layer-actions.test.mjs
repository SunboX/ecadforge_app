import assert from 'node:assert/strict'
import test from 'node:test'
import { AppControllerPcbStateHandlers } from '../src/AppControllerPcbStateHandlers.mjs'

/**
 * Minimal state double for PCB state-handler tests.
 */
class FakeState {
    /** @type {object} */
    #snapshot

    /**
     * @param {object} snapshot Initial state snapshot.
     */
    constructor(snapshot) {
        this.#snapshot = snapshot
    }

    /**
     * @returns {object}
     */
    getSnapshot() {
        return {
            ...this.#snapshot,
            hiddenPcbLayers: { ...this.#snapshot.hiddenPcbLayers }
        }
    }

    /**
     * @param {string} key State key.
     * @param {any} value State value.
     * @returns {object}
     */
    setValue(key, value) {
        this.#snapshot = {
            ...this.#snapshot,
            [key]: value
        }
        return this.getSnapshot()
    }
}

/**
 * Builds a compact PCB document for layer visibility state tests.
 * @returns {object}
 */
function createPcbDocumentModel() {
    return {
        kind: 'pcb',
        pcb: {
            layers: [
                { name: 'Top Layer', layerId: 0x01000001 },
                { name: 'Bottom Layer', layerId: 0x0100ffff },
                { name: 'Top Overlay', layerId: 0x01030006 }
            ],
            primitiveLayers: [],
            tracks: [],
            pads: [],
            vias: [],
            regions: [],
            texts: [],
            components: []
        }
    }
}

/**
 * Builds a state double with one active PCB document.
 * @returns {FakeState}
 */
function createState() {
    const documentModel = createPcbDocumentModel()
    return new FakeState({
        activeDocumentId: 'doc-1',
        hiddenPcbLayers: {},
        documents: [{ id: 'doc-1', documentModel }],
        documentModel
    })
}

/**
 * Verifies layer "only" events hide every physical layer except the requested
 * subset.
 */
test('AppControllerPcbStateHandlers shows only requested PCB layers', () => {
    const state = createState()

    AppControllerPcbStateHandlers.handleLayerVisibility(state, {
        action: 'only',
        documentId: 'doc-1',
        layerKeys: ['Top Layer']
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {
        'doc-1': ['Bottom Layer', 'Top Overlay']
    })
})

/**
 * Verifies a repeated layer "only" event restores all layers.
 */
test('AppControllerPcbStateHandlers toggles repeated only layer actions off', () => {
    const state = createState()

    AppControllerPcbStateHandlers.handleLayerVisibility(state, {
        action: 'only',
        documentId: 'doc-1',
        layerKeys: ['Top Layer']
    })
    AppControllerPcbStateHandlers.handleLayerVisibility(state, {
        action: 'only',
        documentId: 'doc-1',
        layerKeys: ['Top Layer']
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {})
})

/**
 * Verifies grouped layer events update all requested layer keys together.
 */
test('AppControllerPcbStateHandlers updates grouped PCB layers', () => {
    const state = createState()

    AppControllerPcbStateHandlers.handleLayerVisibility(state, {
        action: 'toggle',
        documentId: 'doc-1',
        layerKeys: ['Top Layer', 'Bottom Layer'],
        visible: false
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {
        'doc-1': ['Top Layer', 'Bottom Layer']
    })

    AppControllerPcbStateHandlers.handleLayerVisibility(state, {
        action: 'toggle',
        documentId: 'doc-1',
        layerKeys: ['Top Layer', 'Bottom Layer'],
        visible: true
    })

    assert.deepEqual(state.getSnapshot().hiddenPcbLayers, {})
})
