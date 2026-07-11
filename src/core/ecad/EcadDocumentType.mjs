import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Resolves canonical document identity and broad view type.
 */
export class EcadDocumentType {
    /**
     * Returns the document's primary view type.
     * @param {unknown} documentModel Loaded document.
     * @returns {'pcb' | 'schematic' | 'bom' | 'document'} View type.
     */
    static kind(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            if (documentModel?.pcb || documentModel?.kind === 'pcb')
                return 'pcb'
            if (
                documentModel?.schematic ||
                documentModel?.kind === 'schematic'
            ) {
                return 'schematic'
            }
            if (Array.isArray(documentModel?.bom)) return 'bom'
            return 'document'
        }

        const context = EcadCircuitJsonContext.prepare(documentModel, {
            indexes: ['elements']
        })
        return context.getOrCreateDerived('document', 'kind-v1', () => {
            const byType = context.getIndex('elements').elementsByType
            const types = [...byType.keys()]
            if (types.some((type) => type.startsWith('pcb_'))) return 'pcb'
            if (types.some((type) => type.startsWith('schematic_'))) {
                return 'schematic'
            }
            if (byType.has('source_component')) return 'bom'
            return 'document'
        })
    }

    /**
     * Returns the canonical source file name with legacy fallback.
     * @param {unknown} documentModel Loaded document.
     * @returns {string} Source file name.
     */
    static fileName(documentModel) {
        return String(
            documentModel?.source?.fileName || documentModel?.fileName || ''
        )
    }

    /**
     * Returns whether the document's primary view is a PCB.
     * @param {unknown} documentModel Loaded document.
     * @returns {boolean} Whether this is a PCB document.
     */
    static isPcb(documentModel) {
        return EcadDocumentType.kind(documentModel) === 'pcb'
    }

    /**
     * Returns whether the document's primary view is a schematic.
     * @param {unknown} documentModel Loaded document.
     * @returns {boolean} Whether this is a schematic document.
     */
    static isSchematic(documentModel) {
        return EcadDocumentType.kind(documentModel) === 'schematic'
    }
}
