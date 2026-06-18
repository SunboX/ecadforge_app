/**
 * Tracks component selection origin for sidebar auto-scroll decisions.
 */
export class AppViewComponentSelectionScrollGuard {
    /** @type {boolean} */
    #suppressNextScroll

    /** @type {{ documentId: string, componentKey: string } | null} */
    #sidebarSelection

    /**
     * Creates an empty component selection scroll guard.
     */
    constructor() {
        this.#suppressNextScroll = false
        this.#sidebarSelection = null
    }

    /**
     * Runs a sidebar-origin selection callback without allowing row auto-scroll.
     * @param {{ documentId?: string, componentKey?: string, source?: string }} change Selection event.
     * @param {((change: { documentId?: string, componentKey?: string, source?: string }) => void) | null} callback Selection callback.
     * @returns {void}
     */
    runSidebarSelection(change, callback) {
        this.#rememberSidebarSelection(change)
        this.#suppressNextScroll = true
        try {
            callback?.(change)
        } finally {
            this.#suppressNextScroll = false
        }
    }

    /**
     * Clears sidebar-origin selection memory after a rendered-view selection.
     * @returns {void}
     */
    clearSidebarSelection() {
        this.#sidebarSelection = null
    }

    /**
     * Returns whether selected component row auto-scroll should be suppressed.
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string } }} snapshot State snapshot.
     * @returns {boolean}
     */
    shouldSuppress(snapshot) {
        if (this.#suppressNextScroll) {
            return true
        }

        const sidebarSelection = this.#sidebarSelection
        if (!sidebarSelection) {
            return false
        }

        const documentId = String(snapshot?.activeDocumentId || '')
        const selectedKey = String(
            snapshot?.selectedPcbComponents?.[documentId] || ''
        ).trim()
        return (
            selectedKey !== '' &&
            selectedKey === sidebarSelection.componentKey &&
            documentId === sidebarSelection.documentId
        )
    }

    /**
     * Remembers the last component selected from the sidebar list.
     * @param {{ documentId?: string, componentKey?: string }} change Selection event.
     * @returns {void}
     */
    #rememberSidebarSelection(change) {
        const documentId = String(change?.documentId || '')
        const componentKey = String(change?.componentKey || '').trim()
        this.#sidebarSelection = componentKey
            ? { documentId, componentKey }
            : null
    }
}
