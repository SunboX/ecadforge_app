import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewController } from '../../src/ui/PcbViewController.mjs'

/**
 * Minimal classList implementation for viewport listeners.
 */
class FakeClassList {
    /** @returns {void} */
    add() {}

    /** @returns {void} */
    remove() {}
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
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
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
 * Minimal document node for SVG viewport listeners.
 */
class FakeDocument extends FakeEventTarget {
    constructor() {
        super()
        this.documentElement = { classList: new FakeClassList() }
    }
}

/**
 * Minimal rendered SVG node.
 */
class FakeSvgElement extends FakeEventTarget {
    #attributes

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     * @param {string} viewBox SVG viewBox.
     */
    constructor(ownerDocument, viewBox) {
        super()
        this.ownerDocument = ownerDocument
        this.#attributes = new Map([['viewBox', viewBox]])
        this.classList = new FakeClassList()
        this.style = {}
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
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 400, height: 200 }
    }
}

/**
 * Minimal content node that exposes the rendered PCB SVG.
 */
class FakeContentNode extends FakeEventTarget {
    #ownerDocument
    #svg

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#svg = null
        this._innerHTML = ''
    }

    /**
     * @param {string} value Rendered markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        this.#svg = svgMatch
            ? new FakeSvgElement(this.#ownerDocument, svgMatch[1])
            : null
    }

    /** @returns {string} */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | null}
     */
    querySelector(selector) {
        return selector === '.pcb-svg' ? this.#svg : null
    }

    /**
     * @returns {any[]}
     */
    querySelectorAll() {
        return []
    }

    /**
     * @param {string} key Keyboard key.
     * @returns {string[]}
     */
    pressKey(key) {
        const actions = []
        this.dispatch('keydown', {
            key,
            target: this,
            preventDefault() {
                actions.push('prevent')
            },
            stopPropagation() {
                actions.push('stop')
            }
        })
        return actions
    }
}

/**
 * Builds a compact PCB document with two visible layer rows.
 * @returns {object}
 */
function createDocumentModel() {
    return {
        kind: 'pcb',
        fileName: 'layer-shortcuts.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 100, y2: 0 },
                    { type: 'line', x1: 100, y1: 0, x2: 100, y2: 100 },
                    { type: 'line', x1: 100, y1: 100, x2: 0, y2: 100 },
                    { type: 'line', x1: 0, y1: 100, x2: 0, y2: 0 }
                ]
            },
            layers: [
                { name: 'Top Layer', layerId: 1 },
                { name: 'Bottom Layer', layerId: 32 }
            ],
            components: [],
            pads: []
        }
    }
}

/**
 * Verifies numeric PCB layer shortcuts emit visibility changes through the
 * same state path as the sidebar controls.
 */
test('PcbViewController maps numeric keys to PCB layer visibility changes', () => {
    const content = new FakeContentNode(new FakeDocument())
    const changes = []
    const controller = new PcbViewController(content, createDocumentModel(), {
        documentId: 'doc-1'
    })
    content.addEventListener('pcb-layer-visibility-change', (event) => {
        changes.push(event.detail)
    })

    const actions = content.pressKey('1')

    assert.deepEqual(changes, [
        {
            documentId: 'doc-1',
            layerKey: 'Top Layer',
            visible: false,
            source: 'pcb-layer-shortcut'
        }
    ])
    assert.deepEqual(actions, ['prevent', 'stop'])

    controller.dispose()
})
