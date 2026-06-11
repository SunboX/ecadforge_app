import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Normalizes parser input and output data for AppController.
 */
export class AppControllerParserData {
    /**
     * Resolves the coarse format family for a parser entry batch.
     * @param {{ name: string }[]} entries Parser entries.
     * @returns {string}
     */
    static resolveFormatFamily(entries) {
        const role = EcadFormatRegistry.resolveNativeRole(entries[0]?.name)
        return role?.sourceFormat || ''
    }

    /**
     * Normalizes one companion asset record for session state.
     * @param {{ name?: string, webkitRelativePath?: string }} file
     * @returns {{ name: string, relativePath: string, file: any, format: string }}
     */
    static buildCompanionAsset(file) {
        const fileName = String(file?.name || '')
        const relativePath =
            String(file?.webkitRelativePath || fileName) || fileName

        return {
            name: fileName,
            relativePath,
            file,
            format: EcadFormatRegistry.resolveCompanionFormat(fileName)
        }
    }

    /**
     * Normalizes one parser asset record for session state.
     * @param {{ name?: string, bytes?: Uint8Array, relativePath?: string, format?: string }} asset Parser asset.
     * @returns {{ name: string, relativePath: string, file: any, format: string }}
     */
    static buildParsedAsset(asset) {
        const relativePath = String(asset?.relativePath || asset?.name || '')
        const name = String(asset?.name || relativePath.split('/').pop() || '')
        const bytes = asset?.bytes || new Uint8Array()
        const format =
            String(asset?.format || '') ||
            EcadFormatRegistry.resolveCompanionFormat(name)

        return {
            name,
            relativePath,
            file: typeof Blob === 'function' ? new Blob([bytes]) : bytes,
            format
        }
    }

    /**
     * Merges session companion assets by relative path.
     * @param {{ name: string, relativePath: string, file: any, format: string }[]} existingAssets Existing assets.
     * @param {{ name: string, relativePath: string, file: any, format: string }[]} nextAssets New assets.
     * @returns {{ name: string, relativePath: string, file: any, format: string }[]}
     */
    static mergeSessionAssets(existingAssets, nextAssets) {
        const mergedAssets = new Map()

        ;[...(existingAssets || []), ...(nextAssets || [])].forEach((asset) => {
            mergedAssets.set(String(asset.relativePath).toLowerCase(), asset)
        })

        return [...mergedAssets.values()]
    }

    /**
     * Builds one parser entry from a browser File.
     * @param {{ name?: string, webkitRelativePath?: string, arrayBuffer: () => Promise<ArrayBuffer> }} file Source file.
     * @returns {Promise<{ name: string, buffer: ArrayBuffer }>}
     */
    static async buildParserEntry(file) {
        const fileName = String(file?.name || '')
        const relativePath =
            String(file?.webkitRelativePath || fileName) || fileName

        return {
            name: relativePath,
            buffer: await file.arrayBuffer()
        }
    }

    /**
     * Normalizes parser return shapes from direct and worker code paths.
     * @param {object} result Parser result.
     * @returns {{ documents: object[], assets: object[], diagnostics: object[], project: object | null }}
     */
    static normalizeParseResult(result) {
        const documents = Array.isArray(result?.documents)
            ? result.documents
            : result?.documentModel
              ? [result.documentModel]
              : result?.kind || result?.pcb || result?.schematic
                ? [result]
                : []

        return {
            documents,
            assets: Array.isArray(result?.assets) ? result.assets : [],
            diagnostics: Array.isArray(result?.diagnostics)
                ? result.diagnostics
                : [],
            project: result?.project || null
        }
    }
}
