import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { HeroPreviewController } from './HeroPreviewController.mjs'
import { PcbScene3dController } from './PcbScene3dController.mjs'
import { Scene3dRenderer } from './Scene3dRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { SummaryCardRenderer } from './SummaryCardRenderer.mjs'
import { ViewerEmptyStateRenderer } from './ViewerEmptyStateRenderer.mjs'

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

    /** @type {SchematicViewportController | null} */
    #svgViewportController

    /** @type {PcbScene3dController | null} */
    #scene3dController

    #heroPreviewController

    /** @type {(viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void }) => PcbScene3dController} */
    #createScene3dController

    /**
     * @param {Document} documentRef
     * @param {{ createScene3dController?: (viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void }) => PcbScene3dController }} [options]
     */
    constructor(documentRef, options = {}) {
        this.#document = documentRef
        this.#fileInput = this.#document.querySelector('#fileInput')
        this.#folderInput = this.#document.querySelector('#folderInput')
        this.#dropZone = this.#document.querySelector('#dropZone')
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
        this.#svgViewportController = null
        this.#scene3dController = null
        this.#createScene3dController =
            options.createScene3dController ||
            ((viewportNode, documentModel, sceneOptions = {}) =>
                new PcbScene3dController(viewportNode, documentModel, {
                    sessionAssets: sceneOptions.sessionAssets || [],
                    setLoadingVisible: sceneOptions.setLoadingVisible
                }))
        this.#heroPreviewController = new HeroPreviewController(
            this.#document,
            {
                createScene3dController: this.#createScene3dController
            }
        )
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
            bodyClassList[snapshot.documentModel ? 'add' : 'remove'](
                'is-viewer-mode'
            )
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
                callback
            )
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
                ? 'Open this board in PCB Styler'
                : 'Export or reopen in PCB Styler'
        this.#pcbStylerCtaNode.removeAttribute('hidden')
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
        this.#activeFileNode.textContent = fileName || 'No file loaded'
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

        this.#summaryNode.innerHTML = SummaryCardRenderer.render(documentModel)
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

        const documents = AppView.#filterDocumentsForView(
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
                AppView.#renderDocumentRailCard(
                    entry,
                    activeDocumentId,
                    snapshot.activeView
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
        this.#disposeScene3dController()

        if (snapshot.parseStatus === 'loading' && !snapshot.documentModel) {
            this.#contentNode.innerHTML =
                '<section class="viewer-loading"><div class="viewer-loading__pulse"></div><p>Parsing native ECAD records in the browser...</p></section>'
            return
        }

        if (!snapshot.documentModel) {
            this.#contentNode.innerHTML = ViewerEmptyStateRenderer.render()
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
            this.#contentNode.innerHTML = EcadRendererService.renderPcb(
                snapshot.documentModel
            )
            this.#attachSvgViewportController('.pcb-svg')
            return
        }

        if (snapshot.activeView === '3d') {
            this.#contentNode.innerHTML = Scene3dRenderer.render(
                snapshot.documentModel
            )
            this.#attachScene3dController(
                snapshot.documentModel,
                snapshot.sessionAssets || []
            )
            return
        }

        if (snapshot.activeView === 'bom') {
            this.#contentNode.innerHTML = EcadRendererService.renderBom(
                snapshot.documentModel
            )
            return
        }

        this.#contentNode.innerHTML = AppView.#renderDiagnostics(
            snapshot.documentModel.diagnostics || []
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
                setLoadingVisible
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
     * Renders the diagnostics tab.
     * @param {{ severity: string, message: string }[]} diagnostics
     * @returns {string}
     */
    static #renderDiagnostics(diagnostics) {
        if (!diagnostics.length) {
            return '<section class="viewer-empty">No diagnostics were emitted for this file.</section>'
        }

        return (
            '<section class="diagnostics-panel"><header class="svg-panel__header"><h3>Parser diagnostics</h3><p>' +
            diagnostics.length +
            ' messages</p></header><ul class="diagnostics-list">' +
            diagnostics
                .map(
                    (diagnostic) =>
                        '<li class="diagnostic diagnostic--' +
                        AppView.#escapeHtml(diagnostic.severity) +
                        '"><span class="diagnostic__severity">' +
                        AppView.#escapeHtml(diagnostic.severity) +
                        '</span><p>' +
                        AppView.#escapeHtml(diagnostic.message) +
                        '</p></li>'
                )
                .join('') +
            '</ul></section>'
        )
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
     * Filters the session document list to the files that can render the
     * current active view.
     * @param {{ id: string, documentModel: any }[]} documents
     * @param {string} activeView
     * @returns {{ id: string, documentModel: any }[]}
     */
    static #filterDocumentsForView(documents, activeView) {
        return documents.filter((entry) =>
            AppView.#supportsView(entry.documentModel, activeView)
        )
    }

    /**
     * Renders one preview-rail card for a loaded document.
     * @param {{ id: string, documentModel: any }} entry
     * @param {string} activeDocumentId
     * @param {string} activeView
     * @returns {string}
     */
    static #renderDocumentRailCard(entry, activeDocumentId, activeView) {
        const isActive = entry.id === activeDocumentId
        const documentModel = entry.documentModel
        const previewMarkup = AppView.#renderDocumentPreview(
            entry.id,
            documentModel,
            activeView
        )

        return (
            '<button class="document-rail__item' +
            (isActive ? ' is-active' : '') +
            '" type="button" data-document-id="' +
            AppView.#escapeHtml(entry.id) +
            '" aria-pressed="' +
            (isActive ? 'true' : 'false') +
            '">' +
            '<span class="document-rail__preview">' +
            previewMarkup +
            '</span>' +
            '<span class="document-rail__name">' +
            AppView.#escapeHtml(
                documentModel?.fileName ||
                    documentModel?.summary?.title ||
                    'Document'
            ) +
            '</span>' +
            '</button>'
        )
    }

    /**
     * Renders one compact preview for the preview rail.
     * @param {string} documentId
     * @param {any} documentModel
     * @param {string} activeView
     * @returns {string}
     */
    static #renderDocumentPreview(documentId, documentModel, activeView) {
        if (activeView === 'schematic') {
            return AppView.#extractPreviewSvgMarkup(
                EcadRendererService.renderSchematic(documentModel),
                'schematic-svg',
                'document-preview__svg document-preview__svg--schematic',
                documentId
            )
        }

        if (activeView === 'pcb') {
            return AppView.#extractPreviewSvgMarkup(
                EcadRendererService.renderPcb(documentModel),
                'pcb-svg',
                'document-preview__svg document-preview__svg--pcb',
                documentId
            )
        }

        if (activeView === 'bom') {
            return AppView.#renderPreviewSummary(
                'BOM',
                String(documentModel?.bom?.length || 0) + ' grouped rows',
                documentModel?.kind === 'schematic'
                    ? 'Recovered from the current sheet.'
                    : 'Recovered from the current board.'
            )
        }

        if (activeView === '3d') {
            return AppView.#renderPreviewSummary(
                '3D',
                String(documentModel?.summary?.boardWidthMil || 0) +
                    ' x ' +
                    String(documentModel?.summary?.boardHeightMil || 0) +
                    ' mil',
                String(documentModel?.summary?.componentCount || 0) +
                    ' placements'
            )
        }

        return AppView.#renderPreviewSummary(
            'Diagnostics',
            String(documentModel?.diagnostics?.length || 0) + ' messages',
            documentModel?.diagnostics?.length
                ? 'Parser findings available.'
                : 'No diagnostics emitted.'
        )
    }

    /**
     * Extracts the rendered SVG from a full renderer panel and rewrites its
     * ids and root class for safe use inside the preview rail.
     * @param {string} markup
     * @param {string} sourceClassName
     * @param {string} previewClassName
     * @param {string} documentId
     * @returns {string}
     */
    static #extractPreviewSvgMarkup(
        markup,
        sourceClassName,
        previewClassName,
        documentId
    ) {
        const escapedClassName = sourceClassName.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        )
        const svgMatch = markup.match(
            new RegExp(
                '<svg\\b(?=[^>]*\\bclass="([^"]*\\b' +
                    escapedClassName +
                    '\\b[^"]*)")[^>]*>[\\s\\S]*?<\\/svg>'
            )
        )

        if (!svgMatch) {
            return AppView.#renderPreviewSummary(
                'Preview',
                'Unavailable',
                'Preview markup could not be extracted.'
            )
        }

        const previewSvgMarkup = svgMatch[0].replace(
            /class="[^"]*"/,
            'class="' +
                AppView.#previewSvgClassName(svgMatch[1], previewClassName) +
                '"'
        )

        return AppView.#prefixSvgMarkupIds(
            previewSvgMarkup,
            'preview-' + documentId
        )
    }

    /**
     * Preserves source renderer modifier classes on preview SVGs.
     * @param {string} sourceClassList Original SVG class attribute.
     * @param {string} previewClassName Preview class replacement.
     * @returns {string}
     */
    static #previewSvgClassName(sourceClassList, previewClassName) {
        const retainedModifiers = String(sourceClassList)
            .split(/\s+/)
            .filter((className) => /--[a-z0-9-]+$/i.test(className))

        return [previewClassName, ...retainedModifiers].join(' ')
    }

    /**
     * Prefixes in-markup ids and matching `url(#...)` references so repeated
     * preview SVGs do not collide inside the same document.
     * @param {string} markup
     * @param {string} prefix
     * @returns {string}
     */
    static #prefixSvgMarkupIds(markup, prefix) {
        const idMap = new Map()
        let updatedMarkup = markup.replace(/\sid="([^"]+)"/g, (_match, id) => {
            const nextId = prefix + '-' + id
            idMap.set(id, nextId)
            return ' id="' + nextId + '"'
        })

        idMap.forEach((nextId, id) => {
            updatedMarkup = updatedMarkup.replaceAll(
                'url(#' + id + ')',
                'url(#' + nextId + ')'
            )
        })

        return updatedMarkup
    }

    /**
     * Renders one summary-style preview card body.
     * @param {string} label
     * @param {string} value
     * @param {string} detail
     * @returns {string}
     */
    static #renderPreviewSummary(label, value, detail) {
        return (
            '<span class="document-preview__summary">' +
            '<span class="document-preview__label">' +
            AppView.#escapeHtml(label) +
            '</span>' +
            '<strong>' +
            AppView.#escapeHtml(value) +
            '</strong>' +
            '<small>' +
            AppView.#escapeHtml(detail) +
            '</small>' +
            '</span>'
        )
    }

    /**
     * Returns true when the document model supports the requested top-level
     * view.
     * @param {any} documentModel
     * @param {string} activeView
     * @returns {boolean}
     */
    static #supportsView(documentModel, activeView) {
        if (activeView === 'schematic') {
            return Boolean(documentModel?.schematic)
        }

        if (activeView === 'pcb' || activeView === '3d') {
            return Boolean(documentModel?.pcb)
        }

        if (activeView === 'bom') {
            return Array.isArray(documentModel?.bom)
        }

        if (activeView === 'diagnostics') {
            return Array.isArray(documentModel?.diagnostics)
        }

        return false
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
