import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for landing status AppView tests.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * Registers one listener.
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type)?.add(listener)
    }
}

/**
 * Minimal class list for AppView body updates.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor() {
        this.#tokens = new Set()
    }

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
}

/**
 * Minimal DOM node for landing status rendering.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
        this.classList = new FakeClassList()
        this.hidden = false
        this.innerHTML = ''
        this.textContent = ''
    }

    /**
     * Sets one attribute value.
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') {
            this.hidden = true
        }
    }

    /**
     * Returns one attribute value.
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Removes one attribute value.
     * @param {string} name Attribute name.
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') {
            this.hidden = false
        }
    }

    /**
     * Returns matching child nodes for controls AppView updates.
     * @param {string} _selector Selector.
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }
}

/**
 * Minimal document with the nodes AppView touches while rendering landing mode.
 */
class FakeDocument extends FakeEventTarget {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        super()
        this.body = new FakeNode()
        this.#nodes = new Map([
            ['#statusMessage', new FakeNode()],
            ['#landingStatusMessage', new FakeNode()],
            ['#viewTabs', new FakeNode()],
            ['#documentRail', new FakeNode()],
            ['#viewContent', new FakeNode()]
        ])
    }

    /**
     * Returns one node by selector.
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a no-document AppView snapshot.
 * @returns {{ activeView: string, activeSidebarTab: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents: any[], activeDocumentId: string, documentModel: null }}
 */
function createLandingErrorSnapshot() {
    return {
        activeView: 'schematic',
        activeSidebarTab: 'info',
        locale: 'en',
        parseStatus: 'error',
        statusMessage: 'GitHub API rate limit is exhausted.',
        activeFileName: '',
        documents: [],
        activeDocumentId: '',
        documentModel: null
    }
}

test('AppView shows landing intake errors next to the opening controls', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createLandingErrorSnapshot())

    const messageNode = fakeDocument.querySelector('#landingStatusMessage')

    assert.equal(messageNode?.hidden, false)
    assert.equal(
        messageNode?.textContent,
        'GitHub API rate limit is exhausted.'
    )
    assert.equal(messageNode?.getAttribute('data-status'), 'error')
})
