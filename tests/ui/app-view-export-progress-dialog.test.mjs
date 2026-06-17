import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewExportProgressDialog } from '../../src/ui/AppViewExportProgressDialog.mjs'

/**
 * Minimal class list for dialog rendering tests.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor() {
        this.#tokens = new Set()
    }

    /**
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * @param {string} token Class token.
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal DOM node for progress dialog tests.
 */
class FakeNode {
    /** @type {Map<string, string>} */
    #attributes

    /** @type {Map<string, FakeNode>} */
    #childrenBySelector

    constructor() {
        this.#attributes = new Map()
        this.#childrenBySelector = new Map()
        this.children = []
        this.hidden = false
        this.classList = new FakeClassList()
        this.textContent = ''
        this.value = 0
        this.max = 0
    }

    /**
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * @param {FakeNode} child Child node.
     * @returns {FakeNode}
     */
    appendChild(child) {
        this.children.push(child)
        return child
    }

    /**
     * @returns {void}
     */
    remove() {
        this.removed = true
    }

    /**
     * @param {string} selector Child selector.
     * @param {FakeNode} child Child node.
     * @returns {void}
     */
    registerChild(selector, child) {
        this.#childrenBySelector.set(selector, child)
    }

    /**
     * @param {string} selector Child selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#childrenBySelector.get(selector) || null
    }
}

/**
 * Minimal document for progress dialog tests.
 */
class FakeDocument {
    constructor() {
        this.body = new FakeNode()
    }

    /**
     * @param {string} _name Element name.
     * @returns {FakeNode}
     */
    createElement(_name) {
        return new FakeNode()
    }
}

test('AppViewExportProgressDialog renders and updates an accessible progressbar', () => {
    const documentRef = new FakeDocument()
    const dialog = new AppViewExportProgressDialog(documentRef)

    dialog.show({
        title: 'Exporting PCB assembly',
        message: 'Preparing PCB assembly export',
        value: 0
    })

    const node = documentRef.body.children[0]
    assert.equal(node.getAttribute('role'), 'dialog')
    assert.equal(node.getAttribute('aria-modal'), 'true')
    assert.equal(
        node.querySelector('[data-export-progress-title]').textContent,
        'Exporting PCB assembly'
    )
    assert.equal(
        node.querySelector('[data-export-progress-message]').textContent,
        'Preparing PCB assembly export'
    )
    assert.equal(node.querySelector('[data-export-progress-bar]').value, 0)

    dialog.update({
        message: 'Writing STEP assembly',
        value: 75
    })

    assert.equal(
        node.querySelector('[data-export-progress-message]').textContent,
        'Writing STEP assembly'
    )
    assert.equal(node.querySelector('[data-export-progress-bar]').value, 75)
    assert.equal(
        node
            .querySelector('[data-export-progress-bar]')
            .getAttribute('aria-valuenow'),
        '75'
    )

    dialog.hide()

    assert.equal(node.removed, true)
})
