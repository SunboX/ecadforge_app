import { AltiumParser } from '@sunbox/altium-toolkit/parser'
import { KicadParser, KicadProjectLoader } from '@sunbox/kicad-toolkit/parser'
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

    /**
     * @param {{ altiumParser?: any, kicadParser?: any, kicadProjectLoader?: any }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#altiumParser = dependencies.altiumParser || AltiumParser
        this.#kicadParser = dependencies.kicadParser || KicadParser
        this.#kicadProjectLoader =
            dependencies.kicadProjectLoader || KicadProjectLoader
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
        const documents = altiumEntries.map((entry) => {
            return this.#altiumParser.parseArrayBuffer(entry.name, entry.buffer)
        })
        const diagnostics = []
        const assets = []
        let project = null

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

        return {
            documents,
            diagnostics,
            assets,
            project
        }
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
