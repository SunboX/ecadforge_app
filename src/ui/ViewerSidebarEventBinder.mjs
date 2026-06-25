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
        mount?.addEventListener('pcb-layer-visibility-change', (event) => {
            if (!event?.detail || typeof event.detail !== 'object') return

            callback({
                documentId: String(event.detail.documentId || ''),
                layerKey: String(event.detail.layerKey || ''),
                visible: event.detail.visible !== false,
                source: String(event.detail.source || '')
            })
        })
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
     * Binds PCB object visibility changes from rendered view controls.
     * @param {HTMLElement | null} mount Sidebar or content mount node.
     * @param {(change: { documentId: string, objectKey: string, visible: boolean, source?: string }) => void} callback Visibility callback.
     * @returns {void}
     */
    static bindPcbObjectVisibilityChange(mount, callback) {
        mount?.addEventListener('pcb-object-visibility-change', (event) => {
            if (!event?.detail || typeof event.detail !== 'object') return

            callback({
                documentId: String(event.detail.documentId || ''),
                objectKey: String(event.detail.objectKey || ''),
                visible: event.detail.visible !== false,
                source: String(event.detail.source || '')
            })
        })
    }

    /**
     * Binds PCB component selections.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, componentKey: string }) => void} callback Selection callback.
     * @returns {void}
     */
    static bindPcbComponentSelectionChange(mount, callback) {
        mount?.addEventListener('click', (event) => {
            if (
                ViewerSidebarEventBinder.#closest(
                    event.target,
                    '[data-selected-part-export-format]'
                )
            ) {
                return
            }

            const button = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-pcb-component-key]'
            )
            if (!button || typeof button.getAttribute !== 'function') return

            event.preventDefault?.()
            callback({
                documentId: button.getAttribute('data-document-id') || '',
                componentKey:
                    button.getAttribute('data-pcb-component-key') || ''
            })
        })
    }

    /**
     * Binds PCB and schematic net selections.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, netName: string }) => void} callback Selection callback.
     * @returns {void}
     */
    static bindPcbNetSelectionChange(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-pcb-net-key]',
            (button) =>
                callback({
                    documentId: button.getAttribute('data-document-id') || '',
                    netName: button.getAttribute('data-pcb-net-key') || ''
                })
        )
    }

    /**
     * Binds selected-part export button clicks.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, componentKey: string, format: string }) => void} callback Export callback.
     * @returns {void}
     */
    static bindSelectedPartExport(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-selected-part-export-format]',
            (button) =>
                callback({
                    documentId: button.getAttribute('data-document-id') || '',
                    componentKey:
                        button.getAttribute('data-pcb-component-key') || '',
                    format:
                        button.getAttribute(
                            'data-selected-part-export-format'
                        ) || ''
                })
        )
    }

    /**
     * Binds Gerber composite and source-file render selections.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, renderMode: string, layerId: string }) => void} callback Selection callback.
     * @returns {void}
     */
    static bindGerberRenderSelection(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-gerber-render-mode]',
            (button) =>
                callback({
                    documentId:
                        button.getAttribute('data-gerber-document-id') || '',
                    renderMode:
                        button.getAttribute('data-gerber-render-mode') ||
                        'composite',
                    layerId: button.getAttribute('data-gerber-layer-id') || ''
                })
        )
    }

    /**
     * Binds full-model ZIP export button clicks.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {() => void} callback Export callback.
     * @returns {void}
     */
    static bindScene3dModelZipExport(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-scene-3d-export="models-zip"]',
            () => callback()
        )
    }

    /**
     * Binds whole-PCB assembly export button clicks.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {(change: { documentId: string, format: string }) => void | Promise<void>} callback Export callback.
     * @returns {void}
     */
    static bindPcbAssemblyExport(mount, callback) {
        ViewerSidebarEventBinder.#bindAttribute(
            mount,
            '[data-pcb-assembly-export-format]',
            (button) =>
                callback({
                    documentId: button.getAttribute('data-document-id') || '',
                    format:
                        button.getAttribute(
                            'data-pcb-assembly-export-format'
                        ) || 'step'
                })
        )
    }

    /**
     * Binds component detail/name copy actions.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {{ writeText?: (value: string) => Promise<void> | void } | ((value: string) => Promise<void> | void) | null} [clipboardWriter] Clipboard writer override.
     * @returns {void}
     */
    static bindComponentDetailCopy(mount, clipboardWriter = null) {
        mount?.addEventListener('click', (event) => {
            const button = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-component-detail-copy]'
            )
            if (!button || typeof button.getAttribute !== 'function') return

            event.preventDefault?.()
            event.stopPropagation?.()
            event.stopImmediatePropagation?.()

            const text = button.getAttribute('data-component-copy-text') || ''
            if (!text) return
            ViewerSidebarEventBinder.#writeClipboardText(
                text,
                clipboardWriter,
                mount
            )
        })
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
     * @param {((query: string) => void) | null} [callback] Query callback.
     * @returns {void}
     */
    static bindComponentFilter(mount, callback = null) {
        mount?.addEventListener('input', (event) => {
            const input = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-component-filter]'
            )
            if (!input || typeof input.value !== 'string') return

            callback?.(input.value)
            ViewerSidebarEventBinder.applyComponentFilter(mount, input.value)
        })
    }

    /**
     * Applies the current component search query to rendered rows.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {string} rawQuery Search query.
     * @returns {void}
     */
    static applyComponentFilter(mount, rawQuery) {
        ViewerSidebarEventBinder.#applyComponentFilter(mount, rawQuery)
    }

    /**
     * Binds client-side layer filtering.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @returns {void}
     */
    static bindLayerFilter(mount) {
        mount?.addEventListener('input', (event) => {
            const input = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-layer-filter]'
            )
            if (!input || typeof input.value !== 'string') return

            ViewerSidebarEventBinder.#applyLayerFilter(mount, input.value)
        })
    }

    /**
     * Binds client-side net filtering.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @returns {void}
     */
    static bindNetFilter(mount) {
        mount?.addEventListener('input', (event) => {
            const input = ViewerSidebarEventBinder.#closest(
                event.target,
                '[data-net-filter]'
            )
            if (!input || typeof input.value !== 'string') return

            ViewerSidebarEventBinder.#applyNetFilter(mount, input.value)
        })
    }

    /**
     * Writes text through the browser clipboard API when available.
     * @param {string} text Clipboard text.
     * @param {{ writeText?: (value: string) => Promise<void> | void } | ((value: string) => Promise<void> | void) | null} clipboardWriter Clipboard writer override.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @returns {void}
     */
    static #writeClipboardText(text, clipboardWriter, mount) {
        const writer =
            clipboardWriter ||
            ViewerSidebarEventBinder.#resolveClipboardWriter()
        try {
            if (!writer) {
                ViewerSidebarEventBinder.#copyTextWithSelection(text, mount)
                return
            }

            const result =
                typeof writer === 'function'
                    ? writer(text)
                    : writer?.writeText?.(text)
            result?.catch?.(() =>
                ViewerSidebarEventBinder.#copyTextWithSelection(text, mount)
            )
        } catch (_error) {
            ViewerSidebarEventBinder.#copyTextWithSelection(text, mount)
        }
    }

    /**
     * Resolves the browser clipboard writer.
     * @returns {{ writeText?: (value: string) => Promise<void> | void } | null}
     */
    static #resolveClipboardWriter() {
        const clipboard =
            typeof navigator !== 'undefined' ? navigator.clipboard : null
        return clipboard && typeof clipboard.writeText === 'function'
            ? clipboard
            : null
    }

    /**
     * Copies text using a temporary off-screen textarea fallback.
     * @param {string} text Clipboard text.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @returns {void}
     */
    static #copyTextWithSelection(text, mount) {
        const documentRef = mount?.ownerDocument
        if (
            !documentRef?.body ||
            typeof documentRef.createElement !== 'function' ||
            typeof documentRef.execCommand !== 'function'
        ) {
            return
        }

        const textarea = documentRef.createElement('textarea')
        textarea.value = text
        textarea.setAttribute?.('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.top = '-9999px'
        textarea.style.left = '-9999px'

        try {
            documentRef.body.appendChild(textarea)
            textarea.select?.()
            documentRef.execCommand('copy')
        } catch (_error) {
        } finally {
            documentRef.body.removeChild?.(textarea)
        }
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

    /**
     * Applies the current layer search query to rendered rows.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {string} rawQuery Search query.
     * @returns {void}
     */
    static #applyLayerFilter(mount, rawQuery) {
        const query = String(rawQuery || '')
            .trim()
            .toLowerCase()
        const groups = mount?.querySelectorAll?.('[data-layer-group]') || []
        groups.forEach((group) => {
            let visibleRows = 0
            const rows = group.querySelectorAll?.('[data-layer-search]') || []
            rows.forEach((row) => {
                const searchText = String(
                    row.getAttribute?.('data-layer-search') || ''
                )
                const hidden = Boolean(query && !searchText.includes(query))
                row.toggleAttribute?.('hidden', hidden)
                if (!hidden) visibleRows += 1
            })
            group.toggleAttribute?.('hidden', visibleRows === 0)
        })
    }

    /**
     * Applies the current net search query to rendered rows.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {string} rawQuery Search query.
     * @returns {void}
     */
    static #applyNetFilter(mount, rawQuery) {
        const query = String(rawQuery || '')
            .trim()
            .toLowerCase()
        const groups = mount?.querySelectorAll?.('[data-net-group]') || []
        groups.forEach((group) => {
            let visibleRows = 0
            const rows = group.querySelectorAll?.('[data-net-search]') || []
            rows.forEach((row) => {
                const searchText = String(
                    row.getAttribute?.('data-net-search') || ''
                )
                const hidden = Boolean(query && !searchText.includes(query))
                row.toggleAttribute?.('hidden', hidden)
                if (!hidden) visibleRows += 1
            })
            group.toggleAttribute?.('hidden', visibleRows === 0)
        })
    }
}
