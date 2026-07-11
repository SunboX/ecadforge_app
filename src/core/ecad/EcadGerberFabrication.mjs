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
        return (
            documentModel?.extensions?.gerber?.native ||
            (documentModel?.pcb?.fabrication ? documentModel : null)
        )
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
}
