const TAP_MOVE_THRESHOLD_PX = 8

/**
 * Recognizes stationary single-touch taps without depending on synthetic
 * browser click events.
 */
export class TouchTapSelectionGuard {
    /** @type {() => string} */
    #readState
    /** @type {{ target: unknown, startClientX: number, startClientY: number, state: string, cancelled: boolean } | null} */
    #touchState

    /**
     * @param {{ readState?: () => string }} [options] Gesture state options.
     */
    constructor(options = {}) {
        this.#readState =
            typeof options.readState === 'function'
                ? options.readState
                : () => ''
        this.#touchState = null
    }

    /**
     * Starts tracking a possible tap from a one-finger touch event.
     * @param {{ target?: unknown, touches?: ArrayLike<{ clientX?: number, clientY?: number }> }} event Touch event.
     * @returns {void}
     */
    start(event) {
        const touches = TouchTapSelectionGuard.#touchPoints(event?.touches)
        if (touches.length !== 1) {
            this.reset()
            return
        }

        const [touch] = touches
        this.#touchState = {
            target: event?.target || null,
            startClientX: touch.clientX,
            startClientY: touch.clientY,
            state: this.#readState(),
            cancelled: false
        }
    }

    /**
     * Tracks movement while a possible tap is active.
     * @param {{ touches?: ArrayLike<{ clientX?: number, clientY?: number }> }} event Touch event.
     * @returns {void}
     */
    move(event) {
        if (!this.#touchState) {
            return
        }

        const touches = TouchTapSelectionGuard.#touchPoints(event?.touches)
        if (touches.length !== 1) {
            this.#touchState.cancelled = true
            return
        }

        if (this.#movedPastThreshold(touches[0])) {
            this.#touchState.cancelled = true
        }
    }

    /**
     * Resolves a completed touch as a tap when it stayed stationary.
     * @param {{ target?: unknown, touches?: ArrayLike<{ clientX?: number, clientY?: number }>, changedTouches?: ArrayLike<{ clientX?: number, clientY?: number }> }} event Touch event.
     * @returns {{ target: unknown, clientX: number, clientY: number } | null}
     */
    end(event) {
        const touchState = this.#touchState
        this.#touchState = null
        if (!touchState || touchState.cancelled) {
            return null
        }

        if (TouchTapSelectionGuard.#touchPoints(event?.touches).length) {
            return null
        }

        const touch = TouchTapSelectionGuard.#touchPoints(
            event?.changedTouches
        )[0] || {
            clientX: touchState.startClientX,
            clientY: touchState.startClientY
        }
        if (this.#movedPastThreshold(touch, touchState)) {
            return null
        }

        if (this.#readState() !== touchState.state) {
            return null
        }

        return {
            target: event?.target || touchState.target,
            clientX: touch.clientX,
            clientY: touch.clientY
        }
    }

    /**
     * Clears any active touch gesture.
     * @returns {void}
     */
    reset() {
        this.#touchState = null
    }

    /**
     * Returns whether a touch has moved beyond tap tolerance.
     * @param {{ clientX: number, clientY: number }} touch Current touch.
     * @param {{ startClientX: number, startClientY: number }} [touchState] Optional state override.
     * @returns {boolean}
     */
    #movedPastThreshold(touch, touchState = this.#touchState) {
        if (!touchState) {
            return true
        }

        return (
            Math.hypot(
                touch.clientX - touchState.startClientX,
                touch.clientY - touchState.startClientY
            ) > TAP_MOVE_THRESHOLD_PX
        )
    }

    /**
     * Converts a browser TouchList-like value into numeric client points.
     * @param {ArrayLike<{ clientX?: number, clientY?: number }> | undefined} touches Touch list.
     * @returns {{ clientX: number, clientY: number }[]}
     */
    static #touchPoints(touches) {
        return Array.from(touches || []).map((touch) => ({
            clientX: Number(touch?.clientX || 0),
            clientY: Number(touch?.clientY || 0)
        }))
    }
}
