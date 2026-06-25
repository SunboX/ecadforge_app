/**
 * Provides reusable SVG client-rectangle guards for pointer events.
 */
export class SvgClientBoundsGuard {
    /**
     * Returns true when a queried node supports SVG viewport controls.
     * @param {unknown} node Queried node.
     * @returns {boolean}
     */
    static isInteractiveSvg(node) {
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
     * Returns whether an event with finite client coordinates falls outside the SVG rect.
     * @param {SVGSVGElement | HTMLElement | null} svgNode SVG node.
     * @param {Event | { clientX?: unknown, clientY?: unknown }} event Pointer event.
     * @returns {boolean}
     */
    static isOutside(svgNode, event) {
        if (typeof svgNode?.getBoundingClientRect !== 'function') {
            return false
        }

        const rect = svgNode.getBoundingClientRect()
        const clientX = Number(event?.clientX)
        const clientY = Number(event?.clientY)
        if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
            return false
        }

        return (
            clientX < rect.left ||
            clientX > rect.left + rect.width ||
            clientY < rect.top ||
            clientY > rect.top + rect.height
        )
    }
}
