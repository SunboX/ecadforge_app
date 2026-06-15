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
 * Minimal generic fake node.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
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
        this.#svg = null

        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        if (svgMatch) {
            this.#svg = new FakeSvgElement(this.#ownerDocument, svgMatch[1])
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
     * @returns {FakeSvgElement | null}
     */
    querySelector(selector) {
        return selector === '.pcb-svg' ? this.#svg : null
    }

    /**
     * Drags the rendered PCB SVG using the viewport controller listeners.
     * @param {number} startX Starting client x coordinate.
     * @param {number} startY Starting client y coordinate.
     * @param {number} endX Ending client x coordinate.
     * @param {number} endY Ending client y coordinate.
     * @returns {void}
     */
    dragPcbBoard(startX, startY, endX, endY) {
        if (!this.#svg) {
            return
        }

        const downEvent = {
            target: this.#svg,
            button: 0,
            clientX: startX,
            clientY: startY,
            preventDefault() {}
        }
        this.#svg.dispatch('mousedown', downEvent)
        this.dispatch('mousedown', downEvent)
        this.#ownerDocument.dispatch('mousemove', {
            target: this.#svg,
            buttons: 1,
            clientX: endX,
            clientY: endY,
            preventDefault() {}
        })
        this.#ownerDocument.dispatch('mouseup', {
            target: this.#svg,
            button: 0,
            clientX: endX,
            clientY: endY
        })
    }

    /**
     * Dispatches a click on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @returns {void}
     */
    clickPcbBoard(clientX, clientY) {
        if (!this.#svg) {
            return
        }

        this.dispatch('click', {
            target: this.#svg,
            clientX,
            clientY,
            preventDefault() {}
        })
    }

    /**
     * Dispatches one or more wheel events on the rendered PCB SVG.
     * @param {number} clientX Client x coordinate.
     * @param {number} clientY Client y coordinate.
     * @param {number} deltaY Wheel delta y.
     * @param {number} [count] Number of wheel events to dispatch.
     * @returns {void}
     */
    wheelPcbBoard(clientX, clientY, deltaY, count = 1) {
        if (!this.#svg) {
            return
        }

        for (let index = 0; index < count; index += 1) {
            this.#svg.dispatch('wheel', {
                target: this.#svg,
                clientX,
                clientY,
                deltaY,
                preventDefault() {}
            })
        }
    }
}

/**
 * Builds a small selectable PCB document.
 * @returns {object}
 */
function createSelectablePcbDocument() {
    return {
        kind: 'pcb',
        fileName: 'board-selection.PcbDoc',
        summary: { title: 'board-selection' },
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
 * Parses an SVG viewBox string.
 * @param {string | null} value Raw viewBox value.
 * @returns {{ x: number, y: number, width: number, height: number }}
 */
function parseViewBox(value) {
    const [x, y, width, height] = String(value || '')
        .trim()
        .split(/\s+/u)
        .map(Number)

    return { x, y, width, height }
}

/**
 * Verifies a PCB pan drag does not clear the current board selection when the
 * browser dispatches a click after mouse release.
 */
test('PcbViewController keeps PCB component selection after a board pan drag', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const selections = []
    const controller = new PcbViewController(
        content,
        createSelectablePcbDocument(),
        {
            documentId: 'doc-1',
            selectedComponentKey: 'U1',
            onComponentSelectionChange: (change) => {
                selections.push(change)
            }
        }
    )

    content.dragPcbBoard(200, 100, 260, 120)
    content.clickPcbBoard(700, 350)

    assert.deepEqual(selections, [])

    controller.dispose()
})

/**
 * Verifies an empty board click without drag still clears selection.
 */
test('PcbViewController clears PCB component selection after a stationary board click', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const selections = []
    const controller = new PcbViewController(
        content,
        createSelectablePcbDocument(),
        {
            documentId: 'doc-1',
            selectedComponentKey: 'U1',
            onComponentSelectionChange: (change) => {
                selections.push(change)
            }
        }
    )

    content.dragPcbBoard(700, 350, 700, 350)
    content.clickPcbBoard(700, 350)

    assert.deepEqual(selections, [
        {
            documentId: 'doc-1',
            componentKey: '',
            source: 'pcb-board'
        }
    ])

    controller.dispose()
})

/**
 * Verifies selecting a component from a preserved zoomed viewport does not
 * shrink the zoom-out limit to that preserved viewBox.
 */
test('PcbViewController can zoom back out after centering a selected component', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const documentModel = createSelectablePcbDocument()
    const controller = new PcbViewController(content, documentModel)
    const firstSvg = content.querySelector('.pcb-svg')

    firstSvg?.setAttribute('viewBox', '0 0 20 20')
    controller.dispose()

    const remountedController = new PcbViewController(content, documentModel, {
        selectedComponentKey: 'U1'
    })

    content.wheelPcbBoard(200, 100, 100, 120)

    const viewBox = parseViewBox(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox')
    )

    assert.ok(viewBox.width >= 100)
    assert.ok(viewBox.height >= 100)

    remountedController.dispose()
})

/**
 * Verifies PCB-origin component selection preserves the current viewport
 * instead of recentering a component that was already clicked in view.
 */
test('PcbViewController preserves viewport after selecting a component on the PCB', () => {
    const fakeDocument = new FakeDocument()
    const content = new FakeContentNode(fakeDocument)
    const documentModel = createSelectablePcbDocument()
    const selections = []
    const controller = new PcbViewController(content, documentModel, {
        documentId: 'doc-1',
        onComponentSelectionChange: (change) => {
            selections.push(change)
        }
    })
    const firstSvg = content.querySelector('.pcb-svg')

    firstSvg?.setAttribute('viewBox', '45 45 20 20')
    content.clickPcbBoard(100, 50)
    controller.dispose()

    const remountedController = new PcbViewController(content, documentModel, {
        documentId: 'doc-1',
        selectedComponentKey: selections[0]?.componentKey || ''
    })

    assert.equal(
        content.querySelector('.pcb-svg')?.getAttribute('viewBox'),
        '45 45 20 20'
    )

    remountedController.dispose()
})
