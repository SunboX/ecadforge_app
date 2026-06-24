/**
 * Binds the 3D scene controller to freshly rendered viewport markup.
 */
export class AppViewScene3dControllerBinder {
    /**
     * Attaches a 3D scene controller to the rendered viewport node.
     * @param {{ contentNode: HTMLElement | null, documentId?: string, documentModel: any, sessionAssets?: any[], selectedComponentKey?: string, autoSearchMissingModels?: boolean, renderAdjustmentControlsInSelection?: boolean, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, translate: (key: string) => string, createScene3dController: (viewportNode: HTMLElement, documentModel: any, options?: { documentId?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, sessionAssets?: any[], autoSearchMissingModels?: boolean, renderAdjustmentControlsInSelection?: boolean, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => any }} options
     * @returns {any | null}
     */
    static attach(options) {
        const contentNode = options.contentNode
        if (!contentNode) return null

        const viewportNode = contentNode.querySelector(
            '[data-scene-3d-viewport]'
        )
        if (
            !AppViewScene3dControllerBinder.#isSceneViewportNode(viewportNode)
        ) {
            return null
        }

        const loadingNode = contentNode.querySelector('[data-scene-3d-loading]')
        const setLoadingVisible = (visible) => {
            if (
                !AppViewScene3dControllerBinder.#isSceneViewportNode(
                    loadingNode
                )
            ) {
                return
            }

            if (visible) {
                loadingNode.removeAttribute?.('hidden')
                return
            }

            loadingNode.setAttribute?.('hidden', 'hidden')
        }
        setLoadingVisible(true)

        const controller = options.createScene3dController(
            viewportNode,
            options.documentModel,
            {
                documentId: options.documentId || '',
                onComponentSelectionChange:
                    options.onComponentSelectionChange || null,
                onSessionAssetsResolved:
                    options.onSessionAssetsResolved || null,
                sessionAssets: options.sessionAssets || [],
                autoSearchMissingModels: Boolean(
                    options.autoSearchMissingModels
                ),
                renderAdjustmentControlsInSelection:
                    options.renderAdjustmentControlsInSelection,
                setLoadingVisible,
                translate: options.translate
            }
        )
        controller?.setSelectedComponent?.(options.selectedComponentKey || '')
        return controller || null
    }

    /**
     * Returns true when the queried node can host the 3D viewport.
     * @param {unknown} node
     * @returns {boolean}
     */
    static #isSceneViewportNode(node) {
        return Boolean(node && typeof node === 'object')
    }
}
