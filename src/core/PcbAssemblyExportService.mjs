import { EcadScene3dService } from './ecad/EcadScene3dService.mjs'
import {
    PcbAssemblyGeometryBuildProgress,
    PcbAssemblyGeometryBuilder,
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

    /**
     * @param {{ sceneService?: { prepare?: (documentModel: object, options?: object) => Promise<object> }, modelMeshLoader?: ((placement: object) => Promise<object | object[]>) | PcbAssemblyModelMeshLoader }} [options] Service options.
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
    }

    /**
     * Exports one PCB assembly.
     * @param {{ format?: string, documentModel?: object, sceneDescription?: object, sessionAssets?: object[], onProgress?: (progress: { value: number, message: string }) => void }} options Export options.
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
                    this.#loadPlacementMesh(placement),
                progress: buildProgress
            }
        )
        PcbAssemblyExportService.#reportProgress(
            onProgress,
            75,
            'Writing ' + format.toUpperCase() + ' assembly'
        )
        const text =
            format === 'wrl'
                ? PcbAssemblyWrlWriter.write({
                      name: assemblyName,
                      meshes: geometry.meshes
                  })
                : PcbAssemblyStepWriter.write({
                      name: assemblyName,
                      meshes: geometry.meshes
                  })

        PcbAssemblyExportService.#reportProgress(
            onProgress,
            92,
            'Encoding ' + format.toUpperCase() + ' download'
        )
        const bytes = new TextEncoder().encode(text)
        PcbAssemblyExportService.#reportProgress(
            onProgress,
            100,
            'Export ready'
        )

        return {
            fileName: assemblyName + (format === 'wrl' ? '.wrl' : '.step'),
            bytes,
            contentType: format === 'wrl' ? 'model/vrml' : 'model/step',
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
     * @param {{ documentModel?: object, sceneDescription?: object, sessionAssets?: object[] }} options Export options.
     * @returns {Promise<object>}
     */
    async #resolveSceneDescription(options) {
        if (options.sceneDescription) {
            return options.sceneDescription
        }

        if (typeof this.#sceneService?.prepare !== 'function') {
            throw new Error('3D scene preparation is unavailable.')
        }

        return await this.#sceneService.prepare(options.documentModel || {}, {
            sessionAssets: options.sessionAssets || []
        })
    }

    /**
     * Loads one placement mesh through the configured loader.
     * @param {object} placement External placement.
     * @returns {Promise<object | object[]>}
     */
    async #loadPlacementMesh(placement) {
        if (this.#modelMeshLoaderCallback) {
            return await this.#modelMeshLoaderCallback(placement)
        }

        if (!this.#modelMeshLoader) {
            this.#modelMeshLoader = new PcbAssemblyModelMeshLoader()
        }

        return await this.#modelMeshLoader.loadPlacement(placement)
    }

    /**
     * Normalizes the requested export format.
     * @param {string | undefined} format Requested format.
     * @returns {'step' | 'wrl'}
     */
    static #normalizeFormat(format) {
        const normalized = String(format || 'step').toLowerCase()
        return normalized === 'wrl' || normalized === 'vrml' ? 'wrl' : 'step'
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
