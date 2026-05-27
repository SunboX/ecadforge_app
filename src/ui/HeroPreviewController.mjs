import { HeroPreviewRenderer } from './HeroPreviewRenderer.mjs'

/**
 * Manages the landing-page preview switcher and its renderer-backed content.
 */
export class HeroPreviewController {
    #previewNode
    #chipsNode
    #documentModels
    #activeView
    #createScene3dController
    #scene3dController

    /**
     * @param {Document} documentRef Browser document.
     * @param {{ createScene3dController?: (viewportNode: HTMLElement, documentModel: any, options?: { sessionAssets?: any[], setLoadingVisible?: (visible: boolean) => void }) => { dispose?: () => void } }} [options]
     */
    constructor(documentRef, options = {}) {
        this.#previewNode = documentRef.querySelector('#heroPreviewScreen')
        this.#chipsNode = documentRef.querySelector('#heroViewChips')
        this.#documentModels = []
        this.#activeView = 'pcb'
        this.#createScene3dController =
            options.createScene3dController || (() => ({ dispose() {} }))
        this.#scene3dController = null
        this.#bindSelection()
    }

    /**
     * Stores parsed demo documents and refreshes the selected preview.
     * @param {any[]} documentModels Parsed demo document models.
     * @returns {void}
     */
    setDocuments(documentModels) {
        this.#documentModels = Array.isArray(documentModels)
            ? documentModels
            : []
        this.#render()
    }

    /** Binds landing-preview chip clicks. */
    #bindSelection() {
        this.#chipsNode?.addEventListener('click', (event) => {
            const target = event.target
            const button =
                target &&
                typeof target === 'object' &&
                typeof target.closest === 'function'
                    ? target.closest('[data-view-chip]')
                    : null

            if (!button || typeof button.getAttribute !== 'function') {
                return
            }

            event.preventDefault?.()
            this.#activeView = button.getAttribute('data-view-chip') || 'pcb'
            this.#render()
        })
    }

    /** Renders the selected preview without touching main viewer state. */
    #render() {
        this.#disposeScene3dController()
        this.#renderChips()
        if (!this.#previewNode || !this.#documentModels.length) {
            return
        }

        this.#previewNode.innerHTML = HeroPreviewRenderer.render(
            this.#documentModels,
            this.#activeView
        )

        if (this.#activeView === '3d') {
            this.#attachScene3dController()
        }
    }

    /** Updates chip pressed states. */
    #renderChips() {
        const buttons =
            this.#chipsNode?.querySelectorAll('[data-view-chip]') || []
        buttons.forEach((button) => {
            const selected =
                button.getAttribute('data-view-chip') === this.#activeView
            button.setAttribute('aria-pressed', selected ? 'true' : 'false')
        })
    }

    /** Mounts the 3D runtime when the compact 3D preview is selected. */
    #attachScene3dController() {
        const documentModel = HeroPreviewRenderer.resolveDocument(
            this.#documentModels,
            '3d'
        )
        const viewportNode = this.#previewNode?.querySelector(
            '[data-scene-3d-viewport]'
        )
        if (!documentModel || !viewportNode) {
            return
        }

        const loadingNode = this.#previewNode?.querySelector(
            '[data-scene-3d-loading]'
        )
        const setLoadingVisible = (visible) => {
            if (!loadingNode) {
                return
            }

            if (visible) {
                loadingNode.removeAttribute?.('hidden')
                return
            }

            loadingNode.setAttribute?.('hidden', 'hidden')
        }
        setLoadingVisible(true)

        this.#scene3dController = this.#createScene3dController(
            viewportNode,
            documentModel,
            {
                sessionAssets: [],
                setLoadingVisible
            }
        )
    }

    /** Disposes the compact 3D runtime before replacing preview content. */
    #disposeScene3dController() {
        this.#scene3dController?.dispose?.()
        this.#scene3dController = null
    }
}
