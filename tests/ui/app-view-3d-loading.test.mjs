import assert from 'node:assert/strict'
import test from 'node:test'
import { AppView } from '../../src/ui/AppView.mjs'

const MODEL_ZIP_EXPORT_SELECTOR = '[data-scene-3d-export="models-zip"]'

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
        this.childNodes = []
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
 * Minimal button-like node for delegated selector checks.
 */
class FakeButtonNode extends FakeNode {
    /** @type {Map<string, string>} */
    #attributes

    /**
     * @param {{ [name: string]: string }} attributes
     */
    constructor(attributes = {}) {
        super()
        this.#attributes = new Map(Object.entries(attributes))
    }

    /**
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }

    /**
     * @param {string} selector
     * @returns {FakeButtonNode | null}
     */
    closest(selector) {
        if (
            selector === MODEL_ZIP_EXPORT_SELECTOR &&
            this.getAttribute('data-scene-3d-export') === 'models-zip'
        ) {
            return this
        }

        return null
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
        this.childNodes = [new FakeNode()]

        if (this._innerHTML.includes('data-scene-3d-viewport')) {
            const shellNode = new FakeNode()
            const viewportNode = new FakeNode()
            const loadingNode = new FakeNode()
            const exportNode = new FakeButtonNode({
                'data-scene-3d-export': 'models-zip'
            })
            viewportNode.closest = (selector) =>
                selector === '.scene-3d' ? shellNode : null
            exportNode.remove = () => {
                this._innerHTML = this._innerHTML.replace(
                    /<button class="scene-3d__preset scene-3d__action"[\s\S]*?data-scene-3d-export="models-zip"[\s\S]*?<\/button>/u,
                    ''
                )
                this.#nodes.delete('[data-scene-3d-export="models-zip"]')
                shellNode._queryNodes?.delete?.(MODEL_ZIP_EXPORT_SELECTOR)
            }
            shellNode._queryNodes = new Map([
                ['[data-scene-3d-viewport]', viewportNode],
                ['[data-scene-3d-loading]', loadingNode],
                [MODEL_ZIP_EXPORT_SELECTOR, exportNode]
            ])
            shellNode.querySelector = (selector) =>
                shellNode._queryNodes.get(selector) || null
            this.childNodes = [shellNode]
            this.#nodes.set('[data-scene-3d-viewport]', viewportNode)
            this.#nodes.set('[data-scene-3d-loading]', loadingNode)
            this.#nodes.set(MODEL_ZIP_EXPORT_SELECTOR, exportNode)
        }
    }

    /**
     * @param {...FakeNode} nodes
     * @returns {void}
     */
    replaceChildren(...nodes) {
        this._innerHTML = ''
        this.childNodes = nodes
        this.#nodes = new Map()
        nodes.forEach((node) => {
            node._queryNodes?.forEach?.((value, key) => {
                this.#nodes.set(key, value)
            })
        })
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
 * Minimal document rail node that exposes the 3D adjustment host after render.
 */
class FakeDocumentRailNode extends FakeNode {
    /** @type {FakeNode | null} */
    #adjustmentHostNode

    /** @type {FakeButtonNode | null} */
    #modelZipExportNode

    constructor() {
        super()
        this.#adjustmentHostNode = null
        this.#modelZipExportNode = null
    }

    /** @param {string} value */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.#adjustmentHostNode = this._innerHTML.includes(
            'data-scene-3d-adjustment-host'
        )
            ? new FakeNode()
            : null
        this.#modelZipExportNode = this._innerHTML.includes(
            'data-scene-3d-export="models-zip"'
        )
            ? new FakeButtonNode({
                  'data-scene-3d-export': 'models-zip'
              })
            : null
    }

    /** @returns {string} */
    get innerHTML() {
        return this._innerHTML
    }

    /**
     * @param {string} selector
     * @returns {FakeNode | null}
     */
    querySelector(selector) {
        if (selector === '[data-scene-3d-adjustment-host]') {
            return this.#adjustmentHostNode
        }

        if (selector === MODEL_ZIP_EXPORT_SELECTOR) {
            return this.#modelZipExportNode
        }

        return null
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
            ['#documentRail', new FakeDocumentRailNode()],
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
 * Builds paired project snapshots for a schematic tab and a PCB-backed 3D tab.
 * @returns {{ schematicSnapshot: any, sceneSnapshot: any }}
 */
function createProjectViewSnapshots() {
    const schematicDocument = {
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
            lines: [{ x1: 0, y1: 0, x2: 200, y2: 0, width: 1 }],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        },
        bom: []
    }
    const sceneSnapshot = createPcbSnapshot()
    const documents = [
        { id: 'schematic-doc', documentModel: schematicDocument },
        { id: 'pcb-doc', documentModel: sceneSnapshot.documentModel }
    ]

    return {
        schematicSnapshot: {
            ...sceneSnapshot,
            activeView: 'schematic',
            activeFileName: 'demo.SchDoc',
            documents,
            activeDocumentId: 'schematic-doc',
            documentModel: schematicDocument
        },
        sceneSnapshot: {
            ...sceneSnapshot,
            activeView: '3d',
            documents,
            activeDocumentId: 'pcb-doc'
        }
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
    assert.equal(
        contentNode.querySelector(MODEL_ZIP_EXPORT_SELECTOR).hidden,
        true
    )
    assert.doesNotMatch(contentNode._innerHTML, /svg-panel__header/)
    assert.doesNotMatch(contentNode._innerHTML, /3D preview/)
    assert.doesNotMatch(contentNode._innerHTML, /scene-3d__stats/)
    assert.doesNotMatch(contentNode._innerHTML, /<dt>Footprint<\/dt>/)
    assert.doesNotMatch(contentNode._innerHTML, /<dt>Placements<\/dt>/)
    assert.doesNotMatch(contentNode._innerHTML, /<dt>BOM groups<\/dt>/)
})

/**
 * Verifies the 3D panel exposes the app-owned missing model search preference.
 */
test('AppView renders the 3D missing model search checkbox', () => {
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

    view.render({
        ...createPcbSnapshot(),
        autoSearchMissingModels: true
    })

    const contentNode = fakeDocument.querySelector('#viewContent')
    assert.match(contentNode._innerHTML, /data-scene-3d-model-search/)
    assert.match(contentNode._innerHTML, /checked/)
})

/**
 * Verifies the info-tab model ZIP action forwards to the 3D controller action.
 */
test('AppView routes the info tab model ZIP export action', () => {
    const fakeDocument = new FakeDocument()
    let exportClicks = 0

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode) => {
            const exportButton = viewportNode
                .closest?.('.scene-3d')
                ?.querySelector?.(MODEL_ZIP_EXPORT_SELECTOR)
            exportButton?.addEventListener?.('click', () => {
                exportClicks += 1
            })
            return {}
        }
    })

    view.render({
        ...createPcbSnapshot(),
        activeSidebarTab: 'info'
    })

    const railNode = fakeDocument.querySelector('#documentRail')
    const exportButton = railNode.querySelector(MODEL_ZIP_EXPORT_SELECTOR)
    const contentNode = fakeDocument.querySelector('#viewContent')

    assert.ok(exportButton)
    assert.equal(
        contentNode.querySelector(MODEL_ZIP_EXPORT_SELECTOR).hidden,
        true
    )

    railNode.dispatch('click', {
        target: exportButton,
        preventDefault() {}
    })

    assert.equal(exportClicks, 1)
})

/**
 * Verifies the sidebar model ZIP action still works when the real 3D runtime
 * binds its export listener after the app has rendered the sidebar proxy.
 */
test('AppView routes the info tab model ZIP export action after lazy 3D runtime bind', async () => {
    const fakeDocument = new FakeDocument()
    let exportClicks = 0
    const bindTasks = []

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode) => {
            bindTasks.push(
                Promise.resolve().then(() => {
                    const exportButton = viewportNode
                        .closest?.('.scene-3d')
                        ?.querySelector?.(MODEL_ZIP_EXPORT_SELECTOR)
                    exportButton?.addEventListener?.('click', () => {
                        exportClicks += 1
                    })
                })
            )
            return {}
        }
    })

    view.render({
        ...createPcbSnapshot(),
        activeSidebarTab: 'info'
    })
    await Promise.all(bindTasks)

    const railNode = fakeDocument.querySelector('#documentRail')
    const exportButton = railNode.querySelector(MODEL_ZIP_EXPORT_SELECTOR)

    assert.ok(exportButton)

    railNode.dispatch('click', {
        target: exportButton,
        preventDefault() {}
    })

    assert.equal(exportClicks, 1)
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
 * Verifies reopening the 3D tab for the same loaded board reuses the existing
 * scene instead of forcing another scene build.
 */
test('AppView reopens the 3D tab without rebuilding the scene', () => {
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
         * @returns {void}
         */
        setSelectedComponent() {}

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
    const loadedSnapshot = createPcbSnapshot()

    view.render(loadedSnapshot)
    view.render({ ...loadedSnapshot, activeView: 'bom' })
    view.render(loadedSnapshot)

    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].isDisposed, false)
})

/**
 * Verifies changing the missing model search setting updates the mounted 3D
 * scene without discarding the rendered board.
 */
test('AppView updates missing model search visibility without rebuilding the 3D scene', () => {
    const fakeDocument = new FakeDocument()
    const createdControllers = []

    class FakeScene3dController {
        /**
         * @param {FakeNode} viewportNode
         * @param {any} documentModel
         * @param {{ autoSearchMissingModels?: boolean }} [options]
         */
        constructor(viewportNode, documentModel, options = {}) {
            this.viewportNode = viewportNode
            this.documentModel = documentModel
            this.options = options
            this.isDisposed = false
            this.autoSearchUpdates = []
            createdControllers.push(this)
        }

        /**
         * @returns {void}
         */
        setSelectedComponent() {}

        /**
         * @param {boolean} enabled
         * @returns {void}
         */
        setAutoSearchMissingModels(enabled) {
            this.autoSearchUpdates.push(enabled)
        }

        /**
         * @returns {void}
         */
        dispose() {
            this.isDisposed = true
        }
    }

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode, documentModel, options) =>
            new FakeScene3dController(viewportNode, documentModel, options)
    })
    const loadedSnapshot = {
        ...createPcbSnapshot(),
        autoSearchMissingModels: true
    }

    view.render(loadedSnapshot)
    view.render({
        ...loadedSnapshot,
        autoSearchMissingModels: false
    })
    view.render({
        ...loadedSnapshot,
        autoSearchMissingModels: true
    })

    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].isDisposed, false)
    assert.equal(createdControllers[0].options.autoSearchMissingModels, true)
    assert.deepEqual(createdControllers[0].autoSearchUpdates, [false, true])
})

/**
 * Verifies switching through a separate schematic document does not invalidate
 * the already-mounted 3D PCB scene.
 */
test('AppView reopens 3D from a schematic document without rebuilding the scene', () => {
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
            this.isDisposed = false
            createdControllers.push(this)
        }

        /** @returns {void} */
        setSelectedComponent() {}

        /** @returns {void} */
        dispose() {
            this.isDisposed = true
        }
    }

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode, documentModel) =>
            new FakeScene3dController(viewportNode, documentModel)
    })
    const { schematicSnapshot, sceneSnapshot } = createProjectViewSnapshots()

    view.render(sceneSnapshot)
    view.render(schematicSnapshot)
    view.render(sceneSnapshot)

    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].isDisposed, false)
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

/**
 * Verifies the app forwards the sidebar 3D model parameter host to the
 * mounted scene controller.
 */
test('AppView forwards the 3D model sidebar host to the scene controller', () => {
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
            this.adjustmentHosts = []
            createdControllers.push(this)
        }

        /**
         * @param {FakeNode | null} hostNode 3D adjustment host.
         * @returns {void}
         */
        setAdjustmentHost(hostNode) {
            this.adjustmentHosts.push(hostNode)
        }

        /**
         * @returns {void}
         */
        dispose() {}
    }

    const view = new AppView(fakeDocument, {
        createScene3dController: (viewportNode, documentModel) =>
            new FakeScene3dController(viewportNode, documentModel)
    })

    view.render({
        ...createPcbSnapshot(),
        activeSidebarTab: 'model3d',
        selectedPcbComponents: {
            'doc-1': 'U1'
        }
    })

    assert.equal(createdControllers.length, 1)
    assert.equal(createdControllers[0].adjustmentHosts.length, 1)
    assert.ok(createdControllers[0].adjustmentHosts[0])
})
