import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for AppView DOM fakes.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * Registers one listener.
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
     * Removes one listener.
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * Dispatches one synthetic event.
     * @param {string} type
     * @param {Record<string, any>} [event]
     * @returns {void}
     */
    dispatch(type, event = {}) {
        const payload = { ...event, type, currentTarget: this, target: this }
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener(payload)
        )
    }

    /**
     * Returns the listener count for one event type.
     * @param {string} type
     * @returns {number}
     */
    getListenerCount(type) {
        return this.#listeners.get(type)?.size || 0
    }
}

/**
 * Minimal class list for SVG interaction assertions.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor(initialTokens = []) {
        this.#tokens = new Set(initialTokens)
    }

    /**
     * Adds one or more class tokens.
     * @param {...string} tokens
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * Removes one or more class tokens.
     * @param {...string} tokens
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * Returns true when the class token exists.
     * @param {string} token
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal generic DOM node for AppView rendering tests.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map()
        this._innerHTML = ''
        this.textContent = ''
        this.value = ''
    }

    /**
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * Returns one attribute value.
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Returns the first matching child node when supported.
     * @param {string} _selector
     * @returns {any}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * Returns matching child nodes when supported.
     * @param {string} _selector
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }
}

/**
 * Minimal tab button node.
 */
class FakeTabButton extends FakeNode {
    /**
     * @param {string} viewName
     */
    constructor(viewName) {
        super()
        this.setAttribute('data-view', viewName)
    }
}

/**
 * Minimal container that exposes tab buttons.
 */
class FakeTabsNode extends FakeNode {
    /** @type {FakeTabButton[]} */
    #buttons

    constructor() {
        super()
        this.#buttons = [
            new FakeTabButton('schematic'),
            new FakeTabButton('pcb'),
            new FakeTabButton('3d'),
            new FakeTabButton('bom'),
            new FakeTabButton('diagnostics')
        ]
    }

    /**
     * Returns the fake tab buttons for AppView updates.
     * @param {string} selector
     * @returns {FakeTabButton[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-view]' ? this.#buttons : []
    }
}

/**
 * Minimal fake document used by rendered schematic integration tests.
 */
class FakeDocument extends FakeEventTarget {
    /** @type {Map<string, any>} */
    #nodes

    constructor() {
        super()
        this.#nodes = new Map([
            ['#fileInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#summaryGrid', new FakeNode()],
            ['#viewContent', new FakeContentNode(this)],
            ['#activeDocumentName', new FakeNode()],
            ['#viewTabs', new FakeTabsNode()],
            ['#diagnosticsCount', new FakeNode()]
        ])
    }

    /**
     * Returns one node by selector.
     * @param {string} selector
     * @returns {any}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Minimal rendered SVG node.
 */
class FakeSvgElement extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    /** @type {{ left: number, top: number, width: number, height: number }} */
    #rect

    /**
     * @param {FakeDocument} ownerDocument
     * @param {string} viewBox
     */
    constructor(ownerDocument, viewBox) {
        super()
        this.#attributes = new Map([['viewBox', viewBox]])
        this.#rect = { left: 0, top: 0, width: 400, height: 200 }
        this.ownerDocument = ownerDocument
        this.classList = new FakeClassList(['schematic-svg'])
    }

    /**
     * Returns one attribute value.
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }

    /**
     * Returns the fake client box.
     * @returns {{ left: number, top: number, width: number, height: number }}
     */
    getBoundingClientRect() {
        return this.#rect
    }
}

/**
 * Minimal content node that parses rendered schematic markup.
 */
class FakeContentNode extends FakeNode {
    /** @type {FakeDocument} */
    #ownerDocument

    /** @type {FakeSvgElement | null} */
    #schematicSvg

    /**
     * @param {FakeDocument} ownerDocument
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#schematicSvg = null
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this.textContent = ''
        this._innerHTML = String(value)
        const viewBoxMatch = this._innerHTML.match(/viewBox="([^"]+)"/)
        const hasSchematicSvg = /class="schematic-svg"/.test(this._innerHTML)

        this.#schematicSvg =
            hasSchematicSvg && viewBoxMatch
                ? new FakeSvgElement(this.#ownerDocument, viewBoxMatch[1])
                : null
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML || ''
    }

    /**
     * Returns the rendered fake schematic SVG when present.
     * @param {string} selector
     * @returns {FakeSvgElement | null}
     */
    querySelector(selector) {
        return selector === '.schematic-svg' ? this.#schematicSvg : null
    }
}

/**
 * Builds a minimal schematic snapshot accepted by AppView.
 * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: any }}
 */
function createSchematicSnapshot() {
    return {
        activeView: 'schematic',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'File parsed successfully.',
        activeFileName: 'demo.SchDoc',
        documentModel: {
            kind: 'schematic',
            diagnostics: [],
            summary: {
                title: 'Demo schematic',
                componentCount: 0,
                lineCount: 1,
                textCount: 0,
                bomRowCount: 0
            },
            schematic: {
                sheet: { width: 200, height: 100 },
                lines: [
                    {
                        x1: 0,
                        y1: 0,
                        x2: 200,
                        y2: 0,
                        color: '#000080',
                        width: 1
                    }
                ],
                texts: [],
                components: [],
                pins: [],
                ports: [],
                crosses: []
            }
        }
    }
}

/**
 * Verifies AppView makes the rendered schematic SVG interactive.
 */
test('AppView wires mouse-wheel zoom onto the rendered schematic svg', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createSchematicSnapshot())

    const svg = fakeDocument.querySelector('#viewContent').querySelector(
        '.schematic-svg'
    )

    svg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '2.5 1.25 190 95')
})

/**
 * Verifies AppView resets the schematic camera and disposes old listeners on
 * re-render.
 */
test('AppView resets the schematic viewBox when the schematic is rendered again', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const snapshot = createSchematicSnapshot()

    view.render(snapshot)

    const firstSvg = fakeDocument.querySelector('#viewContent').querySelector(
        '.schematic-svg'
    )

    firstSvg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(firstSvg.getAttribute('viewBox'), '2.5 1.25 190 95')

    view.render(snapshot)

    const secondSvg = fakeDocument.querySelector('#viewContent').querySelector(
        '.schematic-svg'
    )

    assert.equal(secondSvg.getAttribute('viewBox'), '0 0 200 100')
    assert.equal(firstSvg.getListenerCount('wheel'), 0)
    assert.equal(firstSvg.getListenerCount('mousedown'), 0)
})
