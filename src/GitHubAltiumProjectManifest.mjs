import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Resolves source files listed by an Altium project manifest from GitHub raw.
 */
export class GitHubAltiumProjectManifest {
    /**
     * Resolves supported source files from an Altium `.PrjPcb` manifest.
     * @param {string} projectRawUrl Raw GitHub URL for the project manifest.
     * @param {string} manifestText Manifest text.
     * @returns {{ rawUrl: string, fileName: string }[]}
     */
    static resolveSourceFiles(projectRawUrl, manifestText) {
        const seen = new Set()

        return GitHubAltiumProjectManifest.#extractDocumentPaths(manifestText)
            .map((documentPath) =>
                GitHubAltiumProjectManifest.#normalizeDocumentPath(documentPath)
            )
            .filter((documentPath) => {
                if (!documentPath || seen.has(documentPath.toLowerCase())) {
                    return false
                }

                const role = EcadFormatRegistry.resolveNativeRole(documentPath)
                if (role?.sourceFormat !== 'altium') {
                    return false
                }

                seen.add(documentPath.toLowerCase())
                return true
            })
            .map((documentPath) => ({
                rawUrl: GitHubAltiumProjectManifest.#resolveRawUrl(
                    projectRawUrl,
                    documentPath
                ),
                fileName: documentPath
            }))
    }

    /**
     * Extracts raw DocumentPath values in manifest order.
     * @param {string} manifestText Manifest text.
     * @returns {string[]}
     */
    static #extractDocumentPaths(manifestText) {
        return String(manifestText || '')
            .split(/\r?\n/u)
            .map((line) => line.match(/^\s*DocumentPath\s*=\s*(.+?)\s*$/iu))
            .filter(Boolean)
            .map((match) => String(match[1] || ''))
    }

    /**
     * Normalizes one project-relative document path.
     * @param {string} documentPath Raw document path.
     * @returns {string}
     */
    static #normalizeDocumentPath(documentPath) {
        const parts = String(documentPath || '')
            .trim()
            .replaceAll('\\', '/')
            .split('/')
            .filter(Boolean)

        if (
            !parts.length ||
            parts.some((part) => part === '.' || part === '..') ||
            /^[a-z][a-z0-9+.-]*:/iu.test(parts[0])
        ) {
            return ''
        }

        return parts.join('/')
    }

    /**
     * Resolves a project-relative path against the raw GitHub project URL.
     * @param {string} projectRawUrl Raw GitHub URL for the project manifest.
     * @param {string} relativePath Project-relative source path.
     * @returns {string}
     */
    static #resolveRawUrl(projectRawUrl, relativePath) {
        const parsedUrl = new URL(projectRawUrl)
        const directoryParts = parsedUrl.pathname
            .split('/')
            .filter(Boolean)
            .slice(0, -1)
        const sourceParts = relativePath
            .split('/')
            .filter(Boolean)
            .map((part) => encodeURIComponent(decodeURIComponent(part)))

        parsedUrl.pathname = '/' + [...directoryParts, ...sourceParts].join('/')
        return parsedUrl.href
    }
}
