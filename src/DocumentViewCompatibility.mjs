import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Resolves which loaded document can render a requested top-level view.
 */
export class DocumentViewCompatibility {
    /**
     * Returns true when a session document can render the requested view.
     * @param {object | null | undefined} documentModel Document model.
     * @param {string} viewName Requested view id.
     * @returns {boolean}
     */
    static supportsView(documentModel, viewName) {
        if (!documentModel || typeof documentModel !== 'object') {
            return false
        }

        if (viewName === 'schematic') {
            return Boolean(documentModel.schematic)
        }

        if (viewName === 'pcb') {
            return Boolean(documentModel.pcb)
        }

        if (viewName === '3d') {
            return (
                Boolean(documentModel.pcb) ||
                EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
                    'circuitjson'
            )
        }

        if (viewName === 'bom') {
            return Array.isArray(documentModel.bom)
        }

        if (viewName === 'diagnostics') {
            return Array.isArray(documentModel.diagnostics)
        }

        return false
    }

    /**
     * Resolves the session document id that best matches the requested view.
     * @param {{ id: string, documentModel: object }[]} documents Loaded docs.
     * @param {string} viewName Requested view id.
     * @param {string} preferredDocumentId Preferred current document id.
     * @returns {string}
     */
    static resolveDocumentId(documents, viewName, preferredDocumentId) {
        const preferredDocument = documents.find(
            (entry) => entry.id === preferredDocumentId
        )
        if (
            preferredDocument &&
            DocumentViewCompatibility.supportsView(
                preferredDocument.documentModel,
                viewName
            )
        ) {
            return preferredDocument.id
        }

        const compatibleDocument = documents.find((entry) =>
            DocumentViewCompatibility.supportsView(
                entry.documentModel,
                viewName
            )
        )
        if (compatibleDocument) {
            return compatibleDocument.id
        }

        return preferredDocumentId || documents[0]?.id || ''
    }
}
