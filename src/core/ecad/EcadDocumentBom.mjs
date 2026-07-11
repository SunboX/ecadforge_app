import { CircuitJsonBomBuilder } from 'circuitjson-toolkit/extensions'
import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Resolves grouped BOM rows from native or canonical documents.
 */
export class EcadDocumentBom {
    /**
     * Returns stable grouped BOM rows without decorating the source document.
     * @param {unknown} documentModel Loaded document.
     * @returns {object[]} Grouped BOM rows.
     */
    static resolve(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return Array.isArray(documentModel?.bom) ? documentModel.bom : []
        }

        const context = EcadCircuitJsonContext.prepare(documentModel)
        return context.getOrCreateDerived('bom', 'app-rows-v1', () =>
            CircuitJsonBomBuilder.build(context.model)
        )
    }
}
