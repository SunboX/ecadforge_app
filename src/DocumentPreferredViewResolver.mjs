import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { EcadDocumentDiagnostics } from './core/ecad/EcadDocumentDiagnostics.mjs'
import { EcadDocumentType } from './core/ecad/EcadDocumentType.mjs'

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
        if (EcadDocumentType.isSchematic(documentModel)) {
            return 'schematic'
        }

        if (EcadDocumentType.isPcb(documentModel)) {
            return 'pcb'
        }

        if (EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            const elements =
                EcadFormatRegistry.circuitJsonElementsForDocument(documentModel)
            if (
                elements.some((element) =>
                    String(element?.type || '').startsWith('pcb_')
                )
            ) {
                return 'pcb'
            }
            if (
                elements.some((element) =>
                    String(element?.type || '').startsWith('schematic_')
                )
            ) {
                return 'schematic'
            }
            if (
                elements.some((element) => element?.type === 'source_component')
            ) {
                return 'bom'
            }
        }

        if (!documentModel?.pcb) {
            if (Array.isArray(documentModel?.diagnostics)) {
                return 'diagnostics'
            }
            return EcadDocumentDiagnostics.resolve(documentModel).length
                ? 'diagnostics'
                : 'bom'
        }

        return 'pcb'
    }
}
