import { EcadScene3dService } from './ecad/EcadScene3dService.mjs'
import { PcbAssemblyBoardTextureRenderer } from './PcbAssemblyBoardTextureRenderer.mjs'
import {
    PcbAssemblyGeometryBuildProgress,
    PcbAssemblyGeometryBuilder,
    PcbAssemblyGltfWriter,
    PcbAssemblyModelMeshLoader,
    PcbAssemblyStepWriter,
    PcbAssemblyWrlWriter
} from 'pcb-scene3d-viewer/scene3d'

/**
 * Builds whole-PCB assembly exports from prepared 3D scene data.
 */
export class PcbAssemblyExportService {
    /** @type {{ prepare?: (documentModel: object, options?: object) => Promise<object> }} */
    #sceneService

    /** @type {PcbAssemblyModelMeshLoader | null} */
    #modelMeshLoader

    /** @type {((placement: object) => Promise<object | object[]>) | null} */
    #modelMeshLoaderCallback

    /** @type {{ render?: (documentModel: object | object[], options?: object) => ({ top?: string, bottom?: string } | null) | Promise<{ top?: string, bottom?: string } | null> } | null} */
    #boardTextureRenderer

    /**
     * @param {{ sceneService?: { prepare?: (documentModel: object, options?: object) => Promise<object> }, modelMeshLoader?: ((placement: object) => Promise<object | object[]>) | PcbAssemblyModelMeshLoader, boardTextureRenderer?: { render?: (documentModel: object | object[], options?: object) => ({ top?: string, bottom?: string } | null) | Promise<{ top?: string, bottom?: string } | null> } | null }} [options] Service options.
     */
    constructor(options = {}) {
        this.#sceneService = options.sceneService || EcadScene3dService
        this.#modelMeshLoader =
            options.modelMeshLoader instanceof PcbAssemblyModelMeshLoader
                ? options.modelMeshLoader
                : null
        this.#modelMeshLoaderCallback =
            typeof options.modelMeshLoader === 'function'
                ? options.modelMeshLoader
                : null
        this.#boardTextureRenderer =
            options.boardTextureRenderer === null
                ? null
                : options.boardTextureRenderer ||
                  PcbAssemblyBoardTextureRenderer
    }

    /**
     * Exports one PCB assembly.
     * @param {{ format?: string, documentModel?: object, sceneDescription?: object, sessionAssets?: object[], includeModels?: boolean, renderFallbackBodies?: boolean, boardDrillQuality?: string, drawFauxBoard?: boolean, boardTextureFormat?: string, boardTextureResolution?: number, boardTextureShowNotes?: boolean, projectBaseUrl?: string, modelUrlResolver?: (url: string, context: object) => string | object | null | undefined, allowNetworkModelFetch?: boolean, modelFetch?: (url: string, options: object) => Promise<any>, modelFetchTimeoutMs?: number, authHeaders?: Record<string, string>, modelCache?: Map<string, Promise<Uint8Array>>, includeSceneMetadata?: boolean, sceneCameraPreset?: string, sceneCameraAspectRatio?: number, sceneCameraFovDegrees?: number, onProgress?: (progress: { value: number, message: string }) => void }} options Export options.
     * @returns {Promise<{ fileName: string, bytes: Uint8Array, contentType: string, diagnostics: object[], meshCount: number }>}
     */
    async export(options = {}) {
        const format = PcbAssemblyExportService.#normalizeFormat(options.format)
        const onProgress =
            typeof options.onProgress === 'function' ? options.onProgress : null
        PcbAssemblyExportService.#reportProgress(
            onProgress,
            5,
            'Preparing 3D scene data'
        )
        const sceneDescription = await this.#resolveSceneDescription(options)
        const assemblyName =
            PcbAssemblyExportService.#assemblyBaseName(options.documentModel) +
            '-assembly'
        const buildProgress = PcbAssemblyGeometryBuildProgress.create(
            sceneDescription,
            onProgress,
            { startValue: 10, endValue: 72 }
        )
        const geometry = await PcbAssemblyGeometryBuilder.build(
            sceneDescription,
            {
                modelMeshLoader: (placement) =>
                    this.#loadPlacementMesh(placement, options),
                progress: buildProgress,
                ...PcbAssemblyExportService.#geometryBuildOptions(options)
            }
        )
        PcbAssemblyExportService.#reportProgress(
            onProgress,
            75,
            'Writing ' + format.toUpperCase() + ' assembly'
        )
        const boardTextures = await this.#renderBoardTextures(format, options)
        const payload = PcbAssemblyExportService.#writeAssembly(
            format,
            assemblyName,
            PcbAssemblyExportService.#withBoardTextures(
                geometry.meshes,
                boardTextures
            ),
            options
        )

        PcbAssemblyExportService.#reportProgress(
            onProgress,
            92,
            'Encoding ' + format.toUpperCase() + ' download'
        )
        PcbAssemblyExportService.#reportProgress(
            onProgress,
            100,
            'Export ready'
        )

        return {
            fileName:
                assemblyName +
                '.' +
                PcbAssemblyExportService.#fileExtension(format),
            bytes: payload.bytes,
            contentType: PcbAssemblyExportService.#contentType(format),
            diagnostics: geometry.diagnostics,
            meshCount: geometry.meshes.length
        }
    }

    /**
     * Releases owned resources.
     * @returns {void}
     */
    dispose() {
        this.#modelMeshLoader?.dispose?.()
        this.#modelMeshLoader = null
    }

    /**
     * Resolves prepared scene data.
     * @param {{ documentModel?: object, sceneDescription?: object, sessionAssets?: object[], includeModels?: boolean, renderFallbackBodies?: boolean, boardDrillQuality?: string, drawFauxBoard?: boolean, projectBaseUrl?: string, modelUrlResolver?: (url: string, context: object) => string | object | null | undefined }} options Export options.
     * @returns {Promise<object>}
     */
    async #resolveSceneDescription(options) {
        if (options.sceneDescription) {
            return options.sceneDescription
        }

        if (typeof this.#sceneService?.prepare !== 'function') {
            throw new Error('3D scene preparation is unavailable.')
        }

        return await this.#sceneService.prepare(
            options.documentModel || {},
            PcbAssemblyExportService.#scenePrepareOptions(options)
        )
    }

    /**
     * Loads one placement mesh through the configured loader.
     * @param {object} placement External placement.
     * @param {object} options Export options.
     * @returns {Promise<object | object[]>}
     */
    async #loadPlacementMesh(placement, options) {
        if (this.#modelMeshLoaderCallback) {
            return await this.#modelMeshLoaderCallback(placement)
        }

        if (PcbAssemblyExportService.#usesNetworkModelOptions(options)) {
            const loader = new PcbAssemblyModelMeshLoader(
                PcbAssemblyExportService.#modelMeshLoaderOptions(options)
            )
            try {
                return await loader.loadPlacement(placement)
            } finally {
                loader.dispose()
            }
        }

        if (!this.#modelMeshLoader) {
            this.#modelMeshLoader = new PcbAssemblyModelMeshLoader()
        }

        return await this.#modelMeshLoader.loadPlacement(placement)
    }

    /**
     * Renders board texture data for texture-capable export formats.
     * @param {'step' | 'wrl' | 'gltf' | 'glb'} format Export format.
     * @param {{ documentModel?: object, boardTextureFormat?: string, boardTextureResolution?: number, boardTextureShowNotes?: boolean }} options Export options.
     * @returns {Promise<{ top?: string, bottom?: string } | null>}
     */
    async #renderBoardTextures(format, options) {
        if (
            !this.#boardTextureRenderer ||
            (format !== 'gltf' && format !== 'glb')
        ) {
            return null
        }

        return (
            (await this.#boardTextureRenderer.render?.(
                options.documentModel || {},
                PcbAssemblyExportService.#boardTextureOptions(options)
            )) || null
        )
    }

    /**
     * Builds texture render options for board artwork export.
     * @param {{ boardTextureFormat?: string, boardTextureResolution?: number, boardTextureShowNotes?: boolean }} options Export options.
     * @returns {{ imageFormat?: string, resolution?: number, showNotes?: boolean }}
     */
    static #boardTextureOptions(options) {
        const textureOptions = {}
        if (options.boardTextureFormat) {
            textureOptions.imageFormat = options.boardTextureFormat
        }
        if (options.boardTextureResolution) {
            textureOptions.resolution = options.boardTextureResolution
        }
        if (typeof options.boardTextureShowNotes === 'boolean') {
            textureOptions.showNotes = options.boardTextureShowNotes
        }
        return textureOptions
    }

    /**
     * Builds 3D scene preparation options from assembly export settings.
     * @param {{ sessionAssets?: object[], includeModels?: boolean, renderFallbackBodies?: boolean, boardDrillQuality?: string, drawFauxBoard?: boolean, projectBaseUrl?: string, modelUrlResolver?: (url: string, context: object) => string | object | null | undefined }} options Export options.
     * @returns {{ sessionAssets: object[], includeModels?: boolean, renderFallbackBodies?: boolean, boardDrillQuality?: string, drawFauxBoard?: boolean, projectBaseUrl?: string, modelUrlResolver?: (url: string, context: object) => string | object | null | undefined }}
     */
    static #scenePrepareOptions(options) {
        const prepareOptions = {
            sessionAssets: options.sessionAssets || []
        }
        for (const key of [
            'includeModels',
            'renderFallbackBodies',
            'boardDrillQuality',
            'drawFauxBoard',
            'projectBaseUrl',
            'modelUrlResolver'
        ]) {
            if (Object.hasOwn(options, key)) {
                prepareOptions[key] = options[key]
            }
        }
        return prepareOptions
    }

    /**
     * Builds assembly geometry options from export settings.
     * @param {{ includeModels?: boolean, renderFallbackBodies?: boolean }} options Export options.
     * @returns {{ includeModels?: boolean, renderFallbackBodies?: boolean }}
     */
    static #geometryBuildOptions(options) {
        const geometryOptions = {}
        for (const key of ['includeModels', 'renderFallbackBodies']) {
            if (Object.hasOwn(options, key)) {
                geometryOptions[key] = options[key]
            }
        }
        return geometryOptions
    }

    /**
     * Normalizes the requested export format.
     * @param {string | undefined} format Requested format.
     * @returns {'step' | 'wrl' | 'gltf' | 'glb'}
     */
    static #normalizeFormat(format) {
        const normalized = String(format || 'step').toLowerCase()
        if (normalized === 'wrl' || normalized === 'vrml') {
            return 'wrl'
        }
        if (normalized === 'gltf' || normalized === 'glb') {
            return normalized
        }
        return 'step'
    }

    /**
     * Writes the requested assembly payload.
     * @param {'step' | 'wrl' | 'gltf' | 'glb'} format Export format.
     * @param {string} assemblyName Assembly name.
     * @param {object[]} meshes Assembly meshes.
     * @param {{ includeSceneMetadata?: boolean, sceneCameraPreset?: string, sceneCameraAspectRatio?: number, sceneCameraFovDegrees?: number }} options Export options.
     * @returns {{ bytes: Uint8Array }}
     */
    static #writeAssembly(format, assemblyName, meshes, options = {}) {
        const sceneMetadataOptions =
            PcbAssemblyExportService.#sceneMetadataOptions(options)
        if (format === 'glb') {
            return {
                bytes: PcbAssemblyGltfWriter.write({
                    name: assemblyName,
                    meshes,
                    format,
                    ...sceneMetadataOptions
                })
            }
        }

        if (format === 'gltf') {
            return {
                bytes: new TextEncoder().encode(
                    JSON.stringify(
                        PcbAssemblyGltfWriter.write({
                            name: assemblyName,
                            meshes,
                            format,
                            ...sceneMetadataOptions
                        })
                    )
                )
            }
        }

        const text =
            format === 'wrl'
                ? PcbAssemblyWrlWriter.write({
                      name: assemblyName,
                      meshes
                  })
                : PcbAssemblyStepWriter.write({
                      name: assemblyName,
                      meshes
                  })

        return {
            bytes: new TextEncoder().encode(text)
        }
    }

    /**
     * Builds GLTF scene metadata options from export settings.
     * @param {{ includeSceneMetadata?: boolean, sceneCameraPreset?: string, sceneCameraAspectRatio?: number, sceneCameraFovDegrees?: number }} options Export options.
     * @returns {{ includeSceneMetadata: boolean, sceneCameraPreset?: string, sceneCameraAspectRatio?: number, sceneCameraFovDegrees?: number }}
     */
    static #sceneMetadataOptions(options) {
        const sceneOptions = {
            includeSceneMetadata: options.includeSceneMetadata !== false
        }
        for (const key of [
            'sceneCameraPreset',
            'sceneCameraAspectRatio',
            'sceneCameraFovDegrees'
        ]) {
            if (Object.hasOwn(options, key)) {
                sceneOptions[key] = options[key]
            }
        }
        return sceneOptions
    }

    /**
     * Applies rendered board texture data to board substrate meshes.
     * @param {object[]} meshes Assembly meshes.
     * @param {{ top?: string, bottom?: string } | null} textures Texture data.
     * @returns {object[]}
     */
    static #withBoardTextures(meshes, textures) {
        if (!textures?.top && !textures?.bottom) {
            return meshes
        }

        return meshes.map((mesh) =>
            String(mesh?.name || '') === 'board'
                ? {
                      ...mesh,
                      texture: {
                          ...(mesh.texture || {}),
                          ...(textures.top ? { top: textures.top } : {}),
                          ...(textures.bottom
                              ? { bottom: textures.bottom }
                              : {})
                      }
                  }
                : mesh
        )
    }

    /**
     * Returns true when a one-off model loader needs network fetch settings.
     * @param {object} options Export options.
     * @returns {boolean}
     */
    static #usesNetworkModelOptions(options) {
        return Boolean(
            options?.allowNetworkModelFetch === true ||
            typeof options?.modelFetch === 'function' ||
            options?.authHeaders ||
            options?.modelFetchTimeoutMs ||
            options?.modelCache
        )
    }

    /**
     * Builds model mesh loader options from export settings.
     * @param {object} options Export options.
     * @returns {object}
     */
    static #modelMeshLoaderOptions(options) {
        return {
            allowNetworkModelFetch: options?.allowNetworkModelFetch === true,
            ...(typeof options?.modelFetch === 'function'
                ? { fetch: options.modelFetch }
                : {}),
            ...(options?.authHeaders
                ? { authHeaders: options.authHeaders }
                : {}),
            ...(options?.modelFetchTimeoutMs
                ? { fetchTimeoutMs: options.modelFetchTimeoutMs }
                : {}),
            ...(options?.modelCache ? { modelCache: options.modelCache } : {})
        }
    }

    /**
     * Resolves the export file extension.
     * @param {'step' | 'wrl' | 'gltf' | 'glb'} format Export format.
     * @returns {string}
     */
    static #fileExtension(format) {
        return format
    }

    /**
     * Resolves the download content type.
     * @param {'step' | 'wrl' | 'gltf' | 'glb'} format Export format.
     * @returns {string}
     */
    static #contentType(format) {
        if (format === 'wrl') {
            return 'model/vrml'
        }
        if (format === 'glb') {
            return 'model/gltf-binary'
        }
        if (format === 'gltf') {
            return 'model/gltf+json'
        }
        return 'model/step'
    }

    /**
     * Builds a safe base file name for the assembly.
     * @param {object | undefined} documentModel Active document model.
     * @returns {string}
     */
    static #assemblyBaseName(documentModel) {
        return (
            String(
                documentModel?.fileName ||
                    documentModel?.summary?.title ||
                    'pcb'
            )
                .replace(/\.[^.]+$/u, '')
                .replace(/[^A-Za-z0-9_.-]+/gu, '-')
                .replace(/^-+|-+$/gu, '')
                .slice(0, 80) || 'pcb'
        )
    }

    /**
     * Emits a coarse export progress update.
     * @param {((progress: { value: number, message: string }) => void) | null} onProgress Progress callback.
     * @param {number} value Progress value from 0 to 100.
     * @param {string} message Human-readable progress message.
     * @returns {void}
     */
    static #reportProgress(onProgress, value, message) {
        onProgress?.({
            value,
            message
        })
    }
}
