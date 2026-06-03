import { DocumentViewCompatibility } from './DocumentViewCompatibility.mjs'

/**
 * Resolves active view/document choices for controller state updates.
 */
export class AppControllerDocumentSelection {
    /**
     * Resolves the preferred active document after a successful load.
     * @param {{ id: string, documentModel: object }[]} appendedDocuments Newly parsed documents.
     * @param {string} activeView View that will be shown after the load.
     * @param {{ adoptPreferredView?: boolean }} options Load options.
     * @returns {string}
     */
    static resolveLoadedDocumentId(appendedDocuments, activeView, options) {
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
     * Builds the active-view patch while keeping the active document
     * compatible with the selected view whenever possible.
     * @param {string} viewName Requested view.
     * @param {{ activeDocumentId: string, documents: { id: string, documentModel: object }[] }} snapshot Current state snapshot.
     * @returns {{ activeView: string, activeDocumentId?: string }}
     */
    static buildCompatibleViewPatch(viewName, snapshot) {
        const patch = {
            activeView: viewName
        }
        const compatibleDocumentId =
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
}
