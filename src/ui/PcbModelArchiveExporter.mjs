import { zipSync } from '../vendor/fflate/browser.mjs'

/**
 * Builds browser-downloadable ZIP archives from resolved PCB component model
 * data.
 */
export class PcbModelArchiveExporter {
    /**
     * Builds one ZIP archive from the resolved scene description.
     * @param {{ archiveBaseName?: string, sceneDescription?: { components?: any[], externalPlacements?: any[] } }} [options]
     * @returns {Promise<{ archiveName: string, archiveBytes: Uint8Array, exportedEntries: { archivePath: string, pattern: string, designator: string, format: string, modelName: string }[], skippedEntries: { designator: string, reason: string }[] }>}
     */
    static async buildArchive(options = {}) {
        const archiveName =
            PcbModelArchiveExporter.#resolveArchiveName(
                options.archiveBaseName
            )
        const resolvedEntries =
            PcbModelArchiveExporter.#collectResolvedEntries(
                options.sceneDescription
            )
        const exportedEntries = []
        const skippedEntries = []
        const archiveInput = {}

        for (const entry of resolvedEntries) {
            try {
                const archivePath =
                    PcbModelArchiveExporter.#resolveArchivePath(
                        entry,
                        exportedEntries
                    )
                const modelBytes =
                    await PcbModelArchiveExporter.#readModelBytes(entry.model)
                archiveInput[archivePath] = modelBytes
                exportedEntries.push({
                    archivePath,
                    pattern: entry.pattern,
                    designator: entry.designator,
                    format: entry.model.format,
                    modelName: entry.model.name
                })
            } catch (error) {
                skippedEntries.push({
                    designator: entry.designator,
                    reason: String(
                        error?.message || error || 'Model export failed.'
                    )
                })
            }
        }

        return {
            archiveName,
            archiveBytes: zipSync(archiveInput),
            exportedEntries,
            skippedEntries
        }
    }

    /**
     * Collects one deduplicated list of exportable resolved models from the
     * same scene description shape used by the 3D runtime.
     * @param {{ components?: any[], externalPlacements?: any[] } | undefined} sceneDescription
     * @returns {{ pattern: string, designator: string, model: any, identityKey: string }[]}
     */
    static #collectResolvedEntries(sceneDescription) {
        const components = Array.isArray(sceneDescription?.components)
            ? sceneDescription.components
            : []
        const explicitPlacements = Array.isArray(
            sceneDescription?.externalPlacements
        )
            ? sceneDescription.externalPlacements
            : []
        const componentByDesignator = new Map()
        const explicitDesignators = new Set()

        components.forEach((component) => {
            const designator = String(component?.designator || '').trim()
            if (!designator) {
                return
            }

            componentByDesignator.set(designator, component)
        })

        const collectedEntries = []
        explicitPlacements.forEach((placement) => {
            const designator = String(placement?.designator || '').trim()
            if (!designator || !placement?.externalModel) {
                return
            }

            explicitDesignators.add(designator)
            const component = componentByDesignator.get(designator) || null
            collectedEntries.push({
                pattern: PcbModelArchiveExporter.#resolvePattern(
                    component,
                    placement
                ),
                designator,
                model: placement.externalModel,
                identityKey:
                    PcbModelArchiveExporter.#resolveModelIdentity(
                        placement.externalModel
                    )
            })
        })

        components.forEach((component) => {
            const designator = String(component?.designator || '').trim()
            if (
                !designator ||
                explicitDesignators.has(designator) ||
                !component?.externalModel
            ) {
                return
            }

            collectedEntries.push({
                pattern: PcbModelArchiveExporter.#resolvePattern(component, null),
                designator,
                model: component.externalModel,
                identityKey:
                    PcbModelArchiveExporter.#resolveModelIdentity(
                        component.externalModel
                    )
            })
        })

        const dedupedEntries = []
        const seenKeys = new Set()
        collectedEntries.forEach((entry) => {
            const dedupeKey =
                PcbModelArchiveExporter.#normalizeToken(entry.pattern) +
                '::' +
                entry.identityKey
            if (seenKeys.has(dedupeKey)) {
                return
            }

            seenKeys.add(dedupeKey)
            dedupedEntries.push(entry)
        })

        return dedupedEntries
    }

    /**
     * Resolves one archive file name for the exported model.
     * @param {{ pattern: string, model: { format?: string } }} entry
     * @param {{ archivePath: string }[]} exportedEntries
     * @returns {string}
     */
    static #resolveArchivePath(entry, exportedEntries) {
        const sanitizedPattern =
            PcbModelArchiveExporter.#sanitizeFileToken(entry.pattern)
        const extension = PcbModelArchiveExporter.#resolveExtension(
            entry.model?.format
        )
        const basePath = sanitizedPattern + '.' + extension
        let archivePath = basePath
        let duplicateIndex = 2

        while (
            exportedEntries.some(
                (exportedEntry) => exportedEntry.archivePath === archivePath
            )
        ) {
            archivePath =
                sanitizedPattern +
                '--' +
                duplicateIndex +
                '.' +
                extension
            duplicateIndex += 1
        }

        return archivePath
    }

    /**
     * Reads one resolved model into ZIP-ready bytes.
     * @param {{ origin?: string, payloadText?: string, file?: Blob | File | null }} model
     * @returns {Promise<Uint8Array>}
     */
    static async #readModelBytes(model) {
        if (model?.origin === 'embedded') {
            const payloadText = String(model?.payloadText || '')
            if (!payloadText) {
                throw new Error('Embedded STEP payload is unavailable.')
            }

            return new TextEncoder().encode(payloadText)
        }

        if (typeof model?.file?.arrayBuffer === 'function') {
            return new Uint8Array(await model.file.arrayBuffer())
        }

        throw new Error('Session model bytes are unavailable.')
    }

    /**
     * Resolves one user-facing archive name from the provided base name.
     * @param {string | undefined} archiveBaseName
     * @returns {string}
     */
    static #resolveArchiveName(archiveBaseName) {
        const sanitizedBaseName =
            PcbModelArchiveExporter.#sanitizeFileToken(
                archiveBaseName || 'pcb-models'
            )

        return sanitizedBaseName + '-models.zip'
    }

    /**
     * Resolves the preferred export label for one model placement.
     * @param {{ pattern?: string, designator?: string, externalModel?: any } | null} component
     * @param {{ designator?: string, externalModel?: any } | null} placement
     * @returns {string}
     */
    static #resolvePattern(component, placement) {
        const componentPattern = String(component?.pattern || '').trim()
        if (componentPattern) {
            return componentPattern
        }

        const designator = String(
            component?.designator || placement?.designator || ''
        ).trim()
        if (designator) {
            return designator
        }

        return PcbModelArchiveExporter.#stripExtension(
            String(
                component?.externalModel?.name ||
                    placement?.externalModel?.name ||
                    'model'
            )
        )
    }

    /**
     * Resolves a stable identity key for one model so repeated placements can
     * be deduplicated.
     * @param {{ origin?: string, relativePath?: string, sourceStream?: string, name?: string, checksum?: number | null, format?: string }} model
     * @returns {string}
     */
    static #resolveModelIdentity(model) {
        if (String(model?.origin || '') === 'embedded') {
            return [
                'embedded',
                String(model?.sourceStream || ''),
                String(model?.name || ''),
                String(model?.checksum || ''),
                String(model?.format || '')
            ].join('::')
        }

        return [
            'session',
            String(model?.relativePath || ''),
            String(model?.name || ''),
            String(model?.format || '')
        ].join('::')
    }

    /**
     * Resolves a safe archive extension from the model format.
     * @param {string | undefined} format
     * @returns {string}
     */
    static #resolveExtension(format) {
        const normalizedFormat = String(format || '').trim().toLowerCase()
        if (normalizedFormat === 'wrl') {
            return 'wrl'
        }

        return 'step'
    }

    /**
     * Removes the trailing extension from one file name.
     * @param {string} value
     * @returns {string}
     */
    static #stripExtension(value) {
        return String(value || '').replace(/\.[^.]+$/, '')
    }

    /**
     * Normalizes one token for internal dedupe keys.
     * @param {string} value
     * @returns {string}
     */
    static #normalizeToken(value) {
        return String(value || '').trim().toLowerCase()
    }

    /**
     * Sanitizes one archive token so pattern-derived names stay readable and
     * cannot introduce nested paths.
     * @param {string} value
     * @returns {string}
     */
    static #sanitizeFileToken(value) {
        const sanitizedValue = String(value || '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, '-')
            .replace(/\s+/g, ' ')
            .trim()

        if (sanitizedValue) {
            return sanitizedValue
        }

        return 'model'
    }
}
