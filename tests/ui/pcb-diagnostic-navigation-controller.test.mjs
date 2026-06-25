import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbDiagnosticNavigationController } from '../../src/ui/PcbDiagnosticNavigationController.mjs'

/**
 * Minimal classList implementation with observable state.
 */
class FakeClassList {
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
     * @param {...string} tokens Class tokens.
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
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
 * Minimal event target used by fake DOM nodes.
 */
class FakeEventTarget {
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type).add(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
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
 * Minimal fake DOM node with attribute and selector support.
 */
class FakeNode {
    #attributes

    /**
     * @param {object} attributes Initial attributes.
     */
    constructor(attributes = {}) {
        this.#attributes = new Map(Object.entries(attributes))
        this.classList = new FakeClassList()
    }

    /**
     * @param {string} name Attribute name.
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
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
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    closest(selector) {
        if (
            selector === '[data-pcb-diagnostic-focus]' &&
            this.getAttribute('data-pcb-diagnostic-focus')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-diagnostic-copy]' &&
            this.getAttribute('data-pcb-diagnostic-copy')
        ) {
            return this
        }
        return null
    }
}

/**
 * Minimal content node for delegated diagnostic navigation events.
 */
class FakeContentNode extends FakeEventTarget {
    #focusButton
    #copyButton
    #marker

    constructor() {
        super()
        this.#focusButton = new FakeNode({
            'data-pcb-diagnostic-focus': 'err_1'
        })
        this.#copyButton = new FakeNode({
            'data-pcb-diagnostic-copy': 'Clearance warning.'
        })
        this.#marker = new FakeNode({
            'data-pcb-diagnostic-id': 'err_1'
        })
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeNode[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-pcb-diagnostic-focus]') {
            return [this.#focusButton]
        }
        if (selector === '[data-pcb-diagnostic-id]') {
            return [this.#marker]
        }
        return []
    }

    /** @returns {FakeNode} */
    getFocusButton() {
        return this.#focusButton
    }

    /** @returns {FakeNode} */
    getCopyButton() {
        return this.#copyButton
    }

    /** @returns {FakeNode} */
    getMarker() {
        return this.#marker
    }
}

/**
 * Verifies diagnostic navigation can focus markers and copy messages.
 */
test('PcbDiagnosticNavigationController focuses and copies diagnostics', async () => {
    const content = new FakeContentNode()
    const copied = []
    const focused = []
    const eventActions = []
    const previousNavigator = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: { clipboard: { writeText: async (text) => copied.push(text) } }
    })

    const controller = new PcbDiagnosticNavigationController(content, {
        onFocus: (diagnosticId) => focused.push(diagnosticId)
    })
    content.dispatch('mouseover', { target: content.getFocusButton() })
    content.dispatch('click', {
        target: content.getFocusButton(),
        preventDefault() {
            eventActions.push('focus:prevent')
        },
        stopPropagation() {
            eventActions.push('focus:stop')
        },
        stopImmediatePropagation() {
            eventActions.push('focus:stop-immediate')
        }
    })
    content.dispatch('click', {
        target: content.getCopyButton(),
        preventDefault() {
            eventActions.push('copy:prevent')
        },
        stopPropagation() {
            eventActions.push('copy:stop')
        },
        stopImmediatePropagation() {
            eventActions.push('copy:stop-immediate')
        }
    })
    await Promise.resolve()

    assert.equal(content.getMarker().classList.contains('is-focused'), true)
    assert.equal(
        content.getFocusButton().classList.contains('is-focused'),
        true
    )
    assert.equal(content.getCopyButton().classList.contains('is-copied'), true)
    assert.equal(
        content.getCopyButton().getAttribute('data-copy-state'),
        'copied'
    )
    assert.deepEqual(copied, ['Clearance warning.'])
    assert.deepEqual(focused, ['err_1'])
    assert.deepEqual(eventActions, [
        'focus:prevent',
        'focus:stop',
        'focus:stop-immediate',
        'copy:prevent',
        'copy:stop',
        'copy:stop-immediate'
    ])

    controller.dispose()
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: previousNavigator
    })
})
