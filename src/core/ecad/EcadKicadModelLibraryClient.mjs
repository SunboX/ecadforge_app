const defaultLibraryBaseUrl =
    'https://raw.githubusercontent.com/KiCad/kicad-packages3D/master/'
const defaultPackageIndexBaseUrl =
    'https://api.github.com/repos/KiCad/kicad-packages3D/contents/'

/**
 * Fetches KiCad standard-library 3D models from known model path variables.
 */
export class EcadKicadModelLibraryClient {
    #baseUrl

    #fetcher

    #packageIndexBaseUrl

    #packageIndexCache

    #packageIndexRef

    #requestTimeoutMs

    /**
     * @param {{ fetcher?: Function, baseUrl?: string, packageIndexBaseUrl?: string, packageIndexRef?: string, requestTimeoutMs?: number }} [options] Client options.
     */
    constructor(options = {}) {
        this.#fetcher =
            options.fetcher ||
            (typeof fetch === 'function' ? fetch.bind(globalThis) : null)
        this.#baseUrl = EcadKicadModelLibraryClient.#normalizeBaseUrl(
            options.baseUrl || defaultLibraryBaseUrl
        )
        this.#packageIndexBaseUrl =
            EcadKicadModelLibraryClient.#normalizeBaseUrl(
                options.packageIndexBaseUrl || defaultPackageIndexBaseUrl
            )
        this.#packageIndexRef = String(options.packageIndexRef || 'master')
        this.#packageIndexCache = new Map()
        this.#requestTimeoutMs = Math.max(
            0,
            Number(options.requestTimeoutMs) || 5000
        )
    }

    /**
     * Fetches a model for a component with a KiCad library model path.
     * @param {object} component PCB component.
     * @returns {Promise<object | null>}
     */
    async fetchComponentModel(component) {
        const assetPath = EcadKicadModelLibraryClient.#resolveAssetPath(
            component?.modelPath
        )
        if (!assetPath || !this.#fetcher) {
            return null
        }

        const resolvedModel = await this.#fetchFirstAvailableModel(assetPath)
        if (!resolvedModel) {
            return null
        }

        const { candidatePath, bytes } = resolvedModel
        if (!bytes.byteLength) {
            return null
        }

        const name =
            candidatePath.split('/').filter(Boolean).at(-1) || 'model.step'
        return {
            name,
            format: EcadKicadModelLibraryClient.#formatForName(name),
            sourceUrl: String(new URL(candidatePath, this.#baseUrl)),
            relativePath: EcadKicadModelLibraryClient.#replaceModelPath(
                component?.modelPath,
                assetPath,
                candidatePath
            ),
            bytes
        }
    }

    /**
     * Fetches the first available representation for one KiCad model path.
     * @param {string} assetPath KiCad package asset path.
     * @returns {Promise<{ candidatePath: string, bytes: Uint8Array } | null>}
     */
    async #fetchFirstAvailableModel(assetPath) {
        const seenPaths = new Set()
        const exactModel = await this.#fetchFirstAvailableCandidatePath(
            EcadKicadModelLibraryClient.#candidateAssetPaths(assetPath),
            seenPaths
        )
        if (exactModel) {
            return exactModel
        }

        return this.#fetchFirstAvailableCandidatePath(
            await this.#indexedCandidateAssetPaths(assetPath),
            seenPaths
        )
    }

    /**
     * Fetches the first available candidate path.
     * @param {string[]} candidatePaths Candidate package asset paths.
     * @param {Set<string>} seenPaths Already attempted paths.
     * @returns {Promise<{ candidatePath: string, bytes: Uint8Array } | null>}
     */
    async #fetchFirstAvailableCandidatePath(candidatePaths, seenPaths) {
        for (const candidatePath of candidatePaths) {
            if (!candidatePath || seenPaths.has(candidatePath)) {
                continue
            }
            seenPaths.add(candidatePath)
            try {
                const response = await this.#request(
                    new URL(candidatePath, this.#baseUrl)
                )
                if (!response?.ok) {
                    continue
                }

                const bytes = new Uint8Array(await response.arrayBuffer())
                if (bytes.byteLength) {
                    return { candidatePath, bytes }
                }
            } catch (_error) {
                continue
            }
        }

        return null
    }

    /**
     * Resolves close same-folder candidates from the package index.
     * @param {string} assetPath Original package asset path.
     * @returns {Promise<string[]>}
     */
    async #indexedCandidateAssetPaths(assetPath) {
        const folderPath = EcadKicadModelLibraryClient.#folderPath(assetPath)
        const fileName = EcadKicadModelLibraryClient.#basename(assetPath)
        if (!folderPath || !fileName) {
            return []
        }

        const rows = await this.#fetchPackageIndex(folderPath)
        return rows
            .map((row) => String(row?.name || '').trim())
            .filter((name) => /\.(step|stp|wrl|vrml)$/iu.test(name))
            .map((name) => ({
                name,
                score: EcadKicadModelLibraryClient.#candidateScore(
                    fileName,
                    name
                )
            }))
            .filter((entry) => entry.score > 0)
            .sort(
                (left, right) =>
                    right.score - left.score ||
                    EcadKicadModelLibraryClient.#formatRank(left.name) -
                        EcadKicadModelLibraryClient.#formatRank(right.name) ||
                    left.name.localeCompare(right.name)
            )
            .map((entry) => folderPath + '/' + entry.name)
    }

    /**
     * Fetches and caches a KiCad package directory index.
     * @param {string} folderPath Package folder path.
     * @returns {Promise<object[]>}
     */
    async #fetchPackageIndex(folderPath) {
        if (!this.#packageIndexCache.has(folderPath)) {
            this.#packageIndexCache.set(
                folderPath,
                this.#fetchPackageIndexUncached(folderPath)
            )
        }

        return this.#packageIndexCache.get(folderPath)
    }

    /**
     * Fetches one uncached KiCad package directory index.
     * @param {string} folderPath Package folder path.
     * @returns {Promise<object[]>}
     */
    async #fetchPackageIndexUncached(folderPath) {
        try {
            const url = new URL(
                EcadKicadModelLibraryClient.#encodePath(folderPath),
                this.#packageIndexBaseUrl
            )
            if (this.#packageIndexRef) {
                url.searchParams.set('ref', this.#packageIndexRef)
            }
            const response = await this.#request(url)
            if (!response?.ok) {
                return []
            }
            const rows = await response.json()
            return Array.isArray(rows) ? rows : []
        } catch (_error) {
            return []
        }
    }

    /**
     * Fetches one remote model with a bounded request lifetime.
     * @param {URL} url Model URL.
     * @returns {Promise<Response>}
     */
    async #request(url) {
        const timeout = EcadKicadModelLibraryClient.#createTimeoutSignal(
            this.#requestTimeoutMs
        )
        try {
            return await this.#fetcher(String(url), {
                cache: 'force-cache',
                signal: timeout.signal
            })
        } finally {
            timeout.dispose()
        }
    }

    /**
     * Resolves supported KiCad model-library variables to a package path.
     * @param {unknown} value Raw model path.
     * @returns {string}
     */
    static #resolveAssetPath(value) {
        const normalized = String(value || '')
            .replaceAll('\\', '/')
            .trim()
        const match = normalized.match(
            /^\$\{(?:KICAD\d+_3DMODEL_DIR|KISYS3DMOD)\}\/(.+)$/u
        )
        if (!match) {
            return ''
        }

        return match[1]
            .split('/')
            .filter((part) => part && part !== '.' && part !== '..')
            .join('/')
    }

    /**
     * Resolves a supported model format from one file name.
     * @param {string} fileName File name.
     * @returns {string}
     */
    static #formatForName(fileName) {
        return String(fileName || '')
            .toLowerCase()
            .endsWith('.wrl')
            ? 'wrl'
            : 'step'
    }

    /**
     * Returns preferred KiCad package model asset paths.
     * @param {string} assetPath Original asset path.
     * @returns {string[]}
     */
    static #candidateAssetPaths(assetPath) {
        const normalized = String(assetPath || '').trim()
        if (/\.(wrl|vrml)$/iu.test(normalized)) {
            return [normalized.replace(/\.(wrl|vrml)$/iu, '.step'), normalized]
        }
        return [normalized]
    }

    /**
     * Scores one indexed candidate against the missing model file.
     * @param {string} targetName Missing file name.
     * @param {string} candidateName Indexed file name.
     * @returns {number}
     */
    static #candidateScore(targetName, candidateName) {
        const targetStem =
            EcadKicadModelLibraryClient.#basenameWithoutExtension(targetName)
        const candidateStem =
            EcadKicadModelLibraryClient.#basenameWithoutExtension(candidateName)
        if (!targetStem || !candidateStem) {
            return 0
        }

        if (
            EcadKicadModelLibraryClient.#numericSignature(targetStem) !==
            EcadKicadModelLibraryClient.#numericSignature(candidateStem)
        ) {
            return 0
        }

        const distance = EcadKicadModelLibraryClient.#numberDistance(
            targetStem,
            candidateStem
        )
        const threshold =
            EcadKicadModelLibraryClient.#numberDistanceThreshold(targetStem)
        if (distance > threshold) {
            return 0
        }

        return (
            10000 -
            distance * 100 -
            EcadKicadModelLibraryClient.#formatRank(candidateName)
        )
    }

    /**
     * Resolves a numeric-insensitive file signature.
     * @param {string} value File stem.
     * @returns {string}
     */
    static #numericSignature(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/\d+(?:\.\d+)?/gu, '#')
    }

    /**
     * Computes numeric distance between two model names.
     * @param {string} targetStem Target file stem.
     * @param {string} candidateStem Candidate file stem.
     * @returns {number}
     */
    static #numberDistance(targetStem, candidateStem) {
        const targetNumbers = EcadKicadModelLibraryClient.#numbers(targetStem)
        const candidateNumbers =
            EcadKicadModelLibraryClient.#numbers(candidateStem)
        if (targetNumbers.length !== candidateNumbers.length) {
            return Number.POSITIVE_INFINITY
        }

        return targetNumbers.reduce(
            (sum, value, index) =>
                sum + Math.abs(value - candidateNumbers[index]),
            0
        )
    }

    /**
     * Resolves a conservative numeric match threshold.
     * @param {string} targetStem Target file stem.
     * @returns {number}
     */
    static #numberDistanceThreshold(targetStem) {
        return Math.max(
            0.25,
            EcadKicadModelLibraryClient.#numbers(targetStem).length * 0.15
        )
    }

    /**
     * Extracts decimal numbers from a model name.
     * @param {string} value Model name.
     * @returns {number[]}
     */
    static #numbers(value) {
        return Array.from(String(value || '').matchAll(/\d+(?:\.\d+)?/gu)).map(
            (match) => Number(match[0])
        )
    }

    /**
     * Ranks candidate formats for rendering.
     * @param {string} fileName File name.
     * @returns {number}
     */
    static #formatRank(fileName) {
        return /\.(step|stp)$/iu.test(String(fileName || '')) ? 0 : 1
    }

    /**
     * Resolves the folder portion of an asset path.
     * @param {string} assetPath Asset path.
     * @returns {string}
     */
    static #folderPath(assetPath) {
        return String(assetPath || '')
            .split('/')
            .slice(0, -1)
            .join('/')
    }

    /**
     * Resolves the basename of an asset path.
     * @param {string} assetPath Asset path.
     * @returns {string}
     */
    static #basename(assetPath) {
        return (
            String(assetPath || '')
                .split('/')
                .filter(Boolean)
                .at(-1) || ''
        )
    }

    /**
     * Resolves a basename without extension.
     * @param {string} fileName File name.
     * @returns {string}
     */
    static #basenameWithoutExtension(fileName) {
        return String(fileName || '').replace(/\.(step|stp|wrl|vrml)$/iu, '')
    }

    /**
     * Encodes a slash-separated path for URL composition.
     * @param {string} path Path.
     * @returns {string}
     */
    static #encodePath(path) {
        return String(path || '')
            .split('/')
            .filter(Boolean)
            .map((part) => encodeURIComponent(part))
            .join('/')
    }

    /**
     * Replaces the resolved package suffix in the original model path.
     * @param {unknown} originalPath Component model path.
     * @param {string} assetPath Original package asset path.
     * @param {string} candidatePath Downloaded package asset path.
     * @returns {string}
     */
    static #replaceModelPath(originalPath, assetPath, candidatePath) {
        const original = String(originalPath || '').trim()
        if (!original || assetPath === candidatePath) {
            return original
        }

        return original.endsWith(assetPath)
            ? original.slice(0, -assetPath.length) + candidatePath
            : candidatePath
    }

    /**
     * Normalizes a base URL.
     * @param {string} baseUrl Base URL.
     * @returns {string}
     */
    static #normalizeBaseUrl(baseUrl) {
        const value = String(baseUrl || '').trim()
        return value.endsWith('/') ? value : value + '/'
    }

    /**
     * Creates a disposable abort signal for a request timeout.
     * @param {number} timeoutMs Timeout in milliseconds.
     * @returns {{ signal?: AbortSignal, dispose: () => void }}
     */
    static #createTimeoutSignal(timeoutMs) {
        if (typeof AbortController !== 'function' || timeoutMs <= 0) {
            return { signal: undefined, dispose: () => {} }
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
        return {
            signal: controller.signal,
            dispose: () => clearTimeout(timeoutId)
        }
    }
}
