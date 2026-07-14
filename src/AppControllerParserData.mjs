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
     * @param {{ name?: string, data?: Uint8Array, relativePath?: string, format?: string }} asset Parser asset.
     * @returns {{ name: string, relativePath: string, file: any, format: string }}
     */
    static buildParsedAsset(asset) {
        const relativePath = String(asset?.relativePath || asset?.name || '')
        const name = String(asset?.name || relativePath.split('/').pop() || '')
        const bytes = asset?.data || new Uint8Array()
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
     * Merges session companion assets by physical relative path while retaining
     * every exact authored alias that resolves to that asset.
     * @param {{ name: string, relativePath: string, file: any, format: string, aliases?: string[] }[]} existingAssets Existing assets.
     * @param {{ name: string, relativePath: string, file: any, format: string, aliases?: string[] }[]} nextAssets New assets.
     * @returns {{ name: string, relativePath: string, file: any, format: string, aliases?: string[] }[]}
     */
    static mergeSessionAssets(existingAssets, nextAssets) {
        const mergedAssets = []
        const indexesByPath = new Map()

        ;[...(existingAssets || []), ...(nextAssets || [])].forEach((asset) => {
            const key = AppControllerParserData.#sessionAssetPathIdentity(asset)
            if (!key) {
                mergedAssets.push(asset)
                return
            }

            const matchingIndex = (indexesByPath.get(key) || []).find((index) =>
                AppControllerParserData.#sessionAssetsAreCompatible(
                    mergedAssets[index],
                    asset
                )
            )
            if (matchingIndex !== undefined) {
                mergedAssets[matchingIndex] =
                    AppControllerParserData.#mergeSessionAsset(
                        mergedAssets[matchingIndex],
                        asset
                    )
                return
            }

            const nextIndex = mergedAssets.length
            mergedAssets.push(asset)
            indexesByPath.set(key, [
                ...(indexesByPath.get(key) || []),
                nextIndex
            ])
        })

        return mergedAssets
    }

    /**
     * Returns the exact, separator-normalized physical path identity of an asset.
     * @param {object} asset Asset descriptor.
     * @returns {string}
     */
    static #sessionAssetPathIdentity(asset) {
        return String(asset?.relativePath || '')
            .trim()
            .replaceAll('\\', '/')
    }

    /**
     * Returns true only when two same-path descriptors have compatible source,
     * document, format, and payload identity.
     * @param {object} currentAsset Existing asset descriptor.
     * @param {object} nextAsset New asset descriptor.
     * @returns {boolean}
     */
    static #sessionAssetsAreCompatible(currentAsset, nextAsset) {
        const currentScope = currentAsset?.documentScope || null
        const nextScope = nextAsset?.documentScope || null
        if (
            (currentScope || nextScope) &&
            (!currentScope || !nextScope || currentScope !== nextScope)
        ) {
            return false
        }

        for (const key of ['source', 'sourceUrl', 'format']) {
            const currentValue = String(currentAsset?.[key] || '').trim()
            const nextValue = String(nextAsset?.[key] || '').trim()
            if (currentValue && nextValue && currentValue !== nextValue) {
                return false
            }
        }

        const currentFile = currentAsset?.file
        const nextFile = nextAsset?.file
        if (currentFile && nextFile && currentFile !== nextFile) {
            const currentSourceUrl = String(
                currentAsset?.sourceUrl || ''
            ).trim()
            const nextSourceUrl = String(nextAsset?.sourceUrl || '').trim()
            return Boolean(
                currentSourceUrl && currentSourceUrl === nextSourceUrl
            )
        }

        return true
    }

    /**
     * Combines descriptors for one physical asset without dropping aliases or
     * optional provenance present only on the earlier descriptor.
     * @param {object} currentAsset Existing asset descriptor.
     * @param {object} nextAsset New asset descriptor.
     * @returns {object}
     */
    static #mergeSessionAsset(currentAsset, nextAsset) {
        const aliases = AppControllerParserData.#mergeSessionAssetAliases(
            currentAsset,
            nextAsset
        )
        return {
            ...currentAsset,
            ...nextAsset,
            ...(aliases.length ? { aliases } : {})
        }
    }

    /**
     * Returns the stable union of exact authored aliases from asset descriptors.
     * @param {...object} assets Asset descriptors.
     * @returns {string[]}
     */
    static #mergeSessionAssetAliases(...assets) {
        const aliases = []
        for (const asset of assets) {
            for (const value of Array.isArray(asset?.aliases)
                ? asset.aliases
                : []) {
                const alias = typeof value === 'string' ? value.trim() : ''
                if (alias && !aliases.includes(alias)) aliases.push(alias)
            }
        }
        return aliases
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
