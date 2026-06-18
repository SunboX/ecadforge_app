import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewController } from '../../src/ui/PcbViewController.mjs'

/**
 * Minimal classList implementation for viewport controller tests.
 */
class FakeClassList {
    /**
     * @returns {void}
     */
    add() {}

    /**
     * @returns {void}
     */
    remove() {}
}

/**
 * Minimal event target used by fake DOM nodes.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
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
 * Minimal document node for SVG viewport document-level listeners.
 */
class FakeDocument extends FakeEventTarget {
    constructor() {
        super()
        this.documentElement = { classList: new FakeClassList() }
    }
}

/**
 * Minimal rendered PCB SVG node.
 */
class FakeSvgElement extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     * @param {string} viewBox SVG viewBox.
     */
    constructor(ownerDocument, viewBox) {
        super()
        this.#attributes = new Map()
        this.classList = new FakeClassList()
        this.ownerDocument = ownerDocument
        this.style = {}
        this.setAttribute('viewBox', viewBox)
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
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 400, height: 200 }
    }
}

/**
 * Minimal content node that reparses rendered PCB view markup.
 */
class FakeContentNode extends FakeEventTarget {
    /** @type {FakeDocument} */
    #ownerDocument

    /** @type {FakeSvgElement | null} */
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
     * @param {string} value Markup.
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

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML || ''
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | null}
     */
    querySelector(selector) {
        return selector === '.pcb-svg' ? this.#svg : null
    }

    /**
     * Dispatches a mobile-style tap on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    touchPcbBoard(clientX, clientY) {
        if (!this.#svg) {
            return
        }

        const touch = { clientX, clientY }
        this.#svg.dispatch('touchstart', {
            target: this.#svg,
            touches: [touch],
            changedTouches: [touch],
            preventDefault() {}
        })
        this.dispatch('touchstart', {
            target: this.#svg,
            touches: [touch],
            changedTouches: [touch],
            preventDefault() {}
        })
        this.#svg.dispatch('touchend', {
            target: this.#svg,
            touches: [],
            changedTouches: [touch]
        })
        this.dispatch('touchend', {
            target: this.#svg,
            touches: [],
            changedTouches: [touch]
        })
    }
}

/**
 * Builds a compact selectable PCB document.
 * @returns {object}
 */
function createSelectablePcbDocument() {
    return {
        kind: 'pcb',
        fileName: 'board-touch-selection.PcbDoc',
        summary: { title: 'board-touch-selection' },
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
            components: [
                {
                    componentIndex: 0,
                    designator: 'U1',
                    x: 50,
                    y: 50,
                    rotation: 0,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ],
            pads: [
                {
                    x: 50,
                    y: 50,
                    sizeTopX: 24,
                    sizeTopY: 24,
                    rotation: 0,
                    componentIndex: 0,
                    layerId: 1,
                    netName: 'SENSE'
                }
            ]
        },
        bom: []
    }
}

/**
 * Verifies mobile touch taps select board components even when browsers do not
 * synthesize a follow-up click after prevented SVG touch panning.
 */
test('PcbViewController selects a component-backed PCB touch tap', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const selections = []
    const controller = new PcbViewController(
        content,
        createSelectablePcbDocument(),
        {
            documentId: 'doc-1',
            onComponentSelectionChange: (change) => {
                selections.push(change)
            }
        }
    )
    const svg = content.querySelector('.pcb-svg')

    svg?.setAttribute('viewBox', '0 0 100 100')
    content.touchPcbBoard(200, 100)

    assert.deepEqual(selections, [
        {
            documentId: 'doc-1',
            componentKey: 'U1',
            source: 'pcb-board'
        }
    ])

    controller.dispose()
})
