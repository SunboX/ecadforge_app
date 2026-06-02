import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for PCB Styler tip interaction tests.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * Registers one event listener.
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener callback.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }

        this.#listeners.get(type)?.add(listener)
    }

    /**
     * Dispatches one synthetic event.
     * @param {string} type Event type.
     * @param {Record<string, any>} [event] Event payload.
     * @returns {void}
     */
    dispatch(type, event = {}) {
        const payload = { type, currentTarget: this, target: this, ...event }
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener(payload)
        )
    }
}

/**
 * Minimal DOM node for focused AppView tests.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    /** @type {Set<string>} */
    #classes

    constructor() {
        super()
        this.#attributes = new Map()
        this.#classes = new Set()
        this.href = ''
        this.textContent = ''
        this.hidden = false
        this.classList = {
            add: (className) => {
                this.#classes.add(className)
            },
            remove: (className) => {
                this.#classes.delete(className)
            }
        }
    }

    /**
     * Sets one attribute.
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
     * Removes one attribute.
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
     * Returns true when the node has one class.
     * @param {string} className Class name.
     * @returns {boolean}
     */
    hasClass(className) {
        return this.#classes.has(className)
    }
}

/**
 * Minimal localStorage-compatible fake.
 */
class FakeStorage {
    /** @type {Map<string, string>} */
    #entries

    /**
     * @param {Record<string, string>} [entries] Initial stored values.
     */
    constructor(entries = {}) {
        this.#entries = new Map(Object.entries(entries))
    }

    /**
     * Reads one stored value.
     * @param {string} key Storage key.
     * @returns {string | null}
     */
    getItem(key) {
        return this.#entries.get(key) || null
    }

    /**
     * Stores one value.
     * @param {string} key Storage key.
     * @param {string} value Storage value.
     * @returns {void}
     */
    setItem(key, value) {
        this.#entries.set(key, String(value))
    }
}

/**
 * Minimal document exposing the PCB Styler tip nodes.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.#nodes = new Map([
            ['#viewerStage', new FakeNode()],
            ['#pcbStylerCta', new FakeNode()],
            ['#pcbStylerLink', new FakeNode()],
            ['#pcbStylerDismiss', new FakeNode()]
        ])
    }

    /**
     * Returns one node by selector.
     * @param {string} selector Selector string.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

const dismissedStorageKey = 'ecadforge.pcbStylerTipDismissed'

test('AppView permanently hides the PCB Styler tip when dismissed', () => {
    const fakeDocument = new FakeDocument()
    const storage = new FakeStorage()
    const view = new AppView(fakeDocument, { storage })

    view.setPcbStylerLink('https://pcb-styler.app/', 'local')
    assert.equal(fakeDocument.querySelector('#pcbStylerCta')?.hidden, false)
    assert.equal(
        fakeDocument
            .querySelector('#viewerStage')
            ?.hasClass('is-pcb-styler-cta-hidden'),
        false
    )

    fakeDocument.querySelector('#pcbStylerDismiss')?.dispatch('click')

    assert.equal(storage.getItem(dismissedStorageKey), 'true')
    assert.equal(fakeDocument.querySelector('#pcbStylerCta')?.hidden, true)
    assert.equal(
        fakeDocument
            .querySelector('#viewerStage')
            ?.hasClass('is-pcb-styler-cta-hidden'),
        true
    )

    view.setPcbStylerLink('https://pcb-styler.app/?url=fake-board', 'github')

    assert.equal(fakeDocument.querySelector('#pcbStylerCta')?.hidden, true)
    assert.equal(
        fakeDocument
            .querySelector('#viewerStage')
            ?.hasClass('is-pcb-styler-cta-hidden'),
        true
    )
})

test('AppView keeps the PCB Styler tip hidden when dismissal is stored', () => {
    const fakeDocument = new FakeDocument()
    const storage = new FakeStorage({ [dismissedStorageKey]: 'true' })
    const view = new AppView(fakeDocument, { storage })

    view.setPcbStylerLink('https://pcb-styler.app/', 'local')

    assert.equal(fakeDocument.querySelector('#pcbStylerCta')?.hidden, true)
    assert.equal(
        fakeDocument
            .querySelector('#viewerStage')
            ?.hasClass('is-pcb-styler-cta-hidden'),
        true
    )
})
