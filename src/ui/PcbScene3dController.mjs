import { PcbScene3dBuilder } from './PcbScene3dBuilder.mjs'
import { PcbScene3dModelRegistry } from './PcbScene3dModelRegistry.mjs'
import { PcbScene3dRuntime } from './PcbScene3dRuntime.mjs'

/**
 * Wires the 3D scene shell to a runtime implementation.
 */
export class PcbScene3dController {
    /** @type {HTMLElement | null} */
    #viewportNode

    /** @type {any} */
    #documentModel

    /** @type {HTMLElement | null} */
    #rootNode

    /** @type {HTMLElement | null} */
    #diagnosticsNode

    /** @type {HTMLElement | null} */
    #selectionNode

    /** @type {Array<{ node: EventTarget, type: string, listener: (event: any) => void }>} */
    #listeners

    /** @type {Map<string, { component: any | null, externalPlacement: any | null }>} */
    #selectionIndex

    /** @type {{ setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void } | null} */
    #runtime

    /** @type {{ prepareScene?: (documentModel: any, sessionAssets?: any[]) => Promise<any>, dispose?: () => void } | null} */
    #scenePrepClient

    /** @type {(visible: boolean) => void} */
    #setLoadingVisible

    /** @type {boolean} */
    #isDisposed

    /**
     * @param {HTMLElement} viewportNode
     * @param {any} documentModel
     * @param {{ rootNode?: HTMLElement | null, sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: PcbScene3dModelRegistry }) => any, createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void }, scenePrepClient?: { prepareScene?: (documentModel: any, sessionAssets?: any[]) => Promise<any>, dispose?: () => void } | null, setLoadingVisible?: (visible: boolean) => void }} [options]
     */
    constructor(viewportNode, documentModel, options = {}) {
        this.#viewportNode = viewportNode
        this.#documentModel = documentModel
        this.#rootNode =
            options.rootNode ||
            (typeof viewportNode.closest === 'function'
                ? viewportNode.closest('.scene-3d')
                : null)
        this.#diagnosticsNode = this.#rootNode?.querySelector(
            '.scene-3d__diagnostics'
        )
        this.#selectionNode = this.#rootNode?.querySelector(
            '.scene-3d__selection'
        )
        this.#listeners = []
        this.#scenePrepClient = options.scenePrepClient || null
        this.#setLoadingVisible =
            options.setLoadingVisible || (() => {})
        this.#isDisposed = false
        this.#runtime = null
        this.#selectionIndex = new Map()

        this.#bindPresets()
        this.#setActivePresetButton('isometric')
        this.#bindToggles()
        this.#setSelection(null)
        this.#setLoadingVisible(true)
        if (this.#scenePrepClient?.prepareScene) {
            this.#initializeScene(options)
            return
        }

        this.#initializeSceneSync(options)
    }

    /**
     * Returns the mounted document model.
     * @returns {any}
     */
    getDocumentModel() {
        return this.#documentModel
    }

    /**
     * Releases event listeners and runtime resources.
     * @returns {void}
     */
    dispose() {
        this.#isDisposed = true
        this.#listeners.forEach(({ node, type, listener }) => {
            node.removeEventListener?.(type, listener)
        })
        this.#listeners = []
        this.#scenePrepClient?.dispose?.()
        this.#scenePrepClient = null
        this.#runtime?.dispose?.()
        this.#runtime = null
        this.#viewportNode = null
        this.#documentModel = null
        this.#rootNode = null
        this.#diagnosticsNode = null
        this.#selectionNode = null
        this.#selectionIndex = new Map()
    }

    /**
     * Builds the scene description, mounts the runtime, and settles loading
     * only after the runtime is fully ready.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: PcbScene3dModelRegistry }) => any, createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void } }} options
     * @returns {Promise<void>}
     */
    async #initializeScene(options) {
        try {
            const sceneDescription =
                await this.#prepareSceneDescription(options)
            if (this.#isDisposed || !this.#viewportNode) {
                return
            }

            this.#mountScene(sceneDescription, options)
            await this.#runtime?.whenReady?.()
            if (this.#isDisposed) {
                return
            }

            this.#setLoadingVisible(false)
        } catch (error) {
            if (this.#isDisposed) {
                return
            }

            this.#setDiagnostics([
                '3D preview could not start: ' +
                    String(error?.message || error || 'Unknown error.')
            ])
            this.#setLoadingVisible(false)
        }
    }

    /**
     * Initializes the local fallback scene path synchronously so the existing
     * non-worker controller behavior remains unchanged.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: PcbScene3dModelRegistry }) => any, createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void } }} options
     * @returns {void}
     */
    #initializeSceneSync(options) {
        try {
            const sceneDescription =
                this.#prepareSceneDescriptionSync(options)
            this.#mountScene(sceneDescription, options)
            Promise.resolve(this.#runtime?.whenReady?.()).finally(() => {
                if (this.#isDisposed) {
                    return
                }

                this.#setLoadingVisible(false)
            })
        } catch (error) {
            this.#setDiagnostics([
                '3D preview could not start: ' +
                    String(error?.message || error || 'Unknown error.')
            ])
            this.#setLoadingVisible(false)
        }
    }

    /**
     * Prepares the scene description either through the dedicated worker
     * client or the local fallback path.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: PcbScene3dModelRegistry }) => any }} options
     * @returns {Promise<any>}
     */
    async #prepareSceneDescription(options) {
        if (this.#scenePrepClient?.prepareScene) {
            try {
                return await this.#scenePrepClient.prepareScene(
                    this.#documentModel,
                    options.sessionAssets || []
                )
            } catch (_error) {
                // Fall back to the local path when the dedicated 3D worker is
                // unavailable so the tab still renders.
            }
        }

        return this.#prepareSceneDescriptionSync(options)
    }

    /**
     * Prepares the local fallback scene description synchronously.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: PcbScene3dModelRegistry }) => any }} options
     * @returns {any}
     */
    #prepareSceneDescriptionSync(options) {
        const modelRegistry = PcbScene3dModelRegistry.create(
            options.sessionAssets || [],
            Array.isArray(this.#documentModel?.pcb?.embeddedModels)
                ? this.#documentModel.pcb.embeddedModels
                : []
        )
        const buildScene =
            options.buildScene ||
            ((nextDocumentModel, buildOptions) =>
                PcbScene3dBuilder.build(nextDocumentModel, buildOptions))

        return buildScene(this.#documentModel, {
            modelRegistry
        })
    }

    /**
     * Mounts the runtime for one prepared scene description.
     * @param {any} sceneDescription
     * @param {{ createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void } }} options
     * @returns {void}
     */
    #mountScene(sceneDescription, options) {
        this.#selectionIndex =
            PcbScene3dController.#buildSelectionIndex(sceneDescription)
        const createRuntime =
            options.createRuntime ||
            ((nextViewportNode, nextSceneDescription, hooks) =>
                new PcbScene3dRuntime(
                    nextViewportNode,
                    nextSceneDescription,
                    hooks
                ))

        this.#runtime = createRuntime(this.#viewportNode, sceneDescription, {
            setDiagnostics: (messages) => this.#setDiagnostics(messages),
            setSelection: (selection) => this.#setSelection(selection)
        })
    }

    /**
     * Binds toolbar camera preset buttons.
     * @returns {void}
     */
    #bindPresets() {
        const buttons =
            this.#rootNode?.querySelectorAll('[data-scene-3d-preset]') || []

        buttons.forEach((button) => {
            const listener = () => {
                const presetName =
                    button?.getAttribute?.('data-scene-3d-preset') || ''
                this.#setActivePresetButton(presetName)
                this.#runtime?.setPreset?.(presetName)
            }

            button.addEventListener?.('click', listener)
            this.#listeners.push({
                node: button,
                type: 'click',
                listener
            })
        })
    }

    /**
     * Marks exactly one preset button as active in the 3D toolbar.
     * @param {string} activePreset
     * @returns {void}
     */
    #setActivePresetButton(activePreset) {
        const normalizedPreset = String(activePreset || '').trim().toLowerCase()
        const buttons =
            this.#rootNode?.querySelectorAll('[data-scene-3d-preset]') || []

        buttons.forEach((button) => {
            const presetName = String(
                button?.getAttribute?.('data-scene-3d-preset') || ''
            )
                .trim()
                .toLowerCase()
            const isActive =
                Boolean(normalizedPreset) && presetName === normalizedPreset

            button?.setAttribute?.('aria-pressed', isActive ? 'true' : 'false')
            if (isActive) {
                button?.classList?.add?.('is-active')
                return
            }

            button?.classList?.remove?.('is-active')
        })
    }

    /**
     * Binds detail toggle controls.
     * @returns {void}
     */
    #bindToggles() {
        const toggles =
            this.#rootNode?.querySelectorAll('[data-scene-3d-toggle]') || []

        toggles.forEach((toggle) => {
            const listener = () => {
                const toggleName =
                    toggle?.getAttribute?.('data-scene-3d-toggle') || ''
                this.#runtime?.setToggle?.(toggleName, Boolean(toggle.checked))
            }

            toggle.addEventListener?.('change', listener)
            this.#listeners.push({
                node: toggle,
                type: 'change',
                listener
            })
        })
    }

    /**
     * Renders diagnostic messages into the scene panel.
     * @param {string[]} messages
     * @returns {void}
     */
    #setDiagnostics(messages) {
        if (!this.#diagnosticsNode) {
            return
        }

        const list = Array.isArray(messages) ? messages.filter(Boolean) : []
        this.#diagnosticsNode.textContent = list.length
            ? list.join(' ')
            : 'Drag to orbit, right-drag to pan, and use the wheel to zoom.'
    }

    /**
     * Renders the selected component details into the inspector panel.
     * @param {{ designator?: string, sourceType?: string } | null} selection
     * @returns {void}
     */
    #setSelection(selection) {
        if (!this.#selectionNode) {
            return
        }

        const designator = String(selection?.designator || '').trim()
        if (!designator) {
            this.#selectionNode.innerHTML =
                '<h4 class="scene-3d__selection-title">Component inspector</h4><p class="scene-3d__selection-empty">Click a component to inspect it.</p>'
            return
        }

        const selectionEntry = this.#selectionIndex.get(designator)
        if (!selectionEntry) {
            this.#selectionNode.innerHTML =
                '<h4 class="scene-3d__selection-title">Component inspector</h4><p class="scene-3d__selection-empty">No metadata is available for ' +
                PcbScene3dController.#escapeHtml(designator) +
                '.</p>'
            return
        }

        const component = selectionEntry.component
        const externalPlacement = selectionEntry.externalPlacement
        const fields = [
            ['Designator', designator],
            [
                'Picked',
                selection?.sourceType === 'external-model'
                    ? 'External model'
                    : 'Fallback body'
            ],
            [
                'Mount side',
                externalPlacement?.mountSide || component?.mountSide || ''
            ],
            [
                'Rotation',
                PcbScene3dController.#formatMilValue(
                    component?.rotationDeg ?? externalPlacement?.rotationDeg,
                    'deg'
                )
            ],
            [
                'Board position',
                component?.boardPositionMil
                    ? PcbScene3dController.#formatPoint(
                          component.boardPositionMil,
                          true
                      )
                    : ''
            ],
            ['Pattern', String(component?.pattern || '')],
            ['Source', String(component?.source || '')],
            [
                'Model',
                externalPlacement?.externalModel
                    ? String(externalPlacement.externalModel.name || '') +
                      ' (' +
                      String(externalPlacement.externalModel.format || '') +
                      ')'
                    : component?.externalModel
                      ? String(component.externalModel.name || '') +
                        ' (' +
                        String(component.externalModel.format || '') +
                        ')'
                      : ''
            ],
            [
                'Body position',
                externalPlacement?.bodyPositionMil
                    ? PcbScene3dController.#formatPoint(
                          externalPlacement.bodyPositionMil,
                          false
                      )
                    : ''
            ],
            [
                'Body rotation',
                PcbScene3dController.#formatMilValue(
                    externalPlacement?.bodyRotationDeg,
                    'deg'
                )
            ],
            [
                'Model rotation',
                externalPlacement?.modelTransform?.rotationDeg
                    ? 'X ' +
                      PcbScene3dController.#formatNumber(
                          externalPlacement.modelTransform.rotationDeg.x
                      ) +
                      ', Y ' +
                      PcbScene3dController.#formatNumber(
                          externalPlacement.modelTransform.rotationDeg.y
                      ) +
                      ', Z ' +
                      PcbScene3dController.#formatNumber(
                          externalPlacement.modelTransform.rotationDeg.z
                      )
                    : ''
            ],
            [
                'dz',
                PcbScene3dController.#formatMilValue(
                    externalPlacement?.modelTransform?.dzMil,
                    'mil'
                )
            ]
        ].filter(([, value]) => String(value || '').trim())

        this.#selectionNode.innerHTML =
            '<h4 class="scene-3d__selection-title">Component inspector</h4><dl class="scene-3d__selection-list">' +
            fields
                .map(
                    ([label, value]) =>
                        '<div class="scene-3d__selection-field"><dt>' +
                        PcbScene3dController.#escapeHtml(label) +
                        '</dt><dd>' +
                        PcbScene3dController.#escapeHtml(String(value)) +
                        '</dd></div>'
                )
                .join('') +
            '</dl>'
    }

    /**
     * Builds one designator-keyed inspector lookup from the scene
     * description.
     * @param {{ components?: any[], externalPlacements?: any[] }} sceneDescription
     * @returns {Map<string, { component: any | null, externalPlacement: any | null }>}
     */
    static #buildSelectionIndex(sceneDescription) {
        const index = new Map()
        const components = Array.isArray(sceneDescription?.components)
            ? sceneDescription.components
            : []
        const externalPlacements = Array.isArray(
            sceneDescription?.externalPlacements
        )
            ? sceneDescription.externalPlacements
            : []

        components.forEach((component) => {
            const designator = String(component?.designator || '').trim()
            if (!designator) {
                return
            }

            index.set(designator, {
                component,
                externalPlacement: index.get(designator)?.externalPlacement || null
            })
        })

        externalPlacements.forEach((externalPlacement) => {
            const designator = String(externalPlacement?.designator || '').trim()
            if (!designator) {
                return
            }

            index.set(designator, {
                component: index.get(designator)?.component || null,
                externalPlacement
            })
        })

        return index
    }

    /**
     * Formats one point for the inspector.
     * @param {{ x?: number, y?: number, z?: number }} point
     * @param {boolean} includeZ
     * @returns {string}
     */
    static #formatPoint(point, includeZ) {
        const values = [
            'X ' + PcbScene3dController.#formatNumber(point?.x),
            'Y ' + PcbScene3dController.#formatNumber(point?.y)
        ]

        if (includeZ) {
            values.push('Z ' + PcbScene3dController.#formatNumber(point?.z))
        }

        return values.join(', ') + ' mil'
    }

    /**
     * Formats one numeric inspector value with an optional unit.
     * @param {number | undefined} value
     * @param {string} unit
     * @returns {string}
     */
    static #formatMilValue(value, unit) {
        if (!Number.isFinite(Number(value))) {
            return ''
        }

        return PcbScene3dController.#formatNumber(value) + ' ' + unit
    }

    /**
     * Formats one number for compact UI display.
     * @param {number | undefined} value
     * @returns {string}
     */
    static #formatNumber(value) {
        const numericValue = Number(value)
        if (!Number.isFinite(numericValue)) {
            return ''
        }

        return numericValue.toFixed(2).replace(/\.00$/, '')
    }

    /**
     * Escapes user-facing HTML values.
     * @param {string} value
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }
}
