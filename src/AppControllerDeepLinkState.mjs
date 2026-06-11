import { AppControllerDocumentSelection } from './AppControllerDocumentSelection.mjs'
import { GitHubShareUrlWriter } from './GitHubShareUrlWriter.mjs'
import { ViewDeepLinkState } from './ViewDeepLinkState.mjs'

/**
 * Synchronizes controller state with shareable browser URL state.
 */
export class AppControllerDeepLinkState {
    /**
     * Writes the current view and active document path into the browser URL.
     * @param {{ activeView: string, activeFileName: string }} snapshot State snapshot.
     * @param {{ history?: History, location?: Location }} [environment] Browser environment.
     * @returns {void}
     */
    static sync(snapshot, environment = globalThis) {
        ViewDeepLinkState.update(snapshot.activeView, environment, {
            documentPath: snapshot.activeFileName
        })
    }

    /**
     * Writes one GitHub source URL with the current active document path.
     * @param {string} sourceUrl Shareable GitHub source URL.
     * @param {{ activeFileName: string }} snapshot State snapshot.
     * @param {{ history?: History, location?: Location }} [environment] Browser environment.
     * @returns {void}
     */
    static syncGitHubShareUrl(sourceUrl, snapshot, environment = globalThis) {
        GitHubShareUrlWriter.update(sourceUrl, environment, {
            documentPath: snapshot.activeFileName
        })
    }

    /**
     * Restores a startup document selection from a stable document path.
     * @param {{ getSnapshot: () => { documents: { id: string, documentModel: object }[] }, setValue: (key: string, value: string) => object }} state App state container.
     * @param {string} documentPath Requested document file path.
     * @returns {void}
     */
    static restoreDocument(state, documentPath) {
        const documentId =
            AppControllerDocumentSelection.resolveDocumentIdByPath(
                state.getSnapshot().documents,
                documentPath
            )

        if (documentId) {
            state.setValue('activeDocumentId', documentId)
        }
    }
}
