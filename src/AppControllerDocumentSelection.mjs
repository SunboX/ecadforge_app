import { DocumentViewCompatibility } from './DocumentViewCompatibility.mjs'
import { PcbComponentSelectionModel } from './core/PcbComponentSelectionModel.mjs'

/**
 * Resolves active view/document choices for controller state updates.
 */
export class AppControllerDocumentSelection {
    /**
     * Resolves the preferred active document after a successful load.
     * @param {{ id: string, documentModel: object }[]} appendedDocuments Newly parsed documents.
     * @param {string} activeView View that will be shown after the load.
     * @param {{ adoptPreferredView?: boolean, preferredDocument?: string }} options Load options.
     * @returns {string}
     */
    static resolveLoadedDocumentId(appendedDocuments, activeView, options) {
        const preferredDocumentId =
            AppControllerDocumentSelection.resolveDocumentIdByPath(
                appendedDocuments,
                String(options?.preferredDocument || '')
            )
        if (preferredDocumentId) {
            return preferredDocumentId
        }

        if (options?.adoptPreferredView) {
            return AppControllerDocumentSelection.resolveDocumentId(
                appendedDocuments,
                activeView,
                ''
            )
        }

        return appendedDocuments.at(-1)?.id || ''
    }

    /**
     * Resolves the best document id for a requested view.
     * @param {{ id: string, documentModel: object }[]} documents Loaded docs.
     * @param {string} viewName Requested view.
     * @param {string} preferredDocumentId Preferred document id.
     * @returns {string}
     */
    static resolveDocumentId(documents, viewName, preferredDocumentId) {
        return DocumentViewCompatibility.resolveDocumentId(
            documents,
            viewName,
            preferredDocumentId
        )
    }

    /**
     * Resolves a session document id from a stable document file path.
     * @param {{ id: string, documentModel: object }[]} documents Loaded docs.
     * @param {string} documentPath Requested document file path.
     * @returns {string}
     */
    static resolveDocumentIdByPath(documents, documentPath) {
        const normalizedPath =
            AppControllerDocumentSelection.#normalizeDocumentPath(documentPath)
        if (!normalizedPath) {
            return ''
        }

        const matchedDocument = documents.find(
            (entry) =>
                AppControllerDocumentSelection.#normalizeDocumentPath(
                    entry?.documentModel?.fileName
                ) === normalizedPath
        )

        return matchedDocument?.id || ''
    }

    /**
     * Builds the active-view patch while keeping the active document
     * compatible with the selected view whenever possible.
     * @param {string} viewName Requested view.
     * @param {{ activeDocumentId: string, documents: { id: string, documentModel: object }[], selectedPcbComponents?: { [documentId: string]: string } }} snapshot Current state snapshot.
     * @returns {{ activeView: string, activeDocumentId?: string }}
     */
    static buildCompatibleViewPatch(viewName, snapshot) {
        const patch = {
            activeView: viewName
        }
        const compatibleDocumentId =
            AppControllerDocumentSelection.#resolveSelectedComponentDocumentId(
                snapshot.documents,
                viewName,
                snapshot
            ) ||
            AppControllerDocumentSelection.resolveDocumentId(
                snapshot.documents,
                viewName,
                snapshot.activeDocumentId
            )

        if (compatibleDocumentId) {
            patch.activeDocumentId = compatibleDocumentId
        }

        return patch
    }

    /**
     * Resolves a view-compatible document that contains the active selected component.
     * @param {{ id: string, documentModel: object }[]} documents Loaded docs.
     * @param {string} viewName Requested view.
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string } }} snapshot Current state snapshot.
     * @returns {string}
     */
    static #resolveSelectedComponentDocumentId(documents, viewName, snapshot) {
        const selectedKey = PcbComponentSelectionModel.resolveSelectedKey(
            snapshot?.selectedPcbComponents,
            String(snapshot?.activeDocumentId || '')
        )
        if (!selectedKey) {
            return ''
        }

        const matchedDocument = (documents || []).find(
            (entry) =>
                DocumentViewCompatibility.supportsView(
                    entry?.documentModel,
                    viewName
                ) &&
                PcbComponentSelectionModel.documentHasComponentKey(
                    entry?.documentModel,
                    selectedKey
                )
        )

        return matchedDocument?.id || ''
    }

    /**
     * Normalizes document paths for URL-state matching.
     * @param {unknown} value Candidate document path.
     * @returns {string}
     */
    static #normalizeDocumentPath(value) {
        return String(value || '')
            .trim()
            .replaceAll('\\', '/')
    }
}
