import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewController } from '../../src/ui/PcbViewController.mjs'

/**
 * Minimal classList implementation for viewport toolbar tests.
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
    #listeners = new Map()

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
 * Minimal fake node with attribute helpers.
 */
class FakeNode extends FakeEventTarget {
    #attributes = new Map()

    constructor() {
        super()
        this.classList = new FakeClassList()
        this.style = {}
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
     * @param {string} _selector Selector.
     * @returns {FakeNode | null}
     */
    closest(_selector) {
        return null
    }
}

/**
 * Minimal owner document for SVG viewport listeners.
 */
class FakeDocument extends FakeEventTarget {
    constructor() {
        super()
        this.defaultView = new FakeEventTarget()
        this.documentElement = { classList: new FakeClassList() }
    }
}

/**
 * Minimal rendered PCB SVG node.
 */
class FakeSvgElement extends FakeNode {
    /**
     * @param {FakeDocument} ownerDocument Owner document.
     * @param {string} viewBox SVG viewBox.
     */
    constructor(ownerDocument, viewBox) {
        super()
        this.ownerDocument = ownerDocument
        this.setAttribute('viewBox', viewBox)
    }

    /**
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return { left: 0, top: 0, width: 400, height: 200 }
    }
}

/**
 * Minimal reset-view button.
 */
class FakeResetViewButton extends FakeNode {
    /** @param {string} selector Selector. @returns {FakeResetViewButton | null} */
    closest(selector) {
        return selector === '[data-pcb-view-reset]' ? this : null
    }
}

/**
 * Minimal hover-focus button.
 */
class FakeHoverFocusButton extends FakeNode {
    /** @param {string} selector Selector. @returns {FakeHoverFocusButton | null} */
    closest(selector) {
        return selector === '[data-pcb-hover-focus-toggle]' ? this : null
    }
}

/**
 * Minimal PCB content node that reparses rendered toolbar markup.
 */
class FakeContentNode extends FakeEventTarget {
    #document
    #svg = null
    #resetButton = null
    #hoverButton = null

    /** @param {FakeDocument} documentRef Owner document. */
    constructor(documentRef) {
        super()
        this.#document = documentRef
        this.ownerDocument = documentRef
        this._innerHTML = ''
    }

    /** @param {string} value Markup. */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#resetButton = this._innerHTML.includes('data-pcb-view-reset')
            ? new FakeResetViewButton()
            : null
        this.#hoverButton = this._innerHTML.includes(
            'data-pcb-hover-focus-toggle'
        )
            ? new FakeHoverFocusButton()
            : null
        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        this.#svg = svgMatch
            ? new FakeSvgElement(this.#document, svgMatch[1])
            : null
    }

    /** @returns {string} */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | FakeNode | null}
     */
    querySelector(selector) {
        if (selector === '.pcb-svg') return this.#svg
        if (selector === '[data-pcb-view-reset]') return this.#resetButton
        if (selector === '[data-pcb-hover-focus-toggle]') {
            return this.#hoverButton
        }
        return null
    }

    /**
     * @returns {FakeNode[]}
     */
    querySelectorAll() {
        return []
    }

    /** @returns {void} */
    clickResetView() {
        this.dispatch('click', {
            target: this.#resetButton,
            preventDefault() {},
            stopPropagation() {},
            stopImmediatePropagation() {}
        })
    }

    /** @returns {void} */
    clickHoverFocusToggle() {
        this.dispatch('click', {
            target: this.#hoverButton,
            preventDefault() {},
            stopPropagation() {},
            stopImmediatePropagation() {}
        })
    }

    /**
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    movePcbBoard(clientX, clientY) {
        this.dispatch('mousemove', { target: this.#svg, clientX, clientY })
    }
}

/**
 * Builds a compact standards-native PCB model.
 * @returns {object[]}
 */
function createCircuitJsonPcbDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6,
            num_layers: 2
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            layer: 'top'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_1',
            pcb_component_id: 'pcb_u1',
            shape: 'rect',
            x: 1,
            y: 1,
            width: 1.2,
            height: 0.8,
            layer: 'top',
            net: 'VCC'
        }
    ]
    return Object.assign(documentModel, {
        fileName: 'board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
}

/**
 * Parses one SVG viewBox string.
 * @param {string | null} value ViewBox attribute.
 * @returns {{ minX: number, minY: number, width: number, height: number }}
 */
function parseViewBox(value) {
    const [minX, minY, width, height] = String(value || '')
        .trim()
        .split(/\s+/u)
        .map(Number)
    return { minX, minY, width, height }
}

/**
 * Verifies the PCB toolbar can restore the renderer default viewBox.
 */
test('PcbViewController resets the CircuitJSON PCB viewport', () => {
    const content = new FakeContentNode(new FakeDocument())
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )
    const svg = content.querySelector('.pcb-svg')
    const initialViewBox = svg?.getAttribute('viewBox')

    svg?.setAttribute('viewBox', '1 1 2 2')
    content.clickResetView()

    assert.equal(svg?.getAttribute('viewBox'), initialViewBox)

    controller.dispose()
})

/**
 * Verifies hover-focus is opt-in before it pans the PCB viewport.
 */
test('PcbViewController focuses hover candidates only after enabling hover focus', () => {
    const content = new FakeContentNode(new FakeDocument())
    const controller = new PcbViewController(
        content,
        createCircuitJsonPcbDocument()
    )
    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )
    const clientX = ((1 - viewBox.minX) / viewBox.width) * 400
    const clientY = ((1 - viewBox.minY) / viewBox.height) * 200

    content.movePcbBoard(clientX, clientY)
    const before = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )

    content.clickHoverFocusToggle()
    content.movePcbBoard(clientX, clientY)
    const after = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )

    assert.equal(before.width, viewBox.width)
    assert.ok(after.width < before.width)
    assert.ok(after.minX < 1)
    assert.ok(after.minX + after.width > 1)

    controller.dispose()
})
