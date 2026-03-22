import { BomTableRenderer } from './BomTableRenderer.mjs'
import { PcbSvgRenderer } from './PcbSvgRenderer.mjs'
import { PcbScene3dController } from './PcbScene3dController.mjs'
import { Scene3dRenderer } from './Scene3dRenderer.mjs'
import { SchematicSvgRenderer } from './SchematicSvgRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'

/**
 * DOM rendering and event binding helper.
 */
export class AppView {
    /** @type {Document} */
    #document

    /** @type {HTMLInputElement | null} */
    #fileInput

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

    /** @type {SchematicViewportController | null} */
    #svgViewportController

    /** @type {PcbScene3dController | null} */
    #scene3dController

    /** @type {(viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void }) => PcbScene3dController} */
    #createScene3dController

    /**
     * @param {Document} documentRef
     * @param {{ createScene3dController?: (viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void }) => PcbScene3dController }} [options]
     */
    constructor(documentRef, options = {}) {
        this.#document = documentRef
        this.#fileInput = this.#document.querySelector('#fileInput')
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
        this.#svgViewportController = null
        this.#scene3dController =
            null
        this.#createScene3dController =
            options.createScene3dController ||
            ((viewportNode, documentModel, sceneOptions = {}) =>
                new PcbScene3dController(viewportNode, documentModel, {
                    sessionAssets: sceneOptions.sessionAssets || [],
                    setLoadingVisible: sceneOptions.setLoadingVisible
                }))
    }

    /**
     * Renders one full state snapshot.
     * @param {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot
     */
    render(snapshot) {
        this.setStatus(snapshot.statusMessage)
        this.setLocale(snapshot.locale)
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
     * Binds file input changes.
     * @param {(files: File[]) => void} callback
     */
    bindFileSelection(callback) {
        this.#fileInput?.addEventListener('change', () => {
            if (!this.#fileInput?.files?.length) return
            callback([...this.#fileInput.files])
            this.#fileInput.value = ''
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
            const target = event.target
            if (!(target instanceof HTMLElement)) return
            const button = target.closest('[data-view]')
            if (!(button instanceof HTMLElement)) return
            callback(button.dataset.view || 'schematic')
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

            if (
                !button ||
                typeof button.getAttribute !== 'function'
            ) {
                return
            }

            callback(button.getAttribute('data-document-id') || '')
        })
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
     * Updates the summary grid.
     * @param {any} documentModel
     */
    #renderSummary(documentModel) {
        if (!this.#summaryNode) return

        if (!documentModel) {
            this.#summaryNode.innerHTML =
                '<article class="summary-card"><span class="summary-card__label">Status</span><strong>Awaiting native file</strong></article>' +
                '<article class="summary-card"><span class="summary-card__label">Formats</span><strong>SchDoc, PcbDoc</strong></article>' +
                '<article class="summary-card"><span class="summary-card__label">Parser</span><strong>Client-side JS</strong></article>' +
                '<article class="summary-card"><span class="summary-card__label">Views</span><strong>5 tabs ready</strong></article>'
            return
        }

        const cards = AppView.#buildSummaryCards(documentModel)
        this.#summaryNode.innerHTML = cards
            .map(
                (card) =>
                    '<article class="summary-card"><span class="summary-card__label">' +
                    AppView.#escapeHtml(card.label) +
                    '</span><strong>' +
                    AppView.#escapeHtml(card.value) +
                    '</strong></article>'
            )
            .join('')
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
                '<section class="viewer-loading"><div class="viewer-loading__pulse"></div><p>Parsing native Altium records in the browser...</p></section>'
            return
        }

        if (!snapshot.documentModel) {
            this.#contentNode.innerHTML =
                '<section class="viewer-empty"><h3>Drop a native file</h3><p>Open standalone <code>.SchDoc</code> and <code>.PcbDoc</code> documents directly in the browser. The parser recovers schematic graphics, PCB outline and placements, grouped BOM rows, and parser diagnostics.</p></section>'
            return
        }

        if (snapshot.activeView === 'schematic') {
            this.#contentNode.innerHTML = SchematicSvgRenderer.render(
                snapshot.documentModel
            )
            this.#attachSvgViewportController('.schematic-svg')
            return
        }

        if (snapshot.activeView === 'pcb') {
            this.#contentNode.innerHTML = PcbSvgRenderer.render(
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
            this.#contentNode.innerHTML = BomTableRenderer.render(
                snapshot.documentModel.bom || []
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
     * Builds summary card values by document type.
     * @param {any} documentModel
     * @returns {{ label: string, value: string }[]}
     */
    static #buildSummaryCards(documentModel) {
        if (documentModel.kind === 'schematic') {
            return [
                {
                    label: 'Components',
                    value: String(documentModel.summary.componentCount || 0)
                },
                {
                    label: 'Graphics',
                    value: String(documentModel.summary.lineCount || 0)
                },
                {
                    label: 'Texts',
                    value: String(documentModel.summary.textCount || 0)
                },
                {
                    label: 'BOM groups',
                    value: String(documentModel.summary.bomRowCount || 0)
                }
            ]
        }

        return [
            {
                label: 'Placements',
                value: String(documentModel.summary.componentCount || 0)
            },
            {
                label: 'Layers',
                value: String(documentModel.summary.layerCount || 0)
            },
            {
                label: 'Outline segments',
                value: String(documentModel.summary.outlineSegmentCount || 0)
            },
            {
                label: 'Board envelope',
                value:
                    String(documentModel.summary.boardWidthMil || 0) +
                    ' x ' +
                    String(documentModel.summary.boardHeightMil || 0) +
                    ' mil'
            }
        ]
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
                documentModel?.fileName || documentModel?.summary?.title || 'Document'
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
                SchematicSvgRenderer.render(documentModel),
                'schematic-svg',
                'document-preview__svg document-preview__svg--schematic',
                documentId
            )
        }

        if (activeView === 'pcb') {
            return AppView.#extractPreviewSvgMarkup(
                PcbSvgRenderer.render(documentModel),
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
                '<svg class="([^"]*\\b' +
                    escapedClassName +
                    '\\b[^"]*)"[^>]*>[\\s\\S]*?<\\/svg>'
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
            'class="' + previewClassName + '"'
        )

        return AppView.#prefixSvgMarkupIds(
            previewSvgMarkup,
            'preview-' + documentId
        )
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
