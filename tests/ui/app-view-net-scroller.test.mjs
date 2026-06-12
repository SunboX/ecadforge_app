import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal class list for AppView layout state.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor() {
        this.#tokens = new Set()
    }

    /**
     * @param {...string} tokens Class names.
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * @param {...string} tokens Class names.
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }
}

/**
 * Minimal event target.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type)?.add(listener)
    }

    /**
     * @param {string} type Event type.
     * @param {Record<string, any>} event Event payload.
     * @returns {void}
     */
    dispatch(type, event = {}) {
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener({
                type,
                target: this,
                preventDefault() {},
                stopPropagation() {},
                stopImmediatePropagation() {},
                ...event
            })
        )
    }
}

/**
 * Minimal DOM node.
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
        this.hidden = false
        this.scrollTop = 0
        this.scrollLeft = 0
        this.classList = new FakeClassList()
    }

    /**
     * @param {string} name Attribute name.
     * @param {string} value Attribute value.
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') this.hidden = true
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
        if (name === 'hidden') this.hidden = false
    }

    /**
     * @param {string} _selector Selector.
     * @returns {FakeNode | null}
     */
    closest(_selector) {
        return null
    }

    /**
     * @param {string} _selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * @param {string} _selector Selector.
     * @returns {FakeNode[]}
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
        return this._innerHTML || ''
    }
}

/**
 * Minimal selectable net row.
 */
class FakeNetRow extends FakeNode {
    /**
     * @param {string} netName Net name.
     * @param {string} documentId Document id.
     */
    constructor(netName, documentId) {
        super()
        this.scrollIntoViewCalls = []
        this.setAttribute('data-pcb-net-key', netName)
        this.setAttribute('data-document-id', documentId)
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeNetRow | null}
     */
    closest(selector) {
        if (selector === '[data-pcb-net-key]') return this
        return null
    }

    /**
     * @param {ScrollIntoViewOptions | boolean} options Scroll options.
     * @returns {void}
     */
    scrollIntoView(options = true) {
        this.scrollIntoViewCalls.push(options)
    }
}

/**
 * Sidebar mount that parses rendered net rows.
 */
class FakeSidebarNode extends FakeNode {
    /** @type {FakeNode | null} */
    #sidebar

    /** @type {FakeNode | null} */
    #panel

    /** @type {Map<string, FakeNetRow>} */
    #nets

    constructor() {
        super()
        this.#sidebar = null
        this.#panel = null
        this.#nets = new Map()
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#nets = new Map()
        this.#sidebar = null
        this.#panel = null

        const sidebarMatch = this._innerHTML.match(
            /<div class="viewer-sidebar"[^>]*data-active-sidebar-tab="([^"]*)"[^>]*data-active-document-id="([^"]*)"/
        )
        if (sidebarMatch) {
            this.#sidebar = new FakeNode()
            this.#sidebar.setAttribute(
                'data-active-sidebar-tab',
                sidebarMatch[1]
            )
            this.#sidebar.setAttribute(
                'data-active-document-id',
                sidebarMatch[2]
            )
        }
        if (this._innerHTML.includes('viewer-sidebar__panel')) {
            this.#panel = new FakeNode()
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="[^"]*viewer-sidebar__net-row[^"]*"[^>]*data-pcb-net-key="([^"]+)"[^>]*data-document-id="([^"]*)"/g
        )) {
            this.#nets.set(match[1], new FakeNetRow(match[1], match[2]))
        }
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        if (selector === '.viewer-sidebar') return this.#sidebar
        if (selector === '.viewer-sidebar__panel') return this.#panel
        return null
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeNetRow[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-pcb-net-key]') {
            return [...this.#nets.values()]
        }
        return []
    }

    /**
     * @param {string} netName Net name.
     * @returns {void}
     */
    clickNet(netName) {
        const row = this.#nets.get(netName)
        if (row) this.dispatch('click', { target: row })
    }
}

/**
 * Minimal document for AppView rendering.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.body = new FakeNode()
        this.#nodes = new Map([
            ['#statusMessage', new FakeNode()],
            ['#landingStatusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#viewerStage', new FakeNode()],
            ['#documentRail', new FakeSidebarNode()],
            ['#viewContent', new FakeNode()],
            ['#viewTabs', new FakeNode()]
        ])
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Builds a PCB snapshot with selectable nets.
 * @param {object} [overrides] Snapshot overrides.
 * @returns {object}
 */
function createPcbSnapshot(overrides = {}) {
    const documentModel = {
        fileName: 'demo.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: { title: 'Demo board' },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500 },
            layers: [],
            components: [],
            nets: [{ name: 'GND' }, { name: 'SENSE_A' }]
        },
        bom: []
    }

    return {
        activeView: 'diagnostics',
        activeSidebarTab: 'nets',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: 'demo.PcbDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel,
        ...overrides
    }
}

/**
 * Verifies render-originated net selections scroll the Nets row into view.
 */
test('AppView scrolls selected net rows into view', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(
        createPcbSnapshot({
            selectedNets: { 'doc-1': 'SENSE_A' }
        })
    )

    const selectedRow = fakeDocument
        .querySelector('#documentRail')
        .querySelectorAll('[data-pcb-net-key]')
        .find((row) => row.getAttribute('data-pcb-net-key') === 'SENSE_A')

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [
        {
            block: 'center',
            inline: 'nearest'
        }
    ])
})

/**
 * Verifies list-originated net selections preserve the current Nets scroll.
 */
test('AppView suppresses selected net row scroll after a net row click', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.bindPcbNetSelectionChange((change) => {
        view.render(
            createPcbSnapshot({
                selectedNets: { 'doc-1': change.netName }
            })
        )
    })
    view.render(createPcbSnapshot())

    const rail = fakeDocument.querySelector('#documentRail')
    rail.clickNet('SENSE_A')
    const selectedRow = rail
        .querySelectorAll('[data-pcb-net-key]')
        .find((row) => row.getAttribute('data-pcb-net-key') === 'SENSE_A')

    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})
