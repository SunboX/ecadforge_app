/**
 * Keeps selected PCB footprint, schematic symbol, and net rows visible in the viewer sidebar.
 */
export class AppViewPcbComponentScroller {
    /**
     * Scrolls the selected component row into view in the active component panel.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @param {{ activeSidebarTab?: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string } }} snapshot
     * @param {{ suppressScroll?: boolean }} [options] Scroll behavior options.
     * @returns {void}
     */
    static scrollSelectedIntoView(railNode, snapshot, options = {}) {
        AppViewPcbComponentScroller.#scrollSelectedRowIntoView(
            railNode,
            snapshot,
            options,
            'components',
            '[data-pcb-component-key]',
            'data-pcb-component-key',
            snapshot?.selectedPcbComponents
        )
    }

    /**
     * Scrolls the selected net row into view in the active Nets panel.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @param {{ activeSidebarTab?: string, activeDocumentId?: string, selectedNets?: { [documentId: string]: string } }} snapshot
     * @param {{ suppressScroll?: boolean }} [options] Scroll behavior options.
     * @returns {void}
     */
    static scrollSelectedNetIntoView(railNode, snapshot, options = {}) {
        AppViewPcbComponentScroller.#scrollSelectedRowIntoView(
            railNode,
            snapshot,
            options,
            'nets',
            '[data-pcb-net-key]',
            'data-pcb-net-key',
            snapshot?.selectedNets
        )
    }

    /**
     * Scrolls the selected BOM row into view in the active BOM panel.
     * @param {HTMLElement | null} contentNode Viewer content node.
     * @param {{ activeView?: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string } }} snapshot
     * @param {{ suppressScroll?: boolean }} [options] Scroll behavior options.
     * @returns {void}
     */
    static scrollSelectedBomRowIntoView(contentNode, snapshot, options = {}) {
        if (options?.suppressScroll) return
        if (snapshot?.activeView !== 'bom') return

        const documentId = String(snapshot?.activeDocumentId || '')
        const selectedKey = String(
            snapshot?.selectedPcbComponents?.[documentId] || ''
        )
        if (!selectedKey) return

        const row = AppViewPcbComponentScroller.#findRow(
            contentNode,
            '[data-bom-selected-component-key]',
            'data-bom-selected-component-key',
            selectedKey
        )
        if (typeof row?.scrollIntoView !== 'function') return

        row.scrollIntoView({
            block: 'center',
            inline: 'nearest'
        })
    }

    /**
     * Scrolls one selected sidebar row into view.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @param {{ activeSidebarTab?: string, activeDocumentId?: string }} snapshot State snapshot.
     * @param {{ suppressScroll?: boolean }} options Scroll behavior options.
     * @param {string} activeSidebarTab Required active sidebar tab.
     * @param {string} selector Row selector.
     * @param {string} attributeName Row key attribute.
     * @param {{ [documentId: string]: string } | undefined} selectedByDocument Selection map.
     * @returns {void}
     */
    static #scrollSelectedRowIntoView(
        railNode,
        snapshot,
        options,
        activeSidebarTab,
        selector,
        attributeName,
        selectedByDocument
    ) {
        if (options?.suppressScroll) return
        if (snapshot?.activeSidebarTab !== activeSidebarTab) return

        const documentId = String(snapshot?.activeDocumentId || '')
        const selectedKey = String(selectedByDocument?.[documentId] || '')
        if (!selectedKey) return

        const row = AppViewPcbComponentScroller.#findRow(
            railNode,
            selector,
            attributeName,
            selectedKey
        )
        if (typeof row?.scrollIntoView !== 'function') return

        row.scrollIntoView({
            block: 'center',
            inline: 'nearest'
        })
    }

    /**
     * Finds one sidebar row by key without CSS escaping concerns.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @param {string} selector Row selector.
     * @param {string} attributeName Row key attribute.
     * @param {string} selectedKey Selected key.
     * @returns {Element | null}
     */
    static #findRow(railNode, selector, attributeName, selectedKey) {
        const rows = railNode?.querySelectorAll(selector)
        for (const row of rows || []) {
            if (row.getAttribute(attributeName) === selectedKey) {
                return row
            }
        }

        return null
    }
}
