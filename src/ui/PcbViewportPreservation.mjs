import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'

const PRESERVED_VIEWPORT_KEY = '__ecadForgePreservedPcbViewport'

/**
 * Preserves PCB pan and zoom while fitted content bounds remain compatible.
 */
export class PcbViewportPreservation {
    /**
     * Resolves the drawing-layer visibility identity that controls fitted bounds.
     * @param {object} documentModel PCB document.
     * @param {string[]} hiddenLayers Hidden layer keys.
     * @returns {string}
     */
    static boundsKey(documentModel, hiddenLayers) {
        const hidden = new Set((hiddenLayers || []).map(String))
        return PcbLayerVisibilityModel.resolveMechanicalDrawingLayerKeys(
            documentModel
        )
            .filter((layerKey) => hidden.has(layerKey))
            .sort()
            .join('|')
    }

    /**
     * Captures the active viewBox and its compatibility identity.
     * @param {object} contentNode PCB content mount.
     * @param {{ documentModel: object, side: string, selectedComponentKey: string, boundsKey: string }} context View context.
     * @returns {void}
     */
    static capture(contentNode, context) {
        const viewBox = PcbViewportPreservation.read(contentNode)
        if (!viewBox) return
        contentNode[PRESERVED_VIEWPORT_KEY] = { ...context, viewBox }
    }

    /**
     * Restores a compatible captured viewBox.
     * @param {object} contentNode PCB content mount.
     * @param {{ documentModel: object, side: string, boundsKey: string }} context Current view context.
     * @returns {{ restored: boolean, selectedComponentKey: string }}
     */
    static restore(contentNode, context) {
        const preserved = contentNode[PRESERVED_VIEWPORT_KEY]
        delete contentNode[PRESERVED_VIEWPORT_KEY]
        if (
            !preserved ||
            preserved.documentModel !== context.documentModel ||
            preserved.side !== context.side ||
            preserved.boundsKey !== context.boundsKey
        ) {
            return { restored: false, selectedComponentKey: '' }
        }
        return {
            restored: PcbViewportPreservation.apply(
                contentNode,
                preserved.viewBox
            ),
            selectedComponentKey: String(preserved.selectedComponentKey || '')
        }
    }

    /**
     * Reads the active PCB SVG viewBox.
     * @param {object} contentNode PCB content mount.
     * @returns {string}
     */
    static read(contentNode) {
        const svgNode = contentNode?.querySelector?.('.pcb-svg')
        return String(svgNode?.getAttribute?.('viewBox') || '')
    }

    /**
     * Applies a viewBox to the active PCB SVG.
     * @param {object} contentNode PCB content mount.
     * @param {string} viewBox SVG viewBox value.
     * @returns {boolean}
     */
    static apply(contentNode, viewBox) {
        const value = String(viewBox || '').trim()
        if (!value) return false
        const svgNode = contentNode?.querySelector?.('.pcb-svg')
        if (typeof svgNode?.setAttribute !== 'function') return false
        svgNode.setAttribute('viewBox', value)
        return true
    }
}
