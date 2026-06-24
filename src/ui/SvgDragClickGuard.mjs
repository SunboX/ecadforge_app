const DRAG_CLICK_DISTANCE_THRESHOLD = 3

/**
 * Suppresses synthetic SVG clicks that follow drag panning.
 */
export class SvgDragClickGuard {
    /** @type {(target: unknown) => { getAttribute?: (name: string) => string | null } | null} */
    #resolveSvgNode
    /** @type {{ clientX: number, clientY: number, viewBox: string } | null} */
    #mouseDownState
    /** @type {(event: Event) => void} */
    handleMouseDown

    /**
     * @param {(target: unknown) => { getAttribute?: (name: string) => string | null } | null} resolveSvgNode SVG resolver.
     */
    constructor(resolveSvgNode) {
        this.#resolveSvgNode =
            typeof resolveSvgNode === 'function' ? resolveSvgNode : () => null
        this.#mouseDownState = null
        this.handleMouseDown = (event) => this.#handleMouseDownEvent(event)
    }

    /**
     * Returns whether a click should be ignored because it follows drag pan.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    shouldSuppressClick(event) {
        const mouseDownState = this.#mouseDownState
        this.#mouseDownState = null
        if (!mouseDownState) {
            return false
        }

        const svgNode = this.#resolveSvgNode(event?.target)
        if (!svgNode) {
            return false
        }

        return (
            this.#hasMoved(mouseDownState, event) ||
            SvgDragClickGuard.#readViewBox(svgNode) !== mouseDownState.viewBox
        )
    }

    /**
     * Clears pending mouse-down state.
     * @returns {void}
     */
    reset() {
        this.#mouseDownState = null
    }

    /**
     * Records a primary-button SVG mouse-down as a possible click start.
     * @param {Event} event Mouse-down event.
     * @returns {void}
     */
    #handleMouseDownEvent(event) {
        if (Number(event?.button) !== 0) {
            this.reset()
            return
        }

        const svgNode = this.#resolveSvgNode(event?.target)
        if (!svgNode) {
            this.reset()
            return
        }

        this.#mouseDownState = {
            clientX: Number(event?.clientX || 0),
            clientY: Number(event?.clientY || 0),
            viewBox: SvgDragClickGuard.#readViewBox(svgNode)
        }
    }

    /**
     * Returns whether a click endpoint moved far enough to count as a drag.
     * @param {{ clientX: number, clientY: number }} mouseDownState Recorded mouse-down state.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    #hasMoved(mouseDownState, event) {
        return (
            Math.hypot(
                Number(event?.clientX || 0) - mouseDownState.clientX,
                Number(event?.clientY || 0) - mouseDownState.clientY
            ) > DRAG_CLICK_DISTANCE_THRESHOLD
        )
    }

    /**
     * Reads the current SVG viewBox.
     * @param {{ getAttribute?: (name: string) => string | null }} svgNode SVG node.
     * @returns {string}
     */
    static #readViewBox(svgNode) {
        return String(svgNode?.getAttribute?.('viewBox') || '').trim()
    }
}
