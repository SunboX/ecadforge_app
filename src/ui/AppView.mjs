import { Scene3dControllerFactory } from '../Scene3dControllerFactory.mjs'
import { ViewDeepLinkState } from '../ViewDeepLinkState.mjs'
import { EcadDocumentDiagnostics } from '../core/ecad/EcadDocumentDiagnostics.mjs'
import { AppViewRenderGraph } from './AppViewRenderGraph.mjs'
import { AppViewBomPanelRenderer } from './AppViewBomPanelRenderer.mjs'
import { DocumentRailRenderer } from './DocumentRailRenderer.mjs'
import { HeroPreviewController } from './HeroPreviewController.mjs'
import { AppViewDownloadHelper } from './AppViewDownloadHelper.mjs'
import { AppViewComponentSelectionScrollGuard } from './AppViewComponentSelectionScrollGuard.mjs'
import { AppViewPcbComponentScroller } from './AppViewPcbComponentScroller.mjs'
import { AppViewPcbContentReuseModel } from './AppViewPcbContentReuseModel.mjs'
import { AppViewPcbControllerBinder } from './AppViewPcbControllerBinder.mjs'
import { AppViewPcbInteractionPreviewStore } from './AppViewPcbInteractionPreviewStore.mjs'
import { AppViewPcbInteractionPreviewUpdater } from './AppViewPcbInteractionPreviewUpdater.mjs'
import { AppViewGerberRenderSelectionStore } from './AppViewGerberRenderSelectionStore.mjs'
import { AppViewPcbStylerTipController } from './AppViewPcbStylerTipController.mjs'
import { AppViewScene3dPanelController } from './AppViewScene3dPanelController.mjs'
import { AppViewSchematicPanelRenderer } from './AppViewSchematicPanelRenderer.mjs'
import { AppViewSidebarScrollState } from './AppViewSidebarScrollState.mjs'
import { AppViewSidebarFilterState } from './AppViewSidebarFilterState.mjs'
import { AppViewLocalFileBinder } from './AppViewLocalFileBinder.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { UiText } from './UiText.mjs'
import { ViewerEmptyStateRenderer } from './ViewerEmptyStateRenderer.mjs'
import { ViewerSidebarEventBinder } from './ViewerSidebarEventBinder.mjs'
import { ViewerSidebarRenderer } from './ViewerSidebarRenderer.mjs'
import { AppViewExportProgressDialog } from './AppViewExportProgressDialog.mjs'
import { AppViewSupport } from './AppViewSupport.mjs'
/**
 * DOM rendering and event binding helper.
 */
export class AppView {
    /** @type {Document} */
    #document
    /** @type {HTMLInputElement | null} */
    #fileInput
    /** @type {HTMLInputElement | null} */
    #folderInput
    /** @type {HTMLElement | null} */
    #dropZone
    /** @type {HTMLAnchorElement | null} */
    #brandHomeLink
    /** @type {HTMLElement | null} */
    #statusNode
    /** @type {HTMLElement | null} */
    #versionNode
    /** @type {HTMLSelectElement | null} */
    #localeSelect
    /** @type {HTMLElement | null} */
    #viewerStageNode
    /** @type {HTMLElement | null} */
    #documentRailNode
    /** @type {boolean} */
    #sidebarCollapsed
    /** @type {string} */
    #expandedSidebarMarkup
    /** @type {object | null} */
    #lastSnapshot
    /** @type {AppViewRenderGraph} */
    #renderGraph
    /** @type {AppViewGerberRenderSelectionStore} */
    #gerberRenderSelections
    /** @type {AppViewSidebarFilterState} */
    #sidebarFilterState
    /** @type {HTMLElement | null} */
    #contentNode

    /** @type {HTMLElement | null} */
    #tabsNode

    /** @type {HTMLFormElement | null} */
    #githubOpenForm

    /** @type {HTMLInputElement | null} */
    #githubUrlInput

    /** @type {Storage | null} */
    #storage

    /** @type {(key: string) => string} */
    #translate

    /** @type {SchematicViewportController | null} */
    #svgViewportController

    /** @type {(() => void) | null} */
    #schematicSelectionDisposer

    /** @type {import('./PcbViewController.mjs').PcbViewController | null} */
    #pcbViewController

    /** @type {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} */
    #pcbComponentSelectionCallback

    /** @type {((change: { documentId: string, netName: string, source?: string }) => void) | null} */
    #pcbNetSelectionCallback

    /** @type {AppViewPcbInteractionPreviewStore} */
    #pcbInteractionPreviewStore

    /** @type {AppViewPcbInteractionPreviewUpdater} */
    #pcbInteractionPreviewUpdater

    /** @type {((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null} */
    #sessionAssetsResolvedCallback

    /** @type {AppViewComponentSelectionScrollGuard} */
    #componentSelectionScrollGuard

    /** @type {boolean} */
    #suppressNextNetScroll

    /** @type {AppViewScene3dPanelController} */
    #scene3dPanelController

    /** @type {AppViewPcbStylerTipController} */
    #pcbStylerTipController

    /** @type {AppViewExportProgressDialog} */
    #exportProgressDialog

    #heroPreviewController

    /** @type {(viewportNode: HTMLElement, documentModel: any, options?: { documentId?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, sessionAssets?: any[], autoSearchMissingModels?: boolean, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => any} */
    #createScene3dController

    /**
     * @param {Document} documentRef
     * @param {{ createScene3dController?: (viewportNode: HTMLElement, documentModel: any, options?: { documentId?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, sessionAssets?: any[], autoSearchMissingModels?: boolean, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => any, translate?: ((key: string) => string) | null, storage?: Storage | null }} [options]
     */
    constructor(documentRef, options = {}) {
        this.#document = documentRef
        this.#fileInput = this.#document.querySelector('#fileInput')
        this.#folderInput = this.#document.querySelector('#folderInput')
        this.#dropZone = this.#document.querySelector('#dropZone')
        this.#brandHomeLink = this.#document.querySelector('#brandHomeLink')
        this.#statusNode = this.#document.querySelector('#statusMessage')
        this.#versionNode = this.#document.querySelector('#appVersion')
        this.#localeSelect = this.#document.querySelector('#localeSelect')
        this.#viewerStageNode = this.#document.querySelector('#viewerStage')
        this.#documentRailNode = this.#document.querySelector('#documentRail')
        this.#sidebarCollapsed = false
        this.#expandedSidebarMarkup = ''
        this.#lastSnapshot = null
        this.#gerberRenderSelections = new AppViewGerberRenderSelectionStore()
        this.#sidebarFilterState = new AppViewSidebarFilterState()
        this.#contentNode = this.#document.querySelector('#viewContent')
        this.#tabsNode = this.#document.querySelector('#viewTabs')
        this.#githubOpenForm = this.#document.querySelector('#githubOpenForm')
        this.#githubUrlInput = this.#document.querySelector('#githubUrlInput')
        this.#storage =
            options.storage === undefined
                ? AppViewSupport.resolveBrowserStorage(this.#document)
                : options.storage
        this.#translate = UiText.createTranslator(options.translate || null)
        this.#svgViewportController = null
        this.#schematicSelectionDisposer = null
        this.#pcbViewController = null
        this.#pcbComponentSelectionCallback = null
        this.#pcbNetSelectionCallback = null
        this.#pcbInteractionPreviewStore =
            new AppViewPcbInteractionPreviewStore()
        this.#pcbInteractionPreviewUpdater =
            new AppViewPcbInteractionPreviewUpdater(this.#translate)
        this.#sessionAssetsResolvedCallback = null
        this.#componentSelectionScrollGuard =
            new AppViewComponentSelectionScrollGuard()
        this.#suppressNextNetScroll = false
        this.#scene3dPanelController = new AppViewScene3dPanelController()
        this.#pcbStylerTipController = new AppViewPcbStylerTipController(
            this.#document,
            {
                viewerStageNode: this.#viewerStageNode,
                storage: this.#storage,
                translate: this.#translate
            }
        )
        this.#exportProgressDialog = new AppViewExportProgressDialog(
            this.#document
        )
        this.#createScene3dController =
            options.createScene3dController ||
            Scene3dControllerFactory.create(
                new URL('../main.mjs', import.meta.url).href
            )
        this.#heroPreviewController = new HeroPreviewController(
            this.#document,
            {
                createScene3dController: this.#createScene3dController,
                translate: this.#translate
            }
        )
        this.#renderGraph = new AppViewRenderGraph({
            document: this.#document,
            statusNode: this.#statusNode,
            localeSelect: this.#localeSelect,
            tabsNode: this.#tabsNode,
            renderSidebar: (snapshot) => this.#renderDocumentRail(snapshot),
            renderContent: (snapshot) => this.#renderContent(snapshot)
        })
        this.#pcbStylerTipController.bindDismiss()
        ViewerSidebarEventBinder.bindSidebarCollapseToggle(
            this.#documentRailNode,
            (collapsed) => this.#setSidebarCollapsed(collapsed)
        )
        ViewerSidebarEventBinder.bindComponentDetailCopy(this.#documentRailNode)
        this.#sidebarFilterState.bindComponentFilter(
            this.#documentRailNode,
            () => this.#lastSnapshot
        )
        ViewerSidebarEventBinder.bindLayerFilter(this.#documentRailNode)
        ViewerSidebarEventBinder.bindNetFilter(this.#documentRailNode)
        ViewerSidebarEventBinder.bindScene3dModelZipExport(
            this.#documentRailNode,
            () => this.#scene3dPanelController.triggerModelArchiveExport()
        )
        ViewerSidebarEventBinder.bindGerberRenderSelection(
            this.#documentRailNode,
            (change) => this.#handleGerberRenderSelection(change)
        )
    }

    /**
     * Renders one full state snapshot.
     * @param {{ activeView: string, activeSidebarTab?: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     * @param {PropertyKey[][] | null} [changedPaths] Changed state paths, or null when unknown.
     */
    render(snapshot, changedPaths = null) {
        const renderSnapshot = this.#pcbInteractionPreviewStore.withPreview(
            this.#withGerberRenderSelections(snapshot)
        )
        this.#lastSnapshot = renderSnapshot
        this.#renderGraph.render(renderSnapshot, changedPaths)
    }

    /**
     * Renders status text.
     * @param {string} value
     */
    setStatus(value) {
        if (!this.#statusNode) {
            return
        }
        this.#statusNode.textContent = value
        this.#statusNode.removeAttribute('hidden')
    }

    /**
     * Renders app version.
     * @param {string} version
     */
    setVersion(version) {
        if (this.#versionNode) {
            this.#versionNode.textContent = version || '—'
        }
    }

    /**
     * Stores the parsed demo documents used by the landing preview.
     * @param {any[]} documentModels Parsed demo document models.
     * @returns {void}
     */
    setHeroPreviewDocuments(documentModels) {
        this.#heroPreviewController.setDocuments(documentModels)
    }

    /**
     * Binds file input changes.
     * @param {(files: File[]) => void} callback
     */
    bindFileSelection(callback) {
        AppViewLocalFileBinder.bind({
            fileInput: this.#fileInput,
            folderInput: this.#folderInput,
            windowRef: this.#document.defaultView || globalThis,
            callback
        })
    }

    /**
     * Binds drag/drop file intake.
     * @param {(files: File[]) => void} callback
     */
    bindDrop(callback) {
        if (!this.#dropZone) return

        const prevent = (event) => {
            event.preventDefault()
            event.stopPropagation()
        }

        ;['dragenter', 'dragover'].forEach((eventName) => {
            this.#dropZone?.addEventListener(eventName, (event) => {
                prevent(event)
                this.#dropZone?.classList.add('is-dragover')
            })
        })
        ;['dragleave', 'drop'].forEach((eventName) => {
            this.#dropZone?.addEventListener(eventName, (event) => {
                prevent(event)
                this.#dropZone?.classList.remove('is-dragover')
            })
        })

        this.#dropZone.addEventListener('drop', (event) => {
            const transfer = event.dataTransfer
            if (!transfer?.files?.length) return
            callback([...transfer.files])
        })
    }

    /**
     * Binds tab/button view changes.
     * @param {(viewName: string) => void} callback
     */
    bindViewChange(callback) {
        this.#tabsNode?.addEventListener('click', (event) => {
            this.#handleViewSelection(
                event,
                '[data-view]',
                'data-view',
                (viewName) => {
                    ViewDeepLinkState.update(viewName)
                    callback(viewName)
                }
            )
        })
    }

    /**
     * Binds the brand lockup to return to the landing page view.
     * @param {() => void} callback
     * @returns {void}
     */
    bindHomeNavigation(callback) {
        this.#brandHomeLink?.addEventListener('click', (event) => {
            event.preventDefault()
            ViewDeepLinkState.reset()
            callback()
        })
    }

    /**
     * Binds preview-rail document selection changes.
     * @param {(documentId: string) => void} callback
     */
    bindDocumentSelection(callback) {
        ViewerSidebarEventBinder.bindDocumentSelection(
            this.#documentRailNode,
            callback
        )
    }

    /**
     * Binds sidebar tab selection changes.
     * @param {(tabName: string) => void} callback
     * @returns {void}
     */
    bindSidebarTabSelection(callback) {
        ViewerSidebarEventBinder.bindSidebarTabSelection(
            this.#documentRailNode,
            callback
        )
    }

    /**
     * Binds PCB layer visibility row clicks.
     * @param {(change: { documentId: string, layerKey: string, visible: boolean }) => void} callback
     * @returns {void}
     */
    bindPcbLayerVisibilityChange(callback) {
        ViewerSidebarEventBinder.bindPcbLayerVisibilityChange(
            this.#documentRailNode,
            callback
        )
        ViewerSidebarEventBinder.bindPcbLayerVisibilityChange(
            this.#contentNode,
            callback
        )
    }

    /**
     * Binds PCB object opacity slider changes.
     * @param {(change: { documentId: string, objectKey: string, opacity: number }) => void} callback
     * @returns {void}
     */
    bindPcbObjectOpacityChange(callback) {
        ViewerSidebarEventBinder.bindPcbObjectOpacityChange(
            this.#documentRailNode,
            callback
        )
    }

    /**
     * Binds PCB object visibility changes from rendered view controls.
     * @param {(change: { documentId: string, objectKey: string, visible: boolean, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbObjectVisibilityChange(callback) {
        ViewerSidebarEventBinder.bindPcbObjectVisibilityChange(
            this.#contentNode,
            callback
        )
    }

    /**
     * Binds PCB component selection row clicks.
     * @param {(change: { documentId: string, componentKey: string, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbComponentSelectionChange(callback) {
        this.#pcbComponentSelectionCallback =
            typeof callback === 'function' ? callback : null
        ViewerSidebarEventBinder.bindPcbComponentSelectionChange(
            this.#documentRailNode,
            (change) => {
                this.#componentSelectionScrollGuard.runSidebarSelection(
                    change,
                    this.#pcbComponentSelectionCallback
                )
            }
        )
    }

    /**
     * Binds PCB and schematic net selection row clicks.
     * @param {(change: { documentId: string, netName: string, source?: string }) => void} callback
     * @returns {void}
     */
    bindPcbNetSelectionChange(callback) {
        this.#pcbNetSelectionCallback =
            typeof callback === 'function' ? callback : null
        ViewerSidebarEventBinder.bindPcbNetSelectionChange(
            this.#documentRailNode,
            (change) => {
                this.#suppressNextNetScroll = true
                try {
                    this.#pcbNetSelectionCallback?.(change)
                } finally {
                    this.#suppressNextNetScroll = false
                }
            }
        )
    }

    /**
     * Binds PCB layer preset buttons.
     * @param {(change: { documentId: string, preset: string }) => void} callback
     * @returns {void}
     */
    bindPcbLayerPresetSelection(callback) {
        ViewerSidebarEventBinder.bindPcbLayerPresetSelection(
            this.#documentRailNode,
            callback
        )
    }

    /**
     * Binds selected-part export buttons.
     * @param {(change: { documentId: string, componentKey: string, format: string }) => void | Promise<void>} callback
     * @returns {void}
     */
    bindSelectedPartExport(callback) {
        ViewerSidebarEventBinder.bindSelectedPartExport(
            this.#documentRailNode,
            callback
        )
    }

    /**
     * Binds whole-PCB assembly export buttons.
     * @param {(change: { documentId: string, format: string }) => void | Promise<void>} callback
     * @returns {void}
     */
    bindPcbAssemblyExport(callback) {
        ViewerSidebarEventBinder.bindPcbAssemblyExport(
            this.#documentRailNode,
            callback
        )
    }

    /**
     * Binds 3D scene asset resolution updates.
     * @param {(change: { documentModel?: object, sessionAssets?: object[] }) => void} callback Resolved assets callback.
     * @returns {void}
     */
    bindSessionAssetsResolved(callback) {
        this.#sessionAssetsResolvedCallback =
            typeof callback === 'function' ? callback : null
    }

    /**
     * Emits a rendered-view component selection and clears sidebar scroll memory.
     * @param {{ documentId?: string, componentKey?: string, source?: string }} change Selection event.
     * @returns {void}
     */
    #handleRenderedComponentSelection(change) {
        this.#componentSelectionScrollGuard.clearSidebarSelection()
        this.#pcbComponentSelectionCallback?.(change)
    }

    /**
     * Downloads bytes through a temporary browser anchor.
     * @param {string} fileName Download file name.
     * @param {Uint8Array} bytes Download bytes.
     * @param {string} [contentType] MIME content type.
     * @returns {void}
     */
    downloadBytes(fileName, bytes, contentType = 'application/octet-stream') {
        AppViewDownloadHelper.downloadBytes(
            this.#document,
            fileName,
            bytes,
            contentType
        )
    }

    /**
     * Opens the export progress dialog.
     * @param {{ title?: string, message?: string, value?: number }} progress Initial progress state.
     * @returns {void}
     */
    showExportProgress(progress) {
        this.#exportProgressDialog.show(progress)
    }

    /**
     * Updates the active export progress dialog.
     * @param {{ title?: string, message?: string, value?: number }} progress Progress update.
     * @returns {void}
     */
    updateExportProgress(progress) {
        this.#exportProgressDialog.update(progress)
    }

    /**
     * Closes the active export progress dialog.
     * @returns {void}
     */
    hideExportProgress() {
        this.#exportProgressDialog.hide()
    }

    /**
     * Binds the 3D missing model search preference checkbox.
     * @param {(enabled: boolean) => void} callback Preference callback.
     * @returns {void}
     */
    bindModelSearchPreferenceChange(callback) {
        this.#document.addEventListener('change', (event) => {
            const target = event.target
            if (!(target instanceof HTMLElement)) return
            const input = target.closest('[data-scene-3d-model-search]')
            if (!(input instanceof HTMLInputElement)) return

            callback(input.checked)
        })
    }

    /**
     * Binds bundled demo buttons.
     * @param {(demoId: string) => void | Promise<void>} callback
     * @returns {void}
     */
    bindDemoSelection(callback) {
        this.#document.addEventListener('click', (event) => {
            const target = event.target
            if (!(target instanceof HTMLElement)) return
            const button = target.closest('[data-demo-id]')
            if (!(button instanceof HTMLElement)) return

            event.preventDefault()
            callback(button.dataset.demoId || '')
        })
    }

    /**
     * Binds local-open CTA clicks.
     * @param {() => void} callback
     * @returns {void}
     */
    bindLocalOpen(callback) {
        this.#document.addEventListener('click', (event) => {
            const target = event.target
            if (!(target instanceof HTMLElement)) return
            const button = target.closest('[data-local-open]')
            if (!(button instanceof HTMLElement)) return

            callback()
        })
    }

    /**
     * Binds the GitHub URL form.
     * @param {(url: string) => void | Promise<void>} callback
     * @returns {void}
     */
    bindGitHubOpen(callback) {
        this.#githubOpenForm?.addEventListener('submit', (event) => {
            event.preventDefault()
            const value = String(this.#githubUrlInput?.value || '').trim()
            if (!value) return
            callback(value)
        })
    }

    /**
     * Binds PCB Styler crosslink clicks.
     * @param {() => void} callback
     * @returns {void}
     */
    bindPcbStylerClick(callback) {
        this.#pcbStylerTipController.bindClick(callback)
    }

    /**
     * Updates the contextual PCB Styler crosslink.
     * @param {string} url Link URL.
     * @param {string} mode Link mode.
     * @returns {void}
     */
    setPcbStylerLink(url, mode) {
        this.#pcbStylerTipController.setLink(url, mode)
    }

    /**
     * Hides the PCB Styler crosslink when returning to landing mode.
     * @returns {void}
     */
    clearPcbStylerLink() {
        this.#pcbStylerTipController.clearLink()
    }

    /**
     * Binds locale changes.
     * @param {(locale: string) => void | Promise<void>} callback
     */
    bindLocaleChange(callback) {
        this.#localeSelect?.addEventListener('change', () => {
            if (!this.#localeSelect) return
            callback(this.#localeSelect.value)
        })
    }

    /**
     * Returns true when a locale select exists in the template.
     * @returns {boolean}
     */
    hasLocaleSelect() {
        return Boolean(this.#localeSelect)
    }

    /**
     * Applies Gerber stack/file selection from the project sidebar.
     * @param {{ documentId?: string, renderMode?: string, layerId?: string }} change Selection change.
     * @returns {void}
     */
    #handleGerberRenderSelection(change) {
        const result = this.#gerberRenderSelections.apply(
            change,
            this.#lastSnapshot
        )
        if (!result) {
            return
        }

        if (
            result.documentId ===
            String(this.#lastSnapshot?.activeDocumentId || '')
        ) {
            this.#pcbViewController?.setGerberRenderSelection(result.selection)
        }

        if (this.#lastSnapshot) {
            this.#lastSnapshot = this.#withGerberRenderSelections(
                this.#lastSnapshot
            )
            this.#renderDocumentRail(this.#lastSnapshot)
        }
    }

    /**
     * Adds locally remembered Gerber render selections to an app snapshot.
     * @param {object} snapshot App state snapshot.
     * @returns {object}
     */
    #withGerberRenderSelections(snapshot) {
        return this.#gerberRenderSelections.withSelections(snapshot)
    }

    /**
     * Stores transient PCB interaction candidates for the sidebar.
     * @param {{ documentId?: string, candidates?: object[] }} change Preview change.
     * @returns {void}
     */
    #handlePcbInteractionCandidates(change) {
        this.#lastSnapshot = this.#pcbInteractionPreviewStore.handleChange(
            change,
            this.#lastSnapshot
        )
        if (!this.#lastSnapshot) return
        this.#pcbInteractionPreviewUpdater.update(
            this.#documentRailNode,
            this.#lastSnapshot
        )
    }

    /**
     * Resolves one clicked view target and emits its view name.
     * @param {Event} event
     * @param {string} selector
     * @param {string} attributeName
     * @param {(viewName: string) => void} callback
     * @returns {void}
     */
    #handleViewSelection(event, selector, attributeName, callback) {
        const target = event.target
        const button =
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
                ? target.closest(selector)
                : null

        if (!button || typeof button.getAttribute !== 'function') {
            return
        }

        event.preventDefault?.()
        callback(button.getAttribute(attributeName) || 'schematic')
    }

    /**
     * Updates the viewer sidebar for loaded sessions.
     * @param {{ activeSidebarTab?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, sessionAssets?: any[], documentModel: any }} snapshot
     * @returns {void}
     */
    #renderDocumentRail(snapshot) {
        if (!this.#documentRailNode) return

        if (!snapshot.documentModel) {
            this.#documentRailNode.innerHTML = ''
            this.#expandedSidebarMarkup = ''
            this.#sidebarCollapsed = false
            this.#documentRailNode.setAttribute('hidden', 'hidden')
            this.#viewerStageNode?.classList.remove('is-sidebar-visible')
            this.#applySidebarCollapsedClass()
            this.#scene3dPanelController.setAdjustmentHost(null)
            return
        }

        const scrollState = AppViewSidebarScrollState.capture(
            this.#documentRailNode
        )
        const sidebarSnapshot = Object.create(snapshot, {
            documents: {
                value: AppViewSupport.resolveSessionDocuments(snapshot),
                enumerable: true
            }
        })
        this.#expandedSidebarMarkup = ViewerSidebarRenderer.render(
            sidebarSnapshot,
            this.#translate
        )
        this.#documentRailNode.removeAttribute('hidden')
        this.#viewerStageNode?.classList.add('is-sidebar-visible')
        this.#applySidebarCollapsedClass()
        this.#documentRailNode.innerHTML = this.#sidebarCollapsed
            ? ViewerSidebarRenderer.renderCollapsedToggle(this.#translate)
            : this.#expandedSidebarMarkup
        this.#scene3dPanelController.setAdjustmentHostFromRail(
            this.#documentRailNode
        )
        if (!this.#sidebarCollapsed) {
            this.#sidebarFilterState.restoreComponentFilter(
                this.#documentRailNode,
                snapshot
            )
            AppViewSidebarScrollState.restore(
                this.#documentRailNode,
                scrollState
            )
            const suppressComponentScroll =
                this.#componentSelectionScrollGuard.shouldSuppress(snapshot)
            AppViewPcbComponentScroller.scrollSelectedIntoView(
                this.#documentRailNode,
                snapshot,
                { suppressScroll: suppressComponentScroll }
            )
            AppViewPcbComponentScroller.scrollSelectedNetIntoView(
                this.#documentRailNode,
                snapshot,
                { suppressScroll: this.#suppressNextNetScroll }
            )
        }
    }

    /**
     * Applies the current sidebar collapsed state to the rail.
     * @param {boolean} collapsed Whether the sidebar should be collapsed.
     * @returns {void}
     */
    #setSidebarCollapsed(collapsed) {
        this.#sidebarCollapsed = Boolean(collapsed)
        this.#applySidebarCollapsedClass()
        if (!this.#documentRailNode || !this.#expandedSidebarMarkup) return
        this.#documentRailNode.innerHTML = this.#sidebarCollapsed
            ? ViewerSidebarRenderer.renderCollapsedToggle(this.#translate)
            : this.#expandedSidebarMarkup
        this.#scene3dPanelController.setAdjustmentHostFromRail(
            this.#documentRailNode
        )
        if (!this.#sidebarCollapsed) {
            this.#sidebarFilterState.restoreComponentFilter(
                this.#documentRailNode,
                this.#lastSnapshot
            )
        }
    }

    /**
     * Mirrors sidebar collapsed state onto layout nodes.
     * @returns {void}
     */
    #applySidebarCollapsedClass() {
        const action = this.#sidebarCollapsed ? 'add' : 'remove'
        this.#documentRailNode?.classList[action]('is-sidebar-collapsed')
        this.#viewerStageNode?.classList[action]('is-sidebar-collapsed')
    }

    /**
     * Updates the main tab panel content.
     * @param {{ activeView: string, activeDocumentId?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, parseStatus: string, sessionAssets?: any[], documentModel: any }} snapshot
     */
    #renderContent(snapshot) {
        if (!this.#contentNode) return

        if (
            AppViewPcbContentReuseModel.shouldReuse(
                this.#contentNode,
                this.#pcbViewController,
                snapshot
            )
        ) {
            return
        }
        if (
            AppViewSchematicPanelRenderer.shouldReuse(
                this.#contentNode,
                snapshot
            )
        ) {
            return
        }

        const previousPcbSide = this.#pcbViewController?.side || 'top'
        const preservedSchematicViewBox =
            AppViewSchematicPanelRenderer.captureViewport(
                this.#contentNode,
                snapshot
            )
        this.#disposeSchematicSelectionBinder()
        this.#disposeSvgViewportController()
        this.#disposePcbViewController()
        this.#scene3dPanelController.prepareForRender(
            this.#contentNode,
            snapshot
        )

        if (snapshot.parseStatus === 'loading' && !snapshot.documentModel) {
            AppViewSchematicPanelRenderer.clear(this.#contentNode)
            this.#contentNode.innerHTML =
                '<section class="viewer-loading"><div class="viewer-loading__pulse"></div><p>' +
                AppViewSupport.escapeHtml(this.#translate('status.loading')) +
                '</p></section>'
            return
        }

        if (!snapshot.documentModel) {
            AppViewSchematicPanelRenderer.clear(this.#contentNode)
            this.#contentNode.innerHTML = ViewerEmptyStateRenderer.render(
                this.#translate
            )
            return
        }

        if (snapshot.activeView === 'schematic') {
            const schematicPanel = AppViewSchematicPanelRenderer.render({
                contentNode: this.#contentNode,
                snapshot,
                preservedViewBox: preservedSchematicViewBox,
                onComponentSelectionChange: (change) =>
                    this.#handleRenderedComponentSelection(change),
                onNetSelectionChange: this.#pcbNetSelectionCallback
            })
            this.#svgViewportController = schematicPanel.svgViewportController
            this.#schematicSelectionDisposer = schematicPanel.selectionDisposer
            return
        }

        AppViewSchematicPanelRenderer.clear(this.#contentNode)

        if (snapshot.activeView === 'pcb') {
            this.#pcbViewController = AppViewPcbControllerBinder.attach({
                contentNode: this.#contentNode,
                snapshot,
                side: previousPcbSide,
                onComponentSelectionChange: (change) =>
                    this.#handleRenderedComponentSelection(change),
                onNetSelectionChange: this.#pcbNetSelectionCallback,
                onInteractionCandidatesChange: (change) =>
                    this.#handlePcbInteractionCandidates(change),
                translate: this.#translate
            })
            return
        }

        if (snapshot.activeView === '3d') {
            const documentId = String(snapshot?.activeDocumentId || '')
            const selectedKey = String(
                snapshot?.selectedPcbComponents?.[documentId] || ''
            )
            this.#scene3dPanelController.render({
                contentNode: this.#contentNode,
                documentId,
                documentModel: snapshot.documentModel,
                sessionAssets: snapshot.sessionAssets || [],
                autoSearchMissingModels:
                    snapshot.autoSearchMissingModels === true,
                renderAdjustmentControlsInSelection: false,
                selectedComponentKey: selectedKey,
                onComponentSelectionChange: (change) =>
                    this.#handleRenderedComponentSelection(change),
                onSessionAssetsResolved: (change) =>
                    this.#sessionAssetsResolvedCallback?.(change),
                translate: this.#translate,
                createScene3dController: this.#createScene3dController
            })
            return
        }

        if (snapshot.activeView === 'bom') {
            AppViewBomPanelRenderer.render(
                this.#contentNode,
                snapshot,
                this.#translate
            )
            return
        }

        this.#contentNode.innerHTML = DocumentRailRenderer.renderDiagnostics(
            EcadDocumentDiagnostics.resolve(snapshot.documentModel),
            this.#translate
        )
    }

    /**
     * Disposes the active SVG viewport controller before the panel
     * content changes.
     * @returns {void}
     */
    #disposeSvgViewportController() {
        this.#svgViewportController?.dispose()
        this.#svgViewportController = null
    }

    /**
     * Disposes schematic selection listeners before replacing schematic SVGs.
     * @returns {void}
     */
    #disposeSchematicSelectionBinder() {
        this.#schematicSelectionDisposer?.()
        this.#schematicSelectionDisposer = null
    }

    /**
     * Disposes the active PCB view controller before the panel content
     * changes.
     * @returns {void}
     */
    #disposePcbViewController() {
        this.#pcbViewController?.dispose()
        this.#pcbViewController = null
        AppViewPcbContentReuseModel.clear(this.#contentNode)
    }
}
