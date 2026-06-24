/**
 * Handles delegated diagnostic navigation interactions inside the PCB view.
 */
export class PcbDiagnosticNavigationController {
    #contentNode
    #handleClick
    #handleMouseOver
    #handleFocusIn
    #onFocus

    /**
     * @param {HTMLElement} contentNode PCB content node.
     * @param {{ onFocus?: ((diagnosticId: string) => void) | null }} [options] Navigation options.
     */
    constructor(contentNode, options = {}) {
        this.#contentNode = contentNode
        this.#onFocus =
            typeof options.onFocus === 'function' ? options.onFocus : null
        this.#handleClick = (event) => this.#handleClickEvent(event)
        this.#handleMouseOver = (event) => this.#focusFromEvent(event)
        this.#handleFocusIn = (event) => this.#focusFromEvent(event)
        this.#contentNode.addEventListener('click', this.#handleClick)
        this.#contentNode.addEventListener('mouseover', this.#handleMouseOver)
        this.#contentNode.addEventListener('focusin', this.#handleFocusIn)
    }

    /**
     * Removes event listeners.
     * @returns {void}
     */
    dispose() {
        this.#contentNode.removeEventListener('click', this.#handleClick)
        this.#contentNode.removeEventListener(
            'mouseover',
            this.#handleMouseOver
        )
        this.#contentNode.removeEventListener('focusin', this.#handleFocusIn)
    }

    /**
     * Handles diagnostic copy and focus clicks.
     * @param {Event} event Click event.
     * @returns {void}
     */
    #handleClickEvent(event) {
        const copyButton = PcbDiagnosticNavigationController.#closest(
            event.target,
            '[data-pcb-diagnostic-copy]'
        )
        if (copyButton) {
            event.preventDefault?.()
            this.#copyMessage(
                copyButton.getAttribute('data-pcb-diagnostic-copy')
            )
            return
        }

        this.#focusFromEvent(event, true)
    }

    /**
     * Focuses the marker referenced by a navigation event target.
     * @param {Event} event Delegated event.
     * @param {boolean} [notify] Whether listeners should be notified.
     * @returns {void}
     */
    #focusFromEvent(event, notify = false) {
        const button = PcbDiagnosticNavigationController.#closest(
            event.target,
            '[data-pcb-diagnostic-focus]'
        )
        if (!button) return

        const id = button.getAttribute('data-pcb-diagnostic-focus')
        this.#setFocusedId(id)
        if (notify) this.#emitFocus(id)
    }

    /**
     * Applies focused classes to the matching marker and navigation row.
     * @param {string | null} id Diagnostic id.
     * @returns {void}
     */
    #setFocusedId(id) {
        const focusedId = String(id || '').trim()
        for (const node of this.#queryAll('[data-pcb-diagnostic-focus]')) {
            const active =
                node.getAttribute('data-pcb-diagnostic-focus') === focusedId
            PcbDiagnosticNavigationController.#toggleClass(
                node,
                'is-focused',
                active
            )
        }
        for (const node of this.#queryAll('[data-pcb-diagnostic-id]')) {
            const active =
                node.getAttribute('data-pcb-diagnostic-id') === focusedId
            PcbDiagnosticNavigationController.#toggleClass(
                node,
                'is-focused',
                active
            )
        }
    }

    /**
     * Copies one diagnostic message when the Clipboard API is available.
     * @param {string | null} message Diagnostic message.
     * @returns {void}
     */
    #copyMessage(message) {
        const text = String(message || '')
        if (!text) return

        globalThis.navigator?.clipboard?.writeText?.(text)
    }

    /**
     * Notifies the configured focus callback.
     * @param {string | null} id Diagnostic id.
     * @returns {void}
     */
    #emitFocus(id) {
        const focusedId = String(id || '').trim()
        if (!focusedId || !this.#onFocus) return
        this.#onFocus(focusedId)
    }

    /**
     * Queries all matching nodes from the content node.
     * @param {string} selector CSS selector.
     * @returns {Element[]}
     */
    #queryAll(selector) {
        return Array.from(this.#contentNode.querySelectorAll?.(selector) || [])
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

    /**
     * Toggles one class token when classList is available.
     * @param {Element} node Target node.
     * @param {string} className Class token.
     * @param {boolean} active Whether the class should be present.
     * @returns {void}
     */
    static #toggleClass(node, className, active) {
        if (active) {
            node.classList?.add(className)
            return
        }
        node.classList?.remove(className)
    }
}
