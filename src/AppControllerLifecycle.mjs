/**
 * Invalidates asynchronous controller continuations after terminal disposal.
 */
export class AppControllerLifecycle {
    #disposed = false
    #generation = 1

    /**
     * Captures the generation owned by one asynchronous controller operation.
     * @returns {number} Current lifecycle generation.
     */
    capture() {
        return this.#generation
    }

    /**
     * Reports whether an operation may still publish state.
     * @param {number} generation Captured operation generation.
     * @returns {boolean} Whether the controller remains active and current.
     */
    isCurrent(generation) {
        return !this.#disposed && generation === this.#generation
    }

    /**
     * Invalidates every captured operation exactly once.
     * @returns {void}
     */
    dispose() {
        if (this.#disposed) return
        this.#disposed = true
        this.#generation += 1
    }
}

Object.freeze(AppControllerLifecycle.prototype)
Object.freeze(AppControllerLifecycle)
