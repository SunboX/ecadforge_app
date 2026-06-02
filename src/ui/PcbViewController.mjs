import { PcbViewRenderer } from './PcbViewRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'

/**
 * Handles board-side selection and pan/zoom wiring for the 2D PCB view.
 */
export class PcbViewController {
    /** @type {HTMLElement} */
    #contentNode

    /** @type {object} */
    #documentModel

    /** @type {'top' | 'bottom'} */
    #side

    /** @type {((key: string) => string) | null} */
    #translate

    /** @type {SchematicViewportController | null} */
    #svgViewportController

    /** @type {number} */
    #renderGeneration

    /** @type {(event: Event) => void} */
    #handleClick

    /**
     * @param {HTMLElement} contentNode PCB panel mount node.
     * @param {object} documentModel Document model.
     * @param {{ side?: 'top' | 'bottom', translate?: ((key: string) => string) | null }} [options] Initial options.
     */
    constructor(contentNode, documentModel, options = {}) {
        this.#contentNode = contentNode
        this.#documentModel = documentModel
        this.#side = PcbViewController.#normalizeSide(options.side)
        this.#translate = options.translate || null
        this.#svgViewportController = null
        this.#renderGeneration = 0
        this.#handleClick = (event) => this.#handleSideSelection(event)

        this.#contentNode.addEventListener('click', this.#handleClick)
        this.#renderSide(this.#side)
    }

    /**
     * Disposes current event and SVG viewport bindings.
     * @returns {void}
     */
    dispose() {
        this.#contentNode.removeEventListener('click', this.#handleClick)
        this.#renderGeneration += 1
        this.#disposeSvgViewportController()
    }

    /**
     * Handles Top/Bottom toolbar clicks.
     * @param {Event} event Click event.
     * @returns {void}
     */
    #handleSideSelection(event) {
        const target = event.target
        const button =
            target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
                ? target.closest('[data-pcb-view-side]')
                : null

        if (!button || typeof button.getAttribute !== 'function') {
            return
        }

        event.preventDefault?.()
        const nextSide = PcbViewController.#normalizeSide(
            button.getAttribute('data-pcb-view-side')
        )
        if (nextSide === this.#side) {
            return
        }

        this.#renderSide(nextSide)
    }

    /**
     * Replaces the PCB view with the selected board side.
     * @param {'top' | 'bottom'} side Requested side.
     * @param {{ refreshFonts?: boolean }} [options] Render options.
     * @returns {void}
     */
    #renderSide(side, options = {}) {
        this.#side = PcbViewController.#normalizeSide(side)
        const generation = this.#renderGeneration + 1
        this.#renderGeneration = generation
        this.#disposeSvgViewportController()
        this.#contentNode.innerHTML = PcbViewRenderer.render(
            this.#documentModel,
            this.#side,
            this.#translate
        )
        this.#attachSvgViewportController()

        if (options.refreshFonts !== false) {
            this.#refreshAfterFontsReady(generation)
        }
    }

    /**
     * Refreshes the current side once embedded SVG fonts are measurable.
     * @param {number} generation Render generation that scheduled the refresh.
     * @returns {void}
     */
    #refreshAfterFontsReady(generation) {
        if (!this.#hasEmbeddedPcbFonts()) {
            return
        }

        this.#waitForFontsReady()
            .then(() => {
                if (generation !== this.#renderGeneration) {
                    return
                }

                this.#renderSide(this.#side, { refreshFonts: false })
            })
            .catch(() => {})
    }

    /**
     * Waits until the browser has had a chance to register inline SVG fonts.
     * @returns {Promise<void>}
     */
    async #waitForFontsReady() {
        await Promise.resolve()
        const ready = globalThis.document?.fonts?.ready
        if (ready && typeof ready.then === 'function') {
            await ready
        }
    }

    /**
     * Checks whether the active PCB model has embedded font faces.
     * @returns {boolean}
     */
    #hasEmbeddedPcbFonts() {
        return Boolean(
            Array.isArray(this.#documentModel?.pcb?.embeddedFonts) &&
                this.#documentModel.pcb.embeddedFonts.length
        )
    }

    /**
     * Attaches pan and zoom to the active PCB SVG.
     * @returns {void}
     */
    #attachSvgViewportController() {
        const svgNode = this.#contentNode.querySelector('.pcb-svg')
        if (!PcbViewController.#isInteractiveSvg(svgNode)) {
            return
        }

        this.#svgViewportController = new SchematicViewportController(svgNode)
    }

    /**
     * Disposes the active SVG viewport controller.
     * @returns {void}
     */
    #disposeSvgViewportController() {
        this.#svgViewportController?.dispose()
        this.#svgViewportController = null
    }

    /**
     * Returns true when the queried node supports SVG viewport controls.
     * @param {unknown} node Queried node.
     * @returns {boolean}
     */
    static #isInteractiveSvg(node) {
        return Boolean(
            node &&
            typeof node === 'object' &&
            typeof node.getAttribute === 'function' &&
            typeof node.setAttribute === 'function' &&
            typeof node.getBoundingClientRect === 'function' &&
            typeof node.addEventListener === 'function' &&
            typeof node.removeEventListener === 'function'
        )
    }

    /**
     * Normalizes untrusted side input to the supported board-side names.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizeSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }
}
