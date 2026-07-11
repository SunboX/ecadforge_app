import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { GitHubAltiumProjectManifest } from './GitHubAltiumProjectManifest.mjs'
import { GitHubCompanionAssetLoader } from './GitHubCompanionAssetLoader.mjs'
import { GitSourceUrlResolver } from './GitSourceUrlResolver.mjs'
import { SExpressionParser } from 'kicad-toolkit/extensions'

/**
 * Loads supported ECAD files from hosted Git raw, blob, or tree URLs.
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
     * Loads one supported hosted Git URL into parser entries.
     * @param {string} sourceUrl Raw, blob, or tree URL.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[], assets: object[], modelReferences: object[] }>}
     */
    async loadUrl(sourceUrl) {
        const treeSource = GitSourceUrlResolver.normalizeTreeUrl(sourceUrl)
        const resolved = treeSource
            ? await this.#resolveTreeSource(treeSource)
            : GitSourceUrlResolver.normalizeSourceUrl(sourceUrl)

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
     * @param {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[], companionAssetFiles?: { rawUrl: string, fileName: string, relativePath: string, format: string }[] }} resolved Resolved source file.
     * @returns {Promise<{ sourceType: string, formatFamily: string, rawUrl: string, boardUrl: string, entries: { name: string, buffer: ArrayBuffer }[], assets: object[], modelReferences: object[] }>}
     */
    async #buildLoadResult(resolved) {
        const entries = await this.#loadEntries(resolved)
        const modelReferences =
            GitHubSourceLoader.#extractKicadModelReferences(entries)
        const assets = GitHubCompanionAssetLoader.mergeAssets([
            ...(await this.#loadReferencedModelAssets(
                resolved.rawUrl,
                modelReferences
            )),
            ...(await GitHubCompanionAssetLoader.loadAssetFiles(
                resolved.companionAssetFiles || [],
                (rawUrl) => this.#fetchArrayBuffer(rawUrl)
            ))
        ])

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
     * @returns {Promise<{ name: string, relativePath: string, data: Uint8Array, format: string, source: { uri: string, fileName: string } }[]>}
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
                const data = new Uint8Array(buffer)
                assets.push({
                    name:
                        String(relativePath)
                            .split('/')
                            .filter(Boolean)
                            .at(-1) || '',
                    relativePath,
                    data,
                    format,
                    source: {
                        uri: modelUrl,
                        fileName: relativePath
                    }
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
     * @param {{ provider: string, providerLabel: string, apiUrl: string }} treeSource Git host folder API source.
     * @returns {Promise<{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }>}
     */
    async #resolveTreeSource(treeSource) {
        if (treeSource.provider === 'github') {
            await this.#assertGitHubFolderDiscoveryAvailable()
        }

        const entries = await this.#fetchJson(
            treeSource.apiUrl,
            GitSourceUrlResolver.getProviderLabel(treeSource)
        )
        const altiumProject = await this.#resolveAltiumProject(
            treeSource,
            entries
        )
        if (altiumProject) {
            return altiumProject
        }

        return GitSourceUrlResolver.selectDirectorySource(entries, treeSource)
    }

    /**
     * Resolves an Altium `.PrjPcb` manifest from a hosted folder, if present.
     * @param {{ provider: string, providerLabel: string, apiUrl: string }} treeSource Git host folder API source.
     * @param {object[]} entries Git host folder API entries.
     * @returns {Promise<{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles: { rawUrl: string, fileName: string }[], companionAssetFiles: { rawUrl: string, fileName: string, relativePath: string, format: string }[] } | null>}
     */
    async #resolveAltiumProject(treeSource, entries) {
        const projectEntries = (entries || [])
            .map((entry) =>
                GitSourceUrlResolver.buildAltiumProjectCandidate(
                    entry,
                    treeSource
                )
            )
            .filter(Boolean)

        if (!projectEntries.length) {
            return null
        }

        if (projectEntries.length > 1) {
            throw new Error(
                'This ' +
                    GitSourceUrlResolver.getProviderLabel(treeSource) +
                    ' folder contains multiple Altium project files. Please paste the specific project file URL.'
            )
        }

        const projectEntry = projectEntries[0]
        const projectRawUrl = String(projectEntry.rawUrl)
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

        const companionAssetFiles =
            await GitHubCompanionAssetLoader.resolveAltiumProjectAssets(
                treeSource,
                (apiUrl) =>
                    this.#fetchJson(
                        apiUrl,
                        GitSourceUrlResolver.getProviderLabel(treeSource)
                    )
            )

        return {
            rawUrl: projectRawUrl,
            fileName: String(projectEntry.fileName || ''),
            formatFamily: 'altium',
            fileType: 'prjpcb',
            projectFiles,
            companionAssetFiles
        }
    }

    /**
     * Normalizes a raw, GitHub blob, or GitLab blob/raw URL.
     * @param {string} sourceUrl URL supplied by the user.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static normalizeSourceUrl(sourceUrl) {
        return GitSourceUrlResolver.normalizeSourceUrl(sourceUrl)
    }

    /**
     * Normalizes a query value in owner/repo/path form.
     * @param {string} githubPath Query path.
     * @param {string} [ref] Optional git ref.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static normalizeGitHubPath(githubPath, ref = 'main') {
        return GitSourceUrlResolver.normalizeGitHubPath(githubPath, ref)
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
     * @param {string} rawUrl Hosted Git raw URL.
     * @returns {Promise<ArrayBuffer>}
     */
    async #fetchArrayBuffer(rawUrl) {
        const providerLabel =
            GitHubSourceLoader.#resolveRawUrlProviderLabel(rawUrl)
        if (typeof this.#fetcher !== 'function') {
            throw new Error(
                providerLabel + ' URL loading is not available here.'
            )
        }

        let response
        try {
            response = await this.#fetcher(
                GitSourceUrlResolver.resolveFetchUrl(rawUrl)
            )
        } catch (_error) {
            throw new Error(
                'Could not fetch the ' +
                    providerLabel +
                    ' file. The request may be blocked by the network or browser CORS policy.'
            )
        }

        if (!response || !response.ok) {
            throw new Error(
                providerLabel +
                    ' returned HTTP ' +
                    String(response?.status || 0) +
                    ' for the requested ECAD file.'
            )
        }

        return response.arrayBuffer()
    }

    /**
     * Resolves the display label for one raw source URL.
     * @param {string} rawUrl Raw source URL.
     * @returns {string}
     */
    static #resolveRawUrlProviderLabel(rawUrl) {
        try {
            return new URL(rawUrl).hostname === 'gitlab.com'
                ? 'GitLab'
                : 'GitHub'
        } catch (_error) {
            return 'Git'
        }
    }

    /**
     * Fetches one Git host API URL and parses the JSON response.
     * @param {string} apiUrl Git host folder API URL.
     * @param {string} [providerLabel] Git host display label.
     * @returns {Promise<object[]>}
     */
    async #fetchJson(apiUrl, providerLabel = 'GitHub') {
        if (typeof this.#fetcher !== 'function') {
            throw new Error(
                providerLabel + ' URL loading is not available here.'
            )
        }

        let response
        try {
            response = await this.#fetcher(apiUrl)
        } catch (_error) {
            throw new Error(
                'Could not fetch the ' +
                    providerLabel +
                    ' folder. The request may be blocked by the network or browser CORS policy.'
            )
        }

        if (!response || !response.ok) {
            throw new Error(
                providerLabel +
                    ' returned HTTP ' +
                    String(response?.status || 0) +
                    ' for the requested ' +
                    providerLabel +
                    ' folder.'
            )
        }

        let payload
        try {
            payload = await response.json()
        } catch (_error) {
            throw new Error(
                'Could not read the ' + providerLabel + ' folder listing.'
            )
        }

        if (!Array.isArray(payload)) {
            throw new Error(
                'This ' + providerLabel + ' URL does not point to a folder.'
            )
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
     * Resolves the set of files required to parse one source.
     * @param {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }} resolved Resolved URL.
     * @returns {{ rawUrl: string, fileName: string }[]}
     */
    static #resolveProjectFiles(resolved) {
        if (
            Array.isArray(resolved.projectFiles) &&
            resolved.projectFiles.length
        ) {
            const sourceFiles = resolved.projectFiles
            return resolved.fileType === 'prjpcb'
                ? [
                      { rawUrl: resolved.rawUrl, fileName: resolved.fileName },
                      ...sourceFiles
                  ]
                : sourceFiles
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
                    modelName:
                        String(relativePath)
                            .split('/')
                            .filter(Boolean)
                            .at(-1) || '',
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
     * Resolves the matching board URL for PCB Styler links when possible.
     * @param {{ rawUrl: string, fileType: string, projectFiles?: { rawUrl: string, fileName: string }[] }} resolved Resolved URL.
     * @returns {string}
     */
    static #resolveBoardUrl(resolved) {
        const projectBoard = (resolved.projectFiles || []).find((file) => {
            const role = EcadFormatRegistry.resolveNativeRole(file?.fileName)
            return role?.fileType === 'pcbdoc'
        })
        if (projectBoard) {
            return projectBoard.rawUrl
        }

        if (resolved.fileType === 'kicad_pro') {
            return resolved.rawUrl.replace(/\.kicad_pro$/i, '.kicad_pcb')
        }

        return ['kicad_pcb', 'pcbdoc'].includes(resolved.fileType)
            ? resolved.rawUrl
            : ''
    }
}
