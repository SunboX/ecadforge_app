import { ViewerSidebarEventBinder } from './ViewerSidebarEventBinder.mjs'

/**
 * Preserves transient sidebar filter input state across AppView re-renders.
 */
export class AppViewSidebarFilterState {
    /** @type {Map<string, string>} */
    #componentQueries

    constructor() {
        this.#componentQueries = new Map()
    }

    /**
     * Binds component filtering while remembering the latest document query.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {() => { activeDocumentId?: string } | null | undefined} getSnapshot Snapshot provider.
     * @returns {void}
     */
    bindComponentFilter(mount, getSnapshot) {
        ViewerSidebarEventBinder.bindComponentFilter(mount, (query) => {
            this.#rememberComponentQuery(getSnapshot?.(), query)
        })
    }

    /**
     * Restores the component search input and row visibility for one render.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {{ activeDocumentId?: string } | null | undefined} snapshot Render snapshot.
     * @returns {void}
     */
    restoreComponentFilter(mount, snapshot) {
        const input = mount?.querySelector?.('[data-component-filter]')
        if (!input || typeof input.value !== 'string') return

        const query = this.#componentQueries.get(
            AppViewSidebarFilterState.#documentKey(snapshot)
        )
        input.value = query || ''
        ViewerSidebarEventBinder.applyComponentFilter(mount, query || '')
    }

    /**
     * Remembers or clears one document-scoped component query.
     * @param {{ activeDocumentId?: string } | null | undefined} snapshot Active snapshot.
     * @param {string} rawQuery Search query.
     * @returns {void}
     */
    #rememberComponentQuery(snapshot, rawQuery) {
        const documentKey = AppViewSidebarFilterState.#documentKey(snapshot)
        if (!documentKey) return

        const query = String(rawQuery || '')
        if (query) {
            this.#componentQueries.set(documentKey, query)
            return
        }

        this.#componentQueries.delete(documentKey)
    }

    /**
     * Resolves the state key used for document-scoped filter state.
     * @param {{ activeDocumentId?: string } | null | undefined} snapshot Active snapshot.
     * @returns {string}
     */
    static #documentKey(snapshot) {
        return String(snapshot?.activeDocumentId || '')
    }
}
