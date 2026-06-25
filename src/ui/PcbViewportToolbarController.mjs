/**
 * Handles PCB viewport toolbar actions that affect camera state.
 */
export class PcbViewportToolbarController {
    #contentNode
    #documentId
    #hoverFocusEnabled
    #lastHoverKey
    #resetView
    #render

    /**
     * @param {{ contentNode?: HTMLElement, documentId?: string, hoverFocusEnabled?: boolean, resetView?: (() => void) | null, render?: (() => void) | null }} [options] Toolbar options.
     */
    constructor(options = {}) {
        this.#contentNode = options.contentNode || null
        this.#documentId = String(options.documentId || '')
        this.#hoverFocusEnabled = options.hoverFocusEnabled === true
        this.#lastHoverKey = ''
        this.#resetView =
            typeof options.resetView === 'function' ? options.resetView : null
        this.#render = typeof options.render === 'function' ? options.render : null
    }

    /**
     * Returns whether hover focus is enabled.
     * @returns {boolean}
     */
    get hoverFocusEnabled() {
        return this.#hoverFocusEnabled
    }

    /**
     * Handles delegated viewport toolbar clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    handleClick(event) {
        if (PcbViewportToolbarController.#closest(event.target, '[data-pcb-view-reset]')) {
            PcbViewportToolbarController.#consumeEvent(event)
            this.#resetView?.()
            return true
        }

        if (PcbViewportToolbarController.#closest(event.target, '[data-pcb-hover-focus-toggle]')) {
            PcbViewportToolbarController.#consumeEvent(event)
            this.#hoverFocusEnabled = !this.#hoverFocusEnabled
            this.#lastHoverKey = ''
            this.#render?.()
            return true
        }

        const settingButton = PcbViewportToolbarController.#closest(
            event.target,
            '[data-pcb-view-setting]'
        )
        if (settingButton) {
            PcbViewportToolbarController.#consumeEvent(event)
            this.#emitObjectVisibilityChange(settingButton)
            return true
        }

        return false
    }

    /**
     * Emits an object visibility change from a view setting button.
     * @param {Element} button Setting button.
     * @returns {void}
     */
    #emitObjectVisibilityChange(button) {
        const objectKey = String(
            button.getAttribute?.('data-pcb-view-setting') || ''
        )
        const visible =
            button.getAttribute?.('data-pcb-view-setting-visible') !== 'true'
        const detail = {
            documentId: this.#documentId,
            objectKey,
            visible,
            source: 'pcb-view-settings'
        }

        if (
            typeof this.#contentNode?.dispatchEvent === 'function' &&
            typeof CustomEvent === 'function'
        ) {
            this.#contentNode.dispatchEvent(
                new CustomEvent('pcb-object-visibility-change', {
                    bubbles: true,
                    detail
                })
            )
            return
        }

        this.#contentNode?.dispatch?.('pcb-object-visibility-change', {
            detail
        })
    }

    /**
     * Focuses the viewport around a hovered candidate when enabled.
     * @param {{ focusBounds?: (bounds: object, options?: object) => boolean } | null} viewportController Viewport controller.
     * @param {object | null} candidate Hover candidate.
     * @returns {void}
     */
    focusHoverCandidate(viewportController, candidate) {
        if (!this.#hoverFocusEnabled || !candidate) return

        const key = PcbViewportToolbarController.#candidateKey(candidate)
        if (key && key === this.#lastHoverKey) return

        const bounds = PcbViewportToolbarController.#candidateBounds(candidate)
        if (!bounds) return

        this.#lastHoverKey = key
        viewportController?.focusBounds?.(bounds, { paddingFactor: 4 })
    }

    /**
     * Resolves stable hover identity for one candidate.
     * @param {object} candidate Hover candidate.
     * @returns {string}
     */
    static #candidateKey(candidate) {
        return [
            candidate.kind || candidate.role || '',
            candidate.componentKey || candidate.componentId || '',
            candidate.netName || candidate.net || '',
            candidate.layer || candidate.layerKey || ''
        ]
            .map(String)
            .join('|')
    }

    /**
     * Resolves viewport bounds for one hover candidate.
     * @param {object} candidate Hover candidate.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static #candidateBounds(candidate) {
        return (
            PcbViewportToolbarController.#bounds(candidate?.source?.bounds) ||
            PcbViewportToolbarController.#bounds(candidate?.bounds) ||
            PcbViewportToolbarController.#pointBounds(candidate?.source) ||
            PcbViewportToolbarController.#pointBounds(candidate)
        )
    }

    /**
     * Converts min/max bounds to viewport bounds.
     * @param {object | null | undefined} bounds Bounds candidate.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static #bounds(bounds) {
        const minX = Number(bounds?.minX ?? bounds?.x)
        const minY = Number(bounds?.minY ?? bounds?.y)
        const width = Number(bounds?.width)
        const height = Number(bounds?.height)
        const maxX = Number(bounds?.maxX ?? minX + width)
        const maxY = Number(bounds?.maxY ?? minY + height)
        if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null

        return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
    }

    /**
     * Builds zero-area bounds around point-like candidates.
     * @param {object | null | undefined} value Point candidate.
     * @returns {{ x: number, y: number, width: number, height: number } | null}
     */
    static #pointBounds(value) {
        const x = Number(value?.x ?? value?.center?.x)
        const y = Number(value?.y ?? value?.center?.y)
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null
        return { x, y, width: 0, height: 0 }
    }

    /**
     * Resolves the nearest matching ancestor for a delegated target.
     * @param {unknown} target Event target.
     * @param {string} selector CSS selector.
     * @returns {Element | null}
     */
    static #closest(target, selector) {
        return target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
            ? target.closest(selector)
            : null
    }

    /**
     * Consumes toolbar clicks before board selection handlers.
     * @param {Event} event Click event.
     * @returns {void}
     */
    static #consumeEvent(event) {
        event.preventDefault?.()
        event.stopPropagation?.()
        event.stopImmediatePropagation?.()
    }
}
