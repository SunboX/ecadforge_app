import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for sidebar view tests.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
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
     * @param {string} type
     * @param {Record<string, any>} [event]
     * @returns {void}
     */
    dispatch(type, event = {}) {
        const payload = { type, currentTarget: this, target: this, ...event }
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

    /**
     * @param {string[]} [tokens]
     */
    constructor(tokens = []) {
        this.#tokens = new Set(tokens)
    }

    /**
     * @param {...string} tokens
     * @returns {void}
     */
    add(...tokens) {
        tokens.forEach((token) => this.#tokens.add(token))
    }

    /**
     * @param {...string} tokens
     * @returns {void}
     */
    remove(...tokens) {
        tokens.forEach((token) => this.#tokens.delete(token))
    }

    /**
     * @param {string} token
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
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
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') this.hidden = true
    }

    /**
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * @param {string} name
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') this.hidden = false
    }

    /**
     * @param {string} _selector
     * @returns {any}
     */
    closest(_selector) {
        return null
    }

    /**
     * @param {string} _selector
     * @returns {any}
     */
    querySelector(_selector) {
        return null
    }

    /**
     * @param {string} _selector
     * @returns {any[]}
     */
    querySelectorAll(_selector) {
        return []
    }

    /**
     * @param {string} value
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
 * Minimal clickable sidebar button.
 */
class FakeSidebarButton extends FakeNode {
    /**
     * @param {string} attributeName
     * @param {string} value
     * @param {string[]} classNames
     * @param {string} stateName
     * @param {string} stateValue
     */
    constructor(attributeName, value, classNames, stateName, stateValue) {
        super()
        this.scrollIntoViewCalls = []
        this.scrollIntoView = (options = true) => {
            this.scrollIntoViewCalls.push(options)
        }
        this.setAttribute(attributeName, value)
        this.setAttribute(stateName, stateValue)
        this.classList = new FakeClassList(classNames)
    }

    /**
     * @param {string} selector
     * @returns {FakeSidebarButton | null}
     */
    closest(selector) {
        if (
            selector === '[data-document-id]' &&
            this.getAttribute('data-document-id')
        ) {
            return this
        }
        if (
            selector === '[data-sidebar-tab]' &&
            this.getAttribute('data-sidebar-tab')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-layer-key]' &&
            this.getAttribute('data-pcb-layer-key')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-object-opacity-key]' &&
            this.getAttribute('data-pcb-object-opacity-key')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-component-key]' &&
            this.getAttribute('data-pcb-component-key')
        ) {
            return this
        }
        if (
            selector === '[data-pcb-layer-preset]' &&
            this.getAttribute('data-pcb-layer-preset')
        ) {
            return this
        }
        if (
            selector === '[data-sidebar-collapse]' &&
            this.getAttribute('data-sidebar-collapse')
        ) {
            return this
        }
        if (
            selector === '[data-sidebar-expand]' &&
            this.getAttribute('data-sidebar-expand')
        ) {
            return this
        }
        return null
    }
}

/**
 * Sidebar mount that parses generated buttons.
 */
class FakeSidebarNode extends FakeNode {
    /** @type {FakeNode | null} */
    #sidebarRoot

    /** @type {FakeNode | null} */
    #panel

    /** @type {Map<string, FakeSidebarButton>} */
    #documents

    /** @type {Map<string, FakeSidebarButton>} */
    #tabs

    /** @type {Map<string, FakeSidebarButton>} */
    #layers

    /** @type {Map<string, FakeSidebarButton>} */
    #objects

    /** @type {Map<string, FakeSidebarButton>} */
    #components

    /** @type {Map<string, FakeSidebarButton>} */
    #presets

    /** @type {FakeSidebarButton | null} */
    #collapse

    /** @type {FakeSidebarButton | null} */
    #expand

    constructor() {
        super()
        this.#sidebarRoot = null
        this.#panel = null
        this.#documents = new Map()
        this.#tabs = new Map()
        this.#layers = new Map()
        this.#objects = new Map()
        this.#components = new Map()
        this.#presets = new Map()
        this.#collapse = null
        this.#expand = null
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#documents = new Map()
        this.#tabs = new Map()
        this.#layers = new Map()
        this.#objects = new Map()
        this.#components = new Map()
        this.#presets = new Map()
        this.#collapse = null
        this.#expand = null
        this.#sidebarRoot = null
        this.#panel = null

        const sidebarMatch = this._innerHTML.match(
            /<div class="viewer-sidebar"[^>]*data-active-sidebar-tab="([^"]*)"[^>]*data-active-document-id="([^"]*)"/
        )
        if (sidebarMatch) {
            this.#sidebarRoot = new FakeNode()
            this.#sidebarRoot.setAttribute(
                'data-active-sidebar-tab',
                sidebarMatch[1]
            )
            this.#sidebarRoot.setAttribute(
                'data-active-document-id',
                sidebarMatch[2]
            )
        }

        if (this._innerHTML.includes('viewer-sidebar__panel')) {
            this.#panel = new FakeNode()
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__row--button[^"]*)"[^>]*data-document-id="([^"]+)"[^>]*aria-pressed="([^"]+)"/g
        )) {
            this.#documents.set(
                match[2],
                new FakeSidebarButton(
                    'data-document-id',
                    match[2],
                    match[1].split(/\s+/).filter(Boolean),
                    'aria-pressed',
                    match[3]
                )
            )
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__tab[^"]*)"[^>]*data-sidebar-tab="([^"]+)"[^>]*aria-selected="([^"]+)"/g
        )) {
            this.#tabs.set(
                match[2],
                new FakeSidebarButton(
                    'data-sidebar-tab',
                    match[2],
                    match[1].split(/\s+/).filter(Boolean),
                    'aria-selected',
                    match[3]
                )
            )
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__row--layer[^"]*)"[^>]*data-pcb-layer-key="([^"]+)"[^>]*data-pcb-layer-visible="([^"]+)"[^>]*data-document-id="([^"]*)"/g
        )) {
            const button = new FakeSidebarButton(
                'data-pcb-layer-key',
                match[2],
                match[1].split(/\s+/).filter(Boolean),
                'data-pcb-layer-visible',
                match[3]
            )
            button.setAttribute('data-document-id', match[4])
            this.#layers.set(match[2], button)
        }

        for (const match of this._innerHTML.matchAll(
            /<input class="([^"]*viewer-sidebar__object-opacity[^"]*)"[^>]*data-pcb-object-opacity-key="([^"]+)"[^>]*data-document-id="([^"]*)"[^>]*value="([^"]*)"/g
        )) {
            const input = new FakeSidebarButton(
                'data-pcb-object-opacity-key',
                match[2],
                match[1].split(/\s+/).filter(Boolean),
                'value',
                match[4]
            )
            input.setAttribute('data-document-id', match[3])
            input.value = match[4]
            this.#objects.set(match[2], input)
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__component-row[^"]*)"[^>]*data-pcb-component-key="([^"]+)"[^>]*data-document-id="([^"]*)"[^>]*aria-pressed="([^"]+)"/g
        )) {
            const button = new FakeSidebarButton(
                'data-pcb-component-key',
                match[2],
                match[1].split(/\s+/).filter(Boolean),
                'aria-pressed',
                match[4]
            )
            button.setAttribute('data-document-id', match[3])
            this.#components.set(match[2], button)
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__chip[^"]*)"[^>]*data-pcb-layer-preset="([^"]+)"[^>]*data-document-id="([^"]*)"/g
        )) {
            const button = new FakeSidebarButton(
                'data-pcb-layer-preset',
                match[2],
                match[1].split(/\s+/).filter(Boolean),
                'data-pcb-layer-preset',
                match[2]
            )
            button.setAttribute('data-document-id', match[3])
            this.#presets.set(match[2], button)
        }

        if (this._innerHTML.includes('data-sidebar-collapse')) {
            this.#collapse = new FakeSidebarButton(
                'data-sidebar-collapse',
                'true',
                ['viewer-sidebar__collapse'],
                'data-sidebar-collapse',
                'true'
            )
        }

        if (this._innerHTML.includes('data-sidebar-expand')) {
            this.#expand = new FakeSidebarButton(
                'data-sidebar-expand',
                'true',
                ['viewer-sidebar__expand'],
                'data-sidebar-expand',
                'true'
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
     * @param {string} selector
     * @returns {FakeSidebarButton | null}
     */
    querySelector(selector) {
        if (selector === '.viewer-sidebar') return this.#sidebarRoot
        if (selector === '.viewer-sidebar__panel') return this.#panel

        const documentMatch = selector.match(/^\[data-document-id="([^"]+)"\]$/)
        if (documentMatch) return this.#documents.get(documentMatch[1]) || null

        const tabMatch = selector.match(/^\[data-sidebar-tab="([^"]+)"\]$/)
        if (tabMatch) return this.#tabs.get(tabMatch[1]) || null

        return null
    }

    /**
     * @param {string} selector
     * @returns {FakeSidebarButton[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-pcb-component-key]') {
            return [...this.#components.values()]
        }

        return []
    }

    /**
     * @param {string} documentId
     * @returns {void}
     */
    clickDocument(documentId) {
        const button = this.#documents.get(documentId)
        if (button) this.dispatch('click', { target: button })
    }

    /**
     * @param {string} tabName
     * @returns {void}
     */
    clickSidebarTab(tabName) {
        const button = this.#tabs.get(tabName)
        if (button) this.dispatch('click', { target: button })
    }

    /**
     * @param {string} layerKey
     * @returns {void}
     */
    clickLayer(layerKey) {
        const button = this.#layers.get(layerKey)
        if (button) this.dispatch('click', { target: button })
    }

    /**
     * @param {string} objectKey
     * @param {number} opacity
     * @returns {void}
     */
    changeObjectOpacity(objectKey, opacity) {
        const input = this.#objects.get(objectKey)
        if (!input) return
        input.value = String(opacity)
        this.dispatch('change', { target: input })
    }

    /**
     * @param {string} objectKey
     * @param {number} opacity
     * @returns {void}
     */
    inputObjectOpacity(objectKey, opacity) {
        const input = this.#objects.get(objectKey)
        if (!input) return
        input.value = String(opacity)
        this.dispatch('input', { target: input })
    }

    /**
     * @param {string} componentKey
     * @returns {void}
     */
    clickComponent(componentKey) {
        const button = this.#components.get(componentKey)
        if (button) this.dispatch('click', { target: button })
    }

    /**
     * @param {string} presetName
     * @returns {void}
     */
    clickPreset(presetName) {
        const button = this.#presets.get(presetName)
        if (button) this.dispatch('click', { target: button })
    }

    /**
     * @returns {void}
     */
    clickSidebarCollapse() {
        if (this.#collapse) this.dispatch('click', { target: this.#collapse })
    }

    /**
     * @returns {void}
     */
    clickSidebarExpand() {
        if (this.#expand) this.dispatch('click', { target: this.#expand })
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
     * @param {string} selector
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        return this.#nodes.get(selector) || null
    }
}

/**
 * Creates a schematic snapshot.
 * @returns {object}
 */
function createSchematicSnapshot() {
    const documentModel = {
        fileName: 'demo.SchDoc',
        kind: 'schematic',
        diagnostics: [],
        summary: { title: 'Demo schematic', componentCount: 1, textCount: 0 },
        schematic: {
            sheet: { size: 'A4', width: 297, height: 210 },
            components: [],
            pins: [],
            ports: [],
            texts: []
        },
        bom: []
    }

    return {
        activeView: 'diagnostics',
        activeSidebarTab: 'project',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: 'demo.SchDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel
    }
}

/**
 * Creates a PCB snapshot.
 * @returns {object}
 */
function createPcbSnapshot() {
    const documentModel = {
        fileName: 'demo.PcbDoc',
        kind: 'pcb',
        diagnostics: [],
        summary: {
            title: 'Demo board',
            componentCount: 1,
            layerCount: 2,
            trackCount: 1,
            viaCount: 1,
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
            tracks: [{}],
            vias: [{}]
        },
        bom: []
    }

    return {
        activeView: 'diagnostics',
        activeSidebarTab: 'project',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: 'demo.PcbDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel
    }
}

/**
 * Creates a multi-document snapshot.
 * @returns {object}
 */
function createMultiDocumentSnapshot() {
    const schematic = createSchematicSnapshot().documentModel
    const pcb = createPcbSnapshot().documentModel

    return {
        ...createPcbSnapshot(),
        activeSidebarTab: 'project',
        documents: [
            { id: 'doc-1', documentModel: schematic },
            { id: 'doc-2', documentModel: pcb }
        ],
        activeDocumentId: 'doc-2',
        documentModel: pcb
    }
}

/**
 * Verifies AppView renders the sidebar for one loaded document.
 */
test('AppView renders the viewer sidebar when one document is open', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createPcbSnapshot())

    const rail = fakeDocument.querySelector('#documentRail')

    assert.equal(rail.hidden, false)
    assert.match(rail.innerHTML, /data-sidebar-tab="project"/)
    assert.match(rail.innerHTML, /data-sidebar-tab="info"/)
    assert.match(rail.innerHTML, /Open documents/)
    assert.match(rail.innerHTML, /demo\.PcbDoc/)
    assert.doesNotMatch(rail.innerHTML, /Board overview/)
})

/**
 * Verifies AppView filters project rows to the active top-level view.
 */
test('AppView filters project sidebar rows by active view', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const snapshot = createMultiDocumentSnapshot()

    view.render({
        ...snapshot,
        activeView: 'schematic'
    })

    const rail = fakeDocument.querySelector('#documentRail')

    assert.equal(rail.hidden, false)
    assert.match(rail.innerHTML, /demo\.SchDoc/)
    assert.doesNotMatch(rail.innerHTML, /demo\.PcbDoc/)
})

/**
 * Verifies AppView emits document selection from project rows.
 */
test('AppView binds document selection clicks from the project panel', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindDocumentSelection((documentId) => {
        received.push(documentId)
    })
    view.render(createMultiDocumentSnapshot())

    fakeDocument.querySelector('#documentRail').clickDocument('doc-1')

    assert.deepEqual(received, ['doc-1'])
})

/**
 * Verifies AppView emits sidebar tab changes.
 */
test('AppView binds sidebar tab selection clicks', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindSidebarTabSelection((tabName) => {
        received.push(tabName)
    })
    view.render(createPcbSnapshot())

    fakeDocument.querySelector('#documentRail').clickSidebarTab('layers')

    assert.deepEqual(received, ['layers'])
})

/**
 * Verifies AppView collapses and restores the sidebar rail.
 */
test('AppView collapses and restores the viewer sidebar', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const rail = fakeDocument.querySelector('#documentRail')
    const stage = fakeDocument.querySelector('#viewerStage')

    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'layers' })
    assert.match(rail.innerHTML, /data-sidebar-collapse/)

    rail.clickSidebarCollapse()

    assert.equal(rail.classList.contains('is-sidebar-collapsed'), true)
    assert.equal(stage.classList.contains('is-sidebar-collapsed'), true)
    assert.match(rail.innerHTML, /data-sidebar-expand/)
    assert.doesNotMatch(rail.innerHTML, /data-sidebar-tab="layers"/)

    rail.clickSidebarExpand()

    assert.equal(rail.classList.contains('is-sidebar-collapsed'), false)
    assert.equal(stage.classList.contains('is-sidebar-collapsed'), false)
    assert.match(rail.innerHTML, /data-sidebar-tab="layers"/)
    assert.match(rail.innerHTML, /<h3>Layers<\/h3>/)
})

/**
 * Verifies AppView emits PCB layer visibility changes from layer rows.
 */
test('AppView binds PCB layer visibility clicks', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbLayerVisibilityChange((change) => {
        received.push(change)
    })
    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'layers' })

    fakeDocument.querySelector('#documentRail').clickLayer('Top Layer')

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            layerKey: 'Top Layer',
            visible: false
        }
    ])
})

/**
 * Verifies AppView emits PCB object opacity changes from object sliders.
 */
test('AppView binds PCB object opacity changes', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbObjectOpacityChange((change) => {
        received.push(change)
    })
    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'objects' })

    fakeDocument
        .querySelector('#documentRail')
        .changeObjectOpacity('tracks', 45)

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            objectKey: 'tracks',
            opacity: 45
        }
    ])
})

/**
 * Verifies AppView emits PCB object opacity changes while sliders are dragged.
 */
test('AppView binds live PCB object opacity input', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbObjectOpacityChange((change) => {
        received.push(change)
    })
    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'objects' })

    fakeDocument.querySelector('#documentRail').inputObjectOpacity('tracks', 45)

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            objectKey: 'tracks',
            opacity: 45,
            preview: true
        }
    ])
})

/**
 * Verifies AppView emits PCB component selections from footprint rows.
 */
test('AppView binds PCB component selection clicks', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbComponentSelectionChange((change) => {
        received.push(change)
        view.render({
            ...createPcbSnapshot(),
            activeSidebarTab: 'components',
            selectedPcbComponents: { 'doc-1': change.componentKey }
        })
    })
    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'components' })

    const rail = fakeDocument.querySelector('#documentRail')
    rail.clickComponent('R1')
    const selectedRow = rail
        .querySelectorAll('[data-pcb-component-key]')
        .find((row) => row.getAttribute('data-pcb-component-key') === 'R1')

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            componentKey: 'R1'
        }
    ])
    assert.deepEqual(selectedRow.scrollIntoViewCalls, [])
})

/**
 * Verifies same-tab layer visibility renders preserve the layer panel scroll.
 */
test('AppView preserves sidebar layer scroll when layer visibility changes', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const snapshot = { ...createPcbSnapshot(), activeSidebarTab: 'layers' }

    view.render(snapshot)

    const rail = fakeDocument.querySelector('#documentRail')
    const panel = rail.querySelector('.viewer-sidebar__panel')
    panel.scrollTop = 180
    panel.scrollLeft = 12

    view.render({
        ...snapshot,
        hiddenPcbLayers: {
            'doc-1': ['Bottom Layer']
        }
    })

    const nextPanel = rail.querySelector('.viewer-sidebar__panel')

    assert.equal(nextPanel.scrollTop, 180)
    assert.equal(nextPanel.scrollLeft, 12)
    assert.match(
        rail.innerHTML,
        /data-pcb-layer-key="Bottom Layer"[^>]*data-pcb-layer-visible="false"/
    )
})

/**
 * Verifies AppView emits PCB layer preset selections from the layer panel.
 */
test('AppView binds PCB layer preset clicks', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const received = []

    view.bindPcbLayerPresetSelection((change) => {
        received.push(change)
    })
    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'layers' })

    fakeDocument.querySelector('#documentRail').clickPreset('front')

    assert.deepEqual(received, [
        {
            documentId: 'doc-1',
            preset: 'front'
        }
    ])
})

/**
 * Verifies AppView can render a non-default sidebar panel.
 */
test('AppView renders the active sidebar panel from snapshot state', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render({ ...createPcbSnapshot(), activeSidebarTab: 'layers' })

    const rail = fakeDocument.querySelector('#documentRail')

    assert.equal(rail.hidden, false)
    assert.match(rail.innerHTML, /<h3>Layers<\/h3>/)
    assert.match(rail.innerHTML, /Top Layer/)
})

/**
 * Verifies the overview remains available behind the info tab.
 */
test('AppView renders the overview info sidebar panel', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render({ ...createSchematicSnapshot(), activeSidebarTab: 'info' })

    const rail = fakeDocument.querySelector('#documentRail')

    assert.equal(rail.hidden, false)
    assert.match(rail.innerHTML, /Sheet overview/)
    assert.match(rail.innerHTML, /viewer-sidebar__overview-grid/)
    assert.match(rail.innerHTML, /A4/)
})

/**
 * Verifies unavailable panel data renders a targeted empty state.
 */
test('AppView renders sidebar empty states for unavailable panel data', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render({ ...createSchematicSnapshot(), activeSidebarTab: 'layers' })

    assert.match(
        fakeDocument.querySelector('#documentRail').innerHTML,
        /No PCB layer metadata was recovered/
    )
})
