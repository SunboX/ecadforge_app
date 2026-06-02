import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { ViewDeepLinkState } from '../ViewDeepLinkState.mjs'
import { DocumentRailRenderer } from './DocumentRailRenderer.mjs'
import { HeroPreviewController } from './HeroPreviewController.mjs'
import { PcbViewController } from './PcbViewController.mjs'
import { PcbScene3dController } from './PcbScene3dController.mjs'
import { Scene3dRenderer } from './Scene3dRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { SummaryCardRenderer } from './SummaryCardRenderer.mjs'
import { UiText } from './UiText.mjs'
import { ViewerEmptyStateRenderer } from './ViewerEmptyStateRenderer.mjs'

const PCB_STYLER_TIP_DISMISSED_STORAGE_KEY =
    'ecadforge.pcbStylerTipDismissed'

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
    #summaryNode

    /** @type {HTMLElement | null} */
    #viewerStageNode

    /** @type {HTMLElement | null} */
    #documentRailNode

    /** @type {HTMLElement | null} */
    #contentNode

    /** @type {HTMLElement | null} */
    #activeFileNode

    /** @type {HTMLElement | null} */
    #tabsNode

    /** @type {HTMLElement | null} */
    #diagnosticsCountNode

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
        this.#summaryNode = this.#document.querySelector('#summaryGrid')
        this.#viewerStageNode = this.#document.querySelector('#viewerStage')
        this.#documentRailNode = this.#document.querySelector('#documentRail')
        this.#contentNode = this.#document.querySelector('#viewContent')
        this.#activeFileNode = this.#document.querySelector(
            '#activeDocumentName'
        )
        this.#tabsNode = this.#document.querySelector('#viewTabs')
        this.#diagnosticsCountNode =
            this.#document.querySelector('#diagnosticsCount')
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
    }

    /**
     * Renders one full state snapshot.
     * @param {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     */
    render(snapshot) {
        this.setStatus(snapshot.statusMessage)
        this.setLocale(snapshot.locale)
        const bodyClassList = this.#document.body?.classList
        if (bodyClassList) {
            const isViewerMode = Boolean(snapshot.documentModel)
            bodyClassList[isViewerMode ? 'add' : 'remove']('is-viewer-mode')
            bodyClassList.remove(
                'is-viewer-visual',
                'is-viewer-schematic',
                'is-viewer-pcb',
                'is-viewer-3d',
                'is-viewer-report'
            )
            if (
                isViewerMode &&
                ['schematic', 'pcb', '3d', 'bom', 'diagnostics'].includes(
                    snapshot.activeView
                )
            )
                bodyClassList.add('is-viewer-visual')
            if (isViewerMode && snapshot.activeView === 'schematic')
                bodyClassList.add('is-viewer-schematic')
            if (isViewerMode && snapshot.activeView === 'pcb')
                bodyClassList.add('is-viewer-pcb')
            if (isViewerMode && snapshot.activeView === '3d')
                bodyClassList.add('is-viewer-3d')
            if (
                isViewerMode &&
                ['bom', 'diagnostics'].includes(snapshot.activeView)
            )
                bodyClassList.add('is-viewer-report')
        }
        this.#renderActiveFile(snapshot.activeFileName)
        this.#renderTabs(snapshot.activeView)
        this.#renderSummary(snapshot.documentModel)
        this.#renderDiagnosticsCount(snapshot.documentModel)
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
        this.#documentRailNode?.addEventListener('click', (event) => {
            const target = event.target
            const button =
                target &&
                typeof target === 'object' &&
                typeof target.closest === 'function'
                    ? target.closest('[data-document-id]')
                    : null

            if (!button || typeof button.getAttribute !== 'function') {
                return
            }

            callback(button.getAttribute('data-document-id') || '')
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
            this.#storage?.setItem(
                PCB_STYLER_TIP_DISMISSED_STORAGE_KEY,
                'true'
            )
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
     * Updates the visible file label.
     * @param {string} fileName
     */
    #renderActiveFile(fileName) {
        if (!this.#activeFileNode) return
        this.#activeFileNode.textContent =
            fileName || this.#translate('summary.noFile')
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
     * Updates the summary grid.
     * @param {any} documentModel
     */
    #renderSummary(documentModel) {
        if (!this.#summaryNode) return

        this.#summaryNode.innerHTML = SummaryCardRenderer.render(
            documentModel,
            this.#translate
        )
    }

    /**
     * Updates the diagnostics badge.
     * @param {any} documentModel
     */
    #renderDiagnosticsCount(documentModel) {
        if (!this.#diagnosticsCountNode) return
        const count = Array.isArray(documentModel?.diagnostics)
            ? documentModel.diagnostics.length
            : 0
        this.#diagnosticsCountNode.textContent = String(count)
    }

    /**
     * Updates the preview rail for multi-document sessions.
     * @param {{ activeView: string, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     * @returns {void}
     */
    #renderDocumentRail(snapshot) {
        if (!this.#documentRailNode) return

        const documents = DocumentRailRenderer.filterDocumentsForView(
            AppView.#resolveSessionDocuments(snapshot),
            snapshot.activeView
        )
        if (documents.length < 2) {
            this.#documentRailNode.innerHTML = ''
            this.#documentRailNode.setAttribute('hidden', 'hidden')
            this.#viewerStageNode?.classList.remove('is-multi-document')
            return
        }

        const activeDocumentId =
            String(snapshot.activeDocumentId || '') || documents[0].id

        this.#documentRailNode.removeAttribute('hidden')
        this.#viewerStageNode?.classList.add('is-multi-document')
        this.#documentRailNode.innerHTML = documents
            .map((entry) =>
                DocumentRailRenderer.renderCard(
                    entry,
                    activeDocumentId,
                    snapshot.activeView,
                    this.#translate
                )
            )
            .join('')
    }

    /**
     * Updates the main tab panel content.
     * @param {{ activeView: string, parseStatus: string, sessionAssets?: any[], documentModel: any }} snapshot
     */
    #renderContent(snapshot) {
        if (!this.#contentNode) return

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
            this.#contentNode.innerHTML = EcadRendererService.renderSchematic(
                snapshot.documentModel
            )
            this.#attachSvgViewportController('.schematic-svg')
            return
        }

        if (snapshot.activeView === 'pcb') {
            this.#pcbViewController = new PcbViewController(
                this.#contentNode,
                snapshot.documentModel,
                {
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
                snapshot.documentModel
            )
            this.#contentNode.innerHTML = bomMarkup.includes('class="bom-panel"')
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
