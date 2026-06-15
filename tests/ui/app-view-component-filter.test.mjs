import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for component-filter view tests.
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
     * @param {Record<string, any>} [event] Event payload.
     * @returns {void}
     */
    dispatch(type, event = {}) {
        const payload = {
            type,
            currentTarget: this,
            target: this,
            preventDefault() {},
            ...event
        }
        ;[...(this.#listeners.get(type) || [])].forEach((listener) =>
            listener(payload)
        )
    }
}

/**
 * Minimal class list.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor() {
        this.#tokens = new Set()
    }

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
        return this._innerHTML || ''
    }
}

/**
 * Minimal component filter input.
 */
class FakeComponentFilterInput extends FakeNode {
    /**
     * @param {string} value Input value.
     */
    constructor(value = '') {
        super()
        this.value = value
    }

    /**
     * @param {string} selector Closest selector.
     * @returns {FakeComponentFilterInput | null}
     */
    closest(selector) {
        return selector === '[data-component-filter]' ? this : null
    }
}

/**
 * Minimal selectable component row button.
 */
class FakeComponentButton extends FakeNode {
    /**
     * @param {string} key Component key.
     * @param {string} documentId Document id.
     * @param {string} selected Pressed state.
     */
    constructor(key, documentId, selected) {
        super()
        this.scrollIntoViewCalls = []
        this.scrollIntoView = (options = true) => {
            this.scrollIntoViewCalls.push(options)
        }
        this.setAttribute('data-pcb-component-key', key)
        this.setAttribute('data-document-id', documentId)
        this.setAttribute('aria-pressed', selected)
    }

    /**
     * @param {string} selector Closest selector.
     * @returns {FakeComponentButton | null}
     */
    closest(selector) {
        return selector === '[data-pcb-component-key]' ? this : null
    }
}

/**
 * Minimal filterable component row shell.
 */
class FakeComponentRow extends FakeNode {
    /**
     * @param {string} key Component key.
     * @param {string} search Search text.
     */
    constructor(key, search) {
        super()
        this.setAttribute('data-pcb-component-key', key)
        this.setAttribute('data-component-search', search)
    }

    /**
     * @param {string} name Attribute name.
     * @param {boolean} enabled Whether the attribute is enabled.
     * @returns {void}
     */
    toggleAttribute(name, enabled) {
        if (name === 'hidden') {
            this.hidden = Boolean(enabled)
        }
    }
}

/**
 * Minimal component group.
 */
class FakeComponentGroup extends FakeNode {
    /** @type {FakeComponentRow[]} */
    #rows

    /**
     * @param {FakeComponentRow[]} rows Component rows.
     */
    constructor(rows) {
        super()
        this.#rows = rows
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeComponentRow[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-component-search]' ? this.#rows : []
    }

    /**
     * @param {string} name Attribute name.
     * @param {boolean} enabled Whether the attribute is enabled.
     * @returns {void}
     */
    toggleAttribute(name, enabled) {
        if (name === 'hidden') {
            this.hidden = Boolean(enabled)
        }
    }
}

/**
 * Sidebar mount that parses component rows and filter inputs.
 */
class FakeSidebarNode extends FakeNode {
    /** @type {Map<string, FakeComponentButton>} */
    #buttons

    /** @type {Map<string, FakeComponentRow>} */
    #rows

    /** @type {FakeComponentGroup[]} */
    #groups

    /** @type {FakeComponentFilterInput | null} */
    #filterInput

    /** @type {FakeNode | null} */
    #sidebarRoot

    /** @type {FakeNode | null} */
    #panel

    constructor() {
        super()
        this.#buttons = new Map()
        this.#rows = new Map()
        this.#groups = []
        this.#filterInput = null
        this.#sidebarRoot = null
        this.#panel = null
    }

    /**
     * @param {string} value Markup.
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#buttons = new Map()
        this.#rows = new Map()
        this.#groups = []
        this.#filterInput = null
        this.#sidebarRoot = null
        this.#panel = null
        this.#parseSidebarRoot()
        this.#parsePanel()
        this.#parseComponentFilter()
        this.#parseComponents()
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML || ''
    }

    /**
     * @param {string} selector Selector.
     * @returns {FakeNode | FakeComponentFilterInput | null}
     */
    querySelector(selector) {
        if (selector === '.viewer-sidebar') return this.#sidebarRoot
        if (selector === '.viewer-sidebar__panel') return this.#panel
        if (selector === '[data-component-filter]') return this.#filterInput
        return null
    }

    /**
     * @param {string} selector Selector.
     * @returns {any[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-component-group]') return this.#groups
        if (selector === '[data-pcb-component-key]') {
            return [...this.#buttons.values()]
        }
        return []
    }

    /**
     * @param {string} value Search value.
     * @returns {void}
     */
    inputComponentFilter(value) {
        if (!this.#filterInput) return
        this.#filterInput.value = value
        this.dispatch('input', { target: this.#filterInput })
    }

    /**
     * @param {string} componentKey Component key.
     * @returns {void}
     */
    clickComponent(componentKey) {
        const button = this.#buttons.get(componentKey)
        if (button) this.dispatch('click', { target: button })
    }

    /**
     * @returns {string}
     */
    componentFilterValue() {
        return this.#filterInput?.value || ''
    }

    /**
     * @param {string} componentKey Component key.
     * @returns {boolean}
     */
    componentRowHidden(componentKey) {
        return this.#rows.get(componentKey)?.hidden === true
    }

    /**
     * @returns {void}
     */
    #parseSidebarRoot() {
        const match = this._innerHTML.match(
            /<div class="viewer-sidebar"[^>]*data-active-sidebar-tab="([^"]*)"[^>]*data-active-document-id="([^"]*)"/
        )
        if (!match) return
        this.#sidebarRoot = new FakeNode()
        this.#sidebarRoot.setAttribute('data-active-sidebar-tab', match[1])
        this.#sidebarRoot.setAttribute('data-active-document-id', match[2])
    }

    /**
     * @returns {void}
     */
    #parsePanel() {
        if (this._innerHTML.includes('viewer-sidebar__panel')) {
            this.#panel = new FakeNode()
        }
    }

    /**
     * @returns {void}
     */
    #parseComponentFilter() {
        if (this._innerHTML.includes('data-component-filter')) {
            this.#filterInput = new FakeComponentFilterInput()
        }
    }

    /**
     * @returns {void}
     */
    #parseComponents() {
        for (const match of this._innerHTML.matchAll(
            /<div class="viewer-sidebar__component-row-shell[^"]*" data-component-search="([^"]*)"><button class="[^"]*viewer-sidebar__component-row[^"]*"[^>]*data-pcb-component-key="([^"]+)"[^>]*data-document-id="([^"]*)"[^>]*aria-pressed="([^"]+)"/g
        )) {
            const row = new FakeComponentRow(match[2], match[1])
            const button = new FakeComponentButton(match[2], match[3], match[4])
            this.#rows.set(match[2], row)
            this.#buttons.set(match[2], button)
        }
        if (this.#rows.size) {
            this.#groups = [new FakeComponentGroup([...this.#rows.values()])]
        }
    }
}

/**
 * Minimal document.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.body = new FakeNode()
        this.#nodes = new Map([
            ['#fileInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#landingStatusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#summaryGrid', new FakeNode()],
            ['#viewerStage', new FakeNode()],
            ['#documentRail', new FakeSidebarNode()],
            ['#viewContent', new FakeNode()],
            ['#activeDocumentName', new FakeNode()],
            ['#viewTabs', new FakeNode()],
            ['#diagnosticsCount', new FakeNode()]
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
 * Creates a PCB snapshot with two fake components.
 * @param {{ selectedComponent?: string }} [options] Snapshot options.
 * @returns {object}
 */
function createPcbSnapshot(options = {}) {
    const documentModel = {
        fileName: 'demo.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: {
            title: 'Demo board',
            componentCount: 2,
            layerCount: 2,
            trackCount: 0,
            viaCount: 0,
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: { widthMil: 1000, heightMil: 500, segments: [] },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            components: [
                { designator: 'U1', pattern: 'QFN', layer: 'TOP' },
                { designator: 'R1', value: '10k', layer: 'BOTTOM' }
            ],
            tracks: [],
            vias: []
        },
        bom: []
    }

    return {
        activeView: 'diagnostics',
        activeSidebarTab: 'components',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: 'demo.PcbDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel,
        selectedPcbComponents: options.selectedComponent
            ? { 'doc-1': options.selectedComponent }
            : {}
    }
}

/**
 * Verifies selecting a filtered footprint does not clear the active search.
 */
test('AppView preserves component search when selecting a filtered footprint', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.bindPcbComponentSelectionChange((change) => {
        view.render(
            createPcbSnapshot({ selectedComponent: change.componentKey })
        )
    })
    view.render(createPcbSnapshot())

    const rail = fakeDocument.querySelector('#documentRail')
    rail.inputComponentFilter('R1')

    assert.equal(rail.componentRowHidden('U1'), true)
    assert.equal(rail.componentRowHidden('R1'), false)

    rail.clickComponent('R1')

    assert.equal(rail.componentFilterValue(), 'R1')
    assert.equal(rail.componentRowHidden('U1'), true)
    assert.equal(rail.componentRowHidden('R1'), false)
})
