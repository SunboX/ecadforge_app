/**
 * Defers loading the heavy 3D runtime until a 3D viewport is actually mounted.
 */
export class LazyScene3dController {
    /** @type {HTMLElement | null} */
    #viewportNode

    /** @type {any} */
    #documentModel

    /** @type {object} */
    #options

    /** @type {() => Promise<(viewportNode: HTMLElement, documentModel: any, options?: object) => any>} */
    #loadControllerFactory

    /** @type {any | null} */
    #controller

    /** @type {boolean} */
    #isDisposed

    /** @type {boolean} */
    #hasSelectedComponent

    /** @type {string} */
    #selectedComponentKey

    /**
     * @param {HTMLElement} viewportNode 3D viewport mount.
     * @param {any} documentModel Active document model.
     * @param {object} options Controller options.
     * @param {() => Promise<(viewportNode: HTMLElement, documentModel: any, options?: object) => any>} loadControllerFactory Lazy runtime factory loader.
     */
    constructor(viewportNode, documentModel, options, loadControllerFactory) {
        this.#viewportNode = viewportNode
        this.#documentModel = documentModel
        this.#options = options || {}
        this.#loadControllerFactory = loadControllerFactory
        this.#controller = null
        this.#isDisposed = false
        this.#hasSelectedComponent = false
        this.#selectedComponentKey = ''

        this.#mountController()
    }

    /**
     * Returns the mounted document model even while the real runtime loads.
     * @returns {any}
     */
    getDocumentModel() {
        return this.#documentModel
    }

    /**
     * Queues or forwards one selected component update.
     * @param {string} componentKey Selected component designator.
     * @returns {void}
     */
    setSelectedComponent(componentKey) {
        this.#hasSelectedComponent = true
        this.#selectedComponentKey = String(componentKey || '')
        this.#controller?.setSelectedComponent?.(this.#selectedComponentKey)
    }

    /**
     * Disposes the loaded runtime, or prevents mounting if loading is pending.
     * @returns {void}
     */
    dispose() {
        this.#isDisposed = true
        this.#controller?.dispose?.()
        this.#controller = null
        this.#viewportNode = null
        this.#documentModel = null
    }

    /**
     * Loads and mounts the real 3D controller.
     * @returns {Promise<void>}
     */
    async #mountController() {
        try {
            const createController = await this.#loadControllerFactory()
            if (this.#isDisposed || !this.#viewportNode) {
                return
            }

            this.#controller = createController(
                this.#viewportNode,
                this.#documentModel,
                this.#options
            )
            if (this.#hasSelectedComponent) {
                this.#controller?.setSelectedComponent?.(
                    this.#selectedComponentKey
                )
            }
        } catch (error) {
            if (!this.#isDisposed) {
                this.#reportLoadFailure(error)
            }
        }
    }

    /**
     * Shows a startup failure in the existing 3D diagnostics area.
     * @param {unknown} error Runtime loading error.
     * @returns {void}
     */
    #reportLoadFailure(error) {
        this.#options?.setLoadingVisible?.(false)
        const diagnosticsNode = this.#viewportNode
            ?.closest?.('.scene-3d')
            ?.querySelector?.('.scene-3d__diagnostics')
        if (!diagnosticsNode) {
            return
        }

        diagnosticsNode.textContent =
            '3D preview could not start: ' +
            String(error?.message || error || 'Unknown error.')
    }
}
