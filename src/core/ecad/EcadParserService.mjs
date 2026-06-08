import { AltiumParser } from 'altium-toolkit/parser'
import { CircuitJsonParser } from 'circuitjson-toolkit'
import { KicadParser, KicadProjectLoader } from 'kicad-toolkit/parser'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

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

    /**
     * @param {{ altiumParser?: any, kicadParser?: any, kicadProjectLoader?: any, circuitJsonParser?: any }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#altiumParser = dependencies.altiumParser || AltiumParser
        this.#kicadParser = dependencies.kicadParser || KicadParser
        this.#kicadProjectLoader =
            dependencies.kicadProjectLoader || KicadProjectLoader
        this.#circuitJsonParser =
            dependencies.circuitJsonParser || CircuitJsonParser
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
            return this.#kicadParser.parseArrayBuffer(fileName, buffer)
        }

        if (role.sourceFormat === 'circuitjson') {
            return this.#parseCircuitJsonArrayBuffer(fileName, buffer)
        }

        return this.#altiumParser.parseArrayBuffer(fileName, buffer)
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
        const documents = []
        const diagnostics = []
        const assets = []
        let project = null

        for (const entry of altiumEntries) {
            try {
                documents.push(
                    this.#altiumParser.parseArrayBuffer(
                        entry.name,
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

        if (
            kicadEntries.length === 1 &&
            kicadEntries[0].role.fileType !== 'zip'
        ) {
            documents.push(
                this.#kicadParser.parseArrayBuffer(
                    kicadEntries[0].name,
                    kicadEntries[0].buffer
                )
            )
        }

        if (
            kicadEntries.length > 1 ||
            kicadEntries[0]?.role.fileType === 'zip'
        ) {
            const result = await this.#kicadProjectLoader.loadEntries(
                kicadEntries.map((entry) => ({
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

        EcadParserService.#attachDiagnosticsToDocuments(documents, diagnostics)

        return {
            documents,
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
                role: EcadFormatRegistry.resolveNativeRole(entry?.name)
            }))
            .filter((entry) => entry.name && entry.buffer && entry.role)
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
}
