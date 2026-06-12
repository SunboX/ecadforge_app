/**
 * Fetches component and model metadata from a configured model source.
 */
export class EcadModelSourceClient {
    #baseUrl

    #fallbackBaseUrl

    #componentPath

    #fetcher

    #headers

    #retryCount

    #retryDelayMs

    #requestTimeoutMs

    #searchPath

    /**
     * @param {{ fetcher: Function, baseUrl: string, fallbackBaseUrl?: string, searchPath?: string, componentPath?: string, modelPath?: string, retryCount?: number, retryDelayMs?: number, requestTimeoutMs?: number, headers?: Record<string, string> }} options Client options.
     */
    constructor(options = {}) {
        if (typeof options.fetcher !== 'function') {
            throw new TypeError('A model source fetcher is required')
        }

        this.#fetcher = options.fetcher
        this.#baseUrl = EcadModelSourceClient.#normalizeBaseUrl(options.baseUrl)
        this.#fallbackBaseUrl = options.fallbackBaseUrl
            ? EcadModelSourceClient.#normalizeBaseUrl(options.fallbackBaseUrl)
            : ''
        this.#searchPath = options.searchPath || 'search'
        this.#componentPath = options.componentPath || 'components/{id}'
        this.#retryCount = Math.max(1, Number(options.retryCount) || 1)
        this.#retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 0)
        this.#requestTimeoutMs = Math.max(
            0,
            Number(options.requestTimeoutMs) || 5000
        )
        this.#headers =
            options.headers && typeof options.headers === 'object'
                ? { ...options.headers }
                : {}
    }

    /**
     * Searches source components by term.
     * @param {string} query Search query.
     * @param {{ limit?: number }} [options] Search options.
     * @returns {Promise<object[]>}
     */
    async searchComponents(query, options = {}) {
        const url = this.#urlForPath(this.#searchPath)
        url.searchParams.set('q', String(query || '').trim())
        if (Number.isFinite(options.limit)) {
            url.searchParams.set('limit', String(options.limit))
        }

        const data = await this.#requestJsonWithFallback(url, 'search')
        return EcadModelSourceClient.#normalizeRows(data)
    }

    /**
     * Fetches one component bundle.
     * @param {string} id Component id.
     * @returns {Promise<object>}
     */
    async fetchComponentBundle(id) {
        const data = await this.#requestJsonWithFallback(
            this.#urlForPath(this.#componentPath, { id }),
            'components/' + encodeURIComponent(String(id || ''))
        )
        return EcadModelSourceClient.#normalizeBundle(data, id)
    }

    /**
     * Fetches a binary model asset.
     * @param {string} sourceUrl Source URL or source-relative path.
     * @returns {Promise<Uint8Array>}
     */
    async fetchBinaryAsset(sourceUrl) {
        const response = await this.#requestWithFallback(
            this.#urlForPath(sourceUrl),
            String(sourceUrl || '')
        )
        return new Uint8Array(await response.arrayBuffer())
    }

    /**
     * Requests JSON with optional PHP fallback.
     * @param {URL} url Primary URL.
     * @param {string} fallbackPath Fallback path.
     * @returns {Promise<any>}
     */
    async #requestJsonWithFallback(url, fallbackPath) {
        const response = await this.#requestWithFallback(url, fallbackPath, {
            headers: { accept: 'application/json' }
        })
        return response.json()
    }

    /**
     * Requests a source URL with optional PHP fallback.
     * @param {URL} url Primary URL.
     * @param {string} fallbackPath Fallback path.
     * @param {{ headers?: Record<string, string> }} [options] Request options.
     * @returns {Promise<Response>}
     */
    async #requestWithFallback(url, fallbackPath, options = {}) {
        try {
            return await this.#request(url, options)
        } catch (error) {
            if (!this.#fallbackBaseUrl) {
                throw error
            }

            const fallbackUrl = this.#fallbackUrlForPath(fallbackPath, url)
            return this.#request(fallbackUrl, options)
        }
    }

    /**
     * Requests JSON from a source URL.
     * @param {URL} url Request URL.
     * @returns {Promise<any>}
     */
    async #requestJson(url) {
        const response = await this.#request(url, {
            headers: { accept: 'application/json' }
        })
        return response.json()
    }

    /**
     * Requests a source URL with retry handling.
     * @param {URL} url Request URL.
     * @param {{ headers?: Record<string, string> }} [options] Request options.
     * @returns {Promise<Response>}
     */
    async #request(url, options = {}) {
        let lastError = null
        for (let attempt = 0; attempt < this.#retryCount; attempt += 1) {
            const timeout = EcadModelSourceClient.#createTimeoutSignal(
                this.#requestTimeoutMs
            )
            try {
                const response = await this.#fetcher(String(url), {
                    headers: {
                        ...this.#headers,
                        ...(options.headers || {})
                    },
                    signal: timeout.signal
                })

                if (!response?.ok) {
                    throw new Error(
                        `Model source request failed with status ${response?.status || 0}`
                    )
                }

                return response
            } catch (error) {
                lastError = error
                if (attempt + 1 < this.#retryCount) {
                    await EcadModelSourceClient.#delay(this.#retryDelayMs)
                }
            } finally {
                timeout.dispose()
            }
        }

        throw lastError
    }

    /**
     * Resolves a provider path to an absolute URL.
     * @param {string} pathTemplate Path template or URL.
     * @param {Record<string, string>} [values] Replacement values.
     * @returns {URL}
     */
    #urlForPath(pathTemplate, values = {}) {
        const resolvedPath = String(pathTemplate || '').replace(
            /\{([^}]+)\}/gu,
            (_match, key) => encodeURIComponent(String(values[key] || ''))
        )

        return new URL(resolvedPath, this.#baseUrl)
    }

    /**
     * Resolves one fallback PHP URL.
     * @param {string} path Fallback path.
     * @param {URL} sourceUrl Primary source URL.
     * @returns {URL}
     */
    #fallbackUrlForPath(path, sourceUrl) {
        const url = new URL(this.#fallbackBaseUrl)
        url.searchParams.set('path', String(path || '').replace(/^\/+/u, ''))
        for (const [key, value] of sourceUrl.searchParams) {
            url.searchParams.set(key, value)
        }
        return url
    }

    /**
     * Normalizes search result containers.
     * @param {any} data Raw provider response.
     * @returns {object[]}
     */
    static #normalizeRows(data) {
        const rows = Array.isArray(data)
            ? data
            : data?.results || data?.components || data?.items || []

        return rows
            .map((row) => ({
                ...row,
                id: String(row?.id || row?.componentId || row?.key || ''),
                name: String(row?.name || row?.displayName || row?.id || '')
            }))
            .filter((row) => row.id)
    }

    /**
     * Normalizes one component bundle.
     * @param {any} data Raw provider response.
     * @param {string} fallbackId Fallback component id.
     * @returns {object}
     */
    static #normalizeBundle(data, fallbackId) {
        const models = Array.isArray(data?.models) ? data.models : []

        return {
            ...data,
            id: String(data?.id || fallbackId || ''),
            name: String(data?.name || data?.displayName || fallbackId || ''),
            models: models.map((model) =>
                EcadModelSourceClient.#normalizeModel(model)
            )
        }
    }

    /**
     * Normalizes one model descriptor.
     * @param {any} model Raw model descriptor.
     * @returns {object}
     */
    static #normalizeModel(model) {
        const name = String(model?.name || model?.fileName || 'model.step')

        return {
            ...model,
            name,
            format:
                model?.format ||
                (name.toLowerCase().endsWith('.wrl') ? 'wrl' : 'step'),
            sourceUrl:
                model?.sourceUrl ||
                model?.downloadUrl ||
                model?.url ||
                model?.href ||
                ''
        }
    }

    /**
     * Normalizes the configured base URL.
     * @param {string} baseUrl Base URL.
     * @returns {string}
     */
    static #normalizeBaseUrl(baseUrl) {
        const value = String(baseUrl || '').trim()
        const resolved = new URL(
            value || '/',
            globalThis.location?.href || 'http://localhost/'
        ).href
        if (/\.php$/iu.test(new URL(resolved).pathname)) {
            return resolved
        }
        return resolved.endsWith('/') ? resolved : resolved + '/'
    }

    /**
     * Delays retry execution.
     * @param {number} delayMs Delay in milliseconds.
     * @returns {Promise<void>}
     */
    static #delay(delayMs) {
        return new Promise((resolve) => {
            setTimeout(resolve, delayMs)
        })
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
