import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { GitHubAltiumProjectManifest } from './GitHubAltiumProjectManifest.mjs'
import { SExpressionParser } from 'kicad-toolkit/parser'

/**
 * Loads supported ECAD files from GitHub raw, blob, or tree URLs.
 */
export class GitHubSourceLoader {
    /** @type {number} */
    static #MILS_PER_MM = 1000 / 25.4

    /** @type {string} */
    static #GITHUB_RATE_LIMIT_URL = 'https://api.github.com/rate_limit'

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
     * @param {string} sourceUrl Raw, GitHub blob, or GitHub tree URL.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[], assets: object[], modelReferences: object[] }>}
     */
    async loadUrl(sourceUrl) {
        const treeSource = GitHubSourceLoader.#normalizeTreeUrl(sourceUrl)
        const resolved = treeSource
            ? await this.#resolveTreeSource(treeSource)
            : GitHubSourceLoader.normalizeSourceUrl(sourceUrl)

        return this.#buildLoadResult(resolved)
    }

    /**
     * Loads one owner/repo/path query value from raw GitHub.
     * @param {string} githubPath Query path in owner/repo/path form.
     * @param {string} [ref] Optional git ref.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[], assets: object[], modelReferences: object[] }>}
     */
    async loadGitHubPath(githubPath, ref = 'main') {
        const resolved = GitHubSourceLoader.normalizeGitHubPath(githubPath, ref)
        return this.#buildLoadResult(resolved)
    }

    /**
     * Builds a complete source descriptor from one resolved source file.
     * @param {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }} resolved Resolved source file.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[], assets: object[], modelReferences: object[] }>}
     */
    async #buildLoadResult(resolved) {
        const entries = await this.#loadEntries(resolved)
        const modelReferences =
            GitHubSourceLoader.#extractKicadModelReferences(entries)
        const assets = await this.#loadReferencedModelAssets(
            resolved.rawUrl,
            modelReferences
        )

        return {
            sourceType: 'github',
            formatFamily: resolved.formatFamily,
            rawUrl: resolved.rawUrl,
            boardUrl: GitHubSourceLoader.#resolveBoardUrl(resolved),
            entries,
            assets,
            modelReferences
        }
    }

    /**
     * Fetches project-local model assets referenced by KiCad footprints.
     * @param {string} sourceRawUrl Raw URL for the selected project source.
     * @param {{ name?: string, relativePath?: string }[]} modelReferences Model references.
     * @returns {Promise<{ name: string, relativePath: string, bytes: Uint8Array, format: string }[]>}
     */
    async #loadReferencedModelAssets(sourceRawUrl, modelReferences) {
        const directoryUrl =
            GitHubSourceLoader.#resolveRawDirectoryUrl(sourceRawUrl)
        const assets = []
        const seenPaths = new Set()

        for (const modelReference of modelReferences || []) {
            const relativePath = String(modelReference?.relativePath || '')
            const format =
                EcadFormatRegistry.resolveCompanionFormat(relativePath)
            const dedupeKey = relativePath.toLowerCase()
            if (!relativePath || !format || seenPaths.has(dedupeKey)) {
                continue
            }

            seenPaths.add(dedupeKey)

            try {
                const modelUrl = GitHubSourceLoader.#resolveRawAssetUrl(
                    directoryUrl,
                    relativePath
                )
                const buffer = await this.#fetchArrayBuffer(modelUrl)
                assets.push({
                    name: GitHubSourceLoader.#basename(relativePath),
                    relativePath,
                    bytes: new Uint8Array(buffer),
                    format
                })
            } catch (_error) {
                // Keep the board load resilient when optional 3D assets are
                // missing, renamed, or too large for GitHub raw delivery.
            }
        }

        return assets
    }

    /**
     * Resolves the preferred supported source from a GitHub directory.
     * @param {{ apiUrl: string }} treeSource GitHub Contents API source.
     * @returns {Promise<{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }>}
     */
    async #resolveTreeSource(treeSource) {
        await this.#assertGitHubFolderDiscoveryAvailable()
        const entries = await this.#fetchJson(treeSource.apiUrl)
        const altiumProject = await this.#resolveAltiumProject(entries)
        if (altiumProject) {
            return altiumProject
        }

        return GitHubSourceLoader.#selectDirectorySource(entries)
    }

    /**
     * Resolves an Altium `.PrjPcb` manifest from a GitHub folder, if present.
     * @param {object[]} entries GitHub Contents API entries.
     * @returns {Promise<{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles: { rawUrl: string, fileName: string }[] } | null>}
     */
    async #resolveAltiumProject(entries) {
        const projectEntries = (entries || []).filter((entry) => {
            return (
                entry?.type === 'file' &&
                entry?.download_url &&
                EcadFormatRegistry.resolveCompanionFormat(entry?.name) ===
                    'altium-project'
            )
        })

        if (!projectEntries.length) {
            return null
        }

        if (projectEntries.length > 1) {
            throw new Error(
                'This GitHub folder contains multiple Altium project files. Please paste the specific project file URL.'
            )
        }

        const projectEntry = projectEntries[0]
        const projectRawUrl = String(projectEntry.download_url)
        const manifestText = new TextDecoder().decode(
            await this.#fetchArrayBuffer(projectRawUrl)
        )
        const projectFiles = GitHubAltiumProjectManifest.resolveSourceFiles(
            projectRawUrl,
            manifestText
        )

        if (!projectFiles.length) {
            throw new Error(
                'This Altium project file does not list supported schematic or PCB documents.'
            )
        }

        return {
            rawUrl: projectRawUrl,
            fileName: String(projectEntry.name || ''),
            formatFamily: 'altium',
            fileType: 'prjpcb',
            projectFiles
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
                    'Only GitHub blob/tree URLs or raw.githubusercontent.com URLs are supported.'
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
            'Only GitHub blob/tree URLs or raw.githubusercontent.com URLs are supported.'
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
     * Fetches one GitHub API URL and parses the JSON response.
     * @param {string} apiUrl GitHub Contents API URL.
     * @returns {Promise<object[]>}
     */
    async #fetchJson(apiUrl) {
        if (typeof this.#fetcher !== 'function') {
            throw new Error('GitHub URL loading is not available here.')
        }

        let response
        try {
            response = await this.#fetcher(apiUrl)
        } catch (_error) {
            throw new Error(
                'Could not fetch the GitHub folder. The request may be blocked by the network or browser CORS policy.'
            )
        }

        if (!response || !response.ok) {
            throw new Error(
                'GitHub returned HTTP ' +
                    String(response?.status || 0) +
                    ' for the requested GitHub folder.'
            )
        }

        let payload
        try {
            payload = await response.json()
        } catch (_error) {
            throw new Error('Could not read the GitHub folder listing.')
        }

        if (!Array.isArray(payload)) {
            throw new Error('This GitHub URL does not point to a folder.')
        }

        return payload
    }

    /**
     * Stops folder discovery before the rate-limited Contents API would fail.
     * @returns {Promise<void>}
     */
    async #assertGitHubFolderDiscoveryAvailable() {
        const status = await this.#readGitHubRateLimit()
        if (!status || status.remaining > 0) {
            return
        }

        throw new Error(
            GitHubSourceLoader.#buildRateLimitErrorMessage(status.reset)
        )
    }

    /**
     * Reads the public GitHub API quota without blocking on transient failures.
     * @returns {Promise<{ remaining: number, reset: number } | null>}
     */
    async #readGitHubRateLimit() {
        if (typeof this.#fetcher !== 'function') {
            return null
        }

        let response
        try {
            response = await this.#fetcher(
                GitHubSourceLoader.#GITHUB_RATE_LIMIT_URL
            )
        } catch (_error) {
            return null
        }

        if (!response || !response.ok) {
            return null
        }

        let payload
        try {
            payload = await response.json()
        } catch (_error) {
            return null
        }

        const coreStatus = payload?.resources?.core || payload?.rate
        const remaining = Number(coreStatus?.remaining)
        if (!Number.isFinite(remaining)) {
            return null
        }

        const reset = Number(coreStatus?.reset)
        return {
            remaining,
            reset: Number.isFinite(reset) ? reset : 0
        }
    }

    /**
     * Builds an actionable message for exhausted GitHub folder discovery quota.
     * @param {number} reset GitHub reset timestamp in seconds.
     * @returns {string}
     */
    static #buildRateLimitErrorMessage(reset) {
        const resetDate = Number(reset) > 0 ? new Date(reset * 1000) : null
        const retryText =
            resetDate && !Number.isNaN(resetDate.getTime())
                ? ' Try again after ' +
                  GitHubSourceLoader.#formatLocalDateTime(resetDate) +
                  ' (local time).'
                : ' Wait until GitHub resets the public API quota.'

        return (
            'GitHub API rate limit is exhausted for folder discovery. Paste a GitHub blob/raw file URL instead, or use a shared ECAD Forge link with a direct file path.' +
            retryText
        )
    }

    /**
     * Formats a date with the user's runtime locale and timezone.
     * @param {Date} date Date to format.
     * @returns {string}
     */
    static #formatLocalDateTime(date) {
        try {
            return new Intl.DateTimeFormat(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short'
            }).format(date)
        } catch (_error) {
            return date.toLocaleString()
        }
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
     * Normalizes a GitHub tree URL to a Contents API URL.
     * @param {string} sourceUrl URL supplied by the user.
     * @returns {{ apiUrl: string } | null}
     */
    static #normalizeTreeUrl(sourceUrl) {
        const parsedUrl = GitHubSourceLoader.#parseHttpsUrl(sourceUrl)

        if (parsedUrl.hostname !== 'github.com') {
            return null
        }

        const parts = parsedUrl.pathname.split('/').filter(Boolean)
        if (parts[2] !== 'tree') {
            return null
        }

        if (parts.length < 4) {
            throw new Error(
                'GitHub tree URLs must include owner, repository, and branch.'
            )
        }

        return {
            apiUrl: GitHubSourceLoader.#buildContentsApiUrl(
                parts[0],
                parts[1],
                parts[3],
                parts.slice(4)
            )
        }
    }

    /**
     * Builds a GitHub Contents API URL for one repository path.
     * @param {string} owner Repository owner.
     * @param {string} repo Repository name.
     * @param {string} ref Git ref.
     * @param {string[]} pathParts Directory path parts.
     * @returns {string}
     */
    static #buildContentsApiUrl(owner, repo, ref, pathParts) {
        const encodedPath = pathParts
            .map((part) => encodeURIComponent(decodeURIComponent(part)))
            .join('/')
        const baseUrl =
            'https://api.github.com/repos/' +
            encodeURIComponent(decodeURIComponent(owner)) +
            '/' +
            encodeURIComponent(decodeURIComponent(repo)) +
            '/contents'
        const contentsUrl = encodedPath ? baseUrl + '/' + encodedPath : baseUrl

        return (
            contentsUrl +
            '?ref=' +
            encodeURIComponent(decodeURIComponent(ref || 'main'))
        )
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
     * Selects the one supported ECAD source to load from a GitHub folder.
     * @param {object[]} entries GitHub Contents API entries.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static #selectDirectorySource(entries) {
        const candidates = entries
            .map((entry) => GitHubSourceLoader.#buildDirectoryCandidate(entry))
            .filter(Boolean)
            .sort((left, right) => {
                const priority =
                    GitHubSourceLoader.#getDirectorySourcePriority(left) -
                    GitHubSourceLoader.#getDirectorySourcePriority(right)

                if (priority !== 0) return priority
                return left.fileName.localeCompare(right.fileName)
            })

        if (!candidates.length) {
            throw new Error(
                'This GitHub folder does not contain a supported ECAD file.'
            )
        }

        const bestPriority = GitHubSourceLoader.#getDirectorySourcePriority(
            candidates[0]
        )
        const preferredCandidates = candidates.filter(
            (candidate) =>
                GitHubSourceLoader.#getDirectorySourcePriority(candidate) ===
                bestPriority
        )

        if (preferredCandidates.length > 1) {
            throw new Error(
                'This GitHub folder contains multiple supported ECAD files. Please paste the specific project file URL.'
            )
        }

        return candidates[0]
    }

    /**
     * Builds a supported source candidate from one GitHub Contents API entry.
     * @param {object} entry GitHub Contents API entry.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string } | null}
     */
    static #buildDirectoryCandidate(entry) {
        if (!entry || entry.type !== 'file' || !entry.download_url) {
            return null
        }

        const fileName = String(entry.name || '')
        const role = EcadFormatRegistry.resolveNativeRole(fileName)
        if (!role) return null

        return {
            rawUrl: String(entry.download_url),
            fileName,
            formatFamily: role.sourceFormat,
            fileType: role.fileType
        }
    }

    /**
     * Returns source discovery priority for GitHub folders.
     * @param {{ fileType: string }} source Candidate source.
     * @returns {number}
     */
    static #getDirectorySourcePriority(source) {
        const priorities = {
            kicad_pro: 0,
            kicad_pcb: 1,
            kicad_sch: 2,
            pcbdoc: 3,
            schdoc: 4
        }

        return priorities[source.fileType] ?? 99
    }

    /**
     * Resolves the set of files required to parse one source.
     * @param {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }} resolved Resolved URL.
     * @returns {{ rawUrl: string, fileName: string }[]}
     */
    static #resolveProjectFiles(resolved) {
        if (
            Array.isArray(resolved.projectFiles) &&
            resolved.projectFiles.length
        ) {
            return resolved.projectFiles
        }

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
     * Extracts project-local KiCad footprint model references from parser
     * entries.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Parser entries.
     * @returns {{ designator: string, modelName: string, modelPath: string, relativePath: string, modelTransform: { rotationDeg: { x: number, y: number, z: number }, offsetMil: { x: number, y: number, z: number }, dxMil: number, dyMil: number, dzMil: number, scale: { x: number, y: number, z: number } } }[]}
     */
    static #extractKicadModelReferences(entries) {
        const decoder = new TextDecoder()
        const modelReferences = []

        ;(entries || []).forEach((entry) => {
            const role = EcadFormatRegistry.resolveNativeRole(entry?.name)
            if (role?.fileType !== 'kicad_pcb') {
                return
            }

            let rootExpression
            try {
                rootExpression = SExpressionParser.parse(
                    decoder.decode(entry.buffer || new ArrayBuffer(0))
                )
            } catch (_error) {
                return
            }

            GitHubSourceLoader.#findExpressions(
                rootExpression,
                'footprint'
            ).forEach((footprint) => {
                modelReferences.push(
                    ...GitHubSourceLoader.#extractFootprintModelReferences(
                        footprint
                    )
                )
            })
        })

        return modelReferences
    }

    /**
     * Extracts model references from one KiCad footprint S-expression.
     * @param {any[]} footprint Footprint expression.
     * @returns {{ designator: string, modelName: string, modelPath: string, relativePath: string, modelTransform: { rotationDeg: { x: number, y: number, z: number }, offsetMil: { x: number, y: number, z: number }, dxMil: number, dyMil: number, dzMil: number, scale: { x: number, y: number, z: number } } }[]}
     */
    static #extractFootprintModelReferences(footprint) {
        const designator =
            GitHubSourceLoader.#extractFootprintDesignator(footprint)

        return GitHubSourceLoader.#getChildExpressions(footprint, 'model')
            .map((modelExpression) => {
                const modelPath = String(modelExpression?.[1] || '')
                const relativePath =
                    GitHubSourceLoader.#resolveProjectModelPath(modelPath)
                if (!relativePath) {
                    return null
                }

                return {
                    designator,
                    modelName: GitHubSourceLoader.#basename(relativePath),
                    modelPath,
                    relativePath,
                    modelTransform:
                        GitHubSourceLoader.#extractModelTransform(
                            modelExpression
                        )
                }
            })
            .filter(Boolean)
    }

    /**
     * Extracts the reference designator from one footprint expression.
     * @param {any[]} footprint Footprint expression.
     * @returns {string}
     */
    static #extractFootprintDesignator(footprint) {
        const referenceProperty = GitHubSourceLoader.#getChildExpressions(
            footprint,
            'property'
        ).find(
            (propertyExpression) =>
                String(propertyExpression?.[1] || '') === 'Reference'
        )

        if (referenceProperty) {
            return String(referenceProperty[2] || '')
        }

        const referenceText = GitHubSourceLoader.#getChildExpressions(
            footprint,
            'fp_text'
        ).find(
            (textExpression) =>
                String(textExpression?.[1] || '').toLowerCase() === 'reference'
        )

        return String(referenceText?.[2] || '')
    }

    /**
     * Extracts model offset and rotation metadata from one model expression.
     * @param {any[]} modelExpression Model expression.
     * @returns {{ rotationDeg: { x: number, y: number, z: number }, offsetMil: { x: number, y: number, z: number }, dxMil: number, dyMil: number, dzMil: number, scale: { x: number, y: number, z: number } }}
     */
    static #extractModelTransform(modelExpression) {
        const offset = GitHubSourceLoader.#readNestedXyz(
            modelExpression,
            'offset'
        )
        const rotate = GitHubSourceLoader.#readNestedXyz(
            modelExpression,
            'rotate'
        )
        const scale = GitHubSourceLoader.#readNestedXyz(
            modelExpression,
            'scale',
            1
        )
        const offsetMil = {
            x: offset.x * GitHubSourceLoader.#MILS_PER_MM,
            y: offset.y * GitHubSourceLoader.#MILS_PER_MM,
            z: offset.z * GitHubSourceLoader.#MILS_PER_MM
        }

        return {
            rotationDeg: {
                x: rotate.x,
                y: rotate.y,
                z: rotate.z
            },
            offsetMil,
            dxMil: offsetMil.x,
            dyMil: offsetMil.y,
            dzMil: offsetMil.z,
            scale
        }
    }

    /**
     * Reads an `(offset (xyz ...))` or `(rotate (xyz ...))` expression.
     * @param {any[]} expression Parent expression.
     * @param {string} childName Child expression name.
     * @param {number} [defaultValue] Default value for missing coordinates.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #readNestedXyz(expression, childName, defaultValue = 0) {
        const childExpression = GitHubSourceLoader.#getChildExpressions(
            expression,
            childName
        )[0]
        const xyzExpression = GitHubSourceLoader.#getChildExpressions(
            childExpression,
            'xyz'
        )[0]

        return {
            x: Number(xyzExpression?.[1] ?? defaultValue),
            y: Number(xyzExpression?.[2] ?? defaultValue),
            z: Number(xyzExpression?.[3] ?? defaultValue)
        }
    }

    /**
     * Resolves a KiCad model path to a safe project-relative asset path.
     * @param {string} modelPath Model path from the KiCad file.
     * @returns {string}
     */
    static #resolveProjectModelPath(modelPath) {
        const normalized = String(modelPath || '')
            .trim()
            .replaceAll('\\', '/')
        if (!normalized || /^https?:\/\//i.test(normalized)) {
            return ''
        }

        if (normalized.startsWith('/') || /^[a-z]:\//i.test(normalized)) {
            return ''
        }

        if (/^\$\{KIPRJMOD\}\//i.test(normalized)) {
            return GitHubSourceLoader.#normalizeRelativePath(
                normalized.replace(/^\$\{KIPRJMOD\}\//i, '')
            )
        }

        if (/^\$\{[^}]+\}/.test(normalized)) {
            return ''
        }

        return GitHubSourceLoader.#normalizeRelativePath(normalized)
    }

    /**
     * Normalizes a project-relative path without allowing parent traversal.
     * @param {string} relativePath Candidate relative path.
     * @returns {string}
     */
    static #normalizeRelativePath(relativePath) {
        const parts = String(relativePath || '')
            .replace(/^\.\/+/, '')
            .split('/')
            .filter(Boolean)

        if (!parts.length || parts.includes('..')) {
            return ''
        }

        const normalized = parts.join('/')
        return EcadFormatRegistry.resolveCompanionFormat(normalized)
            ? normalized
            : ''
    }

    /**
     * Recursively finds S-expressions with a matching head symbol.
     * @param {any} expression Expression tree.
     * @param {string} name Expression head.
     * @returns {any[][]}
     */
    static #findExpressions(expression, name) {
        if (!Array.isArray(expression)) {
            return []
        }

        const matches = GitHubSourceLoader.#isExpression(expression, name)
            ? [expression]
            : []
        expression.forEach((childExpression) => {
            matches.push(
                ...GitHubSourceLoader.#findExpressions(childExpression, name)
            )
        })

        return matches
    }

    /**
     * Returns direct child S-expressions with a matching head symbol.
     * @param {any[] | undefined} expression Parent expression.
     * @param {string} name Expression head.
     * @returns {any[][]}
     */
    static #getChildExpressions(expression, name) {
        return Array.isArray(expression)
            ? expression.filter((childExpression) =>
                  GitHubSourceLoader.#isExpression(childExpression, name)
              )
            : []
    }

    /**
     * Returns true when one value is an S-expression with the expected head.
     * @param {any} expression Candidate expression.
     * @param {string} name Expression head.
     * @returns {boolean}
     */
    static #isExpression(expression, name) {
        return (
            Array.isArray(expression) &&
            String(expression[0] || '').toLowerCase() === name.toLowerCase()
        )
    }

    /**
     * Resolves the raw GitHub directory URL for a source file.
     * @param {string} rawUrl Source raw URL.
     * @returns {string}
     */
    static #resolveRawDirectoryUrl(rawUrl) {
        const parsedUrl = new URL(rawUrl)
        parsedUrl.pathname = parsedUrl.pathname.replace(/\/[^/]*$/, '/')
        return parsedUrl.href
    }

    /**
     * Resolves one project-relative asset against a raw GitHub directory URL.
     * @param {string} directoryUrl Raw GitHub directory URL.
     * @param {string} relativePath Project-relative path.
     * @returns {string}
     */
    static #resolveRawAssetUrl(directoryUrl, relativePath) {
        const parsedUrl = new URL(directoryUrl)
        const directoryParts = parsedUrl.pathname.split('/').filter(Boolean)
        const assetParts = relativePath
            .split('/')
            .filter(Boolean)
            .map((part) => encodeURIComponent(decodeURIComponent(part)))

        parsedUrl.pathname = '/' + [...directoryParts, ...assetParts].join('/')
        return parsedUrl.href
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

    /**
     * Resolves the matching board URL for PCB Styler links when possible.
     * @param {{ rawUrl: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }} resolved Resolved URL.
     * @returns {string}
     */
    static #resolveBoardUrl(resolved) {
        const projectBoard = (resolved.projectFiles || []).find((file) => {
            return (
                EcadFormatRegistry.resolveNativeRole(file?.fileName)
                    ?.fileType === 'pcbdoc'
            )
        })
        if (projectBoard) {
            return projectBoard.rawUrl
        }

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
