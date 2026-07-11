import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { GitSourceUrlResolver } from './GitSourceUrlResolver.mjs'

/**
 * Discovers and fetches project-local hosted Git companion model assets.
 */
export class GitHubCompanionAssetLoader {
    /**
     * Resolves conventional Altium project-local companion model files.
     * @param {{ provider?: string, apiUrl?: string, projectPath?: string, ref?: string, directoryPath?: string } | string} directorySource Git host folder source.
     * @param {(apiUrl: string) => Promise<object[]>} fetchJson JSON fetcher.
     * @returns {Promise<{ rawUrl: string, fileName: string, relativePath: string, format: string }[]>}
     */
    static async resolveAltiumProjectAssets(directorySource, fetchJson) {
        const modelFolderPath = '3D Bodies'
        const modelEntries =
            await GitHubCompanionAssetLoader.#fetchOptionalJson(
                GitSourceUrlResolver.buildChildDirectoryApiUrl(
                    directorySource,
                    modelFolderPath
                ),
                fetchJson
            )

        return GitHubCompanionAssetLoader.#buildCompanionAssetFiles(
            modelFolderPath,
            modelEntries
        )
    }

    /**
     * Fetches already-discovered companion asset files.
     * @param {{ rawUrl?: string, fileName?: string, relativePath?: string, format?: string }[]} assetFiles Companion asset descriptors.
     * @param {(rawUrl: string) => Promise<ArrayBuffer>} fetchArrayBuffer Binary fetcher.
     * @returns {Promise<{ name: string, relativePath: string, data: Uint8Array, format: string, source: { uri: string, fileName: string } }[]>}
     */
    static async loadAssetFiles(assetFiles, fetchArrayBuffer) {
        const assets = []

        for (const assetFile of assetFiles || []) {
            const rawUrl = String(assetFile?.rawUrl || '')
            const relativePath = String(assetFile?.relativePath || '')
            const format = String(assetFile?.format || '')
            if (!rawUrl || !relativePath || !format) {
                continue
            }

            try {
                const buffer = await fetchArrayBuffer(rawUrl)
                const data = new Uint8Array(buffer)
                assets.push({
                    name:
                        String(assetFile?.fileName || '') ||
                        GitHubCompanionAssetLoader.#basename(relativePath),
                    relativePath,
                    data,
                    format,
                    source: {
                        uri: rawUrl,
                        fileName: relativePath
                    }
                })
            } catch (_error) {
                // Project-local model folders are optional. Keep parsing the
                // design if an individual companion model cannot be fetched.
            }
        }

        return assets
    }

    /**
     * Dedupe companion assets while preserving first-seen order.
     * @param {{ relativePath?: string }[]} assets Companion assets.
     * @returns {object[]}
     */
    static mergeAssets(assets) {
        const seenPaths = new Set()
        const mergedAssets = []

        ;(assets || []).forEach((asset) => {
            const relativePath = String(asset?.relativePath || '')
            const dedupeKey = relativePath.toLowerCase()
            if (!relativePath || seenPaths.has(dedupeKey)) {
                return
            }

            seenPaths.add(dedupeKey)
            mergedAssets.push(asset)
        })

        return mergedAssets
    }

    /**
     * Fetches an optional hosted Git folder listing.
     * @param {string} apiUrl Git host folder API URL.
     * @param {(apiUrl: string) => Promise<object[]>} fetchJson JSON fetcher.
     * @returns {Promise<object[]>}
     */
    static async #fetchOptionalJson(apiUrl, fetchJson) {
        try {
            return await fetchJson(apiUrl)
        } catch (_error) {
            return []
        }
    }

    /**
     * Builds companion asset descriptors from one hosted Git folder listing.
     * @param {string} folderPath Project-relative folder path.
     * @param {object[]} entries GitHub Contents API entries.
     * @returns {{ rawUrl: string, fileName: string, relativePath: string, format: string }[]}
     */
    static #buildCompanionAssetFiles(folderPath, entries) {
        return (entries || [])
            .map((entry) =>
                GitHubCompanionAssetLoader.#buildCompanionAssetFile(
                    folderPath,
                    entry
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds one companion asset descriptor.
     * @param {string} folderPath Project-relative folder path.
     * @param {object} entry GitHub Contents API entry.
     * @returns {{ rawUrl: string, fileName: string, relativePath: string, format: string } | null}
     */
    static #buildCompanionAssetFile(folderPath, entry) {
        if (entry?.type !== 'file' || !entry?.download_url || !entry?.name) {
            return null
        }

        const fileName = String(entry.name || '')
        const relativePath = GitHubCompanionAssetLoader.#normalizeAssetPath(
            folderPath + '/' + fileName
        )
        const format = EcadFormatRegistry.resolveCompanionFormat(relativePath)
        if (!relativePath || !format) {
            return null
        }

        return {
            rawUrl: String(entry.download_url),
            fileName,
            relativePath,
            format
        }
    }

    /**
     * Normalizes a discovered project-local companion asset path.
     * @param {string} relativePath Candidate relative path.
     * @returns {string}
     */
    static #normalizeAssetPath(relativePath) {
        const parts = String(relativePath || '')
            .replace(/^\.\/+/, '')
            .replaceAll('\\', '/')
            .split('/')
            .filter(Boolean)

        if (!parts.length || parts.includes('..')) {
            return ''
        }

        return parts.join('/')
    }

    /**
     * Returns the last slash-delimited path part.
     * @param {string} path Path-like value.
     * @returns {string}
     */
    static #basename(path) {
        return (
            String(path || '')
                .split('/')
                .filter(Boolean)
                .at(-1) || ''
        )
    }
}
