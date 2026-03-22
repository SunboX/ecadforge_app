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

        return null
    }

    /**
     * @returns {FakeButton[]}
     */
    getButtons() {
        return this.#buttons
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
