import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal class list for AppView wiring tests.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens = new Set()

    /**
     * Adds class tokens.
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * Removes class tokens.
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * Returns whether a class token exists.
     * @param {string} token Class token.
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal DOM node for AppView render tests.
 */
class FakeNode {
    /** @type {Map<string, string>} */
    #attributes = new Map()

    constructor() {
        this.innerHTML = ''
        this.textContent = ''
        this.value = ''
        this.hidden = false
        this.classList = new FakeClassList()
    }

    /**
     * Stores an attribute value.
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') this.hidden = true
    }

    /**
     * Reads an attribute value.
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Removes an attribute value.
     * @param {string} name Attribute name.
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') this.hidden = false
    }

    /**
     * Registers an event listener.
     * @param {string} _type Event type.
     * @param {(event: any) => void} _listener Listener.
     * @returns {void}
     */
    addEventListener(_type, _listener) {}

    /**
     * Returns no descendant matches for this focused test.
     * @param {string} _selector Selector.
     * @returns {null}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * Returns no descendant matches for this focused test.
     * @param {string} _selector Selector.
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }
}

/**
 * Minimal document that exposes the AppView mount nodes.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.body = new FakeNode()
        this.documentElement = new FakeNode()
        this.defaultView = { localStorage: null }
        this.#nodes = new Map(
            [
                '#fileInput',
                '#folderInput',
                '#dropZone',
                '#statusMessage',
                '#appVersion',
                '#localeSelect',
                '#viewerStage',
                '#documentRail',
                '#viewContent',
                '#viewTabs',
                '#githubOpenForm',
                '#githubUrlInput',
                '#pcbStylerCta',
                '#pcbStylerDismiss',
                '#pcbStylerNotice'
            ].map((selector) => [selector, new FakeNode()])
        )
    }

    /**
     * Returns one mounted fake node.
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a schematic snapshot with one selected symbol.
 * @returns {object}
 */
function createSnapshot() {
    const documentModel = {
        sourceFormat: 'kicad',
        kind: 'schematic',
        fileName: 'symbol-selection-fake.kicad_sch',
        summary: { title: 'Symbol selection fake' },
        schematic: {
            sheet: { width: 80, height: 60 },
            components: [{ ownerIndex: 'owner-u1', designator: 'U1' }],
            rectangles: [
                { ownerIndex: 'owner-u1', x: 20, y: 20, width: 12, height: 10 }
            ],
            texts: [{ ownerIndex: 'owner-u1', x: 20, y: 18, value: 'U1' }],
            pins: [],
            lines: []
        },
        bom: []
    }
    return {
        activeView: 'schematic',
        activeSidebarTab: 'components',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: documentModel.fileName,
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        selectedPcbComponents: { 'doc-1': 'U1' },
        documentModel
    }
}

/**
 * Verifies schematic selection state reaches the schematic renderer.
 */
test('AppView highlights the selected schematic symbol', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createSnapshot())

    const html = fakeDocument.querySelector('#viewContent').innerHTML
    assert.match(html, /class="schematic-component-highlight-style"/)
    assert.match(html, /data-schematic-component-key="U1"/)
})
