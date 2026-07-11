import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { SvgViewBoxParser } from './SvgViewBoxParser.mjs'

/**
 * Converts rendered PCB SVG coordinates into document hit-test coordinates.
 */
export class PcbHitTestPointResolver {
    /**
     * Converts one SVG point to the coordinate frame expected by PCB hit tests.
     * @param {object} documentModel PCB document model.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {{ x: number, y: number }} point SVG root coordinate.
     * @param {'top' | 'bottom'} side Active PCB side.
     * @returns {{ x: number, y: number }}
     */
    static resolve(documentModel, svgNode, point, side = 'top') {
        if (EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return point
        }

        const sourceFormat =
            EcadFormatRegistry.sourceFormatForDocument(documentModel)
        if (sourceFormat === 'gerber') {
            return PcbHitTestPointResolver.#resolveGerberPoint(
                documentModel,
                svgNode,
                point,
                side
            )
        }

        if (sourceFormat === 'altium' && side === 'bottom') {
            return PcbHitTestPointResolver.#resolveAltiumBottomPoint(
                documentModel,
                svgNode,
                point
            )
        }

        return point
    }

    /**
     * Converts mirrored Gerber SVG coordinates to fabrication coordinates.
     * @param {object} documentModel PCB document model.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {{ x: number, y: number }} point SVG root coordinate.
     * @param {'top' | 'bottom'} side Active PCB side.
     * @returns {{ x: number, y: number }}
     */
    static #resolveGerberPoint(documentModel, svgNode, point, side) {
        const viewBox = SvgViewBoxParser.parse(
            svgNode.getAttribute?.('viewBox')
        )
        const bounds = viewBox || documentModel?.pcb?.bounds || {}
        const minY = Number(bounds.minY)
        const minX = Number(bounds.minX)
        const maxX = Number(
            viewBox ? viewBox.minX + viewBox.width : bounds.maxX
        )
        const maxY = Number(
            viewBox ? viewBox.minY + viewBox.height : bounds.maxY
        )
        if (!Number.isFinite(minY) || !Number.isFinite(maxY)) {
            return point
        }

        const x =
            side === 'bottom' && Number.isFinite(minX) && Number.isFinite(maxX)
                ? minX + maxX - point.x
                : point.x

        return { x, y: minY + maxY - point.y }
    }

    /**
     * Converts bottom-side Altium render coordinates to source board space.
     * @param {object} documentModel PCB document model.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @param {{ x: number, y: number }} point SVG root coordinate.
     * @returns {{ x: number, y: number }}
     */
    static #resolveAltiumBottomPoint(documentModel, svgNode, point) {
        const mirrorXSum =
            PcbHitTestPointResolver.#resolveAltiumBottomMirrorXSum(
                documentModel,
                svgNode
            )
        if (!Number.isFinite(mirrorXSum)) {
            return point
        }

        return { x: mirrorXSum - point.x, y: point.y }
    }

    /**
     * Resolves the X-axis mirror sum used by the Altium bottom renderer.
     * @param {object} documentModel PCB document model.
     * @param {SVGSVGElement | HTMLElement} svgNode SVG node.
     * @returns {number}
     */
    static #resolveAltiumBottomMirrorXSum(documentModel, svgNode) {
        const outline = documentModel?.pcb?.boardOutline || {}
        const minX = PcbHitTestPointResolver.#finiteNumber(outline.minX)
        const maxX =
            PcbHitTestPointResolver.#finiteNumber(outline.maxX) ??
            PcbHitTestPointResolver.#maxFromMinAndWidth(
                minX,
                outline.widthMil ?? outline.width
            )
        if (minX !== null && maxX !== null) {
            return minX + maxX
        }

        const bounds = documentModel?.pcb?.bounds || {}
        const boundsMinX = PcbHitTestPointResolver.#finiteNumber(bounds.minX)
        const boundsMaxX =
            PcbHitTestPointResolver.#finiteNumber(bounds.maxX) ??
            PcbHitTestPointResolver.#maxFromMinAndWidth(
                boundsMinX,
                bounds.width
            )
        if (boundsMinX !== null && boundsMaxX !== null) {
            return boundsMinX + boundsMaxX
        }

        const viewBox = SvgViewBoxParser.parse(
            svgNode.getAttribute?.('viewBox')
        )
        if (!viewBox) return NaN

        return viewBox.minX + viewBox.minX + viewBox.width
    }

    /**
     * Resolves a finite maximum coordinate from a minimum and width.
     * @param {number | null} min Minimum coordinate.
     * @param {unknown} width Width candidate.
     * @returns {number | null}
     */
    static #maxFromMinAndWidth(min, width) {
        const normalizedWidth = PcbHitTestPointResolver.#finiteNumber(width)
        if (min === null || normalizedWidth === null) return null

        return min + normalizedWidth
    }

    /**
     * Normalizes one value to a finite number.
     * @param {unknown} value Numeric candidate.
     * @returns {number | null}
     */
    static #finiteNumber(value) {
        const number = Number(value)
        return Number.isFinite(number) ? number : null
    }
}
