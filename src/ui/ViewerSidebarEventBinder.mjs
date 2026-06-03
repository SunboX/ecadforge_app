import { PcbObjectOpacityPreviewScheduler } from './PcbObjectOpacityPreviewScheduler.mjs'

/**
 * Owns delegated sidebar interactions for AppView.
 */
export class ViewerSidebarEventBinder {
    static #objectOpacityPreviewScheduler =
        new PcbObjectOpacityPreviewScheduler()

    /**
     * Binds document row selection.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(documentId: string) => void} callback Selection callback.
     * @returns {void}
     */
    static bindDocumentSelection(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-document-id]',
            (button) => callback(button.getAttribute('data-document-id') || '')
        )
    }

    /**
     * Binds sidebar tab selection.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(tabName: string) => void} callback Selection callback.
     * @returns {void}
     */
    static bindSidebarTabSelection(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-sidebar-tab]',
            (button) =>
                callback(button.getAttribute('data-sidebar-tab') || 'info')
        )
    }

    /**
     * Binds sidebar collapse and restore controls.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(collapsed: boolean) => void} callback Collapse callback.
     * @returns {void}
     */
    static bindSidebarCollapseToggle(mount, callback) {
        mount?.addEventListener('click', (event) => {
            const collapseButton = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-sidebar-collapse]'
            )
            const expandButton = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-sidebar-expand]'
            )
            const button = collapseButton || expandButton
            if (!button || typeof button.getAttribute !== 'function') return

            event.preventDefault?.()
            callback(Boolean(collapseButton))
        })
    }

    /**
     * Binds PCB layer visibility changes.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, layerKey: string, visible: boolean }) => void} callback Visibility callback.
     * @returns {void}
     */
    static bindPcbLayerVisibilityChange(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-pcb-layer-key]',
            (button) =>
                callback({
                    documentId: button.getAttribute('data-document-id') || '',
                    layerKey: button.getAttribute('data-pcb-layer-key') || '',
                    visible:
                        button.getAttribute('data-pcb-layer-visible') ===
                        'false'
                })
        )
    }

    /**
     * Binds PCB object opacity changes.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, objectKey: string, opacity: number, preview?: boolean }) => void} callback Opacity callback.
     * @param {{ preview?: Function } | null} [previewScheduler] Live preview scheduler.
     * @returns {void}
     */
    static bindPcbObjectOpacityChange(
        mount,
        callback,
        previewScheduler = ViewerSidebarEventBinder
            .#objectOpacityPreviewScheduler
    ) {
        const handleOpacityEvent = (event) => {
            const input = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-pcb-object-opacity-key]'
            )
            if (!input || typeof input.getAttribute !== 'function') return

            const objectKey =
                input.getAttribute('data-pcb-object-opacity-key') || ''
            const opacity = Number(input.value || 100)
            if (event.type === 'input') {
                previewScheduler?.preview?.(mount, input, objectKey, opacity)
            }

            callback({
                documentId: input.getAttribute('data-document-id') || '',
                objectKey,
                opacity,
                ...(event.type === 'input' ? { preview: true } : {})
            })
        }

        mount?.addEventListener('input', handleOpacityEvent)
        mount?.addEventListener('change', handleOpacityEvent)
    }

    /**
     * Binds PCB component selections.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, componentKey: string }) => void} callback Selection callback.
     * @returns {void}
     */
    static bindPcbComponentSelectionChange(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-pcb-component-key]',
            (button) =>
                callback({
                    documentId: button.getAttribute('data-document-id') || '',
                    componentKey:
                        button.getAttribute('data-pcb-component-key') || ''
                })
        )
    }

    /**
     * Binds PCB layer preset selection.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, preset: string }) => void} callback Preset callback.
     * @returns {void}
     */
    static bindPcbLayerPresetSelection(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-pcb-layer-preset]',
            (button) =>
                callback({
                    documentId: button.getAttribute('data-document-id') || '',
                    preset:
                        button.getAttribute('data-pcb-layer-preset') || 'all'
                })
        )
    }

    /**
     * Binds client-side component filtering.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @returns {void}
     */
    static bindComponentFilter(mount) {
        mount?.addEventListener('input', (event) => {
            const input = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-component-filter]'
            )
            if (!input || typeof input.value !== 'string') return

            ViewerSidebarEventBinder.#applyComponentFilter(mount, input.value)
        })
    }

    /**
     * Binds one delegated button-like selector.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {string} selector Delegated selector.
     * @param {(button: any) => void} callback Button callback.
     * @returns {void}
     */
    static #bindAttribute(mount, selector, callback) {
        mount?.addEventListener('click', (event) => {
            const button = ViewerSidebarEventBinder.#closest(
                event.target,
                selector
            )
            if (!button || typeof button.getAttribute !== 'function') return

            event.preventDefault?.()
            callback(button)
        })
    }

    /**
     * Resolves the closest matching element when available.
     * @param {unknown} target Event target.
     * @param {string} selector CSS selector.
     * @returns {any}
     */
    static #closest(target, selector) {
        return target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
            ? target.closest(selector)
            : null
    }

    /**
     * Applies the current component search query to rendered rows.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {string} rawQuery Search query.
     * @returns {void}
     */
    static #applyComponentFilter(mount, rawQuery) {
        const query = String(rawQuery || '')
            .trim()
            .toLowerCase()
        const groups = mount?.querySelectorAll?.('[data-component-group]') || []
        groups.forEach((group) => {
            let visibleRows = 0
            const rows =
                group.querySelectorAll?.('[data-component-search]') || []
            rows.forEach((row) => {
                const searchText = String(
                    row.getAttribute?.('data-component-search') || ''
                )
                const hidden = Boolean(query && !searchText.includes(query))
                row.toggleAttribute?.('hidden', hidden)
                if (!hidden) visibleRows += 1
            })
            group.toggleAttribute?.('hidden', visibleRows === 0)
        })
    }
}
