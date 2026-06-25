import { PcbViewController } from './PcbViewController.mjs'
import { AppViewPcbContentReuseModel } from './AppViewPcbContentReuseModel.mjs'
import { AppViewDownloadHelper } from './AppViewDownloadHelper.mjs'

/**
 * Mounts the 2D PCB controller from an AppView snapshot.
 */
export class AppViewPcbControllerBinder {
    /**
     * Creates a PCB controller and remembers its content signature.
     * @param {object} options Mount options.
     * @param {HTMLElement} options.contentNode PCB content mount.
     * @param {object} options.snapshot App state snapshot.
     * @param {'top' | 'bottom'} options.side Requested PCB side.
     * @param {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} options.onComponentSelectionChange Component selection callback.
     * @param {((change: { documentId: string, netName: string, source?: string }) => void) | null} options.onNetSelectionChange Net selection callback.
     * @param {((change: { documentId: string, point: object, candidates: object[], selectedCandidate: object | null, source?: string }) => void) | null} options.onInteractionCandidatesChange Candidate preview callback.
     * @param {((key: string) => string) | null} options.translate Translation lookup.
     * @returns {PcbViewController}
     */
    static attach({
        contentNode,
        snapshot,
        side,
        onComponentSelectionChange,
        onNetSelectionChange,
        onInteractionCandidatesChange,
        translate
    }) {
        const documentId = String(snapshot?.activeDocumentId || '')
        const objectOpacities = snapshot?.pcbObjectOpacities?.[documentId]
        const gerberSelection =
            AppViewPcbControllerBinder.#resolveGerberRenderSelection(
                snapshot,
                documentId
            )
        const controller = new PcbViewController(
            contentNode,
            snapshot.documentModel,
            {
                documentId,
                side,
                hiddenLayers:
                    AppViewPcbControllerBinder.#resolveHiddenPcbLayers(
                        snapshot
                    ),
                hiddenObjects:
                    AppViewPcbControllerBinder.#resolveHiddenPcbObjects(
                        snapshot
                    ),
                objectOpacities:
                    objectOpacities &&
                    typeof objectOpacities === 'object' &&
                    !Array.isArray(objectOpacities)
                        ? { ...objectOpacities }
                        : {},
                selectedComponentKey: String(
                    snapshot?.selectedPcbComponents?.[documentId] || ''
                ),
                selectedNetName: String(
                    snapshot?.selectedNets?.[documentId] || ''
                ),
                gerberRenderMode: gerberSelection.renderMode,
                gerberLayerId: gerberSelection.layerId,
                gerberLayerIds: gerberSelection.layerIds,
                onComponentSelectionChange,
                onNetSelectionChange,
                onInteractionCandidatesChange,
                downloadBytes: (fileName, bytes, contentType) =>
                    AppViewDownloadHelper.downloadBytes(
                        contentNode.ownerDocument,
                        fileName,
                        bytes,
                        contentType
                    ),
                translate
            }
        )
        AppViewPcbContentReuseModel.remember(contentNode, controller, snapshot)
        return controller
    }

    /**
     * Resolves hidden PCB layer keys for the active document.
     * @param {object} snapshot Viewer snapshot.
     * @returns {string[]}
     */
    static #resolveHiddenPcbLayers(snapshot) {
        const documentId = String(snapshot?.activeDocumentId || '')
        const hiddenLayers = snapshot?.hiddenPcbLayers?.[documentId]
        return Array.isArray(hiddenLayers) ? hiddenLayers : []
    }

    /**
     * Resolves hidden PCB object keys for the active document.
     * @param {object} snapshot Viewer snapshot.
     * @returns {string[]}
     */
    static #resolveHiddenPcbObjects(snapshot) {
        const documentId = String(snapshot?.activeDocumentId || '')
        const hiddenObjects = snapshot?.hiddenPcbObjects?.[documentId]
        return Array.isArray(hiddenObjects) ? hiddenObjects : []
    }

    /**
     * Resolves the active Gerber render selection for a document.
     * @param {object} snapshot Viewer snapshot.
     * @param {string} documentId Active document id.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[] }}
     */
    static #resolveGerberRenderSelection(snapshot, documentId) {
        const selection = snapshot?.gerberRenderSelections?.[documentId]
        if (!selection || typeof selection !== 'object') {
            return { renderMode: '', layerId: '', layerIds: [] }
        }
        const layerIds = Array.isArray(selection.layerIds)
            ? selection.layerIds.map(String).filter(Boolean)
            : []
        const layerId = String(selection.layerId || layerIds[0] || '')

        return {
            renderMode:
                selection.renderMode === 'separated'
                    ? 'separated'
                    : 'composite',
            layerId,
            layerIds
        }
    }
}
