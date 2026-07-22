import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners = new Map()

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
        this.#listeners.get(type)?.add(listener)
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
     * @param {Record<string, any>} event Event payload.
     * @returns {void}
     */
    dispatch(type, event = {}) {
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener({ type, target: this, currentTarget: this, ...event })
        )
    }
}

/**
 * Minimal class list.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens = new Set()

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
}

/**
 * Minimal node.
 */
class FakeNode extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes = new Map()

    constructor() {
        super()
        this.classList = new FakeClassList()
        this._innerHTML = ''
        this.textContent = ''
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
     * @param {string} name Attribute name.
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
    }

    /**
     * @param {string} _selector Selector.
     * @returns {any}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * @param {string} _selector Selector.
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }
}

/**
 * Minimal SVG element.
 */
class FakeSvgNode extends FakeNode {
    /**
     * @param {FakeDocument} ownerDocument Owner document.
     * @param {string} viewBox Viewbox value.
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
 * Minimal PCB side button.
 */
class FakePcbSideButton extends FakeNode {
    /**
     * @param {string} side PCB side.
     */
    constructor(side) {
        super()
        this.setAttribute('data-pcb-view-side', side)
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
 * Content node that exposes rendered PCB controls.
 */
class FakeContentNode extends FakeNode {
    /** @type {FakeDocument} */
    #ownerDocument

    /** @type {FakeSvgNode | null} */
    #svg = null

    /** @type {Map<string, FakePcbSideButton>} */
    #sideButtons = new Map()

    /**
     * @param {FakeDocument} ownerDocument Owner document.
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.renderCount = 0
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this.renderCount += 1
        this._innerHTML = String(value)
        this.#svg = null
        this.#sideButtons = new Map()
        const svgMatch = this._innerHTML.match(
            /<svg[^>]*class="[^"]*\bpcb-svg\b[^"]*"[^>]*viewBox="([^"]+)"/
        )
        if (svgMatch)
            this.#svg = new FakeSvgNode(this.#ownerDocument, svgMatch[1])
        for (const match of this._innerHTML.matchAll(
            /data-pcb-view-side="([^"]+)"/g
        )) {
            this.#sideButtons.set(match[1], new FakePcbSideButton(match[1]))
        }
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeSvgNode | null}
     */
    querySelector(selector) {
        return selector === '.pcb-svg' ? this.#svg : null
    }

    /**
     * @param {string} side PCB side.
     * @returns {void}
     */
    clickPcbSide(side) {
        const button = this.#sideButtons.get(side)
        if (button)
            this.dispatch('click', { target: button, preventDefault() {} })
    }

    /**
     * @returns {string}
     */
    activeSide() {
        return (
            this._innerHTML.match(/data-pcb-view-active-side="([^"]+)"/)?.[1] ||
            ''
        )
    }
}

/**
 * Minimal document.
 */
class FakeDocument extends FakeEventTarget {
    constructor() {
        super()
        this.body = { classList: new FakeClassList() }
        this.documentElement = { classList: new FakeClassList() }
        this.#nodes = new Map([
            ['#fileInput', new FakeNode()],
            ['#folderInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#brandHomeLink', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#viewerStage', new FakeNode()],
            ['#documentRail', new FakeNode()],
            ['#viewContent', new FakeContentNode(this)],
            ['#viewTabs', new FakeNode()],
            ['#githubOpenForm', new FakeNode()],
            ['#githubUrlInput', new FakeNode()],
            ['#pcbStylerCta', new FakeNode()],
            ['#pcbStylerLink', new FakeNode()],
            ['#pcbStylerDismiss', new FakeNode()]
        ])
    }

    /** @type {Map<string, FakeNode>} */
    #nodes

    /**
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Creates a PCB snapshot.
 * @param {object} [patch] Snapshot patch.
 * @returns {object}
 */
function createPcbSnapshot(patch = {}) {
    const documentModel = {
        fileName: 'demo.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: { title: 'Demo board' },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500, segments: [] },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            components: [],
            pads: []
        },
        bom: []
    }
    return {
        activeView: 'pcb',
        activeSidebarTab: 'layers',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: 'demo.PcbDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel,
        ...patch
    }
}

/**
 * Verifies AppView preserves the current PCB side across sidebar re-renders.
 */
test('AppView preserves the PCB side when layer visibility re-renders', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const content = fakeDocument.querySelector('#viewContent')

    view.render(createPcbSnapshot())
    content.clickPcbSide('bottom')

    assert.equal(content.activeSide(), 'bottom')

    view.render(
        createPcbSnapshot({
            hiddenPcbLayers: { 'doc-1': ['Top Layer'] }
        })
    )

    assert.equal(content.activeSide(), 'bottom')
})

/**
 * Verifies sidebar-only state changes leave the mounted PCB view intact.
 */
test('AppView keeps PCB content mounted for sidebar-only re-renders', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const content = fakeDocument.querySelector('#viewContent')
    const snapshot = createPcbSnapshot()

    view.render(snapshot)
    view.render({
        ...snapshot,
        activeSidebarTab: 'components'
    })

    assert.equal(content.renderCount, 1)
    assert.equal(content.activeSide(), 'top')
})
