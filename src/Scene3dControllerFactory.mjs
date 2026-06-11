import { WorkerUrlBuilder } from './WorkerUrlBuilder.mjs'
import { LazyScene3dController } from './ui/LazyScene3dController.mjs'

/**
 * Creates lazy 3D scene controllers without loading the 3D module graph during
 * normal schematic or PCB startup.
 */
export class Scene3dControllerFactory {
    /**
     * Creates an app 3D controller factory.
     * @param {string} entryModuleUrl Module URL used for worker path resolution.
     * @param {() => string | number} [cacheKeyProvider] Runtime cache key source.
     * @returns {(viewportNode: HTMLElement, documentModel: any, options?: object) => LazyScene3dController}
     */
    static create(entryModuleUrl, cacheKeyProvider = () => Date.now()) {
        let runtimeFactoryPromise = null
        const loadRuntimeFactory = () => {
            if (!runtimeFactoryPromise) {
                runtimeFactoryPromise =
                    Scene3dControllerFactory.#loadRuntimeFactory(
                        entryModuleUrl,
                        cacheKeyProvider
                    )
            }

            return runtimeFactoryPromise
        }

        return (viewportNode, documentModel, options = {}) =>
            new LazyScene3dController(
                viewportNode,
                documentModel,
                options,
                loadRuntimeFactory
            )
    }

    /**
     * Loads the real 3D runtime and returns a sync controller constructor.
     * @param {string} entryModuleUrl Module URL used for worker path resolution.
     * @param {() => string | number} cacheKeyProvider Runtime cache key source.
     * @returns {Promise<(viewportNode: HTMLElement, documentModel: any, options?: object) => any>}
     */
    static async #loadRuntimeFactory(entryModuleUrl, cacheKeyProvider) {
        const [{ PcbScene3dController, PcbScene3dWorkerClient }, sceneModule] =
            await Promise.all([
                import('pcb-scene3d-viewer'),
                import('./core/ecad/EcadScene3dService.mjs')
            ])
        const scene3dWorkerUrl = WorkerUrlBuilder.buildScene3dWorkerUrl(
            entryModuleUrl,
            cacheKeyProvider()
        )
        const { EcadScene3dService } = sceneModule

        return (viewportNode, documentModel, options = {}) =>
            new PcbScene3dController(viewportNode, documentModel, {
                ...options,
                buildScene: (nextDocumentModel, buildOptions) =>
                    EcadScene3dService.build(nextDocumentModel, buildOptions),
                createModelRegistry: (nextDocumentModel, sessionAssets) =>
                    EcadScene3dService.createModelRegistry(
                        nextDocumentModel,
                        sessionAssets
                    ),
                scenePrepClient: new PcbScene3dWorkerClient(
                    () => new Worker(scene3dWorkerUrl, { type: 'module' })
                )
            })
    }
}
