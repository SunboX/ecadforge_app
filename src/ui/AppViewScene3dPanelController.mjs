import { AppViewScene3dControllerBinder } from './AppViewScene3dControllerBinder.mjs'
import { AppViewScene3dShellRenderer } from './AppViewScene3dShellRenderer.mjs'
import { ViewportInteractionGateController } from './ViewportInteractionGateController.mjs'

/**
 * Owns the mounted 3D panel lifecycle across app tab changes.
 */
export class AppViewScene3dPanelController {
    /** @type {any | null} */
    #controller

    /** @type {any | null} */
    #documentModel

    /** @type {string} */
    #sessionAssetsSignature

    /** @type {boolean} */
    #autoSearchMissingModels

    /** @type {Node[]} */
    #contentNodes

    /** @type {HTMLElement | null} */
    #adjustmentHostNode

    /** @type {HTMLElement | null} */
    #exportActionProxyNode

    /** @type {ViewportInteractionGateController | null} */
    #interactionGate

    constructor() {
        this.#controller = null
        this.#documentModel = null
        this.#sessionAssetsSignature = ''
        this.#autoSearchMissingModels = false
        this.#contentNodes = []
        this.#adjustmentHostNode = null
        this.#exportActionProxyNode = null
        this.#interactionGate = null
    }

    /**
     * Returns true when the cached 3D scene matches the requested model set.
     * @param {any} documentModel Candidate document model.
     * @param {any[]} [sessionAssets] Candidate session assets.
     * @returns {boolean}
     */
    canReuse(documentModel, sessionAssets = []) {
        return Boolean(
            this.#controller &&
            this.#documentModel === documentModel &&
            this.#sessionAssetsSignature ===
                AppViewScene3dPanelController.#buildSessionAssetSignature(
                    sessionAssets
                )
        )
    }

    /**
     * Preserves the current scene before AppView replaces the content panel.
     * @param {HTMLElement | null} contentNode Active panel mount.
     * @param {{ documentModel?: any, documents?: { documentModel: any }[] }} snapshot Next render snapshot.
     * @returns {void}
     */
    prepareForRender(contentNode, snapshot) {
        if (!this.#controller) return

        if (!this.#isCachedDocumentInSession(snapshot)) {
            this.dispose()
            return
        }

        this.#rememberContent(contentNode)
    }

    /**
     * Renders or reattaches the 3D scene for the active board.
     * @param {{ contentNode: HTMLElement | null, documentId?: string, documentModel: any, sessionAssets?: any[], autoSearchMissingModels?: boolean, renderAdjustmentControlsInSelection?: boolean, selectedComponentKey?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, translate: (key: string) => string, createScene3dController: (viewportNode: HTMLElement, documentModel: any, options?: { documentId?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, sessionAssets?: any[], autoSearchMissingModels?: boolean, renderAdjustmentControlsInSelection?: boolean, setLoadingVisible?: (visible: boolean) => void, translate?: ((key: string) => string) | null }) => any }} options
     * @returns {void}
     */
    render(options) {
        const contentNode = options.contentNode
        if (!contentNode) return

        if (this.canReuse(options.documentModel, options.sessionAssets || [])) {
            this.#restoreContent(contentNode)
            this.#setAutoSearchMissingModels(
                contentNode,
                options.autoSearchMissingModels === true
            )
            this.#controller?.setSelectedComponent?.(
                options.selectedComponentKey || ''
            )
            this.#controller?.setAdjustmentHost?.(this.#adjustmentHostNode)
            return
        }

        this.dispose()
        this.#mountNewScene(options)
    }

    /**
     * Disposes the cached 3D scene and forgets its detached DOM.
     * @returns {void}
     */
    dispose() {
        this.#controller?.dispose?.()
        this.#controller = null
        this.#documentModel = null
        this.#sessionAssetsSignature = ''
        this.#autoSearchMissingModels = false
        this.#contentNodes = []
        this.#exportActionProxyNode = null
        this.#interactionGate?.dispose()
        this.#interactionGate = null
    }

    /**
     * Stores and forwards the app-owned 3D adjustment controls host.
     * @param {HTMLElement | null} hostNode Sidebar host node.
     * @returns {void}
     */
    setAdjustmentHost(hostNode) {
        this.#adjustmentHostNode =
            hostNode && typeof hostNode === 'object' ? hostNode : null
        this.#controller?.setAdjustmentHost?.(this.#adjustmentHostNode)
    }

    /**
     * Resolves and forwards the adjustment controls host from the sidebar rail.
     * @param {HTMLElement | null} railNode Sidebar rail node.
     * @returns {void}
     */
    setAdjustmentHostFromRail(railNode) {
        this.setAdjustmentHost(
            railNode?.querySelector?.('[data-scene-3d-adjustment-host]') || null
        )
    }

    /**
     * Triggers the controller-owned model archive export action.
     * @returns {void}
     */
    triggerModelArchiveExport() {
        AppViewScene3dPanelController.#dispatchClick(
            this.#exportActionProxyNode
        )
    }

    /**
     * Creates a fresh scene controller from rendered shell markup.
     * @param {{ contentNode: HTMLElement, documentId?: string, documentModel: any, sessionAssets?: any[], autoSearchMissingModels?: boolean, renderAdjustmentControlsInSelection?: boolean, selectedComponentKey?: string, onComponentSelectionChange?: ((change: { documentId: string, componentKey: string, source?: string }) => void) | null, onSessionAssetsResolved?: ((change: { documentModel?: object, sessionAssets?: object[] }) => void) | null, translate: (key: string) => string, createScene3dController: (viewportNode: HTMLElement, documentModel: any, options?: object) => any }} options
     * @returns {void}
     */
    #mountNewScene(options) {
        options.contentNode.innerHTML = AppViewScene3dShellRenderer.render(
            options.documentModel,
            options.translate,
            {
                autoSearchMissingModels:
                    options.autoSearchMissingModels === true
            }
        )
        this.#controller = AppViewScene3dControllerBinder.attach(options)
        this.#interactionGate = new ViewportInteractionGateController(
            options.contentNode
        )
        this.#captureExportActionProxy(options.contentNode)
        this.#controller?.setAdjustmentHost?.(this.#adjustmentHostNode)
        this.#documentModel = this.#controller ? options.documentModel : null
        this.#sessionAssetsSignature = this.#controller
            ? AppViewScene3dPanelController.#buildSessionAssetSignature(
                  options.sessionAssets || []
              )
            : ''
        this.#autoSearchMissingModels =
            this.#controller && options.autoSearchMissingModels === true
        this.#rememberContent(options.contentNode)
    }

    /**
     * Captures the package-owned export action as a hidden action proxy.
     * @param {HTMLElement} contentNode Active panel mount.
     * @returns {void}
     */
    #captureExportActionProxy(contentNode) {
        const exportAction = contentNode?.querySelector?.(
            '[data-scene-3d-export="models-zip"]'
        )
        this.#exportActionProxyNode =
            exportAction && typeof exportAction === 'object'
                ? exportAction
                : null
        AppViewScene3dPanelController.#hideExportAction(
            this.#exportActionProxyNode
        )
    }

    /**
     * Mirrors the app-owned checkbox and forwards runtime visibility changes.
     * @param {HTMLElement} contentNode Active panel mount.
     * @param {boolean} enabled Whether app-discovered models should be shown.
     * @returns {void}
     */
    #setAutoSearchMissingModels(contentNode, enabled) {
        const toggle = contentNode?.querySelector?.(
            '[data-scene-3d-model-search]'
        )
        if (toggle && typeof toggle === 'object' && 'checked' in toggle) {
            toggle.checked = enabled
        }

        if (this.#autoSearchMissingModels === enabled) {
            return
        }

        this.#autoSearchMissingModels = enabled
        this.#controller?.setAutoSearchMissingModels?.(enabled)
    }

    /**
     * Reattaches cached 3D DOM if another tab replaced the main panel.
     * @param {HTMLElement} contentNode Active panel mount.
     * @returns {void}
     */
    #restoreContent(contentNode) {
        if (AppViewScene3dPanelController.#containsSceneViewport(contentNode)) {
            this.#rememberContent(contentNode)
            return
        }

        if (!this.#contentNodes.length) return

        if (typeof contentNode.replaceChildren === 'function') {
            contentNode.replaceChildren(...this.#contentNodes)
            this.#rememberContent(contentNode)
            this.#interactionGate?.sync()
            return
        }

        contentNode.innerHTML = ''
        this.#contentNodes.forEach((node) => contentNode.appendChild?.(node))
        this.#rememberContent(contentNode)
        this.#interactionGate?.sync()
    }

    /**
     * Captures current 3D panel nodes while preserving object identity.
     * @param {HTMLElement | null} contentNode Active panel mount.
     * @returns {void}
     */
    #rememberContent(contentNode) {
        if (
            !AppViewScene3dPanelController.#containsSceneViewport(contentNode)
        ) {
            return
        }

        this.#contentNodes = Array.from(contentNode?.childNodes || [])
    }

    /**
     * Returns true when the cached 3D document still belongs to the session.
     * @param {{ documentModel?: any, documents?: { documentModel: any }[] }} snapshot Next render snapshot.
     * @returns {boolean}
     */
    #isCachedDocumentInSession(snapshot) {
        if (!this.#documentModel) return false

        if (Array.isArray(snapshot?.documents)) {
            return snapshot.documents.some(
                (entry) => entry?.documentModel === this.#documentModel
            )
        }

        return snapshot?.documentModel === this.#documentModel
    }

    /**
     * Returns true when a panel currently contains a 3D viewport.
     * @param {HTMLElement | null} contentNode Candidate panel mount.
     * @returns {boolean}
     */
    static #containsSceneViewport(contentNode) {
        return Boolean(contentNode?.querySelector?.('[data-scene-3d-viewport]'))
    }

    /**
     * Builds a stable signature for assets that affect 3D model resolution.
     * @param {any[]} sessionAssets Session assets.
     * @returns {string}
     */
    static #buildSessionAssetSignature(sessionAssets) {
        return JSON.stringify(
            (Array.isArray(sessionAssets) ? sessionAssets : []).map((asset) => [
                String(asset?.name || ''),
                String(asset?.relativePath || ''),
                String(asset?.sourceUrl || ''),
                String(asset?.source || ''),
                String(asset?.componentKey || ''),
                String(asset?.format || '')
            ])
        )
    }

    /**
     * Dispatches a click on a detached button-like node.
     * @param {HTMLElement | null} node Button-like node.
     * @returns {void}
     */
    static #dispatchClick(node) {
        if (!node || typeof node !== 'object') return

        if (typeof node.click === 'function') {
            node.click()
            return
        }

        if (typeof node.dispatch === 'function') {
            node.dispatch('click')
        }
    }

    /**
     * Hides the package export button while keeping it available for controller
     * listeners and programmatic sidebar proxy clicks.
     * @param {HTMLElement | null} node Package-owned export action.
     * @returns {void}
     */
    static #hideExportAction(node) {
        if (!node || typeof node !== 'object') return

        node.setAttribute?.('hidden', 'hidden')
        node.setAttribute?.('aria-hidden', 'true')
        node.setAttribute?.('tabindex', '-1')
    }
}
