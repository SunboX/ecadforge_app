import { PcbViewController } from './PcbViewController.mjs'
import { AppViewPcbContentReuseModel } from './AppViewPcbContentReuseModel.mjs'

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
     * @param {((change: { documentId: string, componentKey: string, source?: string }) => void) | null} options.onComponentSelectionChange Selection callback.
     * @param {((key: string) => string) | null} options.translate Translation lookup.
     * @returns {PcbViewController}
     */
    static attach({
        contentNode,
        snapshot,
        side,
        onComponentSelectionChange,
        translate
    }) {
        const documentId = String(snapshot?.activeDocumentId || '')
        const objectOpacities = snapshot?.pcbObjectOpacities?.[documentId]
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
                onComponentSelectionChange,
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
}
