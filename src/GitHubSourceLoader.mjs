import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Loads supported ECAD files from GitHub raw or blob URLs.
 */
export class GitHubSourceLoader {
    /** @type {(url: string) => Promise<Response>} */
    #fetcher

    /**
     * @param {{ fetcher?: (url: string) => Promise<Response> }} [dependencies]
     */
    constructor(dependencies = {}) {
        this.#fetcher =
            dependencies.fetcher ||
            (typeof globalThis.fetch === 'function'
                ? globalThis.fetch.bind(globalThis)
                : undefined)
    }

    /**
     * Loads one supported GitHub URL into parser entries.
     * @param {string} sourceUrl Raw or GitHub blob URL.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[] }>}
     */
    async loadUrl(sourceUrl) {
        const resolved = GitHubSourceLoader.normalizeSourceUrl(sourceUrl)
        const entries = await this.#loadEntries(resolved)

        return {
            sourceType: 'github',
            formatFamily: resolved.formatFamily,
            rawUrl: resolved.rawUrl,
            boardUrl: GitHubSourceLoader.#resolveBoardUrl(resolved),
            entries
        }
    }

    /**
     * Loads one owner/repo/path query value from raw GitHub.
     * @param {string} githubPath Query path in owner/repo/path form.
     * @param {string} [ref] Optional git ref.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[] }>}
     */
    async loadGitHubPath(githubPath, ref = 'main') {
        const resolved = GitHubSourceLoader.normalizeGitHubPath(githubPath, ref)
        const entries = await this.#loadEntries(resolved)

        return {
            sourceType: 'github',
            formatFamily: resolved.formatFamily,
            rawUrl: resolved.rawUrl,
            boardUrl: GitHubSourceLoader.#resolveBoardUrl(resolved),
            entries
        }
    }

    /**
     * Normalizes a raw.githubusercontent.com or github.com/blob URL.
     * @param {string} sourceUrl URL supplied by the user.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static normalizeSourceUrl(sourceUrl) {
        const parsedUrl = GitHubSourceLoader.#parseHttpsUrl(sourceUrl)

        if (parsedUrl.hostname === 'raw.githubusercontent.com') {
            return GitHubSourceLoader.#buildResolvedUrl(parsedUrl.href)
        }

        if (parsedUrl.hostname === 'github.com') {
            const parts = parsedUrl.pathname.split('/').filter(Boolean)
            if (parts.length < 5 || parts[2] !== 'blob') {
                throw new Error(
                    'Only GitHub blob URLs or raw.githubusercontent.com URLs are supported.'
                )
            }

            const rawPath = parts
                .slice(0, 2)
                .concat(parts.slice(3))
                .map((part) => encodeURIComponent(decodeURIComponent(part)))
                .join('/')

            return GitHubSourceLoader.#buildResolvedUrl(
                'https://raw.githubusercontent.com/' + rawPath
            )
        }

        throw new Error(
            'Only GitHub blob URLs or raw.githubusercontent.com URLs are supported.'
        )
    }

    /**
     * Normalizes a query value in owner/repo/path form.
     * @param {string} githubPath Query path.
     * @param {string} [ref] Optional git ref.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static normalizeGitHubPath(githubPath, ref = 'main') {
        const parts = String(githubPath || '')
            .split('/')
            .filter(Boolean)

        if (parts.length < 3) {
            throw new Error(
                'GitHub source must use owner/repo/path/to/file format.'
            )
        }

        const rawPath = [
            parts[0],
            parts[1],
            String(ref || 'main'),
            ...parts.slice(2)
        ]
            .map((part) => encodeURIComponent(decodeURIComponent(part)))
            .join('/')

        return GitHubSourceLoader.#buildResolvedUrl(
            'https://raw.githubusercontent.com/' + rawPath
        )
    }

    /**
     * Fetches every parser entry required by one resolved URL.
     * @param {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }} resolved Resolved URL.
     * @returns {Promise<{ name: string, buffer: ArrayBuffer }[]>}
     */
    async #loadEntries(resolved) {
        const resolvedFiles = GitHubSourceLoader.#resolveProjectFiles(resolved)
        return Promise.all(
            resolvedFiles.map(async (file) => ({
                name: file.fileName,
                buffer: await this.#fetchArrayBuffer(file.rawUrl)
            }))
        )
    }

    /**
     * Fetches one URL as an ArrayBuffer with user-facing error buckets.
     * @param {string} rawUrl GitHub raw URL.
     * @returns {Promise<ArrayBuffer>}
     */
    async #fetchArrayBuffer(rawUrl) {
        if (typeof this.#fetcher !== 'function') {
            throw new Error('GitHub URL loading is not available here.')
        }

        let response
        try {
            response = await this.#fetcher(rawUrl)
        } catch (_error) {
            throw new Error(
                'Could not fetch the GitHub file. The request may be blocked by the network or browser CORS policy.'
            )
        }

        if (!response || !response.ok) {
            throw new Error(
                'GitHub returned HTTP ' +
                    String(response?.status || 0) +
                    ' for the requested ECAD file.'
            )
        }

        return response.arrayBuffer()
    }

    /**
     * Parses an HTTPS URL.
     * @param {string} sourceUrl Candidate URL.
     * @returns {URL}
     */
    static #parseHttpsUrl(sourceUrl) {
        let parsedUrl
        try {
            parsedUrl = new URL(String(sourceUrl || '').trim())
        } catch (_error) {
            throw new Error('Please enter a valid GitHub URL.')
        }

        if (parsedUrl.protocol !== 'https:') {
            throw new Error('GitHub URL loading requires an HTTPS URL.')
        }

        return parsedUrl
    }

    /**
     * Builds metadata for one raw URL.
     * @param {string} rawUrl Raw GitHub URL.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static #buildResolvedUrl(rawUrl) {
        const parsedUrl = new URL(rawUrl)
        const fileName = decodeURIComponent(
            parsedUrl.pathname.split('/').filter(Boolean).at(-1) || ''
        )
        const role = EcadFormatRegistry.resolveNativeRole(fileName)

        if (!role) {
            throw new Error(
                'This GitHub file type is not supported yet. ECAD Forge supports selected Altium and KiCad design files.'
            )
        }

        return {
            rawUrl,
            fileName,
            formatFamily: role.sourceFormat,
            fileType: role.fileType
        }
    }

    /**
     * Resolves the set of files required to parse one source.
     * @param {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }} resolved Resolved URL.
     * @returns {{ rawUrl: string, fileName: string }[]}
     */
    static #resolveProjectFiles(resolved) {
        if (resolved.fileType !== 'kicad_pro') {
            return [{ rawUrl: resolved.rawUrl, fileName: resolved.fileName }]
        }

        const stemUrl = resolved.rawUrl.replace(/\.kicad_pro$/i, '')
        const stemName = resolved.fileName.replace(/\.kicad_pro$/i, '')

        return ['.kicad_pro', '.kicad_sch', '.kicad_pcb'].map((extension) => ({
            rawUrl: stemUrl + extension,
            fileName: stemName + extension
        }))
    }

    /**
     * Resolves the matching board URL for PCB Styler links when possible.
     * @param {{ rawUrl: string, fileType: string }} resolved Resolved URL.
     * @returns {string}
     */
    static #resolveBoardUrl(resolved) {
        if (resolved.fileType === 'kicad_pro') {
            return resolved.rawUrl.replace(/\.kicad_pro$/i, '.kicad_pcb')
        }

        if (
            resolved.fileType === 'kicad_pcb' ||
            resolved.fileType === 'pcbdoc'
        ) {
            return resolved.rawUrl
        }

        return ''
    }
}
