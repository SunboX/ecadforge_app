import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal classList implementation for body class assertions.
 */
class FakeClassList {
    #tokens = new Set()

    /**
     * Adds class tokens.
     * @param {...string} tokens
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * Removes class tokens.
     * @param {...string} tokens
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * Returns true when the class token is present.
     * @param {string} token
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal event target and node used by AppView.
 */
class FakeNode {
    #attributes = new Map()

    constructor() {
        this.classList = new FakeClassList()
        this.innerHTML = ''
        this.textContent = ''
    }

    /**
     * Stores one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * Removes one attribute value.
     * @param {string} name
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
    }

    /**
     * Returns one attribute value.
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Registers an ignored event listener.
     * @returns {void}
     */
    addEventListener() {}

    /**
     * Returns no child for generic nodes.
     * @returns {null}
     */
    querySelector() {
        return null
    }

    /**
     * Returns no children for generic nodes.
     * @returns {any[]}
     */
    querySelectorAll() {
        return []
    }
}

/**
 * Minimal document exposing AppView mount points.
 */
class FakeDocument {
    #nodes

    constructor() {
        this.body = new FakeNode()
        this.#nodes = new Map([
            ['#brandHomeLink', new FakeNode()],
            ['#fileInput', new FakeNode()],
            ['#folderInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#summaryGrid', new FakeNode()],
            ['#viewerStage', new FakeNode()],
            ['#documentRail', new FakeNode()],
            ['#activeDocumentName', new FakeNode()],
            ['#viewTabs', new FakeNode()],
            ['#diagnosticsCount', new FakeNode()],
            ['#githubOpenForm', new FakeNode()],
            ['#githubUrlInput', new FakeNode()],
            ['#pcbStylerCta', new FakeNode()],
            ['#pcbStylerLink', new FakeNode()]
        ])
    }

    /**
     * Returns one mounted node.
     * @param {string} selector
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a minimal loaded PCB document snapshot.
 * @param {string} activeView
 * @returns {any}
 */
function createSnapshot(activeView) {
    const documentModel = {
        kind: 'pcb',
        fileName: 'demo.PcbDoc',
        diagnostics: [],
        summary: {
            componentCount: 1,
            layerCount: 2,
            outlineSegmentCount: 4,
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            components: [{ designator: 'U1' }]
        },
        bom: []
    }

    return {
        activeView,
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: '',
        activeFileName: 'demo.PcbDoc',
        documentModel,
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1'
    }
}

/**
 * Verifies viewport-height layout is scoped to resizable viewer views.
 */
test('AppView scopes viewport-height layout to resizable views', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument, {
        createScene3dController: () => ({ dispose: () => {} })
    })

    view.render(createSnapshot('diagnostics'))

    assert.equal(fakeDocument.body.classList.contains('is-viewer-mode'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-visual'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-schematic'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-pcb'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-3d'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-report'), true)

    view.render(createSnapshot('schematic'))

    assert.equal(fakeDocument.body.classList.contains('is-viewer-mode'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-visual'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-schematic'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-pcb'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-3d'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-report'), false)

    view.render(createSnapshot('pcb'))

    assert.equal(fakeDocument.body.classList.contains('is-viewer-mode'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-visual'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-schematic'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-pcb'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-3d'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-report'), false)

    view.render(createSnapshot('3d'))

    assert.equal(fakeDocument.body.classList.contains('is-viewer-visual'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-schematic'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-pcb'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-3d'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-report'), false)

    view.render(createSnapshot('bom'))

    assert.equal(fakeDocument.body.classList.contains('is-viewer-visual'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-schematic'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-pcb'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-3d'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-report'), true)

    view.render(createSnapshot('diagnostics'))

    assert.equal(fakeDocument.body.classList.contains('is-viewer-mode'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-visual'), true)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-schematic'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-pcb'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-3d'), false)
    assert.equal(fakeDocument.body.classList.contains('is-viewer-report'), true)
})
