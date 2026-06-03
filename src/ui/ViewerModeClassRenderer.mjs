/**
 * Applies high-level viewer mode classes to the app body.
 */
export class ViewerModeClassRenderer {
    /**
     * Updates body classes for the active viewer state.
     * @param {HTMLElement | null | undefined} body Body element.
     * @param {{ activeView: string, documentModel: any }} snapshot App state snapshot.
     * @returns {void}
     */
    static render(body, snapshot) {
        const classList = body?.classList
        if (!classList) {
            return
        }

        const isViewerMode = Boolean(snapshot.documentModel)
        classList[isViewerMode ? 'add' : 'remove']('is-viewer-mode')
        classList.remove(
            'is-viewer-visual',
            'is-viewer-schematic',
            'is-viewer-pcb',
            'is-viewer-3d',
            'is-viewer-report'
        )

        if (!isViewerMode) {
            return
        }

        ViewerModeClassRenderer.#applyActiveViewClass(
            classList,
            String(snapshot.activeView || '')
        )
    }

    /**
     * Applies view-specific body classes.
     * @param {DOMTokenList} classList Body class list.
     * @param {string} activeView Active view id.
     * @returns {void}
     */
    static #applyActiveViewClass(classList, activeView) {
        if (
            ['schematic', 'pcb', '3d', 'bom', 'diagnostics'].includes(
                activeView
            )
        )
            classList.add('is-viewer-visual')
        if (activeView === 'schematic') classList.add('is-viewer-schematic')
        if (activeView === 'pcb') classList.add('is-viewer-pcb')
        if (activeView === '3d') classList.add('is-viewer-3d')
        if (['bom', 'diagnostics'].includes(activeView))
            classList.add('is-viewer-report')
    }
}
