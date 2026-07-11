import { Parser as AltiumParser } from 'altium-toolkit/parser'
import { ProjectLoader as AltiumProjectLoader } from 'altium-toolkit/project'
import { Parser as CircuitJsonParser } from 'circuitjson-toolkit/parser'
import { ProjectLoader as CircuitJsonProjectLoader } from 'circuitjson-toolkit/project'
import { Parser as GerberParser } from 'gerber-toolkit/parser'
import { ProjectLoader as GerberProjectLoader } from 'gerber-toolkit/project'
import { Parser as KicadParser } from 'kicad-toolkit/parser'
import { ProjectLoader as KicadProjectLoader } from 'kicad-toolkit/project'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

const MODEL_COMPANION_FORMATS = new Set([
    'wrl',
    'vrml',
    'step',
    'glb',
    'gltf',
    'stl',
    'obj',
    '3mf'
])

/**
 * Dispatches ECAD source entries to the owned format toolkits.
 */
export class EcadParserService {
    /** @type {{ parse: (input: { fileName: string, data: ArrayBuffer }) => object }} */
    #altiumParser

    /** @type {{ loadAsync: (entries: { name: string, data: ArrayBuffer }[], options?: object) => Promise<object> }} */
    #altiumProjectLoader

    /** @type {{ parse: (input: { fileName: string, data: ArrayBuffer }) => object }} */
    #kicadParser

    /** @type {{ loadAsync: (entries: { name: string, data: ArrayBuffer }[], options?: object) => Promise<object> }} */
    #kicadProjectLoader

    /** @type {{ parse: (input: { fileName: string, data: ArrayBuffer }) => object }} */
    #circuitJsonParser

    /** @type {{ loadAsync: (entries: { name: string, data: ArrayBuffer }[], options?: object) => Promise<object> }} */
    #circuitJsonProjectLoader

    /** @type {{ parse: (input: { fileName: string, data: ArrayBuffer }) => object }} */
    #gerberParser

    /** @type {{ supports?: (entries: { name: string, data: ArrayBuffer }[]) => boolean, loadAsync: (entries: { name: string, data: ArrayBuffer }[], options?: object) => Promise<object> }} */
    #gerberProjectLoader

    /**
     * @param {{ altiumParser?: any, altiumProjectLoader?: any, kicadParser?: any, kicadProjectLoader?: any, circuitJsonParser?: any, circuitJsonProjectLoader?: any, gerberParser?: any, gerberProjectLoader?: any }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#altiumParser = dependencies.altiumParser || AltiumParser
        this.#altiumProjectLoader =
            dependencies.altiumProjectLoader || AltiumProjectLoader
        this.#kicadParser = dependencies.kicadParser || KicadParser
        this.#kicadProjectLoader =
            dependencies.kicadProjectLoader || KicadProjectLoader
        this.#circuitJsonParser =
            dependencies.circuitJsonParser || CircuitJsonParser
        this.#circuitJsonProjectLoader =
            dependencies.circuitJsonProjectLoader || CircuitJsonProjectLoader
        this.#gerberParser = dependencies.gerberParser || GerberParser
        this.#gerberProjectLoader =
            dependencies.gerberProjectLoader || GerberProjectLoader
    }

    /**
     * Parses one file buffer.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer} buffer Source bytes.
     * @returns {object}
     */
    parseArrayBuffer(fileName, buffer) {
        const role = EcadFormatRegistry.resolveNativeRole(fileName)
        if (!role) {
            throw new Error('Unsupported ECAD file type: ' + fileName)
        }

        if (role.sourceFormat === 'kicad') {
            return this.#parse(this.#kicadParser, fileName, buffer)
        }

        if (role.sourceFormat === 'circuitjson') {
            return this.#parseCircuitJsonArrayBuffer(fileName, buffer)
        }

        if (role.sourceFormat === 'gerber') {
            return this.#parse(this.#gerberParser, fileName, buffer)
        }

        return this.#parse(this.#altiumParser, fileName, buffer, {
            extensions: ['altium.native-model'],
            decodeAssets: 'full'
        })
    }

    /**
     * Parses a selected batch of source entries.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {Promise<{ documents: object[], diagnostics: object[], assets: object[], project: object | null }>}
     */
    async parseEntries(entries) {
        const normalizedEntries = EcadParserService.#normalizeEntries(entries)
        const altiumEntries = normalizedEntries.filter((entry) => {
            return entry.role?.sourceFormat === 'altium'
        })
        const kicadEntries = normalizedEntries.filter((entry) => {
            return entry.role?.sourceFormat === 'kicad'
        })
        const circuitJsonEntries = normalizedEntries.filter((entry) => {
            return entry.role?.sourceFormat === 'circuitjson'
        })
        const gerberEntries = EcadParserService.#resolveGerberEntries(
            normalizedEntries,
            this.#gerberProjectLoader
        )
        const modelCompanions = normalizedEntries.filter(
            (entry) => entry.role?.sourceFormat === 'companion'
        )
        const gerberEntryNames = new Set(
            gerberEntries.map((entry) => entry.name)
        )
        const kicadParseEntries = EcadParserService.#withModelCompanions(
            kicadEntries.filter((entry) => !gerberEntryNames.has(entry.name)),
            modelCompanions
        )
        const documents = []
        const diagnostics = []
        const assets = []
        let project = null

        const groups = [
            [
                this.#altiumProjectLoader,
                EcadParserService.#withModelCompanions(
                    altiumEntries,
                    modelCompanions
                ),
                'Altium project',
                {
                    extensions: ['altium.native-model'],
                    decodeAssets: 'full'
                }
            ],
            [
                this.#circuitJsonProjectLoader,
                EcadParserService.#withModelCompanions(
                    circuitJsonEntries,
                    modelCompanions
                ),
                'CircuitJSON project',
                { decodeAssets: 'full' }
            ],
            [
                this.#gerberProjectLoader,
                EcadParserService.#withModelCompanions(
                    gerberEntries,
                    modelCompanions
                ),
                'Gerber fabrication package',
                { extensions: ['gerber.native-model'] }
            ],
            [
                this.#kicadProjectLoader,
                kicadParseEntries,
                'KiCad project',
                { decodeAssets: 'full' }
            ]
        ]
        const loadedGroups = await Promise.all(
            groups
                .filter(([_loader, groupEntries]) => groupEntries.length)
                .map(([loader, groupEntries, label, loaderOptions]) =>
                    this.#loadProjectEntries(
                        loader,
                        groupEntries,
                        label,
                        loaderOptions
                    )
                )
        )
        for (const loaded of loadedGroups) {
            if (loaded.diagnostic) {
                diagnostics.push(loaded.diagnostic)
                continue
            }
            const result = loaded.result
            documents.push(...EcadParserService.#documentsFromResult(result))
            diagnostics.push(...(result.diagnostics || []))
            assets.push(...(result.assets || []))
            project = result.project || project
        }

        if (!documents.length && diagnostics.length) {
            throw new Error(diagnostics[0].message)
        }

        return {
            documents,
            diagnostics,
            assets: EcadParserService.#uniqueAssets(assets),
            project
        }
    }

    /**
     * Loads one normalized source group through the shared project contract.
     * @param {{ loadAsync: (entries: { name: string, data: ArrayBuffer }[]) => Promise<object> }} loader Common project loader.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries App entries.
     * @param {string} label Fallback diagnostic source.
     * @param {object} options Common project-loader options.
     * @returns {Promise<{ result: object | null, diagnostic: object | null }>} Load attempt.
     */
    async #loadProjectEntries(loader, entries, label, options) {
        try {
            return {
                result: await loader.loadAsync(
                    EcadParserService.#projectEntries(entries),
                    options
                ),
                diagnostic: null
            }
        } catch (error) {
            return {
                result: null,
                diagnostic: EcadParserService.#buildParseDiagnostic(
                    entries[0]?.name || label,
                    error
                )
            }
        }
    }

    /**
     * Parses one standalone CircuitJSON source buffer.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer | Uint8Array} buffer Source bytes.
     * @returns {object[]}
     */
    #parseCircuitJsonArrayBuffer(fileName, buffer) {
        return this.#parse(this.#circuitJsonParser, fileName, buffer)
    }

    /**
     * Parses one file through the shared toolkit parser contract.
     * @param {{ parse: (input: { fileName: string, data: ArrayBuffer }, options?: object) => object }} parser Common parser.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer} buffer Source bytes.
     * @param {object} [options] Common parser options.
     * @returns {object} Canonical document envelope.
     */
    #parse(parser, fileName, buffer, options = {}) {
        return parser.parse({ fileName, data: buffer }, options)
    }

    /**
     * Parses a selected batch through the default parser service.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {Promise<{ documents: object[], diagnostics: object[], assets: object[], project: object | null }>}
     */
    static parseEntries(entries) {
        return EcadParserService.#defaultService().parseEntries(entries)
    }

    /**
     * Parses one file through the default parser service.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer} buffer Source bytes.
     * @returns {object}
     */
    static parseArrayBuffer(fileName, buffer) {
        return EcadParserService.#defaultService().parseArrayBuffer(
            fileName,
            buffer
        )
    }

    /**
     * Creates one file-scoped parser diagnostic.
     * @param {string} fileName Source file name.
     * @param {unknown} error Parser error.
     * @returns {{ severity: string, fileName: string, message: string }}
     */
    static #buildParseDiagnostic(fileName, error) {
        const message =
            error instanceof Error && error.message
                ? error.message
                : 'Unknown parser error.'

        return {
            severity: 'error',
            fileName,
            message: 'Failed to parse ' + fileName + ': ' + message
        }
    }

    /**
     * Normalizes one source path for cross-platform comparisons.
     * @param {string | undefined} fileName Source path.
     * @returns {string}
     */
    static #normalizePath(fileName) {
        return String(fileName || '')
            .replace(/\\+/gu, '/')
            .replace(/\/+/gu, '/')
    }

    /**
     * Returns a lazily-created default service.
     * @returns {EcadParserService}
     */
    static #defaultService() {
        if (!globalThis.__ecadForgeParserService) {
            globalThis.__ecadForgeParserService = new EcadParserService()
        }

        return globalThis.__ecadForgeParserService
    }

    /**
     * Normalizes raw parser entries and attaches file-role metadata.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } }[]}
     */
    static #normalizeEntries(entries) {
        return (entries || [])
            .map((entry) => {
                const buffer = entry?.buffer
                return {
                    name: String(entry?.name || ''),
                    buffer,
                    role: EcadParserService.#resolveParserRole(
                        entry?.name,
                        buffer
                    )
                }
            })
            .filter(
                (entry) =>
                    entry.name &&
                    entry.buffer &&
                    entry.role &&
                    EcadParserService.#isVisibleProjectPath(entry.name)
            )
    }

    /**
     * Converts app intake entries to the shared project-loader input shape.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries App entries.
     * @returns {{ name: string, data: ArrayBuffer }[]} Common project entries.
     */
    static #projectEntries(entries) {
        return entries.map((entry) => ({
            name: entry.name,
            data: entry.buffer
        }))
    }

    /**
     * Resolves parser roles, including companion assets that provide project
     * context during batch parsing.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer} [buffer] Source bytes for content sniffing.
     * @returns {{ sourceFormat: string, fileType: string } | null}
     */
    static #resolveParserRole(fileName, buffer = null) {
        const nativeRole = EcadFormatRegistry.resolveNativeRole(fileName)
        if (nativeRole) {
            return nativeRole
        }

        const companionFormat =
            EcadFormatRegistry.resolveCompanionFormat(fileName)
        if (companionFormat === 'altium-project') {
            return { sourceFormat: 'altium', fileType: 'prjpcb' }
        }

        if (companionFormat === 'kicad-library') {
            return { sourceFormat: 'kicad', fileType: 'kicad-library' }
        }

        if (MODEL_COMPANION_FORMATS.has(companionFormat)) {
            return { sourceFormat: 'companion', fileType: companionFormat }
        }

        if (EcadParserService.#looksLikeGerberFabricationText(buffer)) {
            return { sourceFormat: 'gerber', fileType: 'fabrication-text' }
        }

        return null
    }

    /**
     * Returns true when unknown-name bytes look like Gerber or Excellon input.
     * @param {ArrayBuffer | null | undefined} buffer Source bytes.
     * @returns {boolean}
     */
    static #looksLikeGerberFabricationText(buffer) {
        if (!(buffer instanceof ArrayBuffer)) {
            return false
        }

        const sample = new TextDecoder('utf-8').decode(
            new Uint8Array(buffer).slice(0, 4096)
        )
        return /%FS|%MO|%AD|G04|M48|T\d+C[0-9.]+/iu.test(sample)
    }

    /**
     * Returns true when a project path is visible user source, not metadata.
     * @param {string} fileName Source path.
     * @returns {boolean}
     */
    static #isVisibleProjectPath(fileName) {
        const parts = EcadParserService.#normalizePath(fileName)
            .split('/')
            .filter(Boolean)

        if (!parts.length) {
            return false
        }

        return !parts.some((part) => {
            return (
                part === '__MACOSX' ||
                part.startsWith('.') ||
                part.startsWith('._')
            )
        })
    }

    /**
     * Resolves parsed documents from a toolkit result.
     * @param {object} result Parser result.
     * @returns {object[]}
     */
    static #documentsFromResult(result) {
        return Array.isArray(result?.documents) ? result.documents : []
    }

    /**
     * Resolves entries that should be handled by the Gerber package loader.
     * @param {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } }[]} entries Normalized entries.
     * @param {{ supports?: (entries: { name: string, data: ArrayBuffer }[]) => boolean }} gerberProjectLoader Gerber project loader.
     * @returns {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } }[]}
     */
    static #resolveGerberEntries(entries, gerberProjectLoader) {
        const directEntries = entries.filter(
            (entry) => entry.role?.sourceFormat === 'gerber'
        )
        const zipEntries = entries.filter(
            (entry) => entry.role?.fileType === 'zip'
        )
        const gerberZipEntries = zipEntries.filter((entry) =>
            EcadParserService.#canLoadGerberEntries(gerberProjectLoader, [
                entry
            ])
        )

        return [...directEntries, ...gerberZipEntries]
    }

    /**
     * Checks whether the Gerber loader accepts a set of entries.
     * @param {{ supports?: (entries: { name: string, data: ArrayBuffer }[]) => boolean }} gerberProjectLoader Gerber project loader.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Candidate entries.
     * @returns {boolean}
     */
    static #canLoadGerberEntries(gerberProjectLoader, entries) {
        if (typeof gerberProjectLoader?.supports !== 'function') {
            return false
        }

        return Boolean(
            gerberProjectLoader.supports(
                EcadParserService.#projectEntries(entries)
            )
        )
    }

    /**
     * Routes model companions through every active project owner.
     * @param {object[]} projectEntries Native project entries.
     * @param {object[]} companions Generic model companion entries.
     * @returns {object[]} Project entries with model companions.
     */
    static #withModelCompanions(projectEntries, companions) {
        return projectEntries.length
            ? [...projectEntries, ...companions]
            : projectEntries
    }

    /**
     * Deduplicates canonical assets retained by overlapping project groups.
     * @param {object[]} assets Canonical project assets.
     * @returns {object[]} Stable unique assets.
     */
    static #uniqueAssets(assets) {
        const unique = new Map()
        for (const asset of assets) {
            const key = [
                String(asset?.kind || ''),
                String(asset?.name || ''),
                String(asset?.source?.entryName || '')
            ].join('\u0000')
            const previous = unique.get(key)
            const previousHasPayload =
                previous?.data !== null && previous?.data !== undefined
            const nextHasPayload =
                asset?.data !== null && asset?.data !== undefined
            if (!previous || (!previousHasPayload && nextHasPayload)) {
                unique.set(key, asset)
            }
        }
        return [...unique.values()]
    }
}
