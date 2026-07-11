import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Resolves document-envelope and CircuitJSON model diagnostics for app views.
 */
export class EcadDocumentDiagnostics {
    /**
     * Returns stable diagnostics without mutating the canonical document.
     * @param {unknown} documentModel Loaded document.
     * @returns {object[]} Combined diagnostic rows.
     */
    static resolve(documentModel) {
        const envelope = Array.isArray(documentModel?.diagnostics)
            ? documentModel.diagnostics
            : []
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return envelope
        }
        const context = EcadCircuitJsonContext.prepare(documentModel, {
            indexes: ['connectivity']
        })
        const model = context.getIndex('connectivity')?.diagnostics || []
        return EcadDocumentDiagnostics.#unique([...envelope, ...model])
    }

    /**
     * Deduplicates parser and model rows by their observable identity.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {object[]} Unique rows.
     */
    static #unique(diagnostics) {
        const seen = new Set()
        return diagnostics.filter((diagnostic) => {
            const key = JSON.stringify([
                diagnostic?.severity,
                diagnostic?.code,
                diagnostic?.type,
                diagnostic?.message,
                diagnostic?.source,
                diagnostic?.elementId
            ])
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }
}
