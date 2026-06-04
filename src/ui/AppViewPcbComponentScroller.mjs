/**
 * Keeps selected PCB footprint rows visible in the viewer sidebar.
 */
export class AppViewPcbComponentScroller {
    /**
     * Scrolls the selected PCB component row into view in the footprints panel.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @param {{ activeSidebarTab?: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string } }} snapshot
     * @returns {void}
     */
    static scrollSelectedIntoView(railNode, snapshot) {
        if (snapshot?.activeSidebarTab !== 'components') return

        const documentId = String(snapshot?.activeDocumentId || '')
        const selectedKey = String(
            snapshot?.selectedPcbComponents?.[documentId] || ''
        )
        if (!selectedKey) return

        const row = AppViewPcbComponentScroller.#findComponentRow(
            railNode,
            selectedKey
        )
        if (typeof row?.scrollIntoView !== 'function') return

        row.scrollIntoView({
            block: 'nearest',
            inline: 'nearest'
        })
    }

    /**
     * Finds one PCB component sidebar row by key without CSS escaping concerns.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @param {string} componentKey Selected component key.
     * @returns {Element | null}
     */
    static #findComponentRow(railNode, componentKey) {
        const rows = railNode?.querySelectorAll('[data-pcb-component-key]')
        for (const row of rows || []) {
            if (row.getAttribute('data-pcb-component-key') === componentKey) {
                return row
            }
        }

        return null
    }
}
