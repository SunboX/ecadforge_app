import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

/**
 * Minimal event target for focused 3D AppView tests.
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
 * Minimal class list for 3D loading assertions.
 */
class FakeClassList {
    /** @type {Set<string>} */
    #tokens

    constructor(initialTokens = []) {
        this.#tokens = new Set(initialTokens)
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
}

/**
 * Minimal DOM node for focused 3D loading tests.
 */
class FakeNode extends FakeEventTarget {
    constructor() {
        super()
        this.hidden = false
        this.classList = new FakeClassList()
        this.textContent = ''
        this._innerHTML = ''
    }

    /**
     * @param {string} name
     * @param {string} _value
     * @returns {void}
     */
    setAttribute(name, _value) {
        if (name === 'hidden') {
            this.hidden = true
        }
    }

    /**
     * @param {string} name
     * @returns {void}
     */
    removeAttribute(name) {
        if (name === 'hidden') {
            this.hidden = false
        }
    }

    /**
     * @param {string} _selector
     * @returns {null}
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
}

/**
 * Minimal tab node.
 */
class FakeTabsNode extends FakeNode {
    /** @type {FakeNode[]} */
    #buttons

    constructor() {
        super()
        this.#buttons = ['schematic', 'pcb', '3d', 'bom', 'diagnostics'].map(
            (viewName) => {
                const button = new FakeNode()
                button.getAttribute = (name) =>
                    name === 'data-view' ? viewName : null
                button.setAttribute = () => {}
                return button
            }
        )
    }

    /**
     * @param {string} selector
     * @returns {FakeNode[]}
     */
    querySelectorAll(selector) {
        return selector === '[data-view]' ? this.#buttons : []
    }
}

/**
 * Minimal 3D content node with viewport and loading mounts.
 */
class FakeContentNode extends FakeNode {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        super()
        this.#nodes = new Map()
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#nodes = new Map()

        if (this._innerHTML.includes('data-scene-3d-viewport')) {
            this.#nodes.set('[data-scene-3d-viewport]', new FakeNode())
        }

        if (this._innerHTML.includes('data-scene-3d-loading')) {
            this.#nodes.set('[data-scene-3d-loading]', new FakeNode())
        }
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
 * Minimal document for focused 3D loading assertions.
 */
class FakeDocument {
    /** @type {Map<string, FakeNode>} */
    #nodes

    constructor() {
        this.#nodes = new Map([
            ['#fileInput', new FakeNode()],
            ['#dropZone', new FakeNode()],
            ['#statusMessage', new FakeNode()],
            ['#appVersion', new FakeNode()],
            ['#localeSelect', new FakeNode()],
            ['#summaryGrid', new FakeNode()],
            ['#viewerStage', new FakeNode()],
            ['#documentRail', new FakeNode()],
            ['#viewContent', new FakeContentNode()],
            ['#activeDocumentName', new FakeNode()],
            ['#viewTabs', new FakeTabsNode()],
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
 * Builds a minimal PCB snapshot accepted by AppView.
 * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents: { id: string, documentModel: any }[], activeDocumentId: string, documentModel: any }}
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
            boardWidthMil: 1000,
            boardHeightMil: 500
        },
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            components: [{ designator: 'U1' }]
        },
        bom: []
    }

    return {
        activeView: '3d',
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
 * Verifies AppView keeps the 3D loading overlay visible until the controller
 * reports full scene readiness.
 */
test('AppView keeps the 3D loading overlay visible until the 3D scene is ready', () => {
    const fakeDocument = new FakeDocument()
    const createdControllers = []

    class FakeScene3dController {
        /**
         * @param {FakeNode} viewportNode
         * @param {any} documentModel
         * @param {{ setLoadingVisible?: (visible: boolean) => void }} [options]
         */
        constructor(viewportNode, documentModel, options = {}) {
            this.viewportNode = viewportNode
            this.documentModel = documentModel
            this.options = options
            createdControllers.push(this)
        }

        /**
         * @returns {void}
         */
        markReady() {
            this.options.setLoadingVisible?.(false)
        }

        /**
         * @returns {void}
         */
        dispose() {}
    }

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode, documentModel, options) =>
            new FakeScene3dController(viewportNode, documentModel, options)
    })

    view.render(createPcbSnapshot())

    const loadingNode = fakeDocument
        .querySelector('#viewContent')
        .querySelector('[data-scene-3d-loading]')

    assert.ok(loadingNode)
    assert.equal(loadingNode.hidden, false)

    createdControllers[0].markReady()

    assert.equal(loadingNode.hidden, true)
})

/**
 * Verifies AppView keeps the active 3D panel focused on the large scene while
 * moving compact board metrics into the sidebar info tab.
 */
test('AppView renders the 3D panel without the bottom stat cards', () => {
    const fakeDocument = new FakeDocument()

    class FakeScene3dController {
        /**
         * @returns {void}
         */
        dispose() {}
    }

    const view = new AppView(fakeDocument, {
        createScene3dController: () => new FakeScene3dController()
    })

    view.render(createPcbSnapshot())

    const contentNode = fakeDocument.querySelector('#viewContent')
    assert.match(contentNode._innerHTML, /class="scene-3d"/)
    assert.match(contentNode._innerHTML, /data-scene-3d-viewport/)
    assert.doesNotMatch(contentNode._innerHTML, /scene-3d__stats/)
    assert.doesNotMatch(contentNode._innerHTML, /<dt>Footprint<\/dt>/)
    assert.doesNotMatch(contentNode._innerHTML, /<dt>Placements<\/dt>/)
    assert.doesNotMatch(contentNode._innerHTML, /<dt>BOM groups<\/dt>/)
})

/**
 * Verifies selected component changes in the 3D footprints sidebar update the
 * live scene controller without rebuilding the scene.
 */
test('AppView updates 3D component selection without remounting the scene', () => {
    const fakeDocument = new FakeDocument()
    const createdControllers = []

    class FakeScene3dController {
        /**
         * @param {FakeNode} viewportNode
         * @param {any} documentModel
         */
        constructor(viewportNode, documentModel) {
            this.viewportNode = viewportNode
            this.documentModel = documentModel
            this.selectedKeys = []
            this.isDisposed = false
            createdControllers.push(this)
        }

        /**
         * @returns {any}
         */
        getDocumentModel() {
            return this.documentModel
        }

        /**
         * @param {string} componentKey Selected component key.
         * @returns {void}
         */
        setSelectedComponent(componentKey) {
            this.selectedKeys.push(componentKey)
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
    const firstSnapshot = {
        ...createPcbSnapshot(),
        selectedPcbComponents: { 'doc-1': '' }
    }
    const nextSnapshot = {
        ...firstSnapshot,
        selectedPcbComponents: { 'doc-1': 'C8' }
    }

    view.render(firstSnapshot)
    view.render(nextSnapshot)

    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].isDisposed, false)
    assert.deepEqual(createdControllers[0].selectedKeys, ['', 'C8'])
})

/**
 * Verifies the 3D controller receives the shared component selection callback
 * and active document id when AppView mounts the scene.
 */
test('AppView wires 3D runtime selections into shared selection state', () => {
    const fakeDocument = new FakeDocument()
    const createdControllers = []
    const selectionChanges = []

    class FakeScene3dController {
        /**
         * @param {FakeNode} viewportNode
         * @param {any} documentModel
         * @param {{ documentId?: string, onComponentSelectionChange?: (change: any) => void }} [options]
         */
        constructor(viewportNode, documentModel, options = {}) {
            this.viewportNode = viewportNode
            this.documentModel = documentModel
            this.options = options
            this.selectedKeys = []
            createdControllers.push(this)
        }

        /**
         * @param {string} componentKey Selected component key.
         * @returns {void}
         */
        setSelectedComponent(componentKey) {
            this.selectedKeys.push(componentKey)
        }

        /**
         * @returns {void}
         */
        dispose() {}
    }

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode, documentModel, options) =>
            new FakeScene3dController(viewportNode, documentModel, options)
    })
    view.bindPcbComponentSelectionChange((change) =>
        selectionChanges.push(change)
    )

    view.render({
        ...createPcbSnapshot(),
        selectedPcbComponents: { 'doc-1': 'C8' }
    })

    const controller = createdControllers[0]
    controller.options.onComponentSelectionChange?.({
        documentId: controller.options.documentId,
        componentKey: 'C8',
        source: '3d-scene'
    })

    assert.equal(controller.options.documentId, 'doc-1')
    assert.deepEqual(controller.selectedKeys, ['C8'])
    assert.deepEqual(selectionChanges, [
        { documentId: 'doc-1', componentKey: 'C8', source: '3d-scene' }
    ])
})
