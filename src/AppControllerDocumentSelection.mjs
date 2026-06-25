import { DocumentViewCompatibility } from './DocumentViewCompatibility.mjs'
import { DocumentPreferredViewResolver } from './DocumentPreferredViewResolver.mjs'
import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
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
            return AppControllerDocumentSelection.#resolveBestLoadedDocumentId(
                appendedDocuments,
                activeView
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
     * Builds the active-document patch while keeping the selected document
     * compatible with the current top-level view.
     * @param {string} documentId Requested document id.
     * @param {{ activeView: string, activeDocumentId: string, documents: { id: string, documentModel: object }[] }} snapshot Current state snapshot.
     * @returns {{ activeView?: string, activeDocumentId: string }}
     */
    static buildCompatibleDocumentPatch(documentId, snapshot) {
        const requestedDocumentId = String(documentId || '')
        const requestedDocument = (snapshot.documents || []).find(
            (entry) => entry.id === requestedDocumentId
        )
        if (
            requestedDocument &&
            DocumentViewCompatibility.supportsView(
                requestedDocument.documentModel,
                snapshot.activeView
            )
        ) {
            return { activeDocumentId: requestedDocumentId }
        }

        const requestedDocumentModel = requestedDocument?.documentModel
        const requestedView =
            AppControllerDocumentSelection.#resolveDocumentSelectionView(
                requestedDocumentModel
            )
        if (requestedView) {
            return {
                activeView: requestedView,
                activeDocumentId: requestedDocumentId
            }
        }

        return {
            activeDocumentId:
                AppControllerDocumentSelection.resolveDocumentId(
                    snapshot.documents || [],
                    snapshot.activeView,
                    snapshot.activeDocumentId
                )
        }
    }

    /**
     * Resolves a preferred view for an explicitly selected renderable document.
     * @param {object | null | undefined} documentModel Parsed document model.
     * @returns {string}
     */
    static #resolveDocumentSelectionView(documentModel) {
        if (
            !documentModel ||
            documentModel.kind === 'project' ||
            documentModel.fileType === 'PrjPcb'
        ) {
            return ''
        }

        const preferredView = DocumentPreferredViewResolver.resolve(
            documentModel
        )
        return DocumentViewCompatibility.supportsView(
            documentModel,
            preferredView
        )
            ? preferredView
            : ''
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
     * Resolves the highest-value document for a freshly loaded compatible view.
     * @param {{ id: string, documentModel: object }[]} documents Loaded docs.
     * @param {string} viewName Requested view.
     * @returns {string}
     */
    static #resolveBestLoadedDocumentId(documents, viewName) {
        const rankedDocuments = (documents || [])
            .map((entry, index) => ({
                entry,
                index,
                score: AppControllerDocumentSelection.#scoreLoadedDocument(
                    entry?.documentModel,
                    viewName
                )
            }))
            .filter((ranked) => Number.isFinite(ranked.score))
            .sort((left, right) => {
                return right.score - left.score || left.index - right.index
            })

        return rankedDocuments[0]?.entry?.id || ''
    }

    /**
     * Scores a freshly loaded document for automatic initial activation.
     * @param {object} documentModel Parsed document model.
     * @param {string} viewName Requested view.
     * @returns {number}
     */
    static #scoreLoadedDocument(documentModel, viewName) {
        if (!DocumentViewCompatibility.supportsView(documentModel, viewName)) {
            return Number.NEGATIVE_INFINITY
        }

        const sourceFormat =
            EcadFormatRegistry.sourceFormatForDocument(documentModel)
        const fileName = String(documentModel?.fileName || '').toLowerCase()
        let score =
            AppControllerDocumentSelection.#scoreSourceFormat(sourceFormat)

        if (/\.(kicad_pcb|pcbdoc|json)$/i.test(fileName)) {
            score += 20
        }

        if (fileName.includes('/')) {
            score += 5
        }

        if (/\.zip$/i.test(fileName)) {
            score -= 20
        }

        return score
    }

    /**
     * Scores source families for automatic load selection.
     * @param {string} sourceFormat Parsed source family.
     * @returns {number}
     */
    static #scoreSourceFormat(sourceFormat) {
        const normalizedFormat = String(sourceFormat || '').toLowerCase()
        if (normalizedFormat === 'kicad' || normalizedFormat === 'altium') {
            return 400
        }

        if (normalizedFormat === 'circuitjson') {
            return 300
        }

        if (normalizedFormat === 'gerber') {
            return 100
        }

        return 200
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
