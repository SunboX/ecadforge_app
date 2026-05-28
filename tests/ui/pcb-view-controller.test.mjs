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

    /**
     * @param {string} type Event type.
     * @returns {number}
     */
    getListenerCount(type) {
        return this.#listeners.get(type)?.size || 0
    }
}

/**
 * Minimal generic fake node.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
        this.classList = new FakeClassList()
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
 * Minimal PCB side selector button.
 */
class FakePcbSideButton extends FakeNode {
    /**
     * @param {string} side PCB side.
     * @param {string} pressed Pressed state.
     */
    constructor(side, pressed) {
        super()
        this.setAttribute('data-pcb-view-side', side)
        this.setAttribute('aria-pressed', pressed)
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakePcbSideButton | null}
     */
    closest(selector) {
        return selector === '[data-pcb-view-side]' ? this : null
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

    /** @type {Map<string, FakePcbSideButton>} */
    #buttonsBySide

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#svg = null
        this.#buttonsBySide = new Map()
        this._innerHTML = ''
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#svg = null
        this.#buttonsBySide = new Map()

        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        if (svgMatch) {
            this.#svg = new FakeSvgElement(this.#ownerDocument, svgMatch[1])
        }

        for (const match of this._innerHTML.matchAll(
            /<button[^>]*data-pcb-view-side="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>/g
        )) {
            this.#buttonsBySide.set(
                match[1],
                new FakePcbSideButton(match[1], match[2])
            )
        }
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML || ''
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgElement | FakePcbSideButton | null}
     */
    querySelector(selector) {
        if (selector === '.pcb-svg') {
            return this.#svg
        }

        const sideMatch = selector.match(/^\[data-pcb-view-side="([^"]+)"\]$/)
        if (sideMatch) {
            return this.#buttonsBySide.get(sideMatch[1]) || null
        }

        return null
    }

    /**
     * @param {string} side PCB side.
     * @returns {void}
     */
    clickPcbSide(side) {
        const button = this.#buttonsBySide.get(side)
        if (!button) {
            return
        }

        this.dispatch('click', { target: button, preventDefault() {} })
    }
}

/**
 * Builds PCB controller fixtures.
 */
class PcbViewControllerFixture {
    /**
     * @returns {object}
     */
    static createAltiumPcbDocument() {
        return {
            kind: 'pcb',
            fileName: 'side-toggle.PcbDoc',
            summary: { title: 'side-toggle' },
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
                layers: [{ name: 'Top Layer', layerId: 1 }],
                primitiveLayers: [
                    { name: 'Top Overlay', layerId: 33 },
                    { name: 'Bottom Overlay', layerId: 34 }
                ],
                texts: [
                    {
                        text: 'TOP_SIDE_MARK',
                        x: 20,
                        y: 20,
                        height: 8,
                        layerId: 33,
                        visible: true
                    },
                    {
                        text: 'BOTTOM_SIDE_MARK',
                        x: 40,
                        y: 40,
                        height: 8,
                        layerId: 34,
                        visible: true
                    }
                ],
                components: [],
                pads: []
            },
            bom: []
        }
    }
}

/**
 * Verifies the PCB controller renders and switches between board sides.
 */
test('PcbViewController switches PCB sides from the toolbar', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const controller = new PcbViewController(
        content,
        PcbViewControllerFixture.createAltiumPcbDocument()
    )

    const topButton = content.querySelector('[data-pcb-view-side="top"]')
    const bottomButton = content.querySelector('[data-pcb-view-side="bottom"]')
    const topSvg = content.querySelector('.pcb-svg')

    assert.equal(topButton?.getAttribute('aria-pressed'), 'true')
    assert.equal(bottomButton?.getAttribute('aria-pressed'), 'false')
    assert.match(content.innerHTML, /Top-facing composite view/)
    assert.match(content.innerHTML, />TOP_SIDE_MARK<\/text>/)
    assert.equal(topSvg?.getListenerCount('wheel'), 1)

    content.clickPcbSide('bottom')

    const pressedTopButton = content.querySelector('[data-pcb-view-side="top"]')
    const pressedBottomButton = content.querySelector(
        '[data-pcb-view-side="bottom"]'
    )
    const bottomSvg = content.querySelector('.pcb-svg')

    assert.equal(topSvg?.getListenerCount('wheel'), 0)
    assert.equal(pressedTopButton?.getAttribute('aria-pressed'), 'false')
    assert.equal(pressedBottomButton?.getAttribute('aria-pressed'), 'true')
    assert.match(content.innerHTML, /Bottom-facing composite view/)
    assert.match(content.innerHTML, />BOTTOM_SIDE_MARK<\/text>/)
    assert.equal(bottomSvg?.getListenerCount('wheel'), 1)

    controller.dispose()

    assert.equal(bottomSvg?.getListenerCount('wheel'), 0)
})
