import { SelfAdjustingComputation } from 'circuitjson-toolkit'
import { LandingStatusRenderer } from './LandingStatusRenderer.mjs'
import { ViewerModeClassRenderer } from './ViewerModeClassRenderer.mjs'

/**
 * Propagates app snapshots through independently tracked DOM render stages.
 */
export class AppViewRenderGraph {
    /** @type {Document} */
    #document

    /** @type {HTMLElement | null} */
    #statusNode

    /** @type {HTMLSelectElement | null} */
    #localeSelect

    /** @type {HTMLElement | null} */
    #tabsNode

    /** @type {(snapshot: object) => void} */
    #renderSidebar

    /** @type {(snapshot: object) => void} */
    #renderContent

    /** @type {SelfAdjustingComputation} */
    #computation

    /**
     * @param {{ document: Document, statusNode: HTMLElement | null, localeSelect: HTMLSelectElement | null, tabsNode: HTMLElement | null, renderSidebar: (snapshot: object) => void, renderContent: (snapshot: object) => void }} options Render-stage dependencies.
     */
    constructor(options) {
        this.#document = options.document
        this.#statusNode = options.statusNode
        this.#localeSelect = options.localeSelect
        this.#tabsNode = options.tabsNode
        this.#renderSidebar = options.renderSidebar
        this.#renderContent = options.renderContent
        this.#computation = new SelfAdjustingComputation({
            isAtomic: AppViewRenderGraph.#isAtomicInput
        })
    }

    /**
     * Propagates one snapshot through only the affected render stages.
     * @param {object} snapshot Current app snapshot.
     * @param {PropertyKey[][] | null} [changedPaths] Changed input paths, or null when unknown.
     * @returns {void}
     */
    render(snapshot, changedPaths = null) {
        this.#computation.propagate(snapshot, changedPaths, [
            {
                name: 'status',
                computation: (current) => this.#renderStatus(current)
            },
            {
                name: 'locale',
                computation: (current) => this.#renderLocale(current)
            },
            {
                name: 'viewer-mode',
                computation: (current) => this.#renderViewerMode(current)
            },
            {
                name: 'tabs',
                computation: (current) => this.#renderTabs(current)
            },
            {
                name: 'sidebar',
                computation: (current) => this.#renderTranslatedSidebar(current)
            },
            {
                name: 'content',
                computation: (current) => this.#renderTranslatedContent(current)
            }
        ])
    }

    /**
     * Returns a copied bounded render dependency summary.
     * @returns {{ computations: number, dependencies: number, readerEdges: number }}
     */
    getStatistics() {
        return { ...this.#computation.getStatistics() }
    }

    /**
     * Updates persistent and landing status nodes.
     * @param {object} snapshot Tracked app snapshot.
     * @returns {void}
     */
    #renderStatus(snapshot) {
        LandingStatusRenderer.renderPersistentStatus(this.#statusNode, snapshot)
        LandingStatusRenderer.render(
            this.#document.querySelector('#landingStatusMessage'),
            snapshot
        )
    }

    /**
     * Updates the locale selector.
     * @param {object} snapshot Tracked app snapshot.
     * @returns {void}
     */
    #renderLocale(snapshot) {
        if (this.#localeSelect) {
            this.#localeSelect.value = snapshot.locale
        }
    }

    /**
     * Updates high-level viewer mode classes.
     * @param {object} snapshot Tracked app snapshot.
     * @returns {void}
     */
    #renderViewerMode(snapshot) {
        ViewerModeClassRenderer.render(this.#document.body, snapshot)
    }

    /**
     * Updates active tab accessibility state.
     * @param {object} snapshot Tracked app snapshot.
     * @returns {void}
     */
    #renderTabs(snapshot) {
        const buttons = this.#tabsNode?.querySelectorAll('[data-view]') || []
        buttons.forEach((button) => {
            const selected =
                button.getAttribute('data-view') === snapshot.activeView
            button.setAttribute('aria-selected', selected ? 'true' : 'false')
        })
    }

    /**
     * Renders the sidebar and bridges translator state through `locale`.
     * @param {object} snapshot Tracked app snapshot.
     * @returns {void}
     */
    #renderTranslatedSidebar(snapshot) {
        void snapshot.locale
        this.#renderSidebar(snapshot)
    }

    /**
     * Renders active content and bridges translator state through `locale`.
     * @param {object} snapshot Tracked app snapshot.
     * @returns {void}
     */
    #renderTranslatedContent(snapshot) {
        void snapshot.locale
        this.#renderContent(snapshot)
    }

    /**
     * Preserves identity-sensitive values outside the tracking proxy membrane.
     * @param {object} _value Candidate value.
     * @param {PropertyKey[]} path Snapshot path.
     * @returns {boolean} Whether the value is an atomic dependency.
     */
    static #isAtomicInput(_value, path) {
        const property = path.at(-1)
        return property === 'documentModel' || property === 'documentScope'
    }
}
