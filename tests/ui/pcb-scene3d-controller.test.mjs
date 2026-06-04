import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dController } from '../../src/ui/PcbScene3dController.mjs'

/**
 * Minimal event target used by the scene controller tests.
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
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
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
 * Minimal classList implementation for scene control nodes.
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

    /**
     * @param {string} token
     * @returns {boolean}
     */
    contains(token) {
        return this.#tokens.has(token)
    }
}

/**
 * Minimal scene control button.
 */
class FakeButton extends FakeEventTarget {
    /** @type {{ [key: string]: string }} */
    dataset

    /** @type {FakeClassList} */
    classList

    /** @type {Map<string, string>} */
    #attributes

    /** @type {string} */
    #preset

    /**
     * @param {string} preset
     */
    constructor(preset) {
        super()
        this.#preset = preset
        this.dataset = { 'scene-3dPreset': preset }
        this.classList = new FakeClassList(['scene-3d__preset'])
        this.#attributes = new Map([
            ['data-scene-3d-preset', preset]
        ])
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
     * @param {string} value
     * @returns {void}
     */
    setAttribute(name, value) {
        this.#attributes.set(name, String(value))
    }
}

/**
 * Minimal archive export button.
 */
class FakeExportButton extends FakeEventTarget {
    /** @type {Map<string, string>} */
    #attributes

    constructor() {
        super()
        this.#attributes = new Map([
            ['data-scene-3d-export', 'models-zip']
        ])
    }

    /**
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        return this.#attributes.get(name) || null
    }
}

/**
 * Minimal scene toggle input.
 */
class FakeToggle extends FakeEventTarget {
    /** @type {{ [key: string]: string }} */
    dataset

    /** @type {boolean} */
    checked

    /** @type {string} */
    #toggleName

    /**
     * @param {string} toggleName
     * @param {boolean} checked
     */
    constructor(toggleName, checked = true) {
        super()
        this.#toggleName = toggleName
        this.dataset = { 'scene-3dToggle': toggleName }
        this.checked = checked
    }

    /**
     * @param {string} name
     * @returns {string | null}
     */
    getAttribute(name) {
        if (name === 'data-scene-3d-toggle') {
            return this.#toggleName
        }

        return null
    }
}

/**
 * Minimal diagnostics node.
 */
class FakeDiagnosticsNode {
    /** @type {string} */
    textContent

    constructor() {
        this.textContent = ''
    }
}

/**
 * Minimal inspector node.
 */
class FakeSelectionNode {
    /** @type {string} */
    textContent

    /** @type {string} */
    _innerHTML

    constructor() {
        this.textContent = ''
        this._innerHTML = ''
    }

    /**
     * @param {string} value
     */
    set innerHTML(value) {
        this._innerHTML = String(value)
        this.textContent = this._innerHTML.replace(/<[^>]+>/g, ' ').trim()
    }

    /**
     * @returns {string}
     */
    get innerHTML() {
        return this._innerHTML
    }
}

/**
 * Minimal root scene node.
 */
class FakeSceneRootNode {
    /** @type {FakeButton[]} */
    #buttons

    /** @type {FakeExportButton} */
    #exportButton

    /** @type {FakeToggle[]} */
    #toggles

    /** @type {FakeDiagnosticsNode} */
    #diagnosticsNode

    /** @type {FakeSelectionNode} */
    #selectionNode

    constructor() {
        this.#buttons = [
            new FakeButton('top'),
            new FakeButton('bottom'),
            new FakeButton('isometric')
        ]
        this.#exportButton = new FakeExportButton()
        this.#toggles = [
            new FakeToggle('external-models', true)
        ]
        this.#diagnosticsNode = new FakeDiagnosticsNode()
        this.#selectionNode = new FakeSelectionNode()
    }

    /**
     * @param {string} selector
     * @returns {any[]}
     */
    querySelectorAll(selector) {
        if (selector === '[data-scene-3d-preset]') {
            return this.#buttons
        }

        if (selector === '[data-scene-3d-toggle]') {
            return this.#toggles
        }

        return []
    }

    /**
     * @param {string} selector
     * @returns {FakeDiagnosticsNode | null}
     */
    querySelector(selector) {
        if (selector === '.scene-3d__diagnostics') {
            return this.#diagnosticsNode
        }

        if (selector === '.scene-3d__selection') {
            return this.#selectionNode
        }

        if (selector === '[data-scene-3d-export="models-zip"]') {
            return this.#exportButton
        }

        return null
    }

    /**
     * @returns {FakeButton[]}
     */
    getButtons() {
        return this.#buttons
    }

    /**
     * @returns {FakeExportButton}
     */
    getExportButton() {
        return this.#exportButton
    }

    /**
     * @returns {FakeToggle[]}
     */
    getToggles() {
        return this.#toggles
    }

    /**
     * @returns {FakeDiagnosticsNode}
     */
    getDiagnosticsNode() {
        return this.#diagnosticsNode
    }

    /**
     * @returns {FakeSelectionNode}
     */
    getSelectionNode() {
        return this.#selectionNode
    }
}

/**
 * Minimal viewport mount node.
 */
class FakeViewportNode {
    /** @type {FakeSceneRootNode} */
    #rootNode

    /**
     * @param {FakeSceneRootNode} rootNode
     */
    constructor(rootNode) {
        this.#rootNode = rootNode
    }

    /**
     * @param {string} selector
     * @returns {FakeSceneRootNode | null}
     */
    closest(selector) {
        return selector === '.scene-3d' ? this.#rootNode : null
    }
}

/**
 * Verifies the controller forwards controls to the runtime and surfaces
 * diagnostics into the rendered panel.
 */
test('PcbScene3dController forwards presets, toggles, and diagnostics', () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    const runtimeCalls = {
        presets: [],
        toggles: [],
        disposed: false
    }

    const controller = new PcbScene3dController(
        viewportNode,
        { pcb: { boardOutline: {}, components: [] } },
        {
            buildScene: () => ({ board: {}, components: [], detail: {} }),
            createRuntime: (_viewport, _scene, hooks) => {
                hooks.setDiagnostics([
                    'Missing external model for U1.',
                    'Falling back to procedural package.'
                ])

                return {
                    setPreset(preset) {
                        runtimeCalls.presets.push(preset)
                    },
                    setToggle(toggleName, enabled) {
                        runtimeCalls.toggles.push([toggleName, enabled])
                    },
                    dispose() {
                        runtimeCalls.disposed = true
                    }
                }
            }
        }
    )

    const isometricButton = rootNode.getButtons()[2]
    assert.equal(isometricButton.getAttribute('aria-pressed'), 'true')
    assert.equal(isometricButton.classList.contains('is-active'), true)

    rootNode.getButtons().forEach((button) => {
        button.dispatch('click')
    })
    rootNode.getToggles()[0].checked = false
    rootNode.getToggles()[0].dispatch('change')

    assert.deepEqual(runtimeCalls.presets, [
        'top',
        'bottom',
        'isometric'
    ])
    assert.equal(rootNode.getButtons()[0].getAttribute('aria-pressed'), 'false')
    assert.equal(rootNode.getButtons()[0].classList.contains('is-active'), false)
    assert.equal(rootNode.getButtons()[2].getAttribute('aria-pressed'), 'true')
    assert.equal(rootNode.getButtons()[2].classList.contains('is-active'), true)
    assert.deepEqual(runtimeCalls.toggles, [['external-models', false]])
    assert.match(
        rootNode.getDiagnosticsNode().textContent,
        /Missing external model/
    )

    controller.dispose()

    assert.equal(runtimeCalls.disposed, true)
})

/**
 * Verifies the controller passes embedded PCB model payloads into the 3D model
 * registry used during scene building.
 */
test('PcbScene3dController exposes embedded pcb models to the scene registry', () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    let resolvedModel = null

    const controller = new PcbScene3dController(
        viewportNode,
        {
            pcb: {
                boardOutline: {},
                components: [],
                embeddedModels: [
                    {
                        id: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
                        checksum: 3467130030,
                        name: 'SOT-23_Y.stp',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                ]
            }
        },
        {
            buildScene: (_documentModel, buildOptions) => {
                resolvedModel = buildOptions.modelRegistry.resolveComponentBodyModel({
                    modelId: '{7AE6DAB5-7AAC-4AE4-A725-B155EF16B48A}',
                    checksum: 3467130030,
                    embedded: true,
                    name: 'SOT-23_Y.stp'
                })

                return {
                    board: {},
                    components: [],
                    externalPlacements: [],
                    detail: {}
                }
            },
            createRuntime: () => ({
                dispose() {}
            })
        }
    )

    assert.equal(resolvedModel?.origin, 'embedded')
    assert.equal(resolvedModel?.payloadText, 'ISO-10303-21;')

    controller.dispose()
})

/**
 * Verifies the controller renders clicked component details into the
 * right-side inspector panel.
 */
test('PcbScene3dController renders the selected component inspector content', () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    let runtimeHooks = null

    const controller = new PcbScene3dController(
        viewportNode,
        {
            pcb: {
                boardOutline: {},
                components: [
                    {
                        designator: 'J16',
                        x: 5366.57,
                        y: 9269.12,
                        layer: 'BOTTOM',
                        pattern: 'CK-6.35-636-6P',
                        rotation: 0,
                        source: 'ConnectorLib'
                    }
                ]
            }
        },
        {
            buildScene: () => ({
                board: {},
                components: [
                    {
                        designator: 'J16',
                        mountSide: 'bottom',
                        rotationDeg: 0,
                        positionMil: { x: -2389.76, y: 2897.11, z: -140 },
                        boardPositionMil: { x: 5366.57, y: 9269.12, z: -140 },
                        pattern: 'CK-6.35-636-6P',
                        source: 'ConnectorLib',
                        externalModel: {
                            name: 'ck_636_6p.stp',
                            format: 'step'
                        }
                    }
                ],
                externalPlacements: [
                    {
                        designator: 'J16',
                        mountSide: 'bottom',
                        rotationDeg: 0,
                        positionMil: { x: -2389.76, y: 2897.11, z: -31.5 },
                        bodyPositionMil: { x: 4961.06, y: 13182.5 },
                        bodyRotationDeg: 0,
                        modelTransform: {
                            rotationDeg: { x: 90, y: 0, z: 90 },
                            dzMil: -30.99
                        },
                        externalModel: {
                            origin: 'embedded',
                            name: 'ck_636_6p.stp',
                            format: 'step'
                        }
                    }
                ],
                detail: {}
            }),
            createRuntime: (_viewport, _scene, hooks) => {
                runtimeHooks = hooks
                return {
                    dispose() {}
                }
            }
        }
    )

    runtimeHooks.setSelection({ designator: 'J16', sourceType: 'external-model' })

    assert.match(rootNode.getSelectionNode().textContent, /J16/)
    assert.match(rootNode.getSelectionNode().textContent, /CK-6\.35-636-6P/)
    assert.match(rootNode.getSelectionNode().textContent, /ck_636_6p\.stp/i)
    assert.match(rootNode.getSelectionNode().textContent, /90/)

    runtimeHooks.setSelection(null)

    assert.match(
        rootNode.getSelectionNode().textContent,
        /Click a component to inspect it\./
    )

    controller.dispose()
})

/**
 * Verifies runtime picks are promoted to the shared component selection
 * callback so 3D selections survive view switches.
 */
test('PcbScene3dController reports runtime component selections', () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    const selectionChanges = []
    let runtimeHooks = null

    const controller = new PcbScene3dController(
        viewportNode,
        {
            pcb: {
                boardOutline: {},
                components: [
                    {
                        designator: 'C8',
                        x: 100,
                        y: 200,
                        layer: 'TOP',
                        pattern: 'SMT_C_0402'
                    }
                ]
            }
        },
        {
            documentId: 'pcb-doc',
            onComponentSelectionChange(change) {
                selectionChanges.push(change)
            },
            buildScene: () => ({
                board: {},
                components: [
                    {
                        designator: 'C8',
                        mountSide: 'top',
                        rotationDeg: 90,
                        positionMil: { x: 100, y: 200, z: 0 },
                        boardPositionMil: { x: 100, y: 200, z: 0 },
                        pattern: 'SMT_C_0402'
                    }
                ],
                externalPlacements: [],
                detail: {}
            }),
            createRuntime: (_viewport, _scene, hooks) => {
                runtimeHooks = hooks
                return {
                    dispose() {}
                }
            }
        }
    )

    runtimeHooks.setSelection({ designator: 'C8', sourceType: 'component' })
    runtimeHooks.setSelection(null)

    assert.deepEqual(selectionChanges, [
        { documentId: 'pcb-doc', componentKey: 'C8', source: '3d-scene' },
        { documentId: 'pcb-doc', componentKey: '', source: '3d-scene' }
    ])

    controller.dispose()
})

/**
 * Verifies sidebar-driven selections are forwarded to the mounted runtime and
 * reflected in the inspector without remounting the scene.
 */
test('PcbScene3dController updates selected component on the live runtime', () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    const runtimeSelections = []

    const controller = new PcbScene3dController(
        viewportNode,
        {
            pcb: {
                boardOutline: {},
                components: [
                    {
                        designator: 'C8',
                        x: 100,
                        y: 200,
                        layer: 'TOP',
                        pattern: 'SMT_C_0402'
                    }
                ]
            }
        },
        {
            buildScene: () => ({
                board: {},
                components: [
                    {
                        designator: 'C8',
                        mountSide: 'top',
                        rotationDeg: 90,
                        positionMil: { x: 100, y: 200, z: 0 },
                        boardPositionMil: { x: 100, y: 200, z: 0 },
                        pattern: 'SMT_C_0402'
                    }
                ],
                externalPlacements: [],
                detail: {}
            }),
            createRuntime: () => ({
                setSelectedDesignator(designator) {
                    runtimeSelections.push(designator)
                },
                dispose() {}
            })
        }
    )

    controller.setSelectedComponent('C8')

    assert.deepEqual(runtimeSelections, ['C8'])
    assert.match(rootNode.getSelectionNode().textContent, /C8/)
    assert.match(rootNode.getSelectionNode().textContent, /SMT_C_0402/)

    controller.dispose()
})

/**
 * Verifies a selected component is applied when async scene preparation mounts
 * the runtime after the selection changed.
 */
test('PcbScene3dController applies pending component selection after async mount', async () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    const runtimeSelections = []
    let resolvePrep = null

    const controller = new PcbScene3dController(
        viewportNode,
        {
            pcb: {
                boardOutline: {},
                components: [
                    {
                        designator: 'C8',
                        x: 100,
                        y: 200,
                        layer: 'TOP',
                        pattern: 'SMT_C_0402'
                    }
                ]
            }
        },
        {
            scenePrepClient: {
                prepareScene() {
                    return new Promise((resolve) => {
                        resolvePrep = resolve
                    })
                },
                dispose() {}
            },
            createRuntime: () => ({
                setSelectedDesignator(designator) {
                    runtimeSelections.push(designator)
                },
                dispose() {}
            })
        }
    )

    controller.setSelectedComponent('C8')

    assert.deepEqual(runtimeSelections, [])

    resolvePrep?.({
        board: {},
        components: [
            {
                designator: 'C8',
                mountSide: 'top',
                rotationDeg: 90,
                positionMil: { x: 100, y: 200, z: 0 },
                boardPositionMil: { x: 100, y: 200, z: 0 },
                pattern: 'SMT_C_0402'
            }
        ],
        externalPlacements: [],
        detail: {}
    })
    await Promise.resolve()
    await Promise.resolve()

    assert.deepEqual(runtimeSelections, ['C8'])

    controller.dispose()
})

/**
 * Verifies the controller keeps the scene loading state active until worker
 * prep and runtime settlement both finish.
 */
test('PcbScene3dController waits for prep and runtime readiness before hiding loading', async () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    const loadingStates = []
    let resolvePrep = null
    let resolveRuntimeReady = null

    const controller = new PcbScene3dController(
        viewportNode,
        { pcb: { boardOutline: {}, components: [] } },
        {
            scenePrepClient: {
                prepareScene() {
                    return new Promise((resolve) => {
                        resolvePrep = resolve
                    })
                },
                dispose() {}
            },
            setLoadingVisible(visible) {
                loadingStates.push(visible)
            },
            createRuntime: () => ({
                whenReady() {
                    return new Promise((resolve) => {
                        resolveRuntimeReady = resolve
                    })
                },
                dispose() {}
            })
        }
    )

    assert.deepEqual(loadingStates, [true])

    resolvePrep?.({
        board: {},
        components: [],
        externalPlacements: [],
        detail: {}
    })
    await Promise.resolve()
    await Promise.resolve()

    assert.deepEqual(loadingStates, [true])

    resolveRuntimeReady?.()
    await Promise.resolve()
    await Promise.resolve()

    assert.deepEqual(loadingStates, [true, false])

    controller.dispose()
})

/**
 * Verifies the controller routes the export button through the archive
 * exporter and triggers a download only when models are available.
 */
test('PcbScene3dController exports a ZIP from the resolved scene models', async () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    const exportCalls = []
    const downloadCalls = []
    const sceneDescription = {
        board: {},
        components: [
            {
                designator: 'P1',
                pattern: 'CONN-HEADER',
                externalModel: {
                    origin: 'session',
                    name: 'connector.wrl',
                    relativePath: 'models/connector.wrl',
                    format: 'wrl'
                }
            }
        ],
        externalPlacements: [
            {
                designator: 'J16',
                externalModel: {
                    origin: 'embedded',
                    name: 'ck_636_6p.stp',
                    format: 'step',
                    payloadText: 'ISO-10303-21;',
                    sourceStream: 'Models/1'
                }
            }
        ],
        detail: {}
    }

    const controller = new PcbScene3dController(
        viewportNode,
        {
            fileName: 'demo-board.PcbDoc',
            summary: {
                title: 'Demo Board'
            },
            pcb: {
                boardOutline: {},
                components: [
                    {
                        designator: 'J16',
                        pattern: 'CK-6.35-636-6P'
                    },
                    {
                        designator: 'P1',
                        pattern: 'CONN-HEADER'
                    }
                ]
            }
        },
        {
            buildScene: () => sceneDescription,
            createRuntime: () => ({
                dispose() {}
            }),
            exportArchive: async (options) => {
                exportCalls.push(options)
                return {
                    archiveName: 'Demo-Board-models.zip',
                    archiveBytes: new Uint8Array([1, 2, 3]),
                    exportedEntries: [
                        { archivePath: 'CK-6.35-636-6P.step' },
                        { archivePath: 'CONN-HEADER.wrl' }
                    ],
                    skippedEntries: []
                }
            },
            downloadArchive: (archiveName, archiveBytes) => {
                downloadCalls.push([archiveName, [...archiveBytes]])
            }
        }
    )

    rootNode.getExportButton().dispatch('click')
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(exportCalls.length, 1)
    assert.equal(exportCalls[0].archiveBaseName, 'Demo Board')
    assert.equal(exportCalls[0].sceneDescription, sceneDescription)
    assert.deepEqual(downloadCalls, [['Demo-Board-models.zip', [1, 2, 3]]])
    assert.match(
        rootNode.getDiagnosticsNode().textContent,
        /Downloaded 2 model files/
    )

    controller.dispose()
})

/**
 * Verifies the controller reports the empty export case without attempting a
 * download.
 */
test('PcbScene3dController reports when no models are available for ZIP export', async () => {
    const rootNode = new FakeSceneRootNode()
    const viewportNode = new FakeViewportNode(rootNode)
    let downloadCount = 0

    const controller = new PcbScene3dController(
        viewportNode,
        {
            fileName: 'empty-board.PcbDoc',
            summary: {
                title: 'Empty Board'
            },
            pcb: {
                boardOutline: {},
                components: []
            }
        },
        {
            buildScene: () => ({
                board: {},
                components: [],
                externalPlacements: [],
                detail: {}
            }),
            createRuntime: () => ({
                dispose() {}
            }),
            exportArchive: async () => ({
                archiveName: 'Empty-Board-models.zip',
                archiveBytes: new Uint8Array(),
                exportedEntries: [],
                skippedEntries: []
            }),
            downloadArchive: () => {
                downloadCount += 1
            }
        }
    )

    rootNode.getExportButton().dispatch('click')
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(downloadCount, 0)
    assert.match(
        rootNode.getDiagnosticsNode().textContent,
        /No STEP or WRL models were resolved for export\./
    )

    controller.dispose()
})
