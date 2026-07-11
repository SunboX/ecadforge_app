import { EcadGerberFabrication } from '../core/ecad/EcadGerberFabrication.mjs'

/**
 * Resolves Gerber render selection state for the 2D PCB controller.
 */
export class PcbGerberRenderSelectionModel {
    /**
     * Returns true when the document carries fabrication source layers.
     * @param {object} documentModel PCB document model.
     * @returns {boolean}
     */
    static isGerberDocument(documentModel) {
        return EcadGerberFabrication.layers(documentModel).length > 0
    }

    /**
     * Resolves a safe source-layer id list for Gerber rendering.
     * @param {object} documentModel PCB document model.
     * @param {unknown} requestedLayerIds Requested layer ids.
     * @param {unknown} [fallbackLayerId] Fallback layer id.
     * @returns {string[]}
     */
    static resolveLayerIds(
        documentModel,
        requestedLayerIds,
        fallbackLayerId = ''
    ) {
        const requested = Array.isArray(requestedLayerIds)
            ? requestedLayerIds.map(String).filter(Boolean)
            : []
        const fallback = String(fallbackLayerId || '')
        if (!requested.length && fallback) {
            requested.push(fallback)
        }
        const layers = EcadGerberFabrication.layers(documentModel)
        const availableIds = new Set(
            layers.map((layer) => String(layer?.id || '')).filter(Boolean)
        )
        const selectedIds = requested.filter((id) => availableIds.has(id))
        return selectedIds.length
            ? selectedIds
            : [
                  PcbGerberRenderSelectionModel.#firstLayerId(documentModel)
              ].filter(Boolean)
    }

    /**
     * Resolves whether Gerber rendering should show the full stack or one file.
     * @param {unknown} requestedRenderMode Requested render mode.
     * @param {string[]} layerIds Resolved source-layer ids.
     * @returns {'composite' | 'separated'}
     */
    static resolveRenderMode(requestedRenderMode, layerIds) {
        return requestedRenderMode === 'separated' && layerIds.length
            ? 'separated'
            : 'composite'
    }

    /**
     * Compares two string lists by ordered value.
     * @param {string[]} left First list.
     * @param {string[]} right Second list.
     * @returns {boolean}
     */
    static sameStringList(left, right) {
        return (
            left.length === right.length &&
            left.every((value, index) => value === right[index])
        )
    }

    /**
     * Resolves the first source-layer id from a Gerber document.
     * @param {object} documentModel PCB document model.
     * @returns {string}
     */
    static #firstLayerId(documentModel) {
        const layers = EcadGerberFabrication.layers(documentModel)

        return String(layers[0]?.id || '')
    }
}
