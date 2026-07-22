import { unzipSync } from 'fflate'
import {
    PcbAssemblyModelMeshLoader,
    PcbModelArchiveExporter
} from 'pcb-scene3d-viewer/scene3d'
import { EcadScene3dService } from './ecad/EcadScene3dService.mjs'

/**
 * Adds generated stitched STEP models to selected-part export bundles.
 */
export class SelectedPartStitchedModelExporter {
    /** @type {{ prepare?: (documentModel: object, options?: object) => Promise<object> }} */
    #sceneService

    /** @type {PcbAssemblyModelMeshLoader | null} */
    #modelMeshLoader

    /** @type {((placement: object) => Promise<object | object[]> | object | object[]) | null} */
    #modelMeshLoaderCallback

    /**
     * @param {{ sceneService?: { prepare?: (documentModel: object, options?: object) => Promise<object> }, modelMeshLoader?: ((placement: object) => Promise<object | object[]> | object | object[]) | PcbAssemblyModelMeshLoader }} [options] Exporter options.
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
     * Adds a generated stitched STEP model for authored multi-body parts.
     * @param {{ models: object[], entries: { path: string, bytes: Uint8Array, contentType: string }[], diagnostics: object[] }} modelBundle Mutable model bundle.
     * @param {object} selectedPart Selected part data.
     * @param {{ documentModel?: object, sceneDescription?: object, sessionAssets?: object[] }} options Export options.
     * @param {string} partName Export artifact name.
     * @returns {Promise<void>}
     */
    async append(modelBundle, selectedPart, options, partName) {
        const designator = String(selectedPart?.designator || '').trim()
        if (
            !designator ||
            (!options.sceneDescription && !options.documentModel)
        ) {
            return
        }

        try {
            const sceneDescription =
                await this.#resolveSceneDescription(options)
            if (!sceneDescription) {
                return
            }

            const archive = await PcbModelArchiveExporter.buildArchive({
                archiveBaseName: partName,
                sceneDescription,
                includeRawModels: false,
                stitchedDesignators: [designator],
                modelMeshLoader: (placement) =>
                    this.#loadPlacementMesh(placement)
            })

            this.#appendArchiveEntries(
                modelBundle,
                archive,
                designator,
                partName
            )
        } catch (error) {
            modelBundle.diagnostics.push(
                SelectedPartStitchedModelExporter.#diagnostic(
                    'warning',
                    'selected_part_stitched_model_unavailable',
                    'The stitched 3D model could not be generated: ' +
                        String(error?.message || error || 'unknown error') +
                        '.'
                )
            )
        }
    }

    /**
     * Releases owned mesh-loader resources.
     * @returns {void}
     */
    dispose() {
        this.#modelMeshLoader?.dispose?.()
        this.#modelMeshLoader = null
    }

    /**
     * Appends generated stitched archive entries to a selected model bundle.
     * @param {{ models: object[], entries: { path: string, bytes: Uint8Array, contentType: string }[], diagnostics: object[] }} modelBundle Mutable model bundle.
     * @param {{ archiveBytes: Uint8Array, exportedEntries?: object[], skippedEntries?: object[] }} archive Stitched archive result.
     * @param {string} designator Selected designator.
     * @param {string} partName Export artifact name.
     * @returns {void}
     */
    #appendArchiveEntries(modelBundle, archive, designator, partName) {
        SelectedPartStitchedModelExporter.#array(archive.skippedEntries)
            .filter((entry) =>
                SelectedPartStitchedModelExporter.#sameDesignator(
                    entry.designator,
                    designator
                )
            )
            .forEach((entry) => {
                modelBundle.diagnostics.push(
                    SelectedPartStitchedModelExporter.#diagnostic(
                        'warning',
                        'selected_part_stitched_model_skipped',
                        'The stitched 3D model for ' +
                            designator +
                            ' could not be generated: ' +
                            String(entry.reason || 'unknown error') +
                            '.'
                    )
                )
            })

        const stitchedEntries = SelectedPartStitchedModelExporter.#array(
            archive.exportedEntries
        ).filter(
            (entry) =>
                entry.kind === 'stitched-component' &&
                SelectedPartStitchedModelExporter.#sameDesignator(
                    entry.designator,
                    designator
                )
        )
        if (!stitchedEntries.length) {
            return
        }

        const archiveEntries = unzipSync(archive.archiveBytes)
        stitchedEntries.forEach((entry) => {
            const bytes = archiveEntries[entry.archivePath]
            if (!bytes) {
                return
            }

            const name = SelectedPartStitchedModelExporter.#uniqueArchiveName(
                partName + '-stitched.step',
                new Set(modelBundle.models.map((model) => model.name))
            )
            const model = {
                id: 'selected-part-stitched-model-' + modelBundle.models.length,
                name,
                format: 'step',
                bytes,
                path: entry.archivePath,
                sourcePath: entry.archivePath,
                transform: null,
                generated: true
            }

            modelBundle.models.push(model)
            modelBundle.entries.push({
                path: 'models/' + name,
                bytes,
                contentType: 'model/step'
            })
        })
    }

    /**
     * Resolves prepared 3D scene data for stitched selected-part export.
     * @param {{ documentModel?: object, sceneDescription?: object, sessionAssets?: object[] }} options Export options.
     * @returns {Promise<object | null>}
     */
    async #resolveSceneDescription(options) {
        if (options.sceneDescription) {
            return options.sceneDescription
        }

        if (typeof this.#sceneService?.prepare !== 'function') {
            return null
        }

        return await this.#sceneService.prepare(options.documentModel || {}, {
            sessionAssets: options.sessionAssets || []
        })
    }

    /**
     * Loads one external placement mesh through the configured loader.
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
     * Ensures a model file name is unique within the selected ZIP.
     * @param {string} name Candidate file name.
     * @param {Set<string>} usedNames Used file names.
     * @returns {string}
     */
    static #uniqueArchiveName(name, usedNames) {
        const safeName = name || 'model.step'
        if (!usedNames.has(safeName)) {
            usedNames.add(safeName)
            return safeName
        }

        const extension = safeName.includes('.')
            ? '.' + safeName.split('.').at(-1)
            : ''
        const stem = extension ? safeName.slice(0, -extension.length) : safeName
        let index = 2
        let candidate = stem + '-' + index + extension

        while (usedNames.has(candidate)) {
            index += 1
            candidate = stem + '-' + index + extension
        }

        usedNames.add(candidate)
        return candidate
    }

    /**
     * Returns true when two designator tokens identify the same component.
     * @param {unknown} left First designator.
     * @param {unknown} right Second designator.
     * @returns {boolean}
     */
    static #sameDesignator(left, right) {
        return (
            String(left || '')
                .trim()
                .toUpperCase() ===
            String(right || '')
                .trim()
                .toUpperCase()
        )
    }

    /**
     * Creates one structured diagnostic.
     * @param {string} severity Diagnostic severity.
     * @param {string} code Stable diagnostic code.
     * @param {string} message Diagnostic message.
     * @returns {{ severity: string, code: string, message: string }}
     */
    static #diagnostic(severity, code, message) {
        return { severity, code, message }
    }

    /**
     * Normalizes a possible array.
     * @param {unknown} value Candidate array.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }
}
