import { AppControllerDeepLinkState } from './AppControllerDeepLinkState.mjs'
import { NetSelectionModel } from './core/NetSelectionModel.mjs'
import { PcbComponentSelectionModel } from './core/PcbComponentSelectionModel.mjs'
import { PcbLayerVisibilityModel } from './core/PcbLayerVisibilityModel.mjs'
import { PcbObjectVisibilityModel } from './core/PcbObjectVisibilityModel.mjs'

/**
 * Applies PCB sidebar and rendered-view state mutations for AppController.
 */
export class AppControllerPcbStateHandlers {
    /**
     * Applies one PCB layer visibility change from the sidebar.
     * @param {import('./core/AppState.mjs').AppState} state App state.
     * @param {{ documentId?: string, layerKey?: string, visible?: boolean }} change Layer visibility event.
     * @returns {void}
     */
    static handleLayerVisibility(state, change) {
        const snapshot = state.getSnapshot()
        const documentId = AppControllerPcbStateHandlers.#documentId(
            snapshot,
            change
        )
        const layerKey = String(change?.layerKey || '')
        const nextHidden = PcbLayerVisibilityModel.withLayerVisibility(
            snapshot.hiddenPcbLayers,
            documentId,
            layerKey,
            change?.visible !== false
        )

        state.setValue('hiddenPcbLayers', nextHidden)
    }

    /**
     * Applies one PCB object opacity change from the sidebar.
     * @param {import('./core/AppState.mjs').AppState} state App state.
     * @param {{ documentId?: string, objectKey?: string, opacity?: number, preview?: boolean }} change Object opacity event.
     * @returns {void}
     */
    static handleObjectOpacity(state, change) {
        if (change?.preview === true) return

        const snapshot = state.getSnapshot()
        const documentId = AppControllerPcbStateHandlers.#documentId(
            snapshot,
            change
        )
        const objectKey = String(change?.objectKey || '')
        const nextOpacities = PcbObjectVisibilityModel.withObjectOpacity(
            snapshot.pcbObjectOpacities,
            documentId,
            objectKey,
            Number(change?.opacity ?? 100)
        )

        state.setValue('pcbObjectOpacities', nextOpacities)
    }

    /**
     * Applies one PCB component selection from the sidebar or rendered view.
     * @param {import('./core/AppState.mjs').AppState} state App state.
     * @param {{ documentId?: string, componentKey?: string, source?: string }} change Selection event.
     * @returns {void}
     */
    static handleComponentSelection(state, change) {
        const snapshot = state.getSnapshot()
        const documentId = AppControllerPcbStateHandlers.#documentId(
            snapshot,
            change
        )
        const componentKey = String(change?.componentKey || '')
        const selectedKey = PcbComponentSelectionModel.resolveSelectedKey(
            snapshot.selectedPcbComponents,
            documentId
        )
        const nextComponentKey =
            componentKey && componentKey === selectedKey ? '' : componentKey
        const nextSelection = PcbComponentSelectionModel.withSessionSelection(
            snapshot.selectedPcbComponents,
            snapshot.documents,
            documentId,
            nextComponentKey,
            selectedKey
        )
        const patch = {
            selectedPcbComponents: nextSelection
        }
        const nextSelectedKey = PcbComponentSelectionModel.resolveSelectedKey(
            nextSelection,
            documentId
        )
        const sourceTab = {
            '3d-scene': 'model3d',
            'pcb-board': 'components',
            schematic: 'components'
        }[String(change?.source || '')]
        if (nextSelectedKey && sourceTab) patch.activeSidebarTab = sourceTab

        AppControllerDeepLinkState.sync(state.patch(patch))
    }

    /**
     * Applies one net selection from the sidebar or rendered views.
     * @param {import('./core/AppState.mjs').AppState} state App state.
     * @param {{ documentId?: string, netName?: string, source?: string }} change Selection event.
     * @returns {void}
     */
    static handleNetSelection(state, change) {
        const snapshot = state.getSnapshot()
        const documentId = AppControllerPcbStateHandlers.#documentId(
            snapshot,
            change
        )
        const netName = String(change?.netName || '')
        const selectedKey = NetSelectionModel.resolveSelectedKey(
            snapshot.selectedNets,
            documentId
        )
        const nextNetName = netName && netName === selectedKey ? '' : netName
        const nextSelection = NetSelectionModel.withSessionSelection(
            snapshot.selectedNets,
            snapshot.documents,
            documentId,
            nextNetName,
            selectedKey
        )
        const patch = {
            selectedNets: nextSelection
        }
        const nextSelectedKey = NetSelectionModel.resolveSelectedKey(
            nextSelection,
            documentId
        )
        if (nextSelectedKey) patch.activeSidebarTab = 'nets'

        AppControllerDeepLinkState.sync(state.patch(patch))
    }

    /**
     * Applies a PCB layer visibility preset from the sidebar.
     * @param {import('./core/AppState.mjs').AppState} state App state.
     * @param {{ documentId?: string, preset?: string }} change Preset event.
     * @returns {void}
     */
    static handleLayerPreset(state, change) {
        const snapshot = state.getSnapshot()
        const documentId = AppControllerPcbStateHandlers.#documentId(
            snapshot,
            change
        )
        const documentModel =
            snapshot.documents.find((entry) => entry.id === documentId)
                ?.documentModel || snapshot.documentModel
        const nextHidden = PcbLayerVisibilityModel.withPreset(
            snapshot.hiddenPcbLayers,
            documentId,
            documentModel,
            String(change?.preset || 'all')
        )

        state.setValue('hiddenPcbLayers', nextHidden)
    }

    /**
     * Resolves the target document id for one sidebar event.
     * @param {{ activeDocumentId?: string }} snapshot State snapshot.
     * @param {{ documentId?: string } | null | undefined} change Event data.
     * @returns {string}
     */
    static #documentId(snapshot, change) {
        return String(change?.documentId || snapshot.activeDocumentId)
    }
}
