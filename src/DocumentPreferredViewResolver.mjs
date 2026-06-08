import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Chooses the first viewer tab for a freshly parsed document model.
 */
export class DocumentPreferredViewResolver {
    /**
     * Resolves the preferred view for one parsed document.
     * @param {object} documentModel Parsed document model.
     * @returns {string}
     */
    static resolve(documentModel) {
        if (documentModel?.kind === 'schematic') {
            return 'schematic'
        }

        return EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'circuitjson'
            ? '3d'
            : 'pcb'
    }
}
