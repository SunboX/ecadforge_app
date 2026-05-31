import { EcadScene3dService } from '../core/ecad/EcadScene3dService.mjs'
import { PcbModelArchiveExporter } from './PcbModelArchiveExporter.mjs'
import { PcbScene3dInteractionHints } from './PcbScene3dInteractionHints.mjs'
import { PcbScene3dRuntime } from './PcbScene3dRuntime.mjs'
import { UiText } from './UiText.mjs'

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

    /** @type {any | null} */
    #sceneDescription

    /** @type {{ prepareScene?: (documentModel: any, sessionAssets?: any[]) => Promise<any>, dispose?: () => void } | null} */
    #scenePrepClient

    /** @type {(options: { archiveBaseName?: string, sceneDescription?: any }) => Promise<{ archiveName: string, archiveBytes: Uint8Array, exportedEntries: any[], skippedEntries: any[] }>} */
    #exportArchive

    /** @type {(archiveName: string, archiveBytes: Uint8Array) => Promise<void> | void} */
    #downloadArchive

    /** @type {(visible: boolean) => void} */
    #setLoadingVisible

    /** @type {(key: string) => string} */
    #translate

    /** @type {boolean} */
    #isDisposed

    /**
     * @param {HTMLElement} viewportNode
     * @param {any} documentModel
     * @param {{ rootNode?: HTMLElement | null, sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: any }) => any, createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void, translate?: ((key: string) => string) | null }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void }, scenePrepClient?: { prepareScene?: (documentModel: any, sessionAssets?: any[]) => Promise<any>, dispose?: () => void } | null, exportArchive?: (options: { archiveBaseName?: string, sceneDescription?: any }) => Promise<{ archiveName: string, archiveBytes: Uint8Array, exportedEntries: any[], skippedEntries: any[] }>, downloadArchive?: (archiveName: string, archiveBytes: Uint8Array) => Promise<void> | void, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }} [options]
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
        this.#sceneDescription = null
        this.#exportArchive =
            options.exportArchive ||
            ((exportOptions) =>
                PcbModelArchiveExporter.buildArchive(exportOptions))
        this.#downloadArchive =
            options.downloadArchive ||
            ((archiveName, archiveBytes) =>
                PcbScene3dController.#triggerArchiveDownload(
                    archiveName,
                    archiveBytes
                ))
        this.#setLoadingVisible = options.setLoadingVisible || (() => {})
        this.#translate = UiText.createTranslator(options.translate || null)
        this.#isDisposed = false
        this.#runtime = null
        this.#selectionIndex = new Map()

        this.#bindPresets()
        this.#setActivePresetButton('isometric')
        this.#bindToggles()
        this.#bindExportAction()
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
        this.#sceneDescription = null
        this.#viewportNode = null
        this.#documentModel = null
        this.#rootNode = null
        this.#diagnosticsNode = null
        this.#selectionNode = null
        this.#exportArchive = async () => ({
            archiveName: '',
            archiveBytes: new Uint8Array(),
            exportedEntries: [],
            skippedEntries: []
        })
        this.#downloadArchive = async () => {}
        this.#selectionIndex = new Map()
    }

    /**
     * Builds the scene description, mounts the runtime, and settles loading
     * only after the runtime is fully ready.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: any }) => any, createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void } }} options
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
                this.#translate('scene3d.startFailed') +
                    ' ' +
                    String(error?.message || error || 'Unknown error.')
            ])
            this.#setLoadingVisible(false)
        }
    }

    /**
     * Initializes the local fallback scene path synchronously so the existing
     * non-worker controller behavior remains unchanged.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: any }) => any, createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void } }} options
     * @returns {void}
     */
    #initializeSceneSync(options) {
        try {
            const sceneDescription = this.#prepareSceneDescriptionSync(options)
            this.#mountScene(sceneDescription, options)
            Promise.resolve(this.#runtime?.whenReady?.()).finally(() => {
                if (this.#isDisposed) {
                    return
                }

                this.#setLoadingVisible(false)
            })
        } catch (error) {
            this.#setDiagnostics([
                this.#translate('scene3d.startFailed') +
                    ' ' +
                    String(error?.message || error || 'Unknown error.')
            ])
            this.#setLoadingVisible(false)
        }
    }

    /**
     * Prepares the scene description either through the dedicated worker
     * client or the local fallback path.
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: any }) => any }} options
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
     * @param {{ sessionAssets?: any[], buildScene?: (documentModel: any, options: { modelRegistry: any }) => any }} options
     * @returns {any}
     */
    #prepareSceneDescriptionSync(options) {
        const modelRegistry = EcadScene3dService.createModelRegistry(
            this.#documentModel,
            options.sessionAssets || []
        )
        const buildScene =
            options.buildScene ||
            ((nextDocumentModel, buildOptions) =>
                EcadScene3dService.build(nextDocumentModel, buildOptions))

        return buildScene(this.#documentModel, {
            modelRegistry
        })
    }

    /**
     * Mounts the runtime for one prepared scene description.
     * @param {any} sceneDescription
     * @param {{ createRuntime?: (viewportNode: HTMLElement, sceneDescription: any, hooks: { setDiagnostics: (messages: string[]) => void, setSelection: (selection: any | null) => void, translate?: ((key: string) => string) | null }) => { setPreset?: (preset: string) => void, setToggle?: (toggleName: string, enabled: boolean) => void, dispose?: () => void, whenReady?: () => Promise<void> | void } }} options
     * @returns {void}
     */
    #mountScene(sceneDescription, options) {
        this.#sceneDescription = sceneDescription
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
            setSelection: (selection) => this.#setSelection(selection),
            translate: this.#translate
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
        const normalizedPreset = String(activePreset || '')
            .trim()
            .toLowerCase()
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
     * Binds the model archive export action.
     * @returns {void}
     */
    #bindExportAction() {
        const exportButton = this.#rootNode?.querySelector(
            '[data-scene-3d-export="models-zip"]'
        )
        if (!exportButton) {
            return
        }

        const listener = async () => {
            await this.#handleExportAction()
        }

        exportButton.addEventListener?.('click', listener)
        this.#listeners.push({
            node: exportButton,
            type: 'click',
            listener
        })
    }

    /**
     * Exports the currently resolved 3D model set as one ZIP archive.
     * @returns {Promise<void>}
     */
    async #handleExportAction() {
        if (!this.#sceneDescription) {
            this.#setDiagnostics([this.#translate('scene3d.stillPreparing')])
            return
        }

        try {
            const archiveResult = await this.#exportArchive({
                archiveBaseName: PcbScene3dController.#resolveArchiveBaseName(
                    this.#documentModel
                ),
                sceneDescription: this.#sceneDescription
            })

            if (this.#isDisposed) {
                return
            }

            const exportedCount = Array.isArray(archiveResult?.exportedEntries)
                ? archiveResult.exportedEntries.length
                : 0
            const skippedCount = Array.isArray(archiveResult?.skippedEntries)
                ? archiveResult.skippedEntries.length
                : 0

            if (!exportedCount) {
                this.#setDiagnostics([
                    this.#translate('scene3d.noModelsForExport')
                ])
                return
            }

            await this.#downloadArchive(
                String(archiveResult?.archiveName || ''),
                archiveResult?.archiveBytes instanceof Uint8Array
                    ? archiveResult.archiveBytes
                    : new Uint8Array()
            )

            if (this.#isDisposed) {
                return
            }

            const noun =
                exportedCount === 1
                    ? this.#translate('scene3d.modelFile')
                    : this.#translate('scene3d.modelFiles')
            const skippedSummary =
                skippedCount > 0
                    ? ' ' +
                      this.#translate('scene3d.skipped') +
                      ' ' +
                      skippedCount +
                      ' ' +
                      this.#translate('scene3d.unresolved') +
                      ' ' +
                      (skippedCount === 1
                          ? this.#translate('scene3d.entry')
                          : this.#translate('scene3d.entries')) +
                      '.'
                    : ''
            this.#setDiagnostics([
                this.#translate('scene3d.downloaded') +
                    ' ' +
                    exportedCount +
                    ' ' +
                    noun +
                    ' ' +
                    this.#translate('scene3d.to') +
                    ' ' +
                    String(archiveResult.archiveName || 'model archive') +
                    '.' +
                    skippedSummary
            ])
        } catch (error) {
            if (this.#isDisposed) {
                return
            }

            this.#setDiagnostics([
                this.#translate('scene3d.exportFailed') +
                    ' ' +
                    String(error?.message || error || 'Unknown error.')
            ])
        }
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
            : PcbScene3dInteractionHints.resolveDefaultMessage(
                  globalThis.window,
                  this.#translate
              )
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
                '<h4 class="scene-3d__selection-title">' +
                PcbScene3dController.#escapeHtml(
                    this.#translate('scene3d.componentInspector')
                ) +
                '</h4><p class="scene-3d__selection-empty">' +
                PcbScene3dController.#escapeHtml(
                    this.#translate('scene3d.inspectPrompt')
                ) +
                '</p>'
            return
        }

        const selectionEntry = this.#selectionIndex.get(designator)
        if (!selectionEntry) {
            this.#selectionNode.innerHTML =
                '<h4 class="scene-3d__selection-title">' +
                PcbScene3dController.#escapeHtml(
                    this.#translate('scene3d.componentInspector')
                ) +
                '</h4><p class="scene-3d__selection-empty">' +
                PcbScene3dController.#escapeHtml(
                    this.#translate('scene3d.noMetadataFor')
                ) +
                ' ' +
                PcbScene3dController.#escapeHtml(designator) +
                '.</p>'
            return
        }

        const component = selectionEntry.component
        const externalPlacement = selectionEntry.externalPlacement
        const fields = [
            [this.#translate('scene3d.designator'), designator],
            [
                this.#translate('scene3d.picked'),
                selection?.sourceType === 'external-model'
                    ? this.#translate('scene3d.externalModel')
                    : this.#translate('scene3d.fallbackBody')
            ],
            [
                this.#translate('scene3d.mountSide'),
                externalPlacement?.mountSide || component?.mountSide || ''
            ],
            [
                this.#translate('scene3d.rotation'),
                PcbScene3dController.#formatMilValue(
                    component?.rotationDeg ?? externalPlacement?.rotationDeg,
                    'deg'
                )
            ],
            [
                this.#translate('scene3d.boardPosition'),
                component?.boardPositionMil
                    ? PcbScene3dController.#formatPoint(
                          component.boardPositionMil,
                          true
                      )
                    : ''
            ],
            [
                this.#translate('scene3d.pattern'),
                String(component?.pattern || '')
            ],
            [
                this.#translate('scene3d.source'),
                String(component?.source || '')
            ],
            [
                this.#translate('scene3d.model'),
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
                this.#translate('scene3d.bodyPosition'),
                externalPlacement?.bodyPositionMil
                    ? PcbScene3dController.#formatPoint(
                          externalPlacement.bodyPositionMil,
                          false
                      )
                    : ''
            ],
            [
                this.#translate('scene3d.bodyRotation'),
                PcbScene3dController.#formatMilValue(
                    externalPlacement?.bodyRotationDeg,
                    'deg'
                )
            ],
            [
                this.#translate('scene3d.modelRotation'),
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
            '<h4 class="scene-3d__selection-title">' +
            PcbScene3dController.#escapeHtml(
                this.#translate('scene3d.componentInspector')
            ) +
            '</h4><dl class="scene-3d__selection-list">' +
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
                externalPlacement:
                    index.get(designator)?.externalPlacement || null
            })
        })

        externalPlacements.forEach((externalPlacement) => {
            const designator = String(
                externalPlacement?.designator || ''
            ).trim()
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

    /**
     * Resolves one archive base name from the mounted document metadata.
     * @param {{ summary?: { title?: string }, fileName?: string } | null} documentModel
     * @returns {string}
     */
    static #resolveArchiveBaseName(documentModel) {
        const summaryTitle = String(documentModel?.summary?.title || '').trim()
        if (summaryTitle) {
            return summaryTitle
        }

        const fileName = String(documentModel?.fileName || '').trim()
        if (fileName) {
            return fileName.replace(/\.[^.]+$/, '')
        }

        return 'pcb-models'
    }

    /**
     * Triggers one browser download for the generated archive.
     * @param {string} archiveName
     * @param {Uint8Array} archiveBytes
     * @returns {Promise<void>}
     */
    static async #triggerArchiveDownload(archiveName, archiveBytes) {
        if (
            !archiveName ||
            !(archiveBytes instanceof Uint8Array) ||
            !archiveBytes.length ||
            !globalThis?.document ||
            !globalThis?.URL
        ) {
            return
        }

        const anchor = globalThis.document.createElement?.('a')
        if (!anchor) {
            return
        }

        const objectUrl = globalThis.URL.createObjectURL(
            new Blob([archiveBytes], {
                type: 'application/zip'
            })
        )

        try {
            anchor.href = objectUrl
            anchor.download = archiveName
            anchor.click?.()
        } finally {
            globalThis.URL.revokeObjectURL?.(objectUrl)
        }
    }
}
