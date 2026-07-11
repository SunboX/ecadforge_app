import { CircuitJsonSupportMatrixBuilder } from 'circuitjson-toolkit/extensions'
import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Resolves support coverage from canonical CircuitJSON without mutating it.
 */
export class EcadDocumentSupportMatrix {
    /**
     * Returns a request-context-cached support matrix for one document.
     * @param {unknown} documentModel Loaded document.
     * @returns {object | null} Support matrix or null when unavailable.
     */
    static resolve(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return documentModel?.supportMatrix || null
        }

        const context = EcadCircuitJsonContext.prepare(documentModel)
        return context.getOrCreateDerived('support', 'matrix-v1', () =>
            CircuitJsonSupportMatrixBuilder.build(context.model)
        )
    }
}
