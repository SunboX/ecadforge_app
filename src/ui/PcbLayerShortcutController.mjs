import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'

/**
 * Emits PCB layer visibility changes from numeric keyboard shortcuts.
 */
export class PcbLayerShortcutController {
    #contentNode
    #documentId
    #documentModel
    #hiddenLayers
    #handleKeyDown

    /**
     * @param {HTMLElement} contentNode PCB content host.
     * @param {{ documentId?: string, documentModel?: object, hiddenLayers?: string[] }} options Shortcut options.
     */
    constructor(contentNode, options = {}) {
        this.#contentNode = contentNode
        this.#documentId = String(options.documentId || '')
        this.#documentModel = options.documentModel || null
        this.#hiddenLayers = Array.isArray(options.hiddenLayers)
            ? options.hiddenLayers.map(String)
            : []
        this.#handleKeyDown = (event) => this.#handleKeyDownEvent(event)
        this.#contentNode?.addEventListener?.('keydown', this.#handleKeyDown)
    }

    /**
     * Removes keyboard listeners.
     * @returns {void}
     */
    dispose() {
        this.#contentNode?.removeEventListener?.('keydown', this.#handleKeyDown)
    }

    /**
     * Handles one numeric shortcut.
     * @param {KeyboardEvent} event Key event.
     * @returns {void}
     */
    #handleKeyDownEvent(event) {
        if (!PcbLayerShortcutController.#isLayerShortcut(event)) return
        if (PcbLayerShortcutController.#isEditableTarget(event.target)) return

        const layer = this.#layerForKey(event.key)
        if (!layer) return

        event.preventDefault?.()
        event.stopPropagation?.()
        this.#emitLayerVisibilityChange(layer)
    }

    /**
     * Resolves a layer row for one numeric key.
     * @param {string} key Keyboard key.
     * @returns {{ key: string } | null}
     */
    #layerForKey(key) {
        const index = Number(key) - 1
        const layer = PcbLayerVisibilityModel.resolveLayers(
            this.#documentModel
        )[index]
        if (!layer) return null

        return {
            key: PcbLayerVisibilityModel.resolveLayerKey(layer, index)
        }
    }

    /**
     * Emits a layer visibility change through the content node.
     * @param {{ key: string }} layer Layer row.
     * @returns {void}
     */
    #emitLayerVisibilityChange(layer) {
        const visible = PcbLayerVisibilityModel.isLayerHidden(
            { [this.#documentId]: this.#hiddenLayers },
            this.#documentId,
            layer.key
        )
        const detail = {
            documentId: this.#documentId,
            layerKey: layer.key,
            visible,
            source: 'pcb-layer-shortcut'
        }

        if (
            typeof this.#contentNode?.dispatchEvent === 'function' &&
            typeof CustomEvent === 'function'
        ) {
            this.#contentNode.dispatchEvent(
                new CustomEvent('pcb-layer-visibility-change', {
                    bubbles: true,
                    detail
                })
            )
            return
        }

        this.#contentNode?.dispatch?.('pcb-layer-visibility-change', { detail })
    }

    /**
     * Returns true when the event is an unmodified numeric layer shortcut.
     * @param {KeyboardEvent} event Key event.
     * @returns {boolean}
     */
    static #isLayerShortcut(event) {
        return (
            /^[1-9]$/u.test(String(event.key || '')) &&
            !event.altKey &&
            !event.ctrlKey &&
            !event.metaKey
        )
    }

    /**
     * Returns true when the shortcut target is text-editable.
     * @param {unknown} target Event target.
     * @returns {boolean}
     */
    static #isEditableTarget(target) {
        if (
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function' &&
            target.closest('input, textarea, select, [contenteditable="true"]')
        ) {
            return true
        }

        return false
    }
}
