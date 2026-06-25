import assert from 'node:assert/strict'
import test from 'node:test'
import { ViewportInteractionGateController } from '../../src/ui/ViewportInteractionGateController.mjs'

/**
 * Minimal event target for delegated gate controller listeners.
 */
class FakeEventTarget {
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
        this.#listeners.get(type).add(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {any} event Event payload.
     * @returns {void}
     */
    dispatch(type, event = {}) {
        for (const listener of this.#listeners.get(type) || []) {
            listener(event)
        }
    }
}

/**
 * Minimal gate node with attribute helpers.
 */
class FakeGateNode {
    #attributes

    constructor() {
        this.#attributes = new Map()
    }

    /**
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(String(name), String(value))
    }

    /**
     * @param {string} name Attribute name.
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(String(name))
    }

    /**
     * @param {string} name Attribute name.
     * @returns {boolean}
     */
    hasAttribute(name) {
        return this.#attributes.has(String(name))
    }
}

/**
 * Minimal clickable unlock node.
 */
class FakeUnlockButton {
    /**
     * @param {string} selector CSS selector.
     * @returns {FakeUnlockButton | null}
     */
    closest(selector) {
        return selector === '[data-viewport-interaction-unlock]' ? this : null
    }
}

/**
 * Minimal content node that exposes rendered gate nodes.
 */
class FakeContentNode extends FakeEventTarget {
    #gate

    constructor() {
        super()
        this.ownerDocument = { defaultView: new FakeEventTarget() }
        this.#gate = new FakeGateNode()
    }

    /**
     * @returns {FakeGateNode[]}
     */
    querySelectorAll() {
        return [this.#gate]
    }

    /**
     * @returns {FakeGateNode}
     */
    gate() {
        return this.#gate
    }
}

/**
 * Verifies the interaction gate locks by default and can be re-armed.
 */
test('ViewportInteractionGateController locks, unlocks, and re-arms gates', () => {
    const contentNode = new FakeContentNode()
    const controller = new ViewportInteractionGateController(contentNode, {
        enabled: true
    })

    assert.equal(contentNode.gate().hasAttribute('hidden'), false)

    controller.unlock()
    assert.equal(contentNode.gate().hasAttribute('hidden'), true)

    contentNode.dispatch('keydown', { key: 'Escape' })
    assert.equal(contentNode.gate().hasAttribute('hidden'), false)

    contentNode.dispatch('click', {
        target: new FakeUnlockButton(),
        preventDefault() {},
        stopPropagation() {},
        stopImmediatePropagation() {}
    })
    assert.equal(contentNode.gate().hasAttribute('hidden'), true)

    controller.dispose()
})

/**
 * Verifies callers stay opted out while retaining rendered gate markup.
 */
test('ViewportInteractionGateController keeps gates hidden by default', () => {
    const contentNode = new FakeContentNode()
    const controller = new ViewportInteractionGateController(contentNode)

    assert.equal(contentNode.gate().hasAttribute('hidden'), true)

    controller.lock()
    assert.equal(contentNode.gate().hasAttribute('hidden'), true)

    controller.dispose()
})
