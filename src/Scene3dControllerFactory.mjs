import { WorkerUrlBuilder } from './WorkerUrlBuilder.mjs'
import { EcadMissingModelSearchService } from './core/ecad/EcadMissingModelSearchService.mjs'
import { EcadModelSourceClient } from './core/ecad/EcadModelSourceClient.mjs'
import { EcadKicadModelLibraryClient } from './core/ecad/EcadKicadModelLibraryClient.mjs'
import { PcbScene3dModelBoundsPatch } from './core/ecad/PcbScene3dModelBoundsPatch.mjs'
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
     * @param {{ modelSearchService?: EcadMissingModelSearchService | null, modelSource?: object }} [options] Factory options.
     * @returns {(viewportNode: HTMLElement, documentModel: any, options?: object) => LazyScene3dController}
     */
    static create(
        entryModuleUrl,
        cacheKeyProvider = () => Date.now(),
        options = {}
    ) {
        const normalizedCacheKeyProvider =
            typeof cacheKeyProvider === 'function'
                ? cacheKeyProvider
                : () => Date.now()
        const factoryOptions =
            typeof cacheKeyProvider === 'function'
                ? options
                : cacheKeyProvider || {}
        let runtimeFactoryPromise = null
        const loadRuntimeFactory = () => {
            if (!runtimeFactoryPromise) {
                runtimeFactoryPromise =
                    Scene3dControllerFactory.#loadRuntimeFactory(
                        entryModuleUrl,
                        normalizedCacheKeyProvider,
                        factoryOptions
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
     * Creates the default missing-model search service for app features.
     * @param {{ modelSearchService?: EcadMissingModelSearchService | null, modelSource?: object }} [factoryOptions] Factory options.
     * @param {typeof import('altium-toolkit/parser').SourceComponentClient | null} [SourceComponentClient] Optional toolkit source client constructor.
     * @returns {EcadMissingModelSearchService | null}
     */
    static createModelSearchService(
        factoryOptions = {},
        SourceComponentClient = null
    ) {
        return Scene3dControllerFactory.#resolveModelSearchService(
            factoryOptions,
            SourceComponentClient
        )
    }

    /**
     * Loads the real 3D runtime and returns a sync controller constructor.
     * @param {string} entryModuleUrl Module URL used for worker path resolution.
     * @param {() => string | number} cacheKeyProvider Runtime cache key source.
     * @param {{ modelSearchService?: EcadMissingModelSearchService | null, modelSource?: object }} factoryOptions Factory options.
     * @returns {Promise<(viewportNode: HTMLElement, documentModel: any, options?: object) => any>}
     */
    static async #loadRuntimeFactory(
        entryModuleUrl,
        cacheKeyProvider,
        factoryOptions
    ) {
        const [
            { PcbScene3dController, PcbScene3dWorkerClient },
            sceneModule,
            toolkitModule
        ] = await Promise.all([
            import('pcb-scene3d-viewer'),
            import('./core/ecad/EcadScene3dService.mjs'),
            import('altium-toolkit/parser')
        ])
        PcbScene3dModelBoundsPatch.apply()
        const scene3dWorkerUrl = WorkerUrlBuilder.buildScene3dWorkerUrl(
            entryModuleUrl,
            cacheKeyProvider()
        )
        const { EcadScene3dService } = sceneModule
        const modelSearchService =
            Scene3dControllerFactory.#resolveModelSearchService(
                factoryOptions,
                toolkitModule.SourceComponentClient
            )

        return (viewportNode, documentModel, options = {}) => {
            const workerClient = new PcbScene3dWorkerClient(
                () => new Worker(scene3dWorkerUrl, { type: 'module' })
            )

            return new PcbScene3dController(viewportNode, documentModel, {
                ...options,
                buildScene: (nextDocumentModel, buildOptions) =>
                    EcadScene3dService.build(nextDocumentModel, buildOptions),
                createModelRegistry: (nextDocumentModel, sessionAssets) =>
                    EcadScene3dService.createModelRegistry(
                        nextDocumentModel,
                        sessionAssets
                    ),
                scenePrepClient:
                    Scene3dControllerFactory.#createScenePrepClient(
                        workerClient,
                        EcadScene3dService,
                        modelSearchService,
                        options
                    )
            })
        }
    }

    /**
     * Creates a scene prep client that can augment session model assets.
     * @param {{ prepareScene: Function, dispose?: Function }} workerClient Worker client.
     * @param {{ prepare: Function }} sceneService Scene service.
     * @param {EcadMissingModelSearchService | null} modelSearchService Search service.
     * @param {{ autoSearchMissingModels?: boolean }} options Controller options.
     * @returns {{ prepareScene: (documentModel: any, sessionAssets?: any[]) => Promise<any>, dispose: () => void }}
     */
    static #createScenePrepClient(
        workerClient,
        sceneService,
        modelSearchService,
        options
    ) {
        return {
            prepareScene: async (documentModel, sessionAssets = []) => {
                const resolvedAssets =
                    await Scene3dControllerFactory.#resolveSessionAssets(
                        modelSearchService,
                        documentModel,
                        sessionAssets,
                        options
                    )

                try {
                    return await workerClient.prepareScene(
                        documentModel,
                        resolvedAssets
                    )
                } catch (_error) {
                    return sceneService.prepare(documentModel, {
                        sessionAssets: resolvedAssets
                    })
                }
            },
            dispose: () => workerClient.dispose?.()
        }
    }

    /**
     * Resolves model assets through the optional search service.
     * @param {EcadMissingModelSearchService | null} modelSearchService Search service.
     * @param {any} documentModel Document model.
     * @param {any[]} sessionAssets Session assets.
     * @param {{ autoSearchMissingModels?: boolean }} options Controller options.
     * @returns {Promise<any[]>}
     */
    static async #resolveSessionAssets(
        modelSearchService,
        documentModel,
        sessionAssets,
        options
    ) {
        if (!modelSearchService || options.autoSearchMissingModels !== true) {
            return sessionAssets
        }

        return modelSearchService.resolveSessionAssets(documentModel, {
            enabled: true,
            sessionAssets
        })
    }

    /**
     * Resolves a configured model search service.
     * @param {{ modelSearchService?: EcadMissingModelSearchService | null, modelSource?: object }} factoryOptions Factory options.
     * @param {typeof import('altium-toolkit/parser').SourceComponentClient} SourceComponentClient Source client constructor.
     * @returns {EcadMissingModelSearchService | null}
     */
    static #resolveModelSearchService(factoryOptions, SourceComponentClient) {
        if (factoryOptions.modelSearchService !== undefined) {
            return factoryOptions.modelSearchService
        }

        const fetcher =
            typeof globalThis.fetch === 'function'
                ? globalThis.fetch.bind(globalThis)
                : null
        if (!fetcher) {
            return null
        }

        const sourceConfig = factoryOptions.modelSource ||
            globalThis.ECAD_FORGE_MODEL_SOURCE || {
                baseUrl: '/api/component-source/',
                fallbackBaseUrl: '/api/component-source.php'
            }
        const sourceClient =
            Scene3dControllerFactory.#resolveConfiguredSourceClient(
                sourceConfig,
                fetcher,
                SourceComponentClient
            )
        const clients = [
            new EcadKicadModelLibraryClient({
                fetcher,
                baseUrl: sourceConfig.kicadModelBaseUrl,
                requestTimeoutMs: sourceConfig.requestTimeoutMs
            }),
            sourceClient
        ].filter(Boolean)

        return clients.length
            ? new EcadMissingModelSearchService({
                  client: Scene3dControllerFactory.#composeModelSources(clients)
              })
            : null
    }

    /**
     * Resolves the configured generic source client.
     * @param {{ baseUrl?: string, fallbackBaseUrl?: string, searchPath?: string, componentPath?: string, modelPath?: string, retryCount?: number, retryDelayMs?: number, requestTimeoutMs?: number, headers?: Record<string, string>, clientClass?: Function, useToolkitSourceClient?: boolean }} sourceConfig Source configuration.
     * @param {Function} baseFetcher Fetch implementation.
     * @param {typeof import('altium-toolkit/parser').SourceComponentClient} SourceComponentClient Source client constructor.
     * @returns {object | null}
     */
    static #resolveConfiguredSourceClient(
        sourceConfig,
        baseFetcher,
        SourceComponentClient
    ) {
        if (!sourceConfig?.baseUrl) {
            return null
        }

        const fetcher = sourceConfig?.fetcher || baseFetcher

        if (!sourceConfig?.baseUrl || !fetcher) {
            return null
        }

        const ClientClass =
            sourceConfig?.clientClass ||
            (sourceConfig?.useToolkitSourceClient === true &&
            typeof SourceComponentClient === 'function'
                ? SourceComponentClient
                : EcadModelSourceClient)

        return new ClientClass({
            fetcher,
            baseUrl: sourceConfig.baseUrl,
            fallbackBaseUrl: sourceConfig.fallbackBaseUrl,
            searchPath: sourceConfig.searchPath,
            componentPath: sourceConfig.componentPath,
            modelPath: sourceConfig.modelPath,
            retryCount: sourceConfig.retryCount || 1,
            retryDelayMs: sourceConfig.retryDelayMs || 0,
            requestTimeoutMs: sourceConfig.requestTimeoutMs,
            headers: sourceConfig.headers || {}
        })
    }

    /**
     * Composes model sources, trying direct path sources before generic search.
     * @param {object[]} clients Source clients.
     * @returns {object}
     */
    static #composeModelSources(clients) {
        return {
            fetchComponentModel: async (component, options = {}) => {
                for (const client of clients) {
                    if (typeof client.fetchComponentModel !== 'function') {
                        continue
                    }
                    const model = await client.fetchComponentModel(
                        component,
                        options
                    )
                    if (model) {
                        return model
                    }
                }
                return null
            },
            searchComponents: async (query, options = {}) => {
                for (const client of clients) {
                    if (typeof client.searchComponents !== 'function') {
                        continue
                    }
                    const rows = await client.searchComponents(query, options)
                    if (rows.length) {
                        return rows
                    }
                }
                return []
            },
            fetchComponentBundle: async (id) => {
                for (const client of clients) {
                    if (typeof client.fetchComponentBundle !== 'function') {
                        continue
                    }
                    const bundle = await client.fetchComponentBundle(id)
                    if (Array.isArray(bundle?.models) && bundle.models.length) {
                        return bundle
                    }
                }
                return null
            },
            fetchBinaryAsset: async (sourceUrl) => {
                for (const client of clients) {
                    if (typeof client.fetchBinaryAsset !== 'function') {
                        continue
                    }
                    const bytes = await client.fetchBinaryAsset(sourceUrl)
                    if (bytes?.byteLength) {
                        return bytes
                    }
                }
                return new Uint8Array(0)
            }
        }
    }
}
