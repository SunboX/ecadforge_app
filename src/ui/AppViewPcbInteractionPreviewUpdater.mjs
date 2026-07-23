import { ViewerSidebarInteractionInspectorRenderer } from './ViewerSidebarInteractionInspectorRenderer.mjs'

/**
 * Updates transient PCB interaction preview nodes without rebuilding the sidebar.
 */
export class AppViewPcbInteractionPreviewUpdater {
    /** @type {(key: string) => string} */
    #translate

    /** @type {WeakMap<HTMLElement, object>} */
    #states

    /**
     * @param {(key: string) => string} translate Translation lookup.
     */
    constructor(translate) {
        this.#translate = translate
        this.#states = new WeakMap()
    }

    /**
     * Updates matching component and net rows plus the compact inspector.
     * @param {HTMLElement | null} railNode Mounted sidebar rail.
     * @param {object} snapshot Current app snapshot.
     * @returns {void}
     */
    update(railNode, snapshot) {
        if (!railNode) return

        const root = railNode.querySelector('.viewer-sidebar')
        if (!root) {
            this.#states.delete(railNode)
            return
        }

        const state = this.#stateForRail(railNode, root)
        const preview =
            AppViewPcbInteractionPreviewUpdater.#validPreview(snapshot)
        state.componentElements =
            AppViewPcbInteractionPreviewUpdater.#updateRows(
                state.componentRows,
                state.componentElements,
                AppViewPcbInteractionPreviewUpdater.#componentKey(preview)
            )
        state.netElements = AppViewPcbInteractionPreviewUpdater.#updateRows(
            state.netRows,
            state.netElements,
            AppViewPcbInteractionPreviewUpdater.#netName(preview)
        )
        this.#updateInspector(state, snapshot)
    }

    /**
     * Returns the cached row index for the current sidebar root.
     * @param {HTMLElement} railNode Mounted sidebar rail.
     * @param {Element} root Current sidebar root.
     * @returns {object}
     */
    #stateForRail(railNode, root) {
        const current = this.#states.get(railNode)
        if (current?.root === root) return current

        const componentRows = AppViewPcbInteractionPreviewUpdater.#indexRows(
            railNode,
            '[data-pcb-component-key]',
            'data-pcb-component-key'
        )
        const netRows = AppViewPcbInteractionPreviewUpdater.#indexRows(
            railNode,
            '[data-pcb-net-key]',
            'data-pcb-net-key'
        )
        const state = {
            root,
            panel: railNode.querySelector('.viewer-sidebar__panel'),
            componentRows,
            netRows,
            componentElements:
                AppViewPcbInteractionPreviewUpdater.#previewElements(
                    componentRows
                ),
            netElements:
                AppViewPcbInteractionPreviewUpdater.#previewElements(netRows),
            inspectorMarkup: null
        }
        this.#states.set(railNode, state)
        return state
    }

    /**
     * Replaces the small interaction inspector when its markup changes.
     * @param {object} state Cached rail state.
     * @param {object} snapshot Current app snapshot.
     * @returns {void}
     */
    #updateInspector(state, snapshot) {
        const markup = ViewerSidebarInteractionInspectorRenderer.render(
            snapshot,
            this.#translate
        )
        if (markup === state.inspectorMarkup) return

        state.panel?.querySelector('[data-pcb-interaction-inspector]')?.remove()
        if (markup) {
            state.panel?.insertAdjacentHTML('beforeend', markup)
        }
        state.inspectorMarkup = markup
    }

    /**
     * Builds a key-to-row-elements index once per mounted sidebar root.
     * @param {HTMLElement} railNode Mounted sidebar rail.
     * @param {string} selector Row selector.
     * @param {string} attributeName Row key attribute.
     * @returns {Map<string, Element[]>}
     */
    static #indexRows(railNode, selector, attributeName) {
        const rows = new Map()
        railNode.querySelectorAll(selector).forEach((button) => {
            const key = String(button.getAttribute(attributeName) || '').trim()
            if (!key) return
            const elements = [button]
            const shell = button.closest('.viewer-sidebar__component-row-shell')
            if (shell) elements.push(shell)
            rows.set(key, [...(rows.get(key) || []), ...elements])
        })
        return rows
    }

    /**
     * Returns row elements already carrying the preview class.
     * @param {Map<string, Element[]>} rows Indexed row elements.
     * @returns {Set<Element>}
     */
    static #previewElements(rows) {
        return new Set(
            [...rows.values()]
                .flat()
                .filter((element) => element.classList.contains('is-preview'))
        )
    }

    /**
     * Moves the preview class from old row elements to one indexed key.
     * @param {Map<string, Element[]>} rows Indexed row elements.
     * @param {Set<Element>} previousElements Previously previewed elements.
     * @param {string} key Current preview key.
     * @returns {Set<Element>}
     */
    static #updateRows(rows, previousElements, key) {
        previousElements.forEach((element) =>
            element.classList.remove('is-preview')
        )
        const nextElements = new Set(rows.get(key) || [])
        nextElements.forEach((element) => element.classList.add('is-preview'))
        return nextElements
    }

    /**
     * Returns a preview only when it belongs to the active document.
     * @param {object} snapshot Current app snapshot.
     * @returns {object | null}
     */
    static #validPreview(snapshot) {
        const preview = snapshot?.pcbInteractionPreview
        const candidates = Array.isArray(preview?.candidates)
            ? preview.candidates
            : []
        return preview &&
            candidates.length &&
            String(preview.documentId || '') ===
                String(snapshot?.activeDocumentId || '')
            ? preview
            : null
    }

    /**
     * Resolves the previewed component key.
     * @param {object | null} preview PCB interaction preview.
     * @returns {string}
     */
    static #componentKey(preview) {
        const selected = String(
            preview?.selectedCandidate?.componentKey || ''
        ).trim()
        if (selected) return selected
        const candidate = (preview?.candidates || []).find((row) =>
            String(row?.componentKey || '').trim()
        )
        return String(candidate?.componentKey || '').trim()
    }

    /**
     * Resolves the previewed net name.
     * @param {object | null} preview PCB interaction preview.
     * @returns {string}
     */
    static #netName(preview) {
        const selected = AppViewPcbInteractionPreviewUpdater.#candidateNetName(
            preview?.selectedCandidate
        )
        if (selected) return selected
        const candidate = (preview?.candidates || []).find((row) =>
            AppViewPcbInteractionPreviewUpdater.#candidateNetName(row)
        )
        return AppViewPcbInteractionPreviewUpdater.#candidateNetName(candidate)
    }

    /**
     * Resolves one candidate net name.
     * @param {object | null | undefined} candidate Interaction candidate.
     * @returns {string}
     */
    static #candidateNetName(candidate) {
        return String(
            candidate?.netName ?? candidate?.net ?? candidate?.net_name ?? ''
        ).trim()
    }
}
