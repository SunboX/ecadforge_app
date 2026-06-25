/**
 * Coordinates reusable click-to-interact viewport shields.
 */
export class ViewportInteractionGateController {
    #contentNode
    #enabled
    #windowNode
    #unlocked
    #handleClick
    #handleKeyDown
    #handleWindowBlur

    /**
     * @param {HTMLElement} contentNode Viewport content host.
     * @param {{ enabled?: boolean }} [options] Gate options.
     */
    constructor(contentNode, options = {}) {
        this.#contentNode = contentNode
        this.#enabled = options.enabled === true
        this.#windowNode =
            contentNode?.ownerDocument?.defaultView || globalThis || null
        this.#unlocked = false
        this.#handleClick = (event) => this.#handleClickEvent(event)
        this.#handleKeyDown = (event) => this.#handleKeyDownEvent(event)
        this.#handleWindowBlur = () => this.lock()
        this.#contentNode?.addEventListener?.('click', this.#handleClick)
        this.#contentNode?.addEventListener?.('keydown', this.#handleKeyDown)
        this.#windowNode?.addEventListener?.('blur', this.#handleWindowBlur)
        this.sync()
    }

    /**
     * Removes gate listeners.
     * @returns {void}
     */
    dispose() {
        this.#contentNode?.removeEventListener?.('click', this.#handleClick)
        this.#contentNode?.removeEventListener?.(
            'keydown',
            this.#handleKeyDown
        )
        this.#windowNode?.removeEventListener?.('blur', this.#handleWindowBlur)
    }

    /**
     * Locks all currently rendered viewport gates.
     * @returns {void}
     */
    lock() {
        this.#unlocked = false
        this.sync()
    }

    /**
     * Unlocks all currently rendered viewport gates.
     * @returns {void}
     */
    unlock() {
        this.#unlocked = true
        this.sync()
    }

    /**
     * Mirrors the current lock state onto rendered gate nodes.
     * @returns {void}
     */
    sync() {
        for (const gate of this.#gateNodes()) {
            if (!this.#enabled || this.#unlocked) {
                gate.setAttribute?.('hidden', 'hidden')
                continue
            }
            gate.removeAttribute?.('hidden')
        }
    }

    /**
     * Handles delegated unlock clicks.
     * @param {Event} event Click event.
     * @returns {void}
     */
    #handleClickEvent(event) {
        const button = ViewportInteractionGateController.#closest(
            event.target,
            '[data-viewport-interaction-unlock]'
        )
        if (!button) return

        event.preventDefault?.()
        event.stopPropagation?.()
        event.stopImmediatePropagation?.()
        this.unlock()
    }

    /**
     * Re-arms the viewport shield when Escape is pressed.
     * @param {KeyboardEvent} event Key event.
     * @returns {void}
     */
    #handleKeyDownEvent(event) {
        if (event.key !== 'Escape') return

        this.lock()
    }

    /**
     * Queries currently rendered gate nodes.
     * @returns {Element[]}
     */
    #gateNodes() {
        return Array.from(
            this.#contentNode?.querySelectorAll?.(
                '[data-viewport-interaction-gate]'
            ) || []
        )
    }

    /**
     * Resolves the nearest matching ancestor for a delegated event target.
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
}
