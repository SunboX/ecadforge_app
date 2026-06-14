/**
 * Captures and restores viewer sidebar scroll position across rerenders.
 */
export class AppViewSidebarScrollState {
    /**
     * Captures scroll state for the active sidebar panel before a re-render.
     * @param {HTMLElement | null} sidebarMount Sidebar mount node.
     * @returns {{ activeTab: string, activeDocumentId: string, scrollTop: number, scrollLeft: number } | null}
     */
    static capture(sidebarMount) {
        const sidebar = sidebarMount?.querySelector?.('.viewer-sidebar')
        const panel = sidebarMount?.querySelector?.('.viewer-sidebar__panel')
        if (!sidebar || !panel) {
            return null
        }

        return {
            activeTab: sidebar.getAttribute('data-active-sidebar-tab') || '',
            activeDocumentId:
                sidebar.getAttribute('data-active-document-id') || '',
            scrollTop: Number(panel.scrollTop || 0),
            scrollLeft: Number(panel.scrollLeft || 0)
        }
    }

    /**
     * Restores sidebar panel scroll when the same panel was re-rendered.
     * @param {HTMLElement | null} sidebarMount Sidebar mount node.
     * @param {{ activeTab: string, activeDocumentId: string, scrollTop: number, scrollLeft: number } | null} scrollState Captured scroll state.
     * @returns {void}
     */
    static restore(sidebarMount, scrollState) {
        if (!scrollState) {
            return
        }

        const sidebar = sidebarMount?.querySelector?.('.viewer-sidebar')
        const panel = sidebarMount?.querySelector?.('.viewer-sidebar__panel')
        if (!sidebar || !panel) {
            return
        }

        const activeTab = sidebar.getAttribute('data-active-sidebar-tab') || ''
        const activeDocumentId =
            sidebar.getAttribute('data-active-document-id') || ''
        if (
            activeTab !== scrollState.activeTab ||
            activeDocumentId !== scrollState.activeDocumentId
        ) {
            return
        }

        panel.scrollTop = scrollState.scrollTop
        panel.scrollLeft = scrollState.scrollLeft
    }
}
