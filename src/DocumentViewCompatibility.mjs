import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { EcadDocumentDiagnostics } from './core/ecad/EcadDocumentDiagnostics.mjs'

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
            return (
                Boolean(documentModel.schematic) ||
                DocumentViewCompatibility.#hasElementPrefix(
                    documentModel,
                    'schematic_'
                )
            )
        }

        if (viewName === 'pcb') {
            return (
                Boolean(documentModel.pcb) ||
                DocumentViewCompatibility.#hasElementPrefix(
                    documentModel,
                    'pcb_'
                )
            )
        }

        if (viewName === '3d') {
            return (
                Boolean(documentModel.pcb) ||
                DocumentViewCompatibility.#hasElementPrefix(
                    documentModel,
                    'pcb_'
                )
            )
        }

        if (viewName === 'bom') {
            return (
                Array.isArray(documentModel.bom) ||
                DocumentViewCompatibility.#hasElementType(
                    documentModel,
                    'source_component'
                )
            )
        }

        if (viewName === 'diagnostics') {
            return (
                Array.isArray(documentModel.diagnostics) ||
                EcadDocumentDiagnostics.resolve(documentModel).length > 0
            )
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

    /**
     * Returns true when a standards-shaped element array has a type prefix.
     * @param {object | object[]} documentModel Document model.
     * @param {string} prefix Element type prefix.
     * @returns {boolean}
     */
    static #hasElementPrefix(documentModel, prefix) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return false
        }

        const elements =
            EcadFormatRegistry.circuitJsonElementsForDocument(documentModel)
        return elements.some((element) =>
            String(element?.type || '').startsWith(prefix)
        )
    }

    /**
     * Returns true when a standards-shaped document has one exact type.
     * @param {object | object[]} documentModel Document model.
     * @param {string} type Exact CircuitJSON element type.
     * @returns {boolean}
     */
    static #hasElementType(documentModel, type) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return false
        }
        return EcadFormatRegistry.circuitJsonElementsForDocument(
            documentModel
        ).some((element) => String(element?.type || '') === type)
    }
}
