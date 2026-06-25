import { zipSync } from 'fflate'
import { SelectedPartAltiumExportAdapter } from 'altium-toolkit/parser'
import { SelectedPartCircuitJsonExportAdapter } from 'circuitjson-toolkit/renderers'
import {
    CircuitJsonKicadProjectExporter,
    KicadSelectedPartExporter
} from 'kicad-toolkit/parser'
import { SelectedPartKicadExportAdapter } from './SelectedPartKicadExportAdapter.mjs'
import { SelectedPartResolver } from './SelectedPartResolver.mjs'
import { SelectedPartStitchedModelExporter } from './SelectedPartStitchedModelExporter.mjs'

/**
 * Builds downloadable ZIP archives for the currently selected component.
 */
export class SelectedPartExportService {
    /** @type {SelectedPartStitchedModelExporter} */
    #stitchedModelExporter

    /**
     * @param {{ sceneService?: { prepare?: (documentModel: object, options?: object) => Promise<object> }, modelMeshLoader?: object | ((placement: object) => Promise<object | object[]> | object | object[]) }} [options] Service options.
     */
    constructor(options = {}) {
        this.#stitchedModelExporter = new SelectedPartStitchedModelExporter(
            options
        )
    }

    /**
     * Exports one selected component into a target-format ZIP.
     * @param {{ format?: string, documentId?: string, selectedComponentKey?: string, documentModel?: object, documents?: { documentModel?: object }[], sessionAssets?: object[], sceneDescription?: object }} options Export options.
     * @returns {Promise<{ archiveName: string, archiveBytes: Uint8Array, entries: object[], manifest: object }>}
     */
    async export(options = {}) {
        const format = SelectedPartExportService.#normalizeFormat(
            options.format
        )
        const selectedPart = SelectedPartResolver.resolve(options)
        const partName = SelectedPartExportService.#partExportName(selectedPart)
        const modelBundle = await this.#buildModelBundle(
            selectedPart,
            options,
            partName
        )
        const targetEntries =
            await SelectedPartExportService.#buildTargetEntries(
                format,
                selectedPart,
                options.documentModel || {},
                modelBundle.models,
                partName
            )
        const modelEntries = modelBundle.entries.filter(
            (modelEntry) =>
                !targetEntries.some((entry) => entry.path === modelEntry.path)
        )
        const exportEntries = [...targetEntries, ...modelEntries]
        const manifest = SelectedPartExportService.#buildManifest({
            format,
            documentId: options.documentId || '',
            documentModel: options.documentModel || {},
            selectedPart,
            partName,
            entries: exportEntries,
            models: modelBundle.models,
            modelDiagnostics: modelBundle.diagnostics
        })
        const entries = [
            ...exportEntries,
            SelectedPartExportService.#jsonEntry('manifest.json', manifest)
        ].sort((left, right) => left.path.localeCompare(right.path))

        return {
            archiveName: partName + '-' + format + '-part.zip',
            archiveBytes: zipSync(
                Object.fromEntries(
                    entries.map((entry) => [entry.path, entry.bytes])
                )
            ),
            entries,
            manifest
        }
    }

    /**
     * Releases owned mesh-loader resources.
     * @returns {void}
     */
    dispose() {
        this.#stitchedModelExporter.dispose()
    }

    /**
     * Builds target-specific entries.
     * @param {string} format Target format.
     * @param {{ designator: string, symbol: object, footprint: object, diagnostics: object[] }} selectedPart Selected part data.
     * @param {object} documentModel Active document model.
     * @param {object[]} models Matched 3D model assets.
     * @param {string} partName Export artifact name.
     * @returns {Promise<{ path: string, bytes: Uint8Array, contentType: string }[]>}
     */
    static async #buildTargetEntries(
        format,
        selectedPart,
        documentModel,
        models,
        partName
    ) {
        if (format === 'kicad') {
            return SelectedPartExportService.#buildKicadEntries(
                selectedPart,
                documentModel,
                models,
                partName
            )
        }

        if (format === 'altium') {
            return SelectedPartExportService.#buildAltiumEntries(
                selectedPart,
                models,
                partName
            )
        }

        return SelectedPartExportService.#buildCircuitJsonEntries(
            selectedPart,
            documentModel,
            partName
        )
    }

    /**
     * Builds KiCad export entries.
     * @param {object} selectedPart Selected part data.
     * @param {object} documentModel Active document model.
     * @param {object[]} models Matched 3D model assets.
     * @param {string} partName Export artifact name.
     * @returns {{ path: string, bytes: Uint8Array, contentType: string }[]}
     */
    static #buildKicadEntries(selectedPart, documentModel, models, partName) {
        const kicadPart = SelectedPartKicadExportAdapter.adapt(
            selectedPart,
            partName,
            models
        )
        const circuitJson = SelectedPartCircuitJsonExportAdapter.build(
            selectedPart,
            documentModel,
            partName
        )
        const projectResult = CircuitJsonKicadProjectExporter.export(
            circuitJson,
            {
                projectName: partName,
                libraryName: partName,
                basePath: 'kicad/project',
                modelFiles: models
            }
        )

        const libraryResult = KicadSelectedPartExporter.export(kicadPart, {
            partName
        })

        return [...libraryResult.entries, ...projectResult.entries]
    }

    /**
     * Builds Altium export entries.
     * @param {{ designator: string, symbol: object, footprint: object }} selectedPart Selected part data.
     * @param {object[]} models Matched 3D model assets.
     * @param {string} partName Export artifact name.
     * @returns {{ path: string, bytes: Uint8Array, contentType: string }[]}
     */
    static #buildAltiumEntries(selectedPart, models, partName) {
        return SelectedPartAltiumExportAdapter.export(selectedPart, {
            models,
            partName,
            libraryBasePath: 'altium',
            sourceBasePath: 'source'
        }).entries
    }

    /**
     * Builds CircuitJSON export entries.
     * @param {{ designator: string, symbol: object, footprint: object }} selectedPart Selected part data.
     * @param {object} documentModel Active document model.
     * @param {string} partName Export artifact name.
     * @returns {{ path: string, bytes: Uint8Array, contentType: string }[]}
     */
    static #buildCircuitJsonEntries(selectedPart, documentModel, partName) {
        const circuitJson = SelectedPartCircuitJsonExportAdapter.build(
            selectedPart,
            documentModel,
            partName
        )

        return [
            SelectedPartExportService.#jsonEntry(
                'circuitjson/' + partName + '.circuit.json',
                circuitJson
            )
        ]
    }

    /**
     * Builds matched and generated 3D model assets for the selected part.
     * @param {object} selectedPart Selected part data.
     * @param {{ documentModel?: object, sceneDescription?: object, sessionAssets?: object[] }} options Export options.
     * @param {string} partName Export artifact name.
     * @returns {Promise<{ models: object[], entries: { path: string, bytes: Uint8Array, contentType: string }[], diagnostics: object[] }>}
     */
    async #buildModelBundle(selectedPart, options, partName) {
        const modelBundle =
            await SelectedPartExportService.#buildReferencedModelBundle(
                selectedPart,
                options.sessionAssets,
                partName
            )

        await this.#stitchedModelExporter.append(
            modelBundle,
            selectedPart,
            options,
            partName
        )

        return modelBundle
    }

    /**
     * Builds matched 3D model assets and archive entries.
     * @param {object} selectedPart Selected part data.
     * @param {object[] | undefined} sessionAssets Session companion assets.
     * @param {string} partName Export artifact name.
     * @returns {Promise<{ models: object[], entries: { path: string, bytes: Uint8Array, contentType: string }[], diagnostics: object[] }>}
     */
    static async #buildReferencedModelBundle(
        selectedPart,
        sessionAssets,
        partName
    ) {
        const references =
            SelectedPartExportService.#modelReferences(selectedPart)
        const diagnostics = []
        const models = []
        const entries = []
        const usedPaths = new Set()

        for (const reference of references) {
            const asset = SelectedPartExportService.#findModelAsset(
                reference,
                sessionAssets
            )
            if (!asset) {
                diagnostics.push(
                    SelectedPartExportService.#diagnostic(
                        'warning',
                        'selected_part_model_asset_missing',
                        'No session asset was found for 3D model ' +
                            SelectedPartExportService.#modelDisplayName(
                                reference
                            ) +
                            '.'
                    )
                )
                continue
            }

            const bytes = await SelectedPartExportService.#readAssetBytes(asset)
            if (!bytes.byteLength) {
                diagnostics.push(
                    SelectedPartExportService.#diagnostic(
                        'warning',
                        'selected_part_model_asset_empty',
                        'The matched 3D model asset ' +
                            SelectedPartExportService.#modelDisplayName(
                                reference
                            ) +
                            ' had no exportable bytes.'
                    )
                )
                continue
            }

            const name = SelectedPartExportService.#uniqueArchiveName(
                SelectedPartExportService.#modelArchiveName(
                    reference,
                    asset,
                    partName
                ),
                usedPaths
            )
            const model = {
                id: 'selected-part-model-' + models.length,
                name,
                format:
                    reference.format ||
                    asset.format ||
                    SelectedPartExportService.#fileExtension(name) ||
                    'step',
                bytes,
                path: reference.path || reference.relativePath || '',
                sourcePath: asset.relativePath || asset.name || '',
                transform: reference.transform || null
            }

            models.push(model)
            entries.push({
                path: 'models/' + name,
                bytes,
                contentType: SelectedPartExportService.#modelContentType(model)
            })
        }

        return { models, entries, diagnostics }
    }

    /**
     * Resolves model references from selected footprint data.
     * @param {object} selectedPart Selected part data.
     * @returns {object[]}
     */
    static #modelReferences(selectedPart) {
        const raw = selectedPart?.footprint?.raw || {}
        const references = [
            ...SelectedPartExportService.#array(
                selectedPart?.footprint?.models
            ),
            ...SelectedPartExportService.#array(raw.models),
            ...SelectedPartExportService.#array(raw.modelReferences)
        ]

        if (raw.modelName || raw.modelPath) {
            references.push({
                name: raw.modelName || '',
                path: raw.modelPath || '',
                transform: raw.modelTransform || null
            })
        }

        const seen = new Set()
        return references
            .map((reference) =>
                SelectedPartExportService.#normalizeModelReference(reference)
            )
            .filter((reference) => {
                const key =
                    SelectedPartExportService.#modelReferenceKey(reference)
                if (!key || seen.has(key)) return false
                seen.add(key)
                return true
            })
    }

    /**
     * Normalizes one model reference.
     * @param {object} reference Raw model reference.
     * @returns {object}
     */
    static #normalizeModelReference(reference) {
        return {
            name: String(
                reference?.name ||
                    reference?.modelName ||
                    reference?.fileName ||
                    ''
            ),
            path: String(
                reference?.path ||
                    reference?.modelPath ||
                    reference?.sourceUrl ||
                    ''
            ),
            relativePath: String(reference?.relativePath || ''),
            format: String(reference?.format || ''),
            transform:
                reference?.transform || reference?.modelTransform || null,
            raw: reference
        }
    }

    /**
     * Finds a session asset matching one model reference.
     * @param {object} reference Normalized model reference.
     * @param {object[] | undefined} sessionAssets Session assets.
     * @returns {object | null}
     */
    static #findModelAsset(reference, sessionAssets) {
        const referenceTokens =
            SelectedPartExportService.#modelMatchTokens(reference)

        return (
            SelectedPartExportService.#array(sessionAssets).find((asset) => {
                const assetTokens =
                    SelectedPartExportService.#modelMatchTokens(asset)

                return [...referenceTokens].some((token) =>
                    assetTokens.has(token)
                )
            }) || null
        )
    }

    /**
     * Builds normalized matching tokens for model references and assets.
     * @param {object} source Model reference or asset.
     * @returns {Set<string>}
     */
    static #modelMatchTokens(source) {
        const rawTokens = [
            source?.relativePath,
            source?.path,
            source?.modelPath,
            source?.sourceUrl,
            source?.name,
            source?.modelName,
            source?.fileName
        ]
        const tokens = new Set()

        for (const rawToken of rawTokens) {
            const token =
                SelectedPartExportService.#normalizeModelPath(rawToken)
            if (!token) continue
            tokens.add(token)
            tokens.add(SelectedPartExportService.#baseName(token))
        }

        tokens.delete('')
        return tokens
    }

    /**
     * Reads raw bytes from a session asset.
     * @param {object} asset Session asset.
     * @returns {Promise<Uint8Array>}
     */
    static async #readAssetBytes(asset) {
        if (asset?.bytes) {
            return SelectedPartExportService.#toUint8Array(asset.bytes)
        }

        if (asset?.file?.arrayBuffer) {
            return SelectedPartExportService.#toUint8Array(
                await asset.file.arrayBuffer()
            )
        }

        if (asset?.file) {
            return SelectedPartExportService.#toUint8Array(asset.file)
        }

        if (typeof asset?.text === 'string') {
            return new TextEncoder().encode(asset.text)
        }

        if (typeof asset?.content === 'string') {
            return new TextEncoder().encode(asset.content)
        }

        return new Uint8Array(0)
    }

    /**
     * Converts common binary inputs into Uint8Array.
     * @param {unknown} value Candidate binary value.
     * @returns {Uint8Array}
     */
    static #toUint8Array(value) {
        if (value instanceof Uint8Array) {
            return new Uint8Array(value)
        }

        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value)
        }

        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(
                value.buffer,
                value.byteOffset,
                value.byteLength
            )
        }

        if (typeof value === 'string') {
            return new TextEncoder().encode(value)
        }

        return new Uint8Array(0)
    }

    /**
     * Builds a stable reference key.
     * @param {object} reference Normalized model reference.
     * @returns {string}
     */
    static #modelReferenceKey(reference) {
        return (
            SelectedPartExportService.#normalizeModelPath(
                reference.relativePath
            ) ||
            SelectedPartExportService.#normalizeModelPath(reference.path) ||
            SelectedPartExportService.#normalizeModelPath(reference.name)
        )
    }

    /**
     * Normalizes a model path for matching.
     * @param {unknown} value Raw model path.
     * @returns {string}
     */
    static #normalizeModelPath(value) {
        return String(value || '')
            .replace(/\\/gu, '/')
            .replace(/^\$\{KIPRJMOD\}\//iu, '')
            .replace(/^\.\//u, '')
            .toLowerCase()
    }

    /**
     * Returns the last path segment.
     * @param {unknown} value Raw path.
     * @returns {string}
     */
    static #baseName(value) {
        return (
            String(value || '')
                .replace(/\\/gu, '/')
                .split('/')
                .filter(Boolean)
                .at(-1) || ''
        )
    }

    /**
     * Ensures a model file name is unique within the ZIP.
     * @param {string} name Candidate file name.
     * @param {Set<string>} usedPaths Used file names.
     * @returns {string}
     */
    static #uniqueArchiveName(name, usedPaths) {
        const safeName = name || 'model.step'
        if (!usedPaths.has(safeName)) {
            usedPaths.add(safeName)
            return safeName
        }

        const extension = safeName.includes('.')
            ? '.' + safeName.split('.').at(-1)
            : ''
        const stem = extension ? safeName.slice(0, -extension.length) : safeName
        let index = 2
        let candidate = stem + '-' + index + extension

        while (usedPaths.has(candidate)) {
            index += 1
            candidate = stem + '-' + index + extension
        }

        usedPaths.add(candidate)
        return candidate
    }

    /**
     * Builds the archive file name for one 3D model.
     * @param {object} reference Normalized model reference.
     * @param {object} asset Matched session asset.
     * @param {string} partName Export artifact name.
     * @returns {string}
     */
    static #modelArchiveName(reference, asset, partName) {
        const extension =
            SelectedPartExportService.#fileExtension(
                reference.name ||
                    reference.path ||
                    reference.relativePath ||
                    asset.name ||
                    asset.relativePath
            ) ||
            reference.format ||
            asset.format ||
            'step'

        return (
            SelectedPartExportService.#safeFileName(
                partName || 'selected-part'
            ) +
            '.' +
            String(extension).replace(/^\./u, '').toLowerCase()
        )
    }

    /**
     * Returns a display name for diagnostics.
     * @param {object} reference Model reference.
     * @returns {string}
     */
    static #modelDisplayName(reference) {
        return (
            reference.name ||
            reference.path ||
            reference.relativePath ||
            'model'
        )
    }

    /**
     * Returns a model content type.
     * @param {{ name?: string, format?: string }} model Model asset.
     * @returns {string}
     */
    static #modelContentType(model) {
        const format = String(
            model?.format ||
                SelectedPartExportService.#fileExtension(model?.name) ||
                ''
        ).toLowerCase()

        if (format === 'step' || format === 'stp') return 'model/step'
        if (format === 'wrl' || format === 'vrml') return 'model/vrml'
        return 'application/octet-stream'
    }

    /**
     * Returns a lower-case file extension without the leading dot.
     * @param {unknown} name File name.
     * @returns {string}
     */
    static #fileExtension(name) {
        const extension = String(name || '')
            .split('.')
            .at(-1)
        return extension && extension !== name ? extension.toLowerCase() : ''
    }

    /**
     * Builds the archive manifest.
     * @param {{ format: string, documentId: string, documentModel: object, selectedPart: object, partName: string, entries: object[], models: object[], modelDiagnostics: object[] }} options Manifest options.
     * @returns {object}
     */
    static #buildManifest(options) {
        const modelReferences = SelectedPartExportService.#modelReferences(
            options.selectedPart
        )

        return {
            schema: 'ecad-forge-selected-part-export-v1',
            document: {
                id: options.documentId,
                fileName: options.documentModel?.fileName || '',
                sourceFormat:
                    options.documentModel?.sourceFormat ||
                    options.documentModel?.fileType ||
                    ''
            },
            selectedPart: {
                designator: options.selectedPart.designator || '',
                name: options.partName || ''
            },
            targetFormat: options.format,
            status: {
                symbol: options.selectedPart.symbol?.name
                    ? 'exported'
                    : 'missing',
                footprint: options.selectedPart.footprint?.name
                    ? 'exported'
                    : 'missing',
                model3d: options.models.length
                    ? 'exported'
                    : modelReferences.length
                      ? 'missing'
                      : 'unavailable'
            },
            files: options.entries.map((entry) => entry.path),
            diagnostics: [
                ...(options.selectedPart.diagnostics || []),
                ...(options.modelDiagnostics || [])
            ]
        }
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
     * Creates one deterministic JSON entry.
     * @param {string} path Archive path.
     * @param {unknown} value JSON value.
     * @returns {{ path: string, bytes: Uint8Array, contentType: string }}
     */
    static #jsonEntry(path, value) {
        return {
            path,
            bytes: new TextEncoder().encode(
                JSON.stringify(value, null, 2) + '\n'
            ),
            contentType: 'application/json'
        }
    }

    /**
     * Normalizes an export format.
     * @param {unknown} value Candidate format.
     * @returns {string}
     */
    static #normalizeFormat(value) {
        const format = String(value || 'circuitjson').toLowerCase()
        if (format === 'kicad' || format === 'altium') return format
        return 'circuitjson'
    }

    /**
     * Resolves the user-facing export artifact name for a selected part.
     * @param {{ designator?: string, symbol?: object, footprint?: object }} selectedPart Selected part data.
     * @returns {string}
     */
    static #partExportName(selectedPart) {
        return SelectedPartExportService.#safeFileName(
            SelectedPartExportService.#localLibraryName(
                selectedPart?.footprint?.name ||
                    selectedPart?.symbol?.name ||
                    selectedPart?.designator ||
                    'selected-part'
            )
        )
    }

    /**
     * Strips an ECAD library prefix from a library-qualified name.
     * @param {unknown} value Candidate library-qualified name.
     * @returns {string}
     */
    static #localLibraryName(value) {
        const name = String(value || '').trim()
        return name.includes(':')
            ? name.split(':').filter(Boolean).at(-1)
            : name
    }

    /**
     * Creates a safe file name.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #safeFileName(value) {
        return String(value || 'selected-part').replace(
            /[\\/:\u0000-\u001f]/gu,
            '_'
        )
    }

    /**
     * Creates a safe CircuitJSON id token.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #safeIdentifier(value) {
        return String(value || 'selected_part').replace(/[^a-z0-9_]/giu, '_')
    }

    /**
     * Normalizes a possible array.
     * @param {unknown} value Candidate array.
     * @returns {object[]}
     */
    static #array(value) {
        return Array.isArray(value) ? value : []
    }

    /**
     * Reads a finite number with fallback.
     * @param {unknown} value Candidate number.
     * @param {number} fallback Fallback number.
     * @returns {number}
     */
    static #number(value, fallback) {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : fallback
    }
}
