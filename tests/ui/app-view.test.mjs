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
        const payload = { type, currentTarget: this, target: this, ...event }
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
        this.hidden = false
        this.classList = new FakeClassList()
    }

    /**
     * Sets one attribute value.
     * @param {string} name
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
        if (name === 'hidden') {
            this.hidden = true
        }
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
     * Removes one attribute value.
     * @param {string} name
     * @returns {void}
     */
    removeAttribute(name) {
        this.#attributes.delete(name)
        if (name === 'hidden') {
            this.hidden = false
        }
    }

    /**
     * Returns the closest matching ancestor when supported.
     * @param {string} _selector
     * @returns {any}
     */
    closest(_selector) {
        return null
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
 * Minimal viewer stage node for layout class assertions.
 */
class FakeViewerStageNode extends FakeNode {}

/**
 * Minimal document rail button node.
 */
class FakeDocumentRailButton extends FakeNode {
    /**
     * @param {string} documentId
     * @param {string[]} classNames
     * @param {string} pressed
     * @param {string} markup
     */
    constructor(documentId, classNames, pressed, markup) {
        super()
        this.setAttribute('data-document-id', documentId)
        this.setAttribute('aria-pressed', pressed)
        this.classList = new FakeClassList(classNames)
        this._innerHTML = markup
        this.textContent = markup.replace(/<[^>]+>/g, ' ').trim()
    }

    /**
     * @param {string} selector
     * @returns {FakeDocumentRailButton | null}
     */
    closest(selector) {
        return selector === '[data-document-id]' ? this : null
    }
}

/**
 * Minimal sidebar tab button node.
 */
class FakeSidebarTabButton extends FakeNode {
    /**
     * @param {string} tabName
     * @param {string[]} classNames
     * @param {string} selected
     */
    constructor(tabName, classNames, selected) {
        super()
        this.setAttribute('data-sidebar-tab', tabName)
        this.setAttribute('aria-selected', selected)
        this.classList = new FakeClassList(classNames)
    }

    /**
     * @param {string} selector
     * @returns {FakeSidebarTabButton | null}
     */
    closest(selector) {
        return selector === '[data-sidebar-tab]' ? this : null
    }
}

/**
 * Minimal rail node that exposes parsed sidebar buttons.
 */
class FakeDocumentRailNode extends FakeNode {
    /** @type {Map<string, FakeDocumentRailButton>} */
    #buttonsById

    /** @type {Map<string, FakeSidebarTabButton>} */
    #tabsByName

    constructor() {
        super()
        this.#buttonsById = new Map()
        this.#tabsByName = new Map()
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#buttonsById = new Map()
        this.#tabsByName = new Map()

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__row--button[^"]*)"[^>]*data-document-id="([^"]+)"[^>]*aria-pressed="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g
        )) {
            const button = new FakeDocumentRailButton(
                match[2],
                match[1].split(/\s+/).filter(Boolean),
                match[3],
                match[4]
            )
            this.#buttonsById.set(match[2], button)
        }

        for (const match of this._innerHTML.matchAll(
            /<button class="([^"]*viewer-sidebar__tab[^"]*)"[^>]*data-sidebar-tab="([^"]+)"[^>]*aria-selected="([^"]+)"/g
        )) {
            const button = new FakeSidebarTabButton(
                match[2],
                match[1].split(/\s+/).filter(Boolean),
                match[3]
            )
            this.#tabsByName.set(match[2], button)
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
     * @returns {FakeDocumentRailButton | null}
     */
    querySelector(selector) {
        const idMatch = selector.match(/^\[data-document-id="([^"]+)"\]$/)
        if (idMatch) {
            return this.#buttonsById.get(idMatch[1]) || null
        }

        const tabMatch = selector.match(/^\[data-sidebar-tab="([^"]+)"\]$/)
        if (tabMatch) {
            return this.#tabsByName.get(tabMatch[1]) || null
        }

        return null
    }

    /**
     * @param {string} selector
     * @returns {FakeDocumentRailButton[]}
     */
    querySelectorAll(selector) {
        if (
            selector === '[data-document-id]' ||
            selector === '.viewer-sidebar__row--button'
        ) {
            return [...this.#buttonsById.values()]
        }

        if (
            selector === '[data-sidebar-tab]' ||
            selector === '.viewer-sidebar__tab'
        ) {
            return [...this.#tabsByName.values()]
        }

        return []
    }

    /**
     * Dispatches a click event as if one rail button was selected.
     * @param {string} documentId
     * @returns {void}
     */
    clickDocument(documentId) {
        const button = this.#buttonsById.get(documentId)
        if (!button) {
            return
        }

        this.dispatch('click', { target: button })
    }

    /**
     * Dispatches a click event as if one sidebar tab was selected.
     * @param {string} tabName
     * @returns {void}
     */
    clickSidebarTab(tabName) {
        const button = this.#tabsByName.get(tabName)
        if (!button) {
            return
        }

        this.dispatch('click', { target: button })
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
        this.body = new FakeNode()
        this.#nodes = new Map([
            ['#fileInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#summaryGrid', new FakeNode()],
            ['#viewerStage', new FakeViewerStageNode()],
            ['#documentRail', new FakeDocumentRailNode()],
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
     * @param {string[]} classNames
     */
    constructor(ownerDocument, viewBox, classNames = ['schematic-svg']) {
        super()
        this.#attributes = new Map([['viewBox', viewBox]])
        this.#rect = { left: 0, top: 0, width: 400, height: 200 }
        this.ownerDocument = ownerDocument
        this.classList = new FakeClassList(classNames)
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
 * Minimal 3D viewport node.
 */
class FakeScene3dViewportNode extends FakeNode {}

/**
 * Minimal 3D loading overlay node.
 */
class FakeScene3dLoadingNode extends FakeNode {}

/**
 * Minimal content node that parses rendered schematic markup.
 */
class FakeContentNode extends FakeNode {
    /** @type {FakeDocument} */
    #ownerDocument

    /** @type {Map<string, FakeSvgElement>} */
    #svgBySelector

    /** @type {Map<string, FakeScene3dViewportNode>} */
    #sceneViewportBySelector

    /** @type {Map<string, FakeScene3dLoadingNode>} */
    #sceneLoadingBySelector

    /**
     * @param {FakeDocument} ownerDocument
     */
    constructor(ownerDocument) {
        super()
        this.#ownerDocument = ownerDocument
        this.#svgBySelector = new Map()
        this.#sceneViewportBySelector = new Map()
        this.#sceneLoadingBySelector = new Map()
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this.textContent = ''
        this._innerHTML = String(value)
        this.#svgBySelector = new Map()
        this.#sceneViewportBySelector = new Map()
        this.#sceneLoadingBySelector = new Map()

        for (const match of this._innerHTML.matchAll(
            /<svg class="([^"]+)" viewBox="([^"]+)"/g
        )) {
            const classNames = match[1].split(/\s+/).filter(Boolean)
            const svg = new FakeSvgElement(
                this.#ownerDocument,
                match[2],
                classNames
            )

            for (const className of classNames) {
                this.#svgBySelector.set('.' + className, svg)
            }
        }

        if (this._innerHTML.includes('data-scene-3d-viewport')) {
            const viewport = new FakeScene3dViewportNode()
            this.#sceneViewportBySelector.set(
                '[data-scene-3d-viewport]',
                viewport
            )
        }

        if (this._innerHTML.includes('data-scene-3d-loading')) {
            const loading = new FakeScene3dLoadingNode()
            this.#sceneLoadingBySelector.set('[data-scene-3d-loading]', loading)
        }
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
        return (
            this.#svgBySelector.get(selector) ||
            this.#sceneViewportBySelector.get(selector) ||
            this.#sceneLoadingBySelector.get(selector) ||
            null
        )
    }
}

/**
 * Builds a minimal schematic snapshot accepted by AppView.
 * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: any }}
 */
function createSchematicSnapshot() {
    const documentModel = {
        fileName: 'demo.SchDoc',
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
        },
        bom: []
    }

    return {
        activeView: 'schematic',
        activeSidebarTab: 'info',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'File parsed successfully.',
        activeFileName: 'demo.SchDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel
    }
}

/**
 * Builds a minimal PCB snapshot accepted by AppView.
 * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: any }}
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
            outlineSegmentCount: 4,
            bomRowCount: 1,
            polygonCount: 1,
            trackCount: 1,
            viaCount: 1,
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            polygons: [
                {
                    layer: 'TOP',
                    segments: [
                        {
                            type: 'line',
                            x1: 100,
                            y1: 100,
                            x2: 300,
                            y2: 100
                        },
                        {
                            type: 'line',
                            x1: 300,
                            y1: 100,
                            x2: 300,
                            y2: 250
                        },
                        {
                            type: 'line',
                            x1: 300,
                            y1: 250,
                            x2: 100,
                            y2: 250
                        },
                        { type: 'line', x1: 100, y1: 250, x2: 100, y2: 100 }
                    ]
                }
            ],
            fills: [{ x1: 340, y1: 120, x2: 420, y2: 180, layerCode: 256 }],
            tracks: [
                {
                    x1: 130,
                    y1: 320,
                    x2: 520,
                    y2: 320,
                    width: 12,
                    layerCode: 256
                }
            ],
            vias: [{ x: 520, y: 320, diameter: 24, holeDiameter: 10 }],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 250,
                    rotation: 90,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        },
        bom: [
            {
                designators: ['U1'],
                quantity: 1,
                pattern: 'QFN',
                source: 'IC/FAKE/QFN',
                value: 'Demo'
            }
        ]
    }

    return {
        activeView: 'pcb',
        activeSidebarTab: 'info',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'File parsed successfully.',
        activeFileName: 'demo.PcbDoc',
        documents: [{ id: 'doc-1', documentModel }],
        activeDocumentId: 'doc-1',
        documentModel
    }
}

/**
 * Builds a snapshot with multiple loaded documents.
 * @param {string} [activeView]
 * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents: { id: string, documentModel: any }[], activeDocumentId: string, documentModel: any }}
 */
function createMultiDocumentSnapshot(activeView = 'schematic') {
    const schematicSnapshot = createSchematicSnapshot()
    const pcbSnapshot = createPcbSnapshot()
    const documents = [
        {
            id: 'doc-1',
            documentModel: schematicSnapshot.documentModel
        },
        {
            id: 'doc-2',
            documentModel: pcbSnapshot.documentModel
        }
    ]
    const activeDocumentId = 'doc-2'
    const activeDocument =
        documents.find((entry) => entry.id === activeDocumentId)
            ?.documentModel || null

    return {
        activeView,
        activeSidebarTab: 'project',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'File parsed successfully.',
        activeFileName: String(activeDocument?.fileName || ''),
        documents,
        activeDocumentId,
        documentModel: activeDocument
    }
}

/**
 * Verifies AppView renders the runtime version into the footer without a
 * header-style prefix.
 */
test('AppView renders the raw runtime version text in the footer node', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.setVersion('1.2.3')

    assert.equal(fakeDocument.querySelector('#appVersion').textContent, '1.2.3')
})

/**
 * Verifies AppView marks the app as an active viewer once a document is
 * available so the landing hero can collapse.
 */
test('AppView toggles viewer mode when a design is loaded', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render({
        activeView: 'schematic',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready.',
        activeFileName: '',
        documentModel: null
    })

    assert.equal(fakeDocument.body.classList.contains('is-viewer-mode'), false)

    view.render(createSchematicSnapshot())

    assert.equal(fakeDocument.body.classList.contains('is-viewer-mode'), true)
})

/**
 * Verifies AppView makes the rendered schematic SVG interactive.
 */
test('AppView wires mouse-wheel zoom onto the rendered schematic svg', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createSchematicSnapshot())

    const svg = fakeDocument
        .querySelector('#viewContent')
        .querySelector('.schematic-svg')

    svg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '1.5 0.75 194 97')
})

/**
 * Verifies document metadata is no longer duplicated above the schematic SVG.
 */
test('AppView omits the rendered schematic metadata header', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createSchematicSnapshot())

    const html = fakeDocument.querySelector('#viewContent').innerHTML

    assert.doesNotMatch(html, /svg-panel__header/)
    assert.match(html, /svg-panel--chrome-hidden/)
})

/**
 * Verifies AppView preserves the schematic camera and disposes old listeners
 * on re-render.
 */
test('AppView preserves the schematic viewBox when the schematic is rendered again', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)
    const snapshot = createSchematicSnapshot()

    view.render(snapshot)

    const firstSvg = fakeDocument
        .querySelector('#viewContent')
        .querySelector('.schematic-svg')

    firstSvg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(firstSvg.getAttribute('viewBox'), '1.5 0.75 194 97')

    view.render(snapshot)

    const secondSvg = fakeDocument
        .querySelector('#viewContent')
        .querySelector('.schematic-svg')

    assert.equal(secondSvg.getAttribute('viewBox'), '1.5 0.75 194 97')
    assert.equal(firstSvg.getListenerCount('wheel'), 0)
    assert.equal(firstSvg.getListenerCount('mousedown'), 0)
})

test('AppView wires zoom and drag onto the rendered pcb svg', () => {
    const fakeDocument = new FakeDocument()
    const view = new AppView(fakeDocument)

    view.render(createPcbSnapshot())

    const svg = fakeDocument
        .querySelector('#viewContent')
        .querySelector('.pcb-svg')

    svg.dispatch('wheel', {
        deltaY: -100,
        clientX: 100,
        clientY: 50,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '-228.9 -232.65 1435.6 950.6')

    svg.dispatch('mousedown', {
        button: 0,
        clientX: 200,
        clientY: 100,
        preventDefault() {}
    })

    fakeDocument.dispatch('mousemove', {
        buttons: 1,
        clientX: 240,
        clientY: 120,
        preventDefault() {}
    })

    assert.equal(svg.getAttribute('viewBox'), '-372.46 -327.71 1435.6 950.6')
})

/**
 * Verifies AppView attaches and disposes the interactive 3D scene controller.
 */
test('AppView attaches and disposes the 3D scene controller around 3D renders', () => {
    const fakeDocument = new FakeDocument()
    const createdControllers = []
    class FakeScene3dController {
        /**
         * @param {FakeScene3dViewportNode} viewportNode
         * @param {any} documentModel
         */
        constructor(viewportNode, documentModel) {
            this.viewportNode = viewportNode
            this.documentModel = documentModel
            this.isDisposed = false
            createdControllers.push(this)
        }

        /**
         * @returns {void}
         */
        dispose() {
            this.isDisposed = true
        }
    }
    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode, documentModel) =>
            new FakeScene3dController(viewportNode, documentModel)
    })
    const threeSnapshot = {
        ...createPcbSnapshot(),
        activeView: '3d'
    }

    view.render(threeSnapshot)

    const viewport = fakeDocument
        .querySelector('#viewContent')
        .querySelector('[data-scene-3d-viewport]')

    assert.ok(viewport)
    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].viewportNode, viewport)
    assert.equal(
        createdControllers[0].documentModel,
        threeSnapshot.documentModel
    )

    view.render(createPcbSnapshot())

    assert.equal(createdControllers[0].isDisposed, true)
})
