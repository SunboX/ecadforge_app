import { AltiumParser } from 'altium-toolkit/parser'
import { CircuitJsonParser } from 'circuitjson-toolkit'
import { unzipSync } from 'fflate'
import { GerberParser, GerberProjectLoader } from 'gerber-toolkit/parser'
import { KicadParser, KicadProjectLoader } from 'kicad-toolkit/parser'
import { AltiumSchematicArcAngleNormalizer } from './AltiumSchematicArcAngleNormalizer.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'
import { AltiumSchematicFreeGraphicStrokeNormalizer } from './AltiumSchematicFreeGraphicStrokeNormalizer.mjs'
import { AltiumSchematicHiddenDesignatorResolver } from './AltiumSchematicHiddenDesignatorResolver.mjs'
import { AltiumSchematicPackedImageResolver } from './AltiumSchematicPackedImageResolver.mjs'
import { AltiumSchematicSheetBoundsNormalizer } from './AltiumSchematicSheetBoundsNormalizer.mjs'

/**
 * Dispatches ECAD source entries to the owned format toolkits.
 */
export class EcadParserService {
    /** @type {{ parseArrayBuffer: (fileName: string, buffer: ArrayBuffer) => object }} */
    #altiumParser

    /** @type {{ parseArrayBuffer: (fileName: string, buffer: ArrayBuffer) => object }} */
    #kicadParser

    /** @type {{ loadEntries: (entries: { name: string, bytes: Uint8Array }[], options?: object) => Promise<object> | object }} */
    #kicadProjectLoader

    /** @type {{ parseBytes: (bytes: ArrayBuffer | Uint8Array, options?: object) => object[] }} */
    #circuitJsonParser

    /** @type {{ parseArrayBuffer: (fileName: string, buffer: ArrayBuffer, options?: object) => object }} */
    #gerberParser

    /** @type {{ canLoadEntries?: (entries: { name: string, bytes: Uint8Array }[]) => boolean, loadEntries: (entries: { name: string, bytes: Uint8Array }[], options?: object) => Promise<object> | object }} */
    #gerberProjectLoader

    /**
     * @param {{ altiumParser?: any, kicadParser?: any, kicadProjectLoader?: any, circuitJsonParser?: any, gerberParser?: any, gerberProjectLoader?: any }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#altiumParser = dependencies.altiumParser || AltiumParser
        this.#kicadParser = dependencies.kicadParser || KicadParser
        this.#kicadProjectLoader =
            dependencies.kicadProjectLoader || KicadProjectLoader
        this.#circuitJsonParser =
            dependencies.circuitJsonParser || CircuitJsonParser
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
            return EcadParserService.#prepareAppDocument(
                this.#kicadParser.parseArrayBuffer(fileName, buffer)
            )
        }

        if (role.sourceFormat === 'circuitjson') {
            return EcadParserService.#prepareAppDocument(
                this.#parseCircuitJsonArrayBuffer(fileName, buffer)
            )
        }

        if (role.sourceFormat === 'gerber') {
            return EcadParserService.#prepareAppDocument(
                this.#gerberParser.parseArrayBuffer(fileName, buffer)
            )
        }

        return EcadParserService.#prepareAppDocument(
            EcadParserService.#prepareAltiumSchematicDocument(
                this.#altiumParser.parseArrayBuffer(fileName, buffer),
                buffer
            )
        )
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
        const gerberEntryNames = new Set(
            gerberEntries.map((entry) => entry.name)
        )
        const documents = []
        const diagnostics = []
        const assets = []
        let project = null

        for (const entry of altiumEntries) {
            try {
                documents.push(
                    EcadParserService.#prepareAltiumSchematicDocument(
                        this.#altiumParser.parseArrayBuffer(
                            entry.name,
                            entry.buffer
                        ),
                        entry.buffer
                    )
                )
            } catch (error) {
                diagnostics.push(
                    EcadParserService.#buildParseDiagnostic(entry.name, error)
                )
            }
        }

        for (const entry of circuitJsonEntries) {
            try {
                documents.push(
                    this.#parseCircuitJsonArrayBuffer(entry.name, entry.buffer)
                )
            } catch (error) {
                diagnostics.push(
                    EcadParserService.#buildParseDiagnostic(entry.name, error)
                )
            }
        }

        if (gerberEntries.length) {
            try {
                const result = await this.#gerberProjectLoader.loadEntries(
                    gerberEntries.map((entry) => ({
                        name: entry.name,
                        bytes: new Uint8Array(entry.buffer)
                    }))
                )
                documents.push(
                    ...EcadParserService.#documentsFromResult(result)
                )
                diagnostics.push(...(result.diagnostics || []))
                assets.push(...(result.assets || []))
                project = result.project || project
            } catch (error) {
                diagnostics.push(
                    EcadParserService.#buildParseDiagnostic(
                        gerberEntries[0]?.name || 'Gerber fabrication package',
                        error
                    )
                )
            }
        }

        const kicadParseEntries = EcadParserService.#expandKicadArchiveEntries(
            kicadEntries.filter((entry) => !gerberEntryNames.has(entry.name))
        )
        const kicadNativeEntries = kicadParseEntries.filter(
            (entry) => entry.role?.sourceFormat === 'kicad'
        )

        if (
            kicadParseEntries.length === 1 &&
            kicadNativeEntries.length === 1 &&
            kicadNativeEntries[0].role.fileType !== 'zip'
        ) {
            documents.push(
                this.#kicadParser.parseArrayBuffer(
                    kicadNativeEntries[0].name,
                    kicadNativeEntries[0].buffer
                )
            )
        }

        if (
            kicadParseEntries.length > 1 ||
            kicadNativeEntries.length > 1 ||
            kicadParseEntries[0]?.role?.fileType === 'zip'
        ) {
            const result = await this.#kicadProjectLoader.loadEntries(
                kicadParseEntries.map((entry) => ({
                    name: entry.name,
                    bytes: new Uint8Array(entry.buffer)
                }))
            )
            documents.push(...EcadParserService.#documentsFromResult(result))
            diagnostics.push(...(result.diagnostics || []))
            assets.push(...(result.assets || []))
            project = result.project || null
        }

        if (!documents.length && diagnostics.length) {
            throw new Error(diagnostics[0].message)
        }

        EcadParserService.#attachAltiumProjectContext(documents)
        EcadParserService.#attachDiagnosticsToDocuments(documents, diagnostics)

        return {
            documents: EcadParserService.#prepareAppDocuments(documents),
            diagnostics,
            assets,
            project
        }
    }

    /**
     * Parses one standalone CircuitJSON source buffer.
     * @param {string} fileName Source file name.
     * @param {ArrayBuffer | Uint8Array} buffer Source bytes.
     * @returns {object[]}
     */
    #parseCircuitJsonArrayBuffer(fileName, buffer) {
        return this.#circuitJsonParser.parseBytes(buffer, { fileName })
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
     * Normalizes parsed documents to the app runtime shape.
     * @param {object[]} documents Parsed documents.
     * @returns {object[]}
     */
    static #prepareAppDocuments(documents) {
        return documents.map((document) =>
            EcadParserService.#prepareAppDocument(document)
        )
    }

    /**
     * Removes parser-only payloads that the browser app does not render or
     * query after parsing.
     * @param {object} document Parsed document.
     * @returns {object}
     */
    static #prepareAppDocument(document) {
        if (!document || typeof document !== 'object') {
            return document
        }

        EcadParserService.#stripRawPcbRecords(document)
        return document
    }

    /**
     * Applies app-side Altium schematic post-processing.
     * @param {object} document Parsed document model.
     * @param {ArrayBuffer} buffer Source file buffer.
     * @returns {object}
     */
    static #prepareAltiumSchematicDocument(document, buffer) {
        return AltiumSchematicPackedImageResolver.hydrate(
            AltiumSchematicFreeGraphicStrokeNormalizer.normalize(
                AltiumSchematicSheetBoundsNormalizer.normalize(
                    AltiumSchematicArcAngleNormalizer.normalize(
                        AltiumSchematicHiddenDesignatorResolver.annotate(
                            document,
                            buffer
                        )
                    )
                )
            ),
            buffer
        )
    }

    /**
     * Drops large raw PCB record sidecars while preserving derived PCB data.
     * @param {object} document Parsed document.
     * @returns {void}
     */
    static #stripRawPcbRecords(document) {
        if (document?.pcb && typeof document.pcb === 'object') {
            delete document.pcb.rawRecords
        }
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
     * Adds batch diagnostics to parsed documents so the existing diagnostics
     * view can surface source-folder parse failures.
     * @param {object[]} documents Parsed documents.
     * @param {{ severity: string, fileName: string, message: string }[]} diagnostics Batch diagnostics.
     */
    static #attachDiagnosticsToDocuments(documents, diagnostics) {
        if (!diagnostics.length) {
            return
        }

        for (const document of documents) {
            document.diagnostics = [
                ...(Array.isArray(document.diagnostics)
                    ? document.diagnostics
                    : []),
                ...diagnostics
            ]
        }
    }

    /**
     * Attaches Altium project special-string context to schematic documents.
     * @param {object[]} documents Parsed documents.
     */
    static #attachAltiumProjectContext(documents) {
        const projects = (documents || []).filter((document) =>
            EcadParserService.#isAltiumProjectDocument(document)
        )
        if (!projects.length) {
            return
        }

        const currentValues =
            EcadParserService.#buildCurrentAltiumSpecialStringValues()
        for (const document of documents || []) {
            if (!EcadParserService.#isAltiumSchematicDocument(document)) {
                continue
            }

            const projectDocument =
                EcadParserService.#findAltiumProjectForDocument(
                    document,
                    projects
                ) || projects[0]
            document.projectParameters = {
                ...EcadParserService.#extractAltiumProjectParameters(
                    projectDocument
                ),
                ...currentValues,
                ProjectName: EcadParserService.#baseName(
                    projectDocument?.fileName
                ),
                DataSourceFileName: EcadParserService.#baseName(
                    projectDocument?.fileName
                ),
                DocumentName: EcadParserService.#baseName(document.fileName),
                DocumentFullPathAndName: String(document.fileName || ''),
                ...(document.projectParameters || {})
            }
        }
    }

    /**
     * Returns true when one parsed document is an Altium project file.
     * @param {object} document Parsed document.
     * @returns {boolean}
     */
    static #isAltiumProjectDocument(document) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(document) === 'altium' &&
            (document?.kind === 'project' || document?.fileType === 'PrjPcb')
        )
    }

    /**
     * Returns true when one parsed document is an Altium schematic.
     * @param {object} document Parsed document.
     * @returns {boolean}
     */
    static #isAltiumSchematicDocument(document) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(document) === 'altium' &&
            document?.kind === 'schematic' &&
            Boolean(document?.schematic)
        )
    }

    /**
     * Finds the project file that lists a schematic document.
     * @param {object} document Schematic document.
     * @param {object[]} projects Parsed project documents.
     * @returns {object | null}
     */
    static #findAltiumProjectForDocument(document, projects) {
        const documentPath = EcadParserService.#normalizePath(
            document?.fileName
        )
        const documentBaseName = EcadParserService.#baseName(documentPath)
        const exactMatch = projects.find((projectDocument) =>
            EcadParserService.#altiumProjectMentionsDocument(
                projectDocument,
                documentPath,
                documentBaseName,
                false
            )
        )

        return (
            exactMatch ||
            projects.find((projectDocument) =>
                EcadParserService.#altiumProjectMentionsDocument(
                    projectDocument,
                    documentPath,
                    documentBaseName,
                    true
                )
            ) ||
            null
        )
    }

    /**
     * Returns true when a project document references one schematic path.
     * @param {object} projectDocument Parsed project document.
     * @param {string} documentPath Normalized schematic path.
     * @param {string} documentBaseName Normalized schematic basename.
     * @param {boolean} allowBaseNameFallback Whether basename-only matches are allowed.
     * @returns {boolean}
     */
    static #altiumProjectMentionsDocument(
        projectDocument,
        documentPath,
        documentBaseName,
        allowBaseNameFallback
    ) {
        const projectEntries = Array.isArray(
            projectDocument?.project?.documents
        )
            ? projectDocument.project.documents
            : []

        return projectEntries.some((entry) => {
            const entryPath = EcadParserService.#normalizePath(
                entry?.fileName || entry?.name || entry?.path
            )
            if (!entryPath) {
                return false
            }

            return (
                entryPath === documentPath ||
                documentPath.endsWith('/' + entryPath) ||
                entryPath.endsWith('/' + documentPath) ||
                (allowBaseNameFallback &&
                    EcadParserService.#baseName(entryPath) === documentBaseName)
            )
        })
    }

    /**
     * Extracts a project parameter map from supported Altium project shapes.
     * @param {object} projectDocument Parsed project document.
     * @returns {Record<string, string | number | boolean | null | undefined>}
     */
    static #extractAltiumProjectParameters(projectDocument) {
        return {
            ...(projectDocument?.project?.parameters?.map || {}),
            ...(projectDocument?.projectParameters || {})
        }
    }

    /**
     * Builds current date/time special-string values for Altium templates.
     * @returns {{ CurrentDate: string, CurrentTime: string }}
     */
    static #buildCurrentAltiumSpecialStringValues() {
        const now = new Date()

        return {
            CurrentDate: now.toLocaleDateString('en-US'),
            CurrentTime: now.toLocaleTimeString('en-US')
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
     * Returns the final path segment from one source path.
     * @param {string | undefined} fileName Source path.
     * @returns {string}
     */
    static #baseName(fileName) {
        const normalized = EcadParserService.#normalizePath(fileName)
        const parts = normalized.split('/')

        return parts[parts.length - 1] || normalized
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
            .map((entry) => ({
                name: String(entry?.name || ''),
                buffer: entry?.buffer,
                role: EcadParserService.#resolveParserRole(entry?.name)
            }))
            .filter(
                (entry) =>
                    entry.name &&
                    entry.buffer &&
                    entry.role &&
                    EcadParserService.#isVisibleProjectPath(entry.name)
            )
    }

    /**
     * Resolves parser roles, including companion assets that provide project
     * context during batch parsing.
     * @param {string} fileName Source file name.
     * @returns {{ sourceFormat: string, fileType: string } | null}
     */
    static #resolveParserRole(fileName) {
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

        return null
    }

    /**
     * Expands KiCad ZIP entries so hidden archive members can be filtered.
     * @param {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } }[]} entries KiCad candidate entries.
     * @returns {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } | null }[]}
     */
    static #expandKicadArchiveEntries(entries) {
        return (entries || []).flatMap((entry) => {
            if (entry.role?.fileType !== 'zip') {
                return [entry]
            }

            return EcadParserService.#expandKicadArchiveEntry(entry)
        })
    }

    /**
     * Expands one KiCad archive entry into visible project files and assets.
     * @param {{ name: string, buffer: ArrayBuffer }} entry Archive entry.
     * @returns {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } | null }[]}
     */
    static #expandKicadArchiveEntry(entry) {
        const archiveEntries = unzipSync(new Uint8Array(entry.buffer))

        return Object.entries(archiveEntries)
            .filter(([name]) => EcadParserService.#isKicadArchiveEntry(name))
            .map(([name, bytes]) => ({
                name,
                buffer: EcadParserService.#arrayBufferFromBytes(bytes),
                role: EcadParserService.#resolveParserRole(name)
            }))
    }

    /**
     * Returns true when an archive member should be passed to KiCad loading.
     * @param {string} fileName Archive member path.
     * @returns {boolean}
     */
    static #isKicadArchiveEntry(fileName) {
        if (!EcadParserService.#isVisibleProjectPath(fileName)) {
            return false
        }

        const role = EcadParserService.#resolveParserRole(fileName)
        if (role?.sourceFormat === 'kicad') {
            return true
        }

        const companionFormat =
            EcadFormatRegistry.resolveCompanionFormat(fileName)
        if (['kicad-library', 'step', 'wrl'].includes(companionFormat)) {
            return true
        }

        return EcadParserService.#isKicadContextFile(fileName)
    }

    /**
     * Returns true for KiCad project context files.
     * @param {string} fileName Source file name.
     * @returns {boolean}
     */
    static #isKicadContextFile(fileName) {
        const baseName = EcadParserService.#baseName(fileName).toLowerCase()
        return baseName === 'fp-lib-table' || baseName === 'sym-lib-table'
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
     * Copies a byte view into a standalone ArrayBuffer.
     * @param {Uint8Array} bytes Byte view.
     * @returns {ArrayBuffer}
     */
    static #arrayBufferFromBytes(bytes) {
        return bytes.buffer.slice(
            bytes.byteOffset,
            bytes.byteOffset + bytes.byteLength
        )
    }

    /**
     * Resolves parsed documents from a toolkit result.
     * @param {object} result Parser result.
     * @returns {object[]}
     */
    static #documentsFromResult(result) {
        if (Array.isArray(result?.documents)) {
            return result.documents
        }

        if (result?.kind || result?.pcb || result?.schematic) {
            return [result]
        }

        return []
    }

    /**
     * Resolves entries that should be handled by the Gerber package loader.
     * @param {{ name: string, buffer: ArrayBuffer, role: { sourceFormat: string, fileType: string } }[]} entries Normalized entries.
     * @param {{ canLoadEntries?: (entries: { name: string, bytes: Uint8Array }[]) => boolean }} gerberProjectLoader Gerber project loader.
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
     * @param {{ canLoadEntries?: (entries: { name: string, bytes: Uint8Array }[]) => boolean }} gerberProjectLoader Gerber project loader.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Candidate entries.
     * @returns {boolean}
     */
    static #canLoadGerberEntries(gerberProjectLoader, entries) {
        if (typeof gerberProjectLoader?.canLoadEntries !== 'function') {
            return false
        }

        return Boolean(
            gerberProjectLoader.canLoadEntries(
                entries.map((entry) => ({
                    name: entry.name,
                    bytes: new Uint8Array(entry.buffer)
                }))
            )
        )
    }
}
