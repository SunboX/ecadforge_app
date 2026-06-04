import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Discovers and fetches project-local GitHub companion model assets.
 */
export class GitHubCompanionAssetLoader {
    /**
     * Resolves conventional Altium project-local companion model files.
     * @param {string} contentsApiUrl GitHub Contents API URL for the project folder.
     * @param {(apiUrl: string) => Promise<object[]>} fetchJson JSON fetcher.
     * @returns {Promise<{ rawUrl: string, fileName: string, relativePath: string, format: string }[]>}
     */
    static async resolveAltiumProjectAssets(contentsApiUrl, fetchJson) {
        const modelFolderPath = '3D Bodies'
        const modelEntries = await GitHubCompanionAssetLoader.#fetchOptionalJson(
            GitHubCompanionAssetLoader.#buildChildContentsApiUrl(
                contentsApiUrl,
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
     * @returns {Promise<{ name: string, relativePath: string, bytes: Uint8Array, format: string }[]>}
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
                assets.push({
                    name:
                        String(assetFile?.fileName || '') ||
                        GitHubCompanionAssetLoader.#basename(relativePath),
                    relativePath,
                    bytes: new Uint8Array(buffer),
                    format
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
     * Fetches an optional GitHub folder listing.
     * @param {string} apiUrl GitHub Contents API URL.
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
     * Builds a child GitHub Contents API URL below an existing folder URL.
     * @param {string} contentsApiUrl Parent Contents API URL.
     * @param {string} relativePath Child folder path.
     * @returns {string}
     */
    static #buildChildContentsApiUrl(contentsApiUrl, relativePath) {
        const parsedUrl = new URL(contentsApiUrl)
        const childParts = String(relativePath || '')
            .split('/')
            .filter(Boolean)
            .map((part) => encodeURIComponent(decodeURIComponent(part)))

        parsedUrl.pathname =
            parsedUrl.pathname.replace(/\/+$/u, '') + '/' + childParts.join('/')
        return parsedUrl.href
    }

    /**
     * Builds companion asset descriptors from one GitHub folder listing.
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
