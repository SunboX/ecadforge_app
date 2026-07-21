import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Reads retained Gerber source-layer data only for source-file-specific views.
 */
export class EcadGerberFabrication {
    /**
     * Returns the retained native Gerber document when available.
     * @param {unknown} documentModel Loaded document.
     * @returns {object | null} Native Gerber document.
     */
    static nativeDocument(documentModel) {
        if (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) !==
            'gerber'
        ) {
            return null
        }
        const native = documentModel?.extensions?.gerber?.native
        if (EcadGerberFabrication.#hasUsableFabrication(native)) {
            return native
        }
        return EcadGerberFabrication.#hasUsableFabrication(documentModel)
            ? documentModel
            : null
    }

    /**
     * Returns retained Gerber source layers.
     * @param {unknown} documentModel Loaded document.
     * @returns {object[]} Source fabrication layers.
     */
    static layers(documentModel) {
        const native = EcadGerberFabrication.nativeDocument(documentModel)
        return Array.isArray(native?.pcb?.fabrication?.layers)
            ? native.pcb.fabrication.layers
            : []
    }

    /**
     * Returns whether a native document has fabrication layer data.
     * @param {unknown} documentModel Candidate native Gerber document.
     * @returns {boolean}
     */
    static #hasUsableFabrication(documentModel) {
        const layers = documentModel?.pcb?.fabrication?.layers
        return Array.isArray(layers) && layers.length > 0
    }
}
