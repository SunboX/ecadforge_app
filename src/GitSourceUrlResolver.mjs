import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'

/**
 * Resolves browser Git hosting URLs into raw ECAD source descriptors.
 */
export class GitSourceUrlResolver {
    /**
     * Normalizes a raw, GitHub blob, or GitLab blob/raw URL.
     * @param {string} sourceUrl URL supplied by the user.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static normalizeSourceUrl(sourceUrl) {
        const parsedUrl = GitSourceUrlResolver.#parseHttpsUrl(sourceUrl)

        if (parsedUrl.hostname === 'raw.githubusercontent.com') {
            return GitSourceUrlResolver.#buildResolvedUrl(parsedUrl.href)
        }

        if (parsedUrl.hostname === 'github.com') {
            return GitSourceUrlResolver.#normalizeGitHubSourceUrl(parsedUrl)
        }

        if (parsedUrl.hostname === 'gitlab.com') {
            return GitSourceUrlResolver.#normalizeGitLabSourceUrl(parsedUrl)
        }

        throw new Error(
            'Only GitHub or GitLab blob/tree URLs, raw.githubusercontent.com URLs, or GitLab raw URLs are supported.'
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
            .map((part) => GitSourceUrlResolver.#encodePathPart(part))
            .join('/')

        return GitSourceUrlResolver.#buildResolvedUrl(
            'https://raw.githubusercontent.com/' + rawPath
        )
    }

    /**
     * Normalizes a GitHub or GitLab tree URL to a folder API source.
     * @param {string} sourceUrl URL supplied by the user.
     * @returns {{ provider: string, providerLabel: string, apiUrl: string, projectPath?: string, ref?: string, directoryPath?: string } | null}
     */
    static normalizeTreeUrl(sourceUrl) {
        const parsedUrl = GitSourceUrlResolver.#parseHttpsUrl(sourceUrl)

        if (parsedUrl.hostname === 'github.com') {
            return GitSourceUrlResolver.#normalizeGitHubTreeUrl(parsedUrl)
        }

        if (parsedUrl.hostname === 'gitlab.com') {
            return GitSourceUrlResolver.#normalizeGitLabTreeUrl(parsedUrl)
        }

        return null
    }

    /**
     * Selects the one supported ECAD source to load from a hosted folder.
     * @param {object[]} entries Git host folder API entries.
     * @param {{ provider: string, providerLabel: string, projectPath?: string, ref?: string }} treeSource Folder source.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static selectDirectorySource(entries, treeSource) {
        const candidates = entries
            .map((entry) =>
                GitSourceUrlResolver.buildDirectoryCandidate(entry, treeSource)
            )
            .filter(Boolean)
            .sort((left, right) => {
                const priority =
                    GitSourceUrlResolver.#getDirectorySourcePriority(left) -
                    GitSourceUrlResolver.#getDirectorySourcePriority(right)

                if (priority !== 0) return priority
                return left.fileName.localeCompare(right.fileName)
            })

        if (!candidates.length) {
            throw new Error(
                'This ' +
                    GitSourceUrlResolver.getProviderLabel(treeSource) +
                    ' folder does not contain a supported ECAD file.'
            )
        }

        const bestPriority = GitSourceUrlResolver.#getDirectorySourcePriority(
            candidates[0]
        )
        const preferredCandidates = candidates.filter(
            (candidate) =>
                GitSourceUrlResolver.#getDirectorySourcePriority(candidate) ===
                bestPriority
        )

        if (preferredCandidates.length > 1) {
            throw new Error(
                'This ' +
                    GitSourceUrlResolver.getProviderLabel(treeSource) +
                    ' folder contains multiple supported ECAD files. Please paste the specific project file URL.'
            )
        }

        return candidates[0]
    }

    /**
     * Builds a supported source candidate from one folder API entry.
     * @param {object} entry Git host folder API entry.
     * @param {{ provider: string, projectPath?: string, ref?: string }} treeSource Folder source.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string } | null}
     */
    static buildDirectoryCandidate(entry, treeSource) {
        if (treeSource?.provider === 'gitlab') {
            return GitSourceUrlResolver.#buildGitLabDirectoryCandidate(
                entry,
                treeSource
            )
        }

        return GitSourceUrlResolver.#buildGitHubDirectoryCandidate(entry)
    }

    /**
     * Builds an Altium project manifest candidate from one folder API entry.
     * @param {object} entry Git host folder API entry.
     * @param {{ provider: string, projectPath?: string, ref?: string }} treeSource Folder source.
     * @returns {{ rawUrl: string, fileName: string } | null}
     */
    static buildAltiumProjectCandidate(entry, treeSource) {
        if (treeSource?.provider === 'gitlab') {
            return GitSourceUrlResolver.#buildGitLabAltiumProjectCandidate(
                entry,
                treeSource
            )
        }

        return GitSourceUrlResolver.#buildGitHubAltiumProjectCandidate(entry)
    }

    /**
     * Builds an API URL for a project-relative child folder.
     * @param {{ provider?: string, apiUrl?: string, projectPath?: string, ref?: string, directoryPath?: string } | string} directorySource Parent directory source.
     * @param {string} relativePath Child folder path.
     * @returns {string}
     */
    static buildChildDirectoryApiUrl(directorySource, relativePath) {
        if (typeof directorySource === 'string') {
            return GitSourceUrlResolver.#buildGitHubChildContentsApiUrl(
                directorySource,
                relativePath
            )
        }

        if (directorySource?.provider === 'gitlab') {
            return GitSourceUrlResolver.#buildGitLabTreeApiUrl(
                String(directorySource.projectPath || ''),
                String(directorySource.ref || 'main'),
                GitSourceUrlResolver.#joinRelativePaths(
                    directorySource.directoryPath,
                    relativePath
                )
            )
        }

        return GitSourceUrlResolver.#buildGitHubChildContentsApiUrl(
            String(directorySource?.apiUrl || ''),
            relativePath
        )
    }

    /**
     * Resolves the CORS-safe fetch URL for one hosted raw source URL.
     * @param {string} rawUrl Raw source URL.
     * @returns {string}
     */
    static resolveFetchUrl(rawUrl) {
        let parsedUrl
        try {
            parsedUrl = GitSourceUrlResolver.#parseHttpsUrl(rawUrl)
        } catch (_error) {
            return rawUrl
        }

        if (parsedUrl.hostname !== 'gitlab.com') {
            return rawUrl
        }

        const normalized = GitSourceUrlResolver.#parseGitLabWorktreeUrl(
            parsedUrl,
            ['raw']
        )
        if (!normalized) {
            return rawUrl
        }

        return GitSourceUrlResolver.#buildGitLabApiRawUrl(
            normalized.projectPath,
            normalized.ref,
            normalized.path
        )
    }

    /**
     * Returns the display label for one Git host source.
     * @param {{ providerLabel?: string, provider?: string } | null} source Source descriptor.
     * @returns {string}
     */
    static getProviderLabel(source) {
        if (source?.providerLabel) {
            return String(source.providerLabel)
        }

        return source?.provider === 'gitlab' ? 'GitLab' : 'GitHub'
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
            throw new Error('Please enter a valid GitHub or GitLab URL.')
        }

        if (parsedUrl.protocol !== 'https:') {
            throw new Error('Git URL loading requires an HTTPS URL.')
        }

        return parsedUrl
    }

    /**
     * Normalizes a github.com/blob URL.
     * @param {URL} parsedUrl Parsed GitHub URL.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static #normalizeGitHubSourceUrl(parsedUrl) {
        const parts = parsedUrl.pathname.split('/').filter(Boolean)
        if (parts.length < 5 || parts[2] !== 'blob') {
            throw new Error(
                'Only GitHub blob/tree URLs or raw.githubusercontent.com URLs are supported.'
            )
        }

        const rawPath = parts
            .slice(0, 2)
            .concat(parts.slice(3))
            .map((part) => GitSourceUrlResolver.#encodePathPart(part))
            .join('/')

        return GitSourceUrlResolver.#buildResolvedUrl(
            'https://raw.githubusercontent.com/' + rawPath
        )
    }

    /**
     * Normalizes a gitlab.com blob or raw URL.
     * @param {URL} parsedUrl Parsed GitLab URL.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string }}
     */
    static #normalizeGitLabSourceUrl(parsedUrl) {
        const normalized = GitSourceUrlResolver.#parseGitLabWorktreeUrl(
            parsedUrl,
            ['blob', 'raw']
        )
        if (!normalized) {
            throw new Error(
                'Only GitLab blob/raw file URLs or tree folder URLs are supported.'
            )
        }

        return GitSourceUrlResolver.#buildResolvedUrl(
            GitSourceUrlResolver.#buildGitLabRawUrl(
                normalized.projectPath,
                normalized.ref,
                normalized.path
            )
        )
    }

    /**
     * Normalizes a GitHub tree URL to a Contents API URL.
     * @param {URL} parsedUrl Parsed GitHub URL.
     * @returns {{ provider: string, providerLabel: string, apiUrl: string } | null}
     */
    static #normalizeGitHubTreeUrl(parsedUrl) {
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
            provider: 'github',
            providerLabel: 'GitHub',
            apiUrl: GitSourceUrlResolver.#buildGitHubContentsApiUrl(
                parts[0],
                parts[1],
                parts[3],
                parts.slice(4)
            )
        }
    }

    /**
     * Normalizes a GitLab tree URL to a Repository Tree API URL.
     * @param {URL} parsedUrl Parsed GitLab URL.
     * @returns {{ provider: string, providerLabel: string, apiUrl: string, projectPath: string, ref: string, directoryPath: string } | null}
     */
    static #normalizeGitLabTreeUrl(parsedUrl) {
        const normalized = GitSourceUrlResolver.#parseGitLabWorktreeUrl(
            parsedUrl,
            ['tree']
        )
        if (!normalized) {
            return null
        }

        return {
            provider: 'gitlab',
            providerLabel: 'GitLab',
            apiUrl: GitSourceUrlResolver.#buildGitLabTreeApiUrl(
                normalized.projectPath,
                normalized.ref,
                normalized.path
            ),
            projectPath: normalized.projectPath,
            ref: normalized.ref,
            directoryPath: normalized.path
        }
    }

    /**
     * Parses GitLab `/-/{blob,raw,tree}/ref/path` URLs.
     * @param {URL} parsedUrl Parsed GitLab URL.
     * @param {string[]} allowedActions Supported worktree actions.
     * @returns {{ projectPath: string, ref: string, path: string } | null}
     */
    static #parseGitLabWorktreeUrl(parsedUrl, allowedActions) {
        const parts = parsedUrl.pathname.split('/').filter(Boolean)
        const separatorIndex = parts.indexOf('-')
        if (separatorIndex < 1 || parts.length < separatorIndex + 4) {
            return null
        }

        const action = parts[separatorIndex + 1]
        if (!allowedActions.includes(action)) {
            return null
        }

        const projectPath = parts
            .slice(0, separatorIndex)
            .map((part) => decodeURIComponent(part))
            .join('/')
        const ref = decodeURIComponent(parts[separatorIndex + 2] || '')
        const path = parts
            .slice(separatorIndex + 3)
            .map((part) => decodeURIComponent(part))
            .join('/')

        return projectPath && ref && path ? { projectPath, ref, path } : null
    }

    /**
     * Builds a GitHub Contents API URL for one repository path.
     * @param {string} owner Repository owner.
     * @param {string} repo Repository name.
     * @param {string} ref Git ref.
     * @param {string[]} pathParts Directory path parts.
     * @returns {string}
     */
    static #buildGitHubContentsApiUrl(owner, repo, ref, pathParts) {
        const encodedPath = pathParts
            .map((part) => GitSourceUrlResolver.#encodePathPart(part))
            .join('/')
        const baseUrl =
            'https://api.github.com/repos/' +
            GitSourceUrlResolver.#encodePathPart(owner) +
            '/' +
            GitSourceUrlResolver.#encodePathPart(repo) +
            '/contents'
        const contentsUrl = encodedPath ? baseUrl + '/' + encodedPath : baseUrl

        return (
            contentsUrl +
            '?ref=' +
            GitSourceUrlResolver.#encodePathPart(ref || 'main')
        )
    }

    /**
     * Builds a GitLab Repository Tree API URL.
     * @param {string} projectPath GitLab project path.
     * @param {string} ref Git ref.
     * @param {string} directoryPath Project-relative directory path.
     * @returns {string}
     */
    static #buildGitLabTreeApiUrl(projectPath, ref, directoryPath) {
        const parsedUrl = new URL(
            'https://gitlab.com/api/v4/projects/' +
                encodeURIComponent(projectPath) +
                '/repository/tree'
        )
        const path = GitSourceUrlResolver.#normalizeRelativePath(directoryPath)

        if (path) {
            parsedUrl.searchParams.set('path', path)
        }
        parsedUrl.searchParams.set('ref', String(ref || 'main'))
        parsedUrl.searchParams.set('per_page', '100')

        return parsedUrl.href
    }

    /**
     * Builds a CORS-enabled GitLab Repository Files raw API URL.
     * @param {string} projectPath GitLab project path.
     * @param {string} ref Git ref.
     * @param {string} filePath Project-relative file path.
     * @returns {string}
     */
    static #buildGitLabApiRawUrl(projectPath, ref, filePath) {
        const parsedUrl = new URL(
            'https://gitlab.com/api/v4/projects/' +
                encodeURIComponent(projectPath) +
                '/repository/files/' +
                encodeURIComponent(filePath) +
                '/raw'
        )

        parsedUrl.searchParams.set('ref', String(ref || 'main'))
        return parsedUrl.href
    }

    /**
     * Builds metadata for one raw URL.
     * @param {string} rawUrl Raw Git source URL.
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
                'This Git source file type is not supported yet. ECAD Forge supports selected Altium, KiCad, Gerber, and CircuitJSON design files.'
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
     * Builds a supported source candidate from one GitHub Contents API entry.
     * @param {object} entry GitHub Contents API entry.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string } | null}
     */
    static #buildGitHubDirectoryCandidate(entry) {
        if (!entry || entry.type !== 'file' || !entry.download_url) {
            return null
        }

        return GitSourceUrlResolver.#buildDirectoryCandidateFromFile(
            String(entry.name || ''),
            String(entry.download_url)
        )
    }

    /**
     * Builds an Altium manifest candidate from one GitHub Contents API entry.
     * @param {object} entry GitHub Contents API entry.
     * @returns {{ rawUrl: string, fileName: string } | null}
     */
    static #buildGitHubAltiumProjectCandidate(entry) {
        if (!entry || entry.type !== 'file' || !entry.download_url) {
            return null
        }

        return GitSourceUrlResolver.#buildAltiumProjectCandidateFromFile(
            String(entry.name || ''),
            String(entry.download_url)
        )
    }

    /**
     * Builds a supported source candidate from one GitLab tree API entry.
     * @param {object} entry GitLab Repository Tree API entry.
     * @param {{ projectPath?: string, ref?: string }} treeSource Folder source.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string } | null}
     */
    static #buildGitLabDirectoryCandidate(entry, treeSource) {
        if (!entry || entry.type !== 'blob' || !entry.path) {
            return null
        }

        return GitSourceUrlResolver.#buildDirectoryCandidateFromFile(
            String(entry.name || ''),
            GitSourceUrlResolver.#buildGitLabRawUrl(
                String(treeSource.projectPath || ''),
                String(treeSource.ref || 'main'),
                String(entry.path || '')
            )
        )
    }

    /**
     * Builds an Altium manifest candidate from one GitLab tree API entry.
     * @param {object} entry GitLab Repository Tree API entry.
     * @param {{ projectPath?: string, ref?: string }} treeSource Folder source.
     * @returns {{ rawUrl: string, fileName: string } | null}
     */
    static #buildGitLabAltiumProjectCandidate(entry, treeSource) {
        if (!entry || entry.type !== 'blob' || !entry.path) {
            return null
        }

        return GitSourceUrlResolver.#buildAltiumProjectCandidateFromFile(
            String(entry.name || ''),
            GitSourceUrlResolver.#buildGitLabRawUrl(
                String(treeSource.projectPath || ''),
                String(treeSource.ref || 'main'),
                String(entry.path || '')
            )
        )
    }

    /**
     * Builds a directory source candidate from a filename and raw URL.
     * @param {string} fileName Candidate filename.
     * @param {string} rawUrl Raw file URL.
     * @returns {{ rawUrl: string, fileName: string, formatFamily: string, fileType: string } | null}
     */
    static #buildDirectoryCandidateFromFile(fileName, rawUrl) {
        const role = EcadFormatRegistry.resolveNativeRole(fileName)
        if (!role) return null

        return {
            rawUrl,
            fileName,
            formatFamily: role.sourceFormat,
            fileType: role.fileType
        }
    }

    /**
     * Builds an Altium manifest candidate from a filename and raw URL.
     * @param {string} fileName Candidate filename.
     * @param {string} rawUrl Raw file URL.
     * @returns {{ rawUrl: string, fileName: string } | null}
     */
    static #buildAltiumProjectCandidateFromFile(fileName, rawUrl) {
        if (
            EcadFormatRegistry.resolveCompanionFormat(fileName) !==
            'altium-project'
        ) {
            return null
        }

        return { rawUrl, fileName }
    }

    /**
     * Builds a GitLab raw file URL.
     * @param {string} projectPath GitLab project path.
     * @param {string} ref Git ref.
     * @param {string} filePath Project-relative file path.
     * @returns {string}
     */
    static #buildGitLabRawUrl(projectPath, ref, filePath) {
        return (
            'https://gitlab.com/' +
            GitSourceUrlResolver.#encodePath(projectPath) +
            '/-/raw/' +
            GitSourceUrlResolver.#encodePathPart(ref || 'main') +
            '/' +
            GitSourceUrlResolver.#encodePath(filePath)
        )
    }

    /**
     * Builds a child GitHub Contents API URL below an existing folder URL.
     * @param {string} contentsApiUrl Parent Contents API URL.
     * @param {string} relativePath Child folder path.
     * @returns {string}
     */
    static #buildGitHubChildContentsApiUrl(contentsApiUrl, relativePath) {
        const parsedUrl = new URL(contentsApiUrl)
        const childParts = String(relativePath || '')
            .split('/')
            .filter(Boolean)
            .map((part) => GitSourceUrlResolver.#encodePathPart(part))

        parsedUrl.pathname =
            parsedUrl.pathname.replace(/\/+$/u, '') + '/' + childParts.join('/')
        return parsedUrl.href
    }

    /**
     * Returns source discovery priority for hosted folders.
     * @param {{ fileType: string }} source Candidate source.
     * @returns {number}
     */
    static #getDirectorySourcePriority(source) {
        const priorities = {
            kicad_pro: 0,
            kicad_pcb: 1,
            kicad_sch: 2,
            pcbdoc: 3,
            schdoc: 4,
            circuitjson: 5
        }

        return priorities[source.fileType] ?? 99
    }

    /**
     * Joins two project-relative paths.
     * @param {string | undefined} basePath Base path.
     * @param {string} childPath Child path.
     * @returns {string}
     */
    static #joinRelativePaths(basePath, childPath) {
        return [basePath, childPath]
            .map((part) =>
                String(part || '')
                    .trim()
                    .replaceAll('\\', '/')
            )
            .filter(Boolean)
            .join('/')
    }

    /**
     * Normalizes a project-relative path for API query usage.
     * @param {string} path Candidate path.
     * @returns {string}
     */
    static #normalizeRelativePath(path) {
        return String(path || '')
            .replaceAll('\\', '/')
            .split('/')
            .filter(Boolean)
            .join('/')
    }

    /**
     * Encodes a slash-delimited path.
     * @param {string} path Slash-delimited path.
     * @returns {string}
     */
    static #encodePath(path) {
        return String(path || '')
            .split('/')
            .filter(Boolean)
            .map((part) => GitSourceUrlResolver.#encodePathPart(part))
            .join('/')
    }

    /**
     * Encodes one path segment while accepting already-encoded input.
     * @param {string} part Path segment.
     * @returns {string}
     */
    static #encodePathPart(part) {
        return encodeURIComponent(decodeURIComponent(String(part || '')))
    }
}
