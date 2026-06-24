import { PcbInteractionPrimitiveModel } from '../core/PcbInteractionPrimitiveModel.mjs'
import { SvgViewBoxParser } from './SvgViewBoxParser.mjs'

/**
 * Tracks PCB measurement tool state and board-point capture.
 */
export class PcbMeasurementInteractionController {
    /** @type {object} */
    #documentModel
    /** @type {() => void} */
    #render
    /** @type {(target: unknown) => SVGSVGElement | HTMLElement | null} */
    #resolvePcbSvgNode
    /** @type {(svgNode: SVGSVGElement | HTMLElement, event: any) => ({ x: number, y: number } | null)} */
    #resolveSvgPoint
    /** @type {(svgNode: SVGSVGElement | HTMLElement, point: { x: number, y: number }) => { x: number, y: number }} */
    #resolveHitTestPoint
    /** @type {'' | 'distance' | 'bounds'} */
    #mode
    /** @type {'' | 'distance' | 'bounds'} */
    #tool
    /** @type {{ x: number, y: number } | null} */
    #start
    /** @type {{ x: number, y: number } | null} */
    #end

    /**
     * @param {{ documentModel: object, render: () => void, resolvePcbSvgNode: (target: unknown) => SVGSVGElement | HTMLElement | null, resolveSvgPoint: (svgNode: SVGSVGElement | HTMLElement, event: any) => ({ x: number, y: number } | null), resolveHitTestPoint: (svgNode: SVGSVGElement | HTMLElement, point: { x: number, y: number }) => { x: number, y: number } }} options Controller options.
     */
    constructor(options) {
        this.#documentModel = options.documentModel
        this.#render = options.render
        this.#resolvePcbSvgNode = options.resolvePcbSvgNode
        this.#resolveSvgPoint = options.resolveSvgPoint
        this.#resolveHitTestPoint = options.resolveHitTestPoint
        this.#mode = ''
        this.#tool = ''
        this.#start = null
        this.#end = null
    }

    /**
     * Returns true while the controller is capturing measurement points.
     * @returns {boolean}
     */
    isActive() {
        return Boolean(this.#mode)
    }

    /**
     * Returns the renderer-facing measurement state.
     * @returns {{ tool: string, mode: string, start: object | null, end: object | null }}
     */
    snapshot() {
        return {
            tool: this.#tool,
            mode: this.#mode,
            start: this.#start ? { ...this.#start } : null,
            end: this.#end ? { ...this.#end } : null
        }
    }

    /**
     * Handles measurement toolbar clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    handleToolSelection(event) {
        const button = PcbMeasurementInteractionController.#toolButton(event)
        if (!button || typeof button.getAttribute !== 'function') {
            return false
        }

        event.preventDefault?.()
        const tool = String(button.getAttribute('data-pcb-measure-tool') || '')
        if (tool === 'clear') {
            this.clear()
            return true
        }
        if (tool !== 'distance' && tool !== 'bounds') return true

        this.#mode = tool
        this.#tool = tool
        this.#start = null
        this.#end = null
        this.#render()
        return true
    }

    /**
     * Handles measurement copy clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    handleCopy(event) {
        const button = PcbMeasurementInteractionController.#copyButton(event)
        if (!button || typeof button.getAttribute !== 'function') {
            return false
        }

        event.preventDefault?.()
        const value = String(button.getAttribute('data-pcb-measure-copy') || '')
        if (value) {
            globalThis.navigator?.clipboard?.writeText?.(value)
        }
        return true
    }

    /**
     * Handles completed measurement copy clicks.
     * @param {Event} event Click event.
     * @returns {boolean}
     */
    handleCopy(event) {
        const button = PcbMeasurementInteractionController.#copyButton(event)
        if (!button || typeof button.getAttribute !== 'function') {
            return false
        }

        event.preventDefault?.()
        const text = String(button.getAttribute('data-pcb-measure-copy') || '')
        if (text) globalThis.navigator?.clipboard?.writeText?.(text)
        return true
    }

    /**
     * Handles a measurement board click.
     * @param {Event | { target?: unknown, clientX?: number, clientY?: number }} event Pointer event.
     * @returns {boolean}
     */
    handleBoardClick(event) {
        if (!this.#mode) return false

        const point = this.#measurementPoint(event)
        if (!point) return false

        if (!this.#start || this.#end) {
            this.#start = point
            this.#end = null
            this.#render()
            return true
        }

        this.#end = point
        this.#mode = ''
        this.#render()
        return true
    }

    /**
     * Clears the active and rendered measurement.
     * @returns {void}
     */
    clear() {
        this.#mode = ''
        this.#tool = ''
        this.#start = null
        this.#end = null
        this.#render()
    }

    /**
     * Resolves a clicked measurement tool button.
     * @param {Event} event Click event.
     * @returns {Element | null}
     */
    static #toolButton(event) {
        const target = event.target
        return target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
            ? target.closest('[data-pcb-measure-tool]')
            : null
    }

    /**
     * Resolves a clicked measurement copy button.
     * @param {Event} event Click event.
     * @returns {Element | null}
     */
    static #copyButton(event) {
        const target = event.target
        return target &&
            typeof target === 'object' &&
            typeof target.closest === 'function'
            ? target.closest('[data-pcb-measure-copy]')
            : null
    }

    /**
     * Resolves a snapped board-space measurement point.
     * @param {Event | { target?: unknown, clientX?: number, clientY?: number }} event Pointer event.
     * @returns {{ x: number, y: number } | null}
     */
    #measurementPoint(event) {
        const svgNode = this.#resolvePcbSvgNode(event.target)
        if (!svgNode) return null

        const point = this.#resolveSvgPoint(svgNode, event)
        if (!point) return null

        return PcbInteractionPrimitiveModel.resolveSnapPoint(
            this.#documentModel,
            this.#resolveHitTestPoint(svgNode, point),
            { tolerance: this.#snapTolerance(svgNode) }
        ).point
    }

    /**
     * Resolves board-space snap tolerance for the current viewport.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @returns {number}
     */
    #snapTolerance(svgNode) {
        const viewBox = SvgViewBoxParser.parse(
            svgNode.getAttribute?.('viewBox')
        )
        return viewBox
            ? Math.max(Math.min(viewBox.width, viewBox.height) / 60, 0.25)
            : 0.25
    }
}
