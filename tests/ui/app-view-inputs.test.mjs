import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for picker binding tests.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }

        this.#listeners.get(type)?.add(listener)
    }

    /**
     * @param {string} type
     * @param {Record<string, any>} [event]
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
 * Minimal DOM node for picker binding tests.
 */
class FakeNode extends FakeEventTarget {
    constructor() {
        super()
        this.files = null
        this.value = ''
    }
}

/**
 * Minimal document exposing the multi-file input only.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.#nodes = new Map([
            ['#fileInput', new FakeNode()]
        ])
    }

    /**
     * @param {string} selector
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Verifies AppView emits the selected file picker payload.
 */
test('AppView binds the file picker and clears the element after selection', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const fileInput = fakeDocument.querySelector('#fileInput')
    const pickedFiles = [{ name: 'board.PcbDoc' }, { name: 'Body.wrl' }]
    const received = []

    view.bindFileSelection((files) => {
        received.push(files)
    })

    fileInput.files = pickedFiles
    fileInput.value = 'filled'
    fileInput.dispatch('change')

    assert.deepEqual(received, [pickedFiles])
    assert.equal(fileInput.value, '')
})
