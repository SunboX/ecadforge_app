import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { ViewDeepLinkState } from '../ViewDeepLinkState.mjs'
import { DocumentRailRenderer } from './DocumentRailRenderer.mjs'
import { HeroPreviewController } from './HeroPreviewController.mjs'
import { LandingStatusRenderer } from './LandingStatusRenderer.mjs'
import { PcbViewController } from './PcbViewController.mjs'
import { PcbScene3dController } from './PcbScene3dController.mjs'
import { Scene3dRenderer } from './Scene3dRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { SchematicViewRenderer } from './SchematicViewRenderer.mjs'
import { UiText } from './UiText.mjs'
import { ViewerModeClassRenderer } from './ViewerModeClassRenderer.mjs'
import { ViewerEmptyStateRenderer } from './ViewerEmptyStateRenderer.mjs'
import { ViewerSidebarEventBinder } from './ViewerSidebarEventBinder.mjs'
import { ViewerSidebarRenderer } from './ViewerSidebarRenderer.mjs'
const PCB_STYLER_TIP_DISMISSED_STORAGE_KEY = 'ecadforge.pcbStylerTipDismissed'

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

    /** @type {HTMLElement | null} */
    #pcbStylerCtaNode

    /** @type {HTMLAnchorElement | null} */
    #pcbStylerLinkNode

    /** @type {HTMLElement | null} */
    #pcbStylerDismissNode

    /** @type {Storage | null} */
    #storage

    /** @type {(key: string) => string} */
    #translate

    /** @type {SchematicViewportController | null} */
    #svgViewportController

    /** @type {PcbViewController | null} */
    #pcbViewController

    /** @type {((change: { documentId: string, componentKey: string }) => void) | null} */
    #pcbComponentSelectionCallback

    /** @type {PcbScene3dController | null} */
    #scene3dController

    #heroPreviewController

    /** @type {(viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => PcbScene3dController} */
    #createScene3dController

    /**
     * @param {Document} documentRef
     * @param {{ createScene3dController?: (viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => PcbScene3dController, translate?: ((key: string) => string) | null, storage?: Storage | null }} [options]
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
        this.#pcbStylerCtaNode = this.#document.querySelector('#pcbStylerCta')
        this.#pcbStylerLinkNode = this.#document.querySelector('#pcbStylerLink')
        this.#pcbStylerDismissNode =
            this.#document.querySelector('#pcbStylerDismiss')
        this.#storage =
            options.storage === undefined
                ? AppView.#resolveBrowserStorage(this.#document)
                : options.storage
        this.#translate = UiText.createTranslator(options.translate || null)
        this.#svgViewportController = null
        this.#pcbViewController = null
        this.#pcbComponentSelectionCallback = null
        this.#scene3dController = null
        this.#createScene3dController =
            options.createScene3dController ||
            ((viewportNode, documentModel, sceneOptions = {}) =>
                new PcbScene3dController(viewportNode, documentModel, {
                    sessionAssets: sceneOptions.sessionAssets || [],
                    setLoadingVisible: sceneOptions.setLoadingVisible,
                    translate: sceneOptions.translate || this.#translate
                }))
        this.#heroPreviewController = new HeroPreviewController(
            this.#document,
            {
                createScene3dController: this.#createScene3dController,
                translate: this.#translate
            }
        )
        this.#bindPcbStylerDismiss()
        ViewerSidebarEventBinder.bindSidebarCollapseToggle(
            this.#documentRailNode,
            (collapsed) => this.#setSidebarCollapsed(collapsed)
        )
        ViewerSidebarEventBinder.bindComponentFilter(this.#documentRailNode)
    }

    /**
     * Renders one full state snapshot.
     * @param {{ activeView: string, activeSidebarTab?: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     */
    render(snapshot) {
        this.setStatus(snapshot.statusMessage)
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
        if (this.#statusNode) {
            this.#statusNode.textContent = value
        }
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
     * @param {(change: { documentId: string, componentKey: string }) => void} callback
     * @returns {void}
     */
    bindPcbComponentSelectionChange(callback) {
        this.#pcbComponentSelectionCallback =
            typeof callback === 'function' ? callback : null
        ViewerSidebarEventBinder.bindPcbComponentSelectionChange(
            this.#documentRailNode,
            callback
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
        this.#pcbStylerLinkNode?.addEventListener('click', () => {
            callback()
        })
    }

    /**
     * Updates the contextual PCB Styler crosslink.
     * @param {string} url Link URL.
     * @param {string} mode Link mode.
     * @returns {void}
     */
    setPcbStylerLink(url, mode) {
        if (!this.#pcbStylerCtaNode || !this.#pcbStylerLinkNode) {
            return
        }

        this.#pcbStylerLinkNode.href = url || 'https://pcb-styler.app/'
        this.#pcbStylerLinkNode.textContent =
            mode === 'github'
                ? this.#translate('pcbStyler.open')
                : this.#translate('pcbStyler.export')
        if (this.#isPcbStylerTipDismissed()) {
            this.#setPcbStylerCtaHidden(true)
            return
        }

        this.#setPcbStylerCtaHidden(false)
    }

    /**
     * Hides the PCB Styler crosslink when returning to landing mode.
     * @returns {void}
     */
    clearPcbStylerLink() {
        if (!this.#pcbStylerCtaNode || !this.#pcbStylerLinkNode) {
            return
        }

        this.#pcbStylerLinkNode.href = 'https://pcb-styler.app/'
        this.#pcbStylerLinkNode.textContent = this.#translate('pcbStyler.open')
        this.#setPcbStylerCtaHidden(true)
    }

    /**
     * Binds the persistent PCB Styler tip dismissal button.
     * @returns {void}
     */
    #bindPcbStylerDismiss() {
        this.#pcbStylerDismissNode?.addEventListener('click', () => {
            this.#dismissPcbStylerTip()
        })
    }

    /**
     * Hides the PCB Styler tip and stores the user preference.
     * @returns {void}
     */
    #dismissPcbStylerTip() {
        this.#storePcbStylerTipDismissed()
        this.#setPcbStylerCtaHidden(true)
    }

    /**
     * Toggles the PCB Styler CTA and collapses the unused grid row with it.
     * @param {boolean} hidden Whether the CTA should be hidden.
     * @returns {void}
     */
    #setPcbStylerCtaHidden(hidden) {
        if (hidden) {
            this.#pcbStylerCtaNode?.setAttribute('hidden', 'hidden')
            this.#viewerStageNode?.classList.add('is-pcb-styler-cta-hidden')
            return
        }

        this.#pcbStylerCtaNode?.removeAttribute('hidden')
        this.#viewerStageNode?.classList.remove('is-pcb-styler-cta-hidden')
    }

    /**
     * Returns true when the PCB Styler tip was dismissed in this browser.
     * @returns {boolean}
     */
    #isPcbStylerTipDismissed() {
        try {
            return (
                this.#storage?.getItem(PCB_STYLER_TIP_DISMISSED_STORAGE_KEY) ===
                'true'
            )
        } catch (_error) {
            return false
        }
    }

    /**
     * Persists the PCB Styler tip dismissal preference when storage is usable.
     * @returns {void}
     */
    #storePcbStylerTipDismissed() {
        try {
            this.#storage?.setItem(PCB_STYLER_TIP_DISMISSED_STORAGE_KEY, 'true')
        } catch (_error) {
            // The current click still hides the tip when browser storage fails.
        }
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
        if (!this.#sidebarCollapsed) {
            AppView.#restoreSidebarScroll(this.#documentRailNode, scrollState)
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

        const previousPcbSide = this.#pcbViewController?.side || 'top'
        this.#disposeSvgViewportController()
        this.#disposePcbViewController()
        this.#disposeScene3dController()

        if (snapshot.parseStatus === 'loading' && !snapshot.documentModel) {
            this.#contentNode.innerHTML =
                '<section class="viewer-loading"><div class="viewer-loading__pulse"></div><p>' +
                AppView.#escapeHtml(this.#translate('status.loading')) +
                '</p></section>'
            return
        }

        if (!snapshot.documentModel) {
            this.#contentNode.innerHTML = ViewerEmptyStateRenderer.render(
                this.#translate
            )
            return
        }

        if (snapshot.activeView === 'schematic') {
            const documentId = String(snapshot?.activeDocumentId || '')
            this.#contentNode.innerHTML = SchematicViewRenderer.render(
                snapshot.documentModel,
                String(snapshot?.selectedPcbComponents?.[documentId] || '')
            )
            this.#attachSvgViewportController('.schematic-svg')
            return
        }

        if (snapshot.activeView === 'pcb') {
            const documentId = String(snapshot?.activeDocumentId || '')
            const objectOpacities = snapshot?.pcbObjectOpacities?.[documentId]
            this.#pcbViewController = new PcbViewController(
                this.#contentNode,
                snapshot.documentModel,
                {
                    documentId,
                    side: previousPcbSide,
                    hiddenLayers: AppView.#resolveHiddenPcbLayers(snapshot),
                    hiddenObjects: AppView.#resolveHiddenPcbObjects(snapshot),
                    objectOpacities:
                        objectOpacities &&
                        typeof objectOpacities === 'object' &&
                        !Array.isArray(objectOpacities)
                            ? { ...objectOpacities }
                            : {},
                    selectedComponentKey: String(
                        snapshot?.selectedPcbComponents?.[documentId] || ''
                    ),
                    onComponentSelectionChange:
                        this.#pcbComponentSelectionCallback,
                    translate: this.#translate
                }
            )
            return
        }

        if (snapshot.activeView === '3d') {
            this.#contentNode.innerHTML = Scene3dRenderer.render(
                snapshot.documentModel,
                this.#translate
            )
            this.#attachScene3dController(
                snapshot.documentModel,
                snapshot.sessionAssets || []
            )
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
    }

    /**
     * Attaches the 3D scene controller when the rendered content contains a
     * compatible viewport mount node.
     * @param {any} documentModel
     * @param {any[]} sessionAssets
     * @returns {void}
     */
    #attachScene3dController(documentModel, sessionAssets) {
        if (!this.#contentNode) return

        const viewportNode = this.#contentNode.querySelector(
            '[data-scene-3d-viewport]'
        )
        if (!AppView.#isSceneViewportNode(viewportNode)) {
            return
        }

        const loadingNode = this.#contentNode.querySelector(
            '[data-scene-3d-loading]'
        )
        const setLoadingVisible = (visible) => {
            if (!AppView.#isSceneViewportNode(loadingNode)) {
                return
            }

            if (visible) {
                loadingNode.removeAttribute?.('hidden')
                return
            }

            loadingNode.setAttribute?.('hidden', 'hidden')
        }
        setLoadingVisible(true)

        this.#scene3dController = this.#createScene3dController(
            viewportNode,
            documentModel,
            {
                sessionAssets,
                setLoadingVisible,
                translate: this.#translate
            }
        )
    }

    /**
     * Disposes the active 3D scene controller before the panel content
     * changes.
     * @returns {void}
     */
    #disposeScene3dController() {
        this.#scene3dController?.dispose()
        this.#scene3dController = null
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
     * Resolves hidden PCB layer keys for the active document.
     * @param {{ activeDocumentId?: string, hiddenPcbLayers?: { [documentId: string]: string[] } }} snapshot Viewer snapshot.
     * @returns {string[]}
     */
    static #resolveHiddenPcbLayers(snapshot) {
        const documentId = String(snapshot?.activeDocumentId || '')
        const hiddenLayers = snapshot?.hiddenPcbLayers?.[documentId]
        return Array.isArray(hiddenLayers) ? hiddenLayers : []
    }

    /**
     * Resolves hidden PCB object keys for the active document.
     * @param {{ activeDocumentId?: string, hiddenPcbObjects?: { [documentId: string]: string[] } }} snapshot Viewer snapshot.
     * @returns {string[]}
     */
    static #resolveHiddenPcbObjects(snapshot) {
        const documentId = String(snapshot?.activeDocumentId || '')
        const hiddenObjects = snapshot?.hiddenPcbObjects?.[documentId]
        return Array.isArray(hiddenObjects) ? hiddenObjects : []
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
     * Returns true when the queried node can host the 3D viewport.
     * @param {unknown} node
     * @returns {boolean}
     */
    static #isSceneViewportNode(node) {
        return Boolean(node && typeof node === 'object')
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
