import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbViewController } from '../../src/ui/PcbViewController.mjs'

/**
 * Minimal event target for controller tests.
 */
class FakeEventTarget {
    #listeners

    /**
     * Creates an empty fake event target.
     */
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
 * Minimal class list for viewport controller tests.
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
 * Minimal fake owner document.
 */
class FakeDocument extends FakeEventTarget {
    /**
     * Creates a fake owner document.
     */
    constructor() {
        super()
        this.documentElement = { classList: new FakeClassList() }
    }
}

/**
 * Minimal SVG element for viewBox-based hit tests.
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
 * Minimal PCB view mount node.
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
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    clickPcbBoard(clientX, clientY) {
        if (!this.#svg) return

        this.dispatch('click', {
            target: this.#svg,
            clientX,
            clientY,
            preventDefault() {}
        })
    }
}

/**
 * Builds a compact two-sided Gerber document.
 * @returns {object}
 */
function createGerberDocument() {
    return {
        sourceFormat: 'gerber',
        kind: 'pcb',
        fileName: 'fabrication',
        pcb: {
            fabrication: {
                layers: [
                    {
                        id: 'top-copper',
                        fileName: 'sample-F_Cu.gtl',
                        role: 'top-copper',
                        side: 'top',
                        primitives: [
                            {
                                type: 'flash',
                                shape: 'circle',
                                x: 1,
                                y: 1,
                                diameter: 0.5
                            }
                        ],
                        drills: []
                    },
                    {
                        id: 'bottom-copper',
                        fileName: 'sample-B_Cu.gbl',
                        role: 'bottom-copper',
                        side: 'bottom',
                        primitives: [
                            {
                                type: 'line',
                                x1: 6,
                                y1: 2,
                                x2: 8,
                                y2: 2,
                                width: 0.5
                            }
                        ],
                        drills: []
                    }
                ]
            }
        }
    }
}

/**
 * Parses a viewBox value.
 * @param {string | null} value Raw viewBox value.
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
 * Verifies Gerber render mode can be driven by an external sidebar selection
 * without creating separate documents.
 */
test('PcbViewController applies external Gerber render selections', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const controller = new PcbViewController(content, createGerberDocument())

    assert.match(content.innerHTML, /data-render-mode="composite"/)
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-top-copper[^"]*"/
    )
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-bottom-copper[^"]*"/
    )

    controller.setGerberRenderSelection({
        renderMode: 'separated',
        layerId: 'top-copper'
    })

    assert.match(content.innerHTML, /data-render-mode="separated"/)
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-top-copper[^"]*"/
    )
    assert.doesNotMatch(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-bottom-copper[^"]*"/
    )

    controller.setGerberRenderSelection({
        renderMode: 'separated',
        layerIds: ['top-copper', 'bottom-copper']
    })

    assert.match(content.innerHTML, /data-render-mode="separated"/)
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-top-copper[^"]*"/
    )
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-bottom-copper[^"]*"/
    )

    controller.setGerberRenderSelection({
        renderMode: 'composite',
        layerId: 'bottom-copper'
    })

    assert.match(content.innerHTML, /data-render-mode="composite"/)
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-top-copper[^"]*"/
    )
    assert.match(
        content.innerHTML,
        /<g class="gerber-layer gerber-role-bottom-copper[^"]*"/
    )

    controller.dispose()
})

test('PcbViewController maps mirrored Gerber bottom hits to fabrication coordinates', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const candidateChanges = []
    const controller = new PcbViewController(content, createGerberDocument(), {
        side: 'bottom',
        onInteractionCandidatesChange: (change) => {
            candidateChanges.push(change)
        }
    })
    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )
    const visualX = viewBox.minX + (viewBox.minX + viewBox.width) - 6
    const visualY = viewBox.minY + (viewBox.minY + viewBox.height) - 2
    const clientX = ((visualX - viewBox.minX) / viewBox.width) * 400
    const clientY = ((visualY - viewBox.minY) / viewBox.height) * 200

    content.clickPcbBoard(clientX, clientY)

    assert.equal(candidateChanges.length, 1)
    assert.equal(Math.round(candidateChanges[0].point.x), 6)
    assert.equal(Math.round(candidateChanges[0].point.y), 2)
    assert.equal(candidateChanges[0].selectedCandidate.role, 'bottom-copper')

    controller.dispose()
})
