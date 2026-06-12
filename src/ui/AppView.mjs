import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { Scene3dControllerFactory } from '../Scene3dControllerFactory.mjs'
import { ViewDeepLinkState } from '../ViewDeepLinkState.mjs'
import { DocumentRailRenderer } from './DocumentRailRenderer.mjs'
import { HeroPreviewController } from './HeroPreviewController.mjs'
import { LandingStatusRenderer } from './LandingStatusRenderer.mjs'
import { AppViewDownloadHelper } from './AppViewDownloadHelper.mjs'
import { AppViewPcbComponentScroller } from './AppViewPcbComponentScroller.mjs'
import { AppViewPcbContentReuseModel } from './AppViewPcbContentReuseModel.mjs'
import { AppViewPcbControllerBinder } from './AppViewPcbControllerBinder.mjs'
import { AppViewPcbStylerTipController } from './AppViewPcbStylerTipController.mjs'
import { AppViewScene3dPanelController } from './AppViewScene3dPanelController.mjs'
import { AppViewSchematicContentReuseModel } from './AppViewSchematicContentReuseModel.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { SchematicComponentSelectionBinder } from './SchematicComponentSelectionBinder.mjs'
import { SchematicViewRenderer } from './SchematicViewRenderer.mjs'
import { SchematicViewportPreserver } from './SchematicViewportPreserver.mjs'
import { UiText } from './UiText.mjs'
import { ViewerModeClassRenderer } from './ViewerModeClassRenderer.mjs'
import { ViewerEmptyStateRenderer } from './ViewerEmptyStateRenderer.mjs'
import { ViewerSidebarEventBinder } from './ViewerSidebarEventBinder.mjs'
import { ViewerSidebarRenderer } from './ViewerSidebarRenderer.mjs'

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

    /** @type {import('./PcbViewController.mjs').PcbViewController | null} */
    #pcbViewController

    /** @type {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} */
    #pcbComponentSelectionCallback

    /** @type {((change: { documentId: string, netName: string, source?: string }) => void) | null} */
    #pcbNetSelectionCallback

    /** @type {boolean} */
    #suppressNextComponentScroll

    /** @type {boolean} */
    #suppressNextNetScroll

    /** @type {AppViewScene3dPanelController} */
    #scene3dPanelController

    /** @type {AppViewPcbStylerTipController} */
    #pcbStylerTipController

    #heroPreviewController

    /** @type {(viewportNode: HTMLElement, documentModel: any, options?: { documentId?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, sessionAssets?: any[], autoSearchMissingModels?: boolean, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => any} */
    #createScene3dController

    /**
     * @param {Document} documentRef
     * @param {{ createScene3dController?: (viewportNode: HTMLElement, documentModel: any, options?: { documentId?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, sessionAssets?: any[], autoSearchMissingModels?: boolean, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => any, translate?: ((key: string) => string) | null, storage?: Storage | null }} [options]
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
        this.#contentNode = this.#document.querySelector('#viewContent')
        this.#tabsNode = this.#document.querySelector('#viewTabs')
        this.#githubOpenForm = this.#document.querySelector('#githubOpenForm')
        this.#githubUrlInput = this.#document.querySelector('#githubUrlInput')
        this.#storage =
            options.storage === undefined
                ? AppView.#resolveBrowserStorage(this.#document)
                : options.storage
        this.#translate = UiText.createTranslator(options.translate || null)
        this.#svgViewportController = null
        this.#pcbViewController = null
        this.#pcbComponentSelectionCallback = null
        this.#pcbNetSelectionCallback = null
        this.#suppressNextComponentScroll = false
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
        this.#pcbStylerTipController.bindDismiss()
        ViewerSidebarEventBinder.bindSidebarCollapseToggle(
            this.#documentRailNode,
            (collapsed) => this.#setSidebarCollapsed(collapsed)
        )
        ViewerSidebarEventBinder.bindComponentDetailCopy(this.#documentRailNode)
        ViewerSidebarEventBinder.bindComponentFilter(this.#documentRailNode)
        ViewerSidebarEventBinder.bindLayerFilter(this.#documentRailNode)
        ViewerSidebarEventBinder.bindNetFilter(this.#documentRailNode)
        ViewerSidebarEventBinder.bindScene3dModelZipExport(
            this.#documentRailNode,
            () => this.#scene3dPanelController.triggerModelArchiveExport()
        )
    }

    /**
     * Renders one full state snapshot.
     * @param {{ activeView: string, activeSidebarTab?: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     */
    render(snapshot) {
        LandingStatusRenderer.renderPersistentStatus(this.#statusNode, snapshot)
        LandingStatusRenderer.render(
            this.#document.querySelector('#landingStatusMessage'),
            snapshot
        )
        this.setLocale(snapshot.locale)
        ViewerModeClassRenderer.render(this.#document.body, snapshot)
        this.#renderTabs(snapshot.activeView)
        this.#renderDocumentRail(snapshot)
        this.#renderContent(snapshot)
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
     * Renders locale select value.
     * @param {string} locale
     */
    setLocale(locale) {
        if (this.#localeSelect) {
            this.#localeSelect.value = locale
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
        this.#fileInput?.addEventListener('change', () => {
            if (!this.#fileInput?.files?.length) return
            callback([...this.#fileInput.files])
            this.#fileInput.value = ''
        })
        this.#folderInput?.addEventListener('change', () => {
            if (!this.#folderInput?.files?.length) return
            callback([...this.#folderInput.files])
            this.#folderInput.value = ''
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
                this.#suppressNextComponentScroll = true
                try {
                    this.#pcbComponentSelectionCallback?.(change)
                } finally {
                    this.#suppressNextComponentScroll = false
                }
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
     * Updates the tab selected state.
     * @param {string} activeView
     */
    #renderTabs(activeView) {
        const buttons = this.#tabsNode?.querySelectorAll('[data-view]') || []
        buttons.forEach((button) => {
            const selected = button.getAttribute('data-view') === activeView
            button.setAttribute('aria-selected', selected ? 'true' : 'false')
        })
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

        const scrollState = AppView.#captureSidebarScroll(
            this.#documentRailNode
        )
        this.#expandedSidebarMarkup = ViewerSidebarRenderer.render(
            {
                ...snapshot,
                documents: AppView.#resolveSessionDocuments(snapshot)
            },
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
            AppView.#restoreSidebarScroll(this.#documentRailNode, scrollState)
            AppViewPcbComponentScroller.scrollSelectedIntoView(
                this.#documentRailNode,
                snapshot,
                { suppressScroll: this.#suppressNextComponentScroll }
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
            AppViewSchematicContentReuseModel.shouldReuse(
                this.#contentNode,
                snapshot
            )
        ) {
            return
        }

        const previousPcbSide = this.#pcbViewController?.side || 'top'
        const preservedSchematicViewBox = SchematicViewportPreserver.capture(
            this.#contentNode,
            snapshot
        )
        this.#disposeSvgViewportController()
        this.#disposePcbViewController()
        this.#scene3dPanelController.prepareForRender(
            this.#contentNode,
            snapshot
        )

        if (snapshot.parseStatus === 'loading' && !snapshot.documentModel) {
            AppViewSchematicContentReuseModel.clear(this.#contentNode)
            this.#contentNode.innerHTML =
                '<section class="viewer-loading"><div class="viewer-loading__pulse"></div><p>' +
                AppView.#escapeHtml(this.#translate('status.loading')) +
                '</p></section>'
            return
        }

        if (!snapshot.documentModel) {
            SchematicViewportPreserver.clear(this.#contentNode)
            AppViewSchematicContentReuseModel.clear(this.#contentNode)
            this.#contentNode.innerHTML = ViewerEmptyStateRenderer.render(
                this.#translate
            )
            return
        }

        if (snapshot.activeView === 'schematic') {
            const documentId = String(snapshot?.activeDocumentId || '')
            this.#contentNode.innerHTML = SchematicViewRenderer.render(
                snapshot.documentModel,
                String(snapshot?.selectedPcbComponents?.[documentId] || ''),
                String(snapshot?.selectedNets?.[documentId] || '')
            )
            SchematicViewportPreserver.restore(
                this.#contentNode,
                preservedSchematicViewBox
            )
            SchematicViewportPreserver.remember(
                this.#contentNode,
                documentId,
                snapshot.documentModel
            )
            AppViewSchematicContentReuseModel.remember(
                this.#contentNode,
                snapshot
            )
            this.#attachSvgViewportController('.schematic-svg')
            SchematicComponentSelectionBinder.bind(
                this.#contentNode.querySelector('.schematic-svg'),
                documentId,
                this.#pcbComponentSelectionCallback,
                this.#pcbNetSelectionCallback
            )
            return
        }

        SchematicViewportPreserver.clear(this.#contentNode)
        AppViewSchematicContentReuseModel.clear(this.#contentNode)

        if (snapshot.activeView === 'pcb') {
            this.#pcbViewController = AppViewPcbControllerBinder.attach({
                contentNode: this.#contentNode,
                snapshot,
                side: previousPcbSide,
                onComponentSelectionChange: this.#pcbComponentSelectionCallback,
                onNetSelectionChange: this.#pcbNetSelectionCallback,
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
                onComponentSelectionChange: this.#pcbComponentSelectionCallback,
                translate: this.#translate,
                createScene3dController: this.#createScene3dController
            })
            return
        }

        if (snapshot.activeView === 'bom') {
            const bomMarkup = EcadRendererService.renderBom(
                snapshot.documentModel,
                {
                    translate: this.#translate
                }
            )
            this.#contentNode.innerHTML = bomMarkup.includes(
                'class="bom-panel"'
            )
                ? bomMarkup
                : '<div class="bom-panel">' + bomMarkup + '</div>'
            return
        }

        this.#contentNode.innerHTML = DocumentRailRenderer.renderDiagnostics(
            snapshot.documentModel.diagnostics || [],
            this.#translate
        )
    }

    /**
     * Attaches the shared SVG viewport controller when the rendered content
     * contains a compatible schematic or PCB SVG node.
     * @param {string} selector
     * @returns {void}
     */
    #attachSvgViewportController(selector) {
        if (!this.#contentNode) return

        const svgNode = this.#contentNode.querySelector(selector)
        if (!AppView.#isInteractiveSvg(svgNode)) {
            return
        }

        this.#svgViewportController = new SchematicViewportController(svgNode)
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
     * Disposes the active PCB view controller before the panel content
     * changes.
     * @returns {void}
     */
    #disposePcbViewController() {
        this.#pcbViewController?.dispose()
        this.#pcbViewController = null
        AppViewPcbContentReuseModel.clear(this.#contentNode)
    }

    /**
     * Resolves a normalized session document list from the render snapshot.
     * @param {{ documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     * @returns {{ id: string, documentModel: any }[]}
     */
    static #resolveSessionDocuments(snapshot) {
        if (Array.isArray(snapshot.documents)) {
            return snapshot.documents
        }

        if (!snapshot.documentModel) {
            return []
        }

        return [
            {
                id: String(snapshot.activeDocumentId || 'active-document'),
                documentModel: snapshot.documentModel
            }
        ]
    }

    /**
     * Captures scroll state for the active sidebar panel before a re-render.
     * @param {HTMLElement | null} sidebarMount Sidebar mount node.
     * @returns {{ activeTab: string, activeDocumentId: string, scrollTop: number, scrollLeft: number } | null}
     */
    static #captureSidebarScroll(sidebarMount) {
        const sidebar = sidebarMount?.querySelector?.('.viewer-sidebar')
        const panel = sidebarMount?.querySelector?.('.viewer-sidebar__panel')
        if (!sidebar || !panel) {
            return null
        }

        return {
            activeTab: sidebar.getAttribute('data-active-sidebar-tab') || '',
            activeDocumentId:
                sidebar.getAttribute('data-active-document-id') || '',
            scrollTop: Number(panel.scrollTop || 0),
            scrollLeft: Number(panel.scrollLeft || 0)
        }
    }

    /**
     * Restores sidebar panel scroll when the same panel was re-rendered.
     * @param {HTMLElement | null} sidebarMount Sidebar mount node.
     * @param {{ activeTab: string, activeDocumentId: string, scrollTop: number, scrollLeft: number } | null} scrollState Captured scroll state.
     * @returns {void}
     */
    static #restoreSidebarScroll(sidebarMount, scrollState) {
        if (!scrollState) {
            return
        }

        const sidebar = sidebarMount?.querySelector?.('.viewer-sidebar')
        const panel = sidebarMount?.querySelector?.('.viewer-sidebar__panel')
        if (!sidebar || !panel) {
            return
        }

        const activeTab = sidebar.getAttribute('data-active-sidebar-tab') || ''
        const activeDocumentId =
            sidebar.getAttribute('data-active-document-id') || ''
        if (
            activeTab !== scrollState.activeTab ||
            activeDocumentId !== scrollState.activeDocumentId
        ) {
            return
        }

        panel.scrollTop = scrollState.scrollTop
        panel.scrollLeft = scrollState.scrollLeft
    }

    /**
     * Returns true when the queried node exposes the methods required by the
     * shared SVG viewport controller.
     * @param {unknown} node
     * @returns {boolean}
     */
    static #isInteractiveSvg(node) {
        return Boolean(
            node &&
            typeof node === 'object' &&
            typeof node.getAttribute === 'function' &&
            typeof node.setAttribute === 'function' &&
            typeof node.getBoundingClientRect === 'function' &&
            typeof node.addEventListener === 'function' &&
            typeof node.removeEventListener === 'function'
        )
    }

    /**
     * Resolves browser storage without throwing in restricted environments.
     * @param {Document} documentRef Browser document.
     * @returns {Storage | null}
     */
    static #resolveBrowserStorage(documentRef) {
        try {
            return documentRef.defaultView?.localStorage || null
        } catch (_error) {
            return null
        }
    }

    /**
     * Escapes user-facing markup.
     * @param {string} value
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
