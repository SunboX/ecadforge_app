import { AppControllerDocumentSelection } from './AppControllerDocumentSelection.mjs'
import { NetSelectionModel } from './core/NetSelectionModel.mjs'
import { PcbComponentSelectionModel } from './core/PcbComponentSelectionModel.mjs'
import { GitHubShareUrlWriter } from './GitHubShareUrlWriter.mjs'
import { ViewDeepLinkState } from './ViewDeepLinkState.mjs'

/**
 * Synchronizes controller state with shareable browser URL state.
 */
export class AppControllerDeepLinkState {
    /**
     * Writes the current view and active document path into the browser URL.
     * @param {{ activeView: string, activeFileName: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, selectedNets?: { [documentId: string]: string } }} snapshot State snapshot.
     * @param {{ history?: History, location?: Location }} [environment] Browser environment.
     * @returns {void}
     */
    static sync(snapshot, environment = globalThis) {
        ViewDeepLinkState.update(snapshot.activeView, environment, {
            documentPath: snapshot.activeFileName,
            componentKey:
                AppControllerDeepLinkState.#resolveActiveComponentKey(snapshot),
            netName: AppControllerDeepLinkState.#resolveActiveNetName(snapshot)
        })
    }

    /**
     * Writes one GitHub source URL with the current active document path.
     * @param {string} sourceUrl Shareable GitHub source URL.
     * @param {{ activeFileName: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, selectedNets?: { [documentId: string]: string } }} snapshot State snapshot.
     * @param {{ history?: History, location?: Location }} [environment] Browser environment.
     * @returns {void}
     */
    static syncGitHubShareUrl(sourceUrl, snapshot, environment = globalThis) {
        GitHubShareUrlWriter.update(sourceUrl, environment, {
            documentPath: snapshot.activeFileName,
            componentKey:
                AppControllerDeepLinkState.#resolveActiveComponentKey(snapshot),
            netName: AppControllerDeepLinkState.#resolveActiveNetName(snapshot)
        })
    }

    /**
     * Writes a bundled demo source URL with the current view and document path.
     * @param {string} demoId Bundled demo id.
     * @param {{ activeView: string, activeFileName: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, selectedNets?: { [documentId: string]: string } }} snapshot State snapshot.
     * @param {{ history?: History, location?: Location }} [environment] Browser environment.
     * @returns {void}
     */
    static syncDemoShareUrl(demoId, snapshot, environment = globalThis) {
        const browserHistory = environment?.history
        const browserLocation = environment?.location
        const normalizedDemoId = String(demoId || '')
            .trim()
            .toLowerCase()

        if (
            !normalizedDemoId ||
            typeof browserHistory?.replaceState !== 'function' ||
            !browserLocation?.href
        ) {
            return
        }

        browserHistory.replaceState(
            browserHistory.state || null,
            '',
            AppControllerDeepLinkState.#buildDemoShareUrl(
                browserLocation.href,
                normalizedDemoId,
                snapshot
            )
        )
    }

    /**
     * Builds a reloadable bundled demo URL.
     * @param {string} currentHref Current browser URL.
     * @param {string} demoId Bundled demo id.
     * @param {{ activeView: string, activeFileName: string, activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string }, selectedNets?: { [documentId: string]: string } }} snapshot State snapshot.
     * @returns {string}
     */
    static #buildDemoShareUrl(currentHref, demoId, snapshot) {
        const shareUrl = new URL(
            String(currentHref || '/'),
            'https://ecadforge.app/'
        )
        shareUrl.pathname = '/'
        shareUrl.hash = ''
        shareUrl.searchParams.delete('url')
        shareUrl.searchParams.delete('github')
        shareUrl.searchParams.delete('ref')
        shareUrl.searchParams.set('demo', demoId)

        return ViewDeepLinkState.build(shareUrl.href, snapshot.activeView, {
            documentPath: snapshot.activeFileName,
            componentKey:
                AppControllerDeepLinkState.#resolveActiveComponentKey(snapshot),
            netName: AppControllerDeepLinkState.#resolveActiveNetName(snapshot)
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

    /**
     * Restores a startup component selection from a stable component key.
     * @param {{ getSnapshot: () => { activeDocumentId: string, documents: { id: string, documentModel: object }[], selectedPcbComponents: { [documentId: string]: string } }, patch?: (values: object) => object, setValue: (key: string, value: object | string) => object }} state App state container.
     * @param {string} componentKey Requested component key.
     * @returns {void}
     */
    static restoreComponent(state, componentKey) {
        const key = String(componentKey || '').trim()
        if (!key) {
            return
        }

        const snapshot = state.getSnapshot()
        const nextSelection = PcbComponentSelectionModel.withSessionSelection(
            snapshot.selectedPcbComponents,
            snapshot.documents,
            snapshot.activeDocumentId,
            key
        )

        AppControllerDeepLinkState.#applyStatePatch(state, {
            selectedPcbComponents: nextSelection,
            activeSidebarTab: 'components'
        })
    }

    /**
     * Restores a startup net selection from a stable net name.
     * @param {{ getSnapshot: () => { activeDocumentId: string, documents: { id: string, documentModel: object }[], selectedNets: { [documentId: string]: string } }, patch?: (values: object) => object, setValue: (key: string, value: object | string) => object }} state App state container.
     * @param {string} netName Requested net name.
     * @returns {void}
     */
    static restoreNet(state, netName) {
        const key = String(netName || '').trim()
        if (!key) {
            return
        }

        const snapshot = state.getSnapshot()
        const activeDocument = (snapshot.documents || []).find(
            (entry) => String(entry?.id || '') === snapshot.activeDocumentId
        )
        if (
            !NetSelectionModel.documentHasNetKey(
                activeDocument?.documentModel,
                key
            )
        ) {
            return
        }

        const nextSelection = NetSelectionModel.withSessionSelection(
            snapshot.selectedNets,
            snapshot.documents,
            snapshot.activeDocumentId,
            key
        )

        AppControllerDeepLinkState.#applyStatePatch(state, {
            selectedNets: nextSelection,
            activeSidebarTab: 'nets'
        })
    }

    /**
     * Resolves the selected component key for the active document.
     * @param {{ activeDocumentId?: string, selectedPcbComponents?: { [documentId: string]: string } }} snapshot State snapshot.
     * @returns {string}
     */
    static #resolveActiveComponentKey(snapshot) {
        return PcbComponentSelectionModel.resolveSelectedKey(
            snapshot?.selectedPcbComponents,
            String(snapshot?.activeDocumentId || '')
        )
    }

    /**
     * Resolves the selected net name for the active document.
     * @param {{ activeDocumentId?: string, selectedNets?: { [documentId: string]: string } }} snapshot State snapshot.
     * @returns {string}
     */
    static #resolveActiveNetName(snapshot) {
        return NetSelectionModel.resolveSelectedKey(
            snapshot?.selectedNets,
            String(snapshot?.activeDocumentId || '')
        )
    }

    /**
     * Applies multiple state values when the backing state supports it.
     * @param {{ patch?: (values: object) => object, setValue: (key: string, value: object | string) => object }} state App state container.
     * @param {object} patch State values to apply.
     * @returns {void}
     */
    static #applyStatePatch(state, patch) {
        if (typeof state?.patch === 'function') {
            state.patch(patch)
            return
        }

        Object.entries(patch || {}).forEach(([key, value]) => {
            state.setValue(key, value)
        })
    }
}
