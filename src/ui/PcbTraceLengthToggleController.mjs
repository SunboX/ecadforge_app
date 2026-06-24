/**
 * Handles trace-length overlay visibility for PCB view chrome.
 */
export class PcbTraceLengthToggleController {
    #render
    #visible

    /**
     * @param {{ render: () => void, visible?: boolean }} options Controller options.
     */
    constructor(options) {
        this.#render = options.render
        this.#visible = Boolean(options.visible)
    }

    /**
     * Returns whether trace-length overlays are currently visible.
     * @returns {boolean}
     */
    get visible() {
        return this.#visible
    }

    /**
     * Handles delegated trace-length toggle clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    handleClick(event) {
        const button = PcbTraceLengthToggleController.#button(event)
        if (!button) return false

        event.preventDefault?.()
        this.#visible = !this.#visible
        this.#render()
        return true
    }

    /**
     * Resolves a trace-length button from an event target.
     * @param {Event} event Click event.
     * @returns {Element | null}
     */
    static #button(event) {
        const target = event.target
        return target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
            ? target.closest('[data-pcb-trace-length-toggle]')
            : null
    }
}
