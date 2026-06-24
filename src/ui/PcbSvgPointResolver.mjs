import { SvgViewBoxParser } from './SvgViewBoxParser.mjs'

/**
 * Resolves browser pointer coordinates into PCB SVG document coordinates.
 */
export class PcbSvgPointResolver {
    /**
     * Resolves an SVG point from native matrix APIs or viewBox fallback math.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {Event} event Pointer event.
     * @returns {{ x: number, y: number } | null}
     */
    static resolve(svgNode, event) {
        return (
            PcbSvgPointResolver.#resolveSvgMatrixPoint(svgNode, event) ||
            PcbSvgPointResolver.#resolveViewBoxPoint(svgNode, event)
        )
    }

    /**
     * Resolves an SVG point with native matrix APIs when available.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {Event} event Pointer event.
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveSvgMatrixPoint(svgNode, event) {
        if (
            typeof svgNode.createSVGPoint !== 'function' ||
            typeof svgNode.getScreenCTM !== 'function'
        ) {
            return null
        }

        const matrix = svgNode.getScreenCTM()
        if (!matrix || typeof matrix.inverse !== 'function') {
            return null
        }

        const point = svgNode.createSVGPoint()
        point.x = Number(event.clientX) || 0
        point.y = Number(event.clientY) || 0
        const transformed = point.matrixTransform(matrix.inverse())

        return {
            x: Number(transformed.x) || 0,
            y: Number(transformed.y) || 0
        }
    }

    /**
     * Resolves an SVG point from the viewBox and client rectangle.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {Event} event Pointer event.
     * @returns {{ x: number, y: number } | null}
     */
    static #resolveViewBoxPoint(svgNode, event) {
        if (typeof svgNode.getBoundingClientRect !== 'function') {
            return null
        }

        const rect = svgNode.getBoundingClientRect()
        const viewBox = SvgViewBoxParser.parse(
            svgNode.getAttribute?.('viewBox')
        )
        if (!viewBox || !rect.width || !rect.height) {
            return null
        }

        return {
            x:
                viewBox.minX +
                ((Number(event.clientX) || 0) - rect.left) *
                    (viewBox.width / rect.width),
            y:
                viewBox.minY +
                ((Number(event.clientY) || 0) - rect.top) *
                    (viewBox.height / rect.height)
        }
    }
}
