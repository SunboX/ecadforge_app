import { BomTableRenderer } from './BomTableRenderer.mjs'
import { PcbSvgRenderer } from './PcbSvgRenderer.mjs'
import { Scene3dRenderer } from './Scene3dRenderer.mjs'
import { SchematicSvgRenderer } from './SchematicSvgRenderer.mjs'

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
    #contentNode

    /** @type {HTMLElement | null} */
    #activeFileNode

    /** @type {HTMLElement | null} */
    #tabsNode

    /** @type {HTMLElement | null} */
    #diagnosticsCountNode

    /**
     * @param {Document} documentRef
     */
    constructor(documentRef) {
        this.#document = documentRef
        this.#fileInput = this.#document.querySelector('#fileInput')
        this.#dropZone = this.#document.querySelector('#dropZone')
        this.#statusNode = this.#document.querySelector('#statusMessage')
        this.#versionNode = this.#document.querySelector('#appVersion')
        this.#localeSelect = this.#document.querySelector('#localeSelect')
        this.#summaryNode = this.#document.querySelector('#summaryGrid')
        this.#contentNode = this.#document.querySelector('#viewContent')
        this.#activeFileNode = this.#document.querySelector(
            '#activeDocumentName'
        )
        this.#tabsNode = this.#document.querySelector('#viewTabs')
        this.#diagnosticsCountNode =
            this.#document.querySelector('#diagnosticsCount')
    }

    /**
     * Renders one full state snapshot.
     * @param {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: any }} snapshot
     */
    render(snapshot) {
        this.setStatus(snapshot.statusMessage)
        this.setLocale(snapshot.locale)
        this.#renderActiveFile(snapshot.activeFileName)
        this.#renderTabs(snapshot.activeView)
        this.#renderSummary(snapshot.documentModel)
        this.#renderDiagnosticsCount(snapshot.documentModel)
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
            this.#versionNode.textContent = version ? 'v' + version : 'v—'
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
     * Updates the main tab panel content.
     * @param {{ activeView: string, parseStatus: string, documentModel: any }} snapshot
     */
    #renderContent(snapshot) {
        if (!this.#contentNode) return

        if (snapshot.parseStatus === 'loading') {
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
            return
        }

        if (snapshot.activeView === 'pcb') {
            this.#contentNode.innerHTML = PcbSvgRenderer.render(
                snapshot.documentModel
            )
            return
        }

        if (snapshot.activeView === '3d') {
            this.#contentNode.innerHTML = Scene3dRenderer.render(
                snapshot.documentModel
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
