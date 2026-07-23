/**
 * Applies lightweight DOM updates for PCB net hover feedback.
 */
export class PcbHoveredNetHighlighter {
    /** @type {WeakMap<SVGSVGElement | HTMLElement, { activeNetName: string, nodesByNetName: Map<string, Element[]> }>} */
    static #svgStates = new WeakMap()

    /**
     * Updates only the previous and current net primitives in the mounted SVG.
     * @param {HTMLElement} contentNode PCB view mount node.
     * @param {string} selectedNetName Persistently selected net name.
     * @param {string} hoveredNetName Transient hovered net name.
     * @returns {boolean} Whether the mounted SVG supported the update.
     */
    static update(contentNode, selectedNetName, hoveredNetName) {
        const svgNode = contentNode.querySelector('.pcb-svg')
        if (!svgNode || typeof svgNode.querySelectorAll !== 'function') {
            return false
        }

        const activeNetName = selectedNetName || hoveredNetName
        const state = PcbHoveredNetHighlighter.#stateFor(svgNode)
        if (activeNetName === state.activeNetName) {
            return true
        }

        PcbHoveredNetHighlighter.#setHighlighted(
            state.nodesByNetName.get(state.activeNetName),
            false
        )
        PcbHoveredNetHighlighter.#setHighlighted(
            state.nodesByNetName.get(activeNetName),
            true
        )
        state.activeNetName = activeNetName
        contentNode
            .querySelector('.pcb-view')
            ?.setAttribute?.('data-pcb-hover-net-name', hoveredNetName)
        return true
    }

    /**
     * Builds or returns the per-SVG primitive index and active highlight state.
     * @param {SVGSVGElement | HTMLElement} svgNode Mounted PCB SVG.
     * @returns {{ activeNetName: string, nodesByNetName: Map<string, Element[]> }} Indexed state.
     */
    static #stateFor(svgNode) {
        const existing = PcbHoveredNetHighlighter.#svgStates.get(svgNode)
        if (existing) return existing

        const nodesByNetName = new Map()
        svgNode.querySelectorAll('[data-pcb-net-name]').forEach((node) => {
            const netName = String(
                node.getAttribute?.('data-pcb-net-name') || ''
            ).trim()
            if (!netName) return

            const nodes = nodesByNetName.get(netName) || []
            nodes.push(node)
            nodesByNetName.set(netName, nodes)
        })
        const state = { activeNetName: '', nodesByNetName }
        PcbHoveredNetHighlighter.#svgStates.set(svgNode, state)
        return state
    }

    /**
     * Toggles the static highlight class for one net's primitives.
     * @param {Element[] | undefined} nodes Net primitives.
     * @param {boolean} highlighted Whether the net is active.
     * @returns {void}
     */
    static #setHighlighted(nodes, highlighted) {
        nodes?.forEach((node) => {
            if (highlighted) {
                node.classList?.add('pcb-net-highlight')
                return
            }
            node.classList?.remove('pcb-net-highlight')
        })
    }
}
