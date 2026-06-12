const defaultSearchApi = 'https://pro.lceda.cn/api/szlcsc/eda/product/list'
const defaultComponentApi = 'https://pro.lceda.cn/api/components/'
const defaultStepApi = 'https://modules.lceda.cn/qAxj6KHrDKw4blvCG8QJPs7Y/'

/**
 * Fetches source component search results and STEP assets from the LCEDA-style
 * component source used by LCSC/EasyEDA.
 */
export class EcadEasyEdaModelSourceClient {
    #componentApi

    #fetcher

    #retryCount

    #retryDelayMs

    #requestTimeoutMs

    #searchApi

    #stepApi

    /**
     * @param {{ fetcher?: Function, searchApi?: string, componentApi?: string, stepApi?: string, retryCount?: number, retryDelayMs?: number, requestTimeoutMs?: number }} [options] Client options.
     */
    constructor(options = {}) {
        this.#fetcher =
            options.fetcher ||
            (typeof fetch === 'function' ? fetch.bind(globalThis) : null)
        this.#searchApi = options.searchApi || defaultSearchApi
        this.#componentApi = EcadEasyEdaModelSourceClient.#normalizeBaseUrl(
            options.componentApi || defaultComponentApi
        )
        this.#stepApi = EcadEasyEdaModelSourceClient.#normalizeBaseUrl(
            options.stepApi || defaultStepApi
        )
        this.#retryCount = Math.max(1, Number(options.retryCount) || 3)
        this.#retryDelayMs = Math.max(0, Number(options.retryDelayMs) || 250)
        this.#requestTimeoutMs = Math.max(
            0,
            Number(options.requestTimeoutMs) || 5000
        )
    }

    /**
     * Searches source components by keyword.
     * @param {string} query Search query.
     * @param {{ limit?: number }} [options] Search options.
     * @returns {Promise<object[]>}
     */
    async searchComponents(query, options = {}) {
        const normalizedQuery = String(query || '').trim()
        if (!normalizedQuery || !this.#fetcher) {
            return []
        }

        const url = new URL(this.#searchApi)
        url.searchParams.set('wd', normalizedQuery)
        const payload = await this.#requestJson(url)
        const rows = Array.isArray(payload?.result) ? payload.result : []
        const normalizedRows =
            EcadEasyEdaModelSourceClient.#preferExactSupplierPart(
                normalizedQuery,
                rows
                    .map((row, index) =>
                        EcadEasyEdaModelSourceClient.#normalizeSearchRow(
                            row,
                            index
                        )
                    )
                    .filter((row) => row.id)
            )

        const limit = Math.max(0, Number(options.limit) || 0)
        return limit ? normalizedRows.slice(0, limit) : normalizedRows
    }

    /**
     * Fetches one source component bundle.
     * @param {string} id Component or model seed id.
     * @returns {Promise<object>}
     */
    async fetchComponentBundle(id) {
        const sourceId = String(id || '').trim()
        if (!sourceId) {
            return { id: '', models: [] }
        }

        const detail = await this.#fetchComponentDetail(sourceId)
        const resolvedModelId =
            EcadEasyEdaModelSourceClient.#nestedString(detail, [
                'result',
                '3d_model_uuid'
            ]) || sourceId

        return {
            id: sourceId,
            models: [
                {
                    name: resolvedModelId + '.step',
                    format: 'step',
                    sourceUrl: 'models/' + resolvedModelId + '.step'
                }
            ]
        }
    }

    /**
     * Fetches a model asset.
     * @param {string} sourceUrl Source URL.
     * @returns {Promise<Uint8Array>}
     */
    async fetchBinaryAsset(sourceUrl) {
        const url = EcadEasyEdaModelSourceClient.#resolveAssetUrl(
            sourceUrl,
            this.#stepApi
        )
        const response = await this.#request(url)
        return new Uint8Array(await response.arrayBuffer())
    }

    /**
     * Resolves a complete component model by searching and downloading STEP.
     * @param {object} _component PCB component.
     * @param {{ term?: string }} [options] Lookup options.
     * @returns {Promise<object | null>}
     */
    async fetchComponentModel(_component, options = {}) {
        const rows = await this.searchComponents(options.term || '', {
            limit: 1
        })
        const firstId = String(rows?.[0]?.id || '')
        if (!firstId) {
            return null
        }

        const bundle = await this.fetchComponentBundle(firstId)
        const model = Array.isArray(bundle?.models) ? bundle.models[0] : null
        if (!model) {
            return null
        }

        const bytes = await this.fetchBinaryAsset(model.sourceUrl)
        return bytes.byteLength
            ? {
                  ...model,
                  bytes
              }
            : null
    }

    /**
     * Fetches detail JSON for one source id.
     * @param {string} id Component id.
     * @returns {Promise<object>}
     */
    async #fetchComponentDetail(id) {
        const url = new URL(encodeURIComponent(id), this.#componentApi)
        url.searchParams.set('uuid', id)
        return this.#requestJson(url)
    }

    /**
     * Requests JSON.
     * @param {URL} url Request URL.
     * @returns {Promise<any>}
     */
    async #requestJson(url) {
        const response = await this.#request(url)
        return response.json()
    }

    /**
     * Requests a URL with retry handling.
     * @param {URL} url Request URL.
     * @returns {Promise<Response>}
     */
    async #request(url) {
        if (!this.#fetcher) {
            throw new Error('Model source fetcher is unavailable.')
        }

        let lastError = null
        for (let attempt = 0; attempt < this.#retryCount; attempt += 1) {
            const timeout = EcadEasyEdaModelSourceClient.#createTimeoutSignal(
                this.#requestTimeoutMs
            )
            try {
                const response = await this.#fetcher(String(url), {
                    signal: timeout.signal
                })
                if (!response?.ok) {
                    throw new Error(
                        'Model source request failed with status ' +
                            String(response?.status || 0)
                    )
                }
                return response
            } catch (error) {
                lastError = error
                if (attempt + 1 < this.#retryCount) {
                    await EcadEasyEdaModelSourceClient.#delay(
                        this.#retryDelayMs * 2 ** attempt
                    )
                }
            } finally {
                timeout.dispose()
            }
        }

        throw lastError
    }

    /**
     * Normalizes one search row.
     * @param {object} row Raw row.
     * @param {number} index Row index.
     * @returns {object}
     */
    static #normalizeSearchRow(row, index) {
        const attrs =
            row?.attributes && typeof row.attributes === 'object'
                ? row.attributes
                : {}
        const modelSeedId = String(attrs['3D Model'] || '').trim()
        const productCode = EcadEasyEdaModelSourceClient.#supplierPart(row)
        const fallbackId = String(row?.uuid || productCode || '').trim()
        const displayName = String(
            row?.display_title || row?.title || productCode || fallbackId
        ).trim()

        return {
            id: modelSeedId || fallbackId,
            name: displayName || 'component-' + String(index + 1),
            manufacturer: String(attrs.Manufacturer || '').trim(),
            productCode,
            modelSeedId,
            raw: row
        }
    }

    /**
     * Sorts exact supplier-code matches first for default search selection.
     * @param {string} query Search query.
     * @param {object[]} rows Normalized rows.
     * @returns {object[]}
     */
    static #preferExactSupplierPart(query, rows) {
        const normalized = String(query || '')
            .trim()
            .toLowerCase()
        if (!/^c\d+$/u.test(normalized)) {
            return rows
        }

        return [...rows].sort((left, right) => {
            const leftMatch =
                String(left.productCode || '').toLowerCase() === normalized
            const rightMatch =
                String(right.productCode || '').toLowerCase() === normalized
            return Number(rightMatch) - Number(leftMatch)
        })
    }

    /**
     * Resolves a supplier part value.
     * @param {object} row Raw row.
     * @returns {string}
     */
    static #supplierPart(row) {
        return String(
            row?.product_code || row?.attributes?.['Supplier Part'] || ''
        ).trim()
    }

    /**
     * Resolves a model source URL.
     * @param {string} sourceUrl Source URL.
     * @param {string} stepApi STEP API root.
     * @returns {URL}
     */
    static #resolveAssetUrl(sourceUrl, stepApi) {
        const raw = String(sourceUrl || '').trim()
        const modelMatch = raw.match(/^models\/([^/]+?)(?:\.step)?$/u)
        if (modelMatch) {
            return new URL(encodeURIComponent(modelMatch[1]), stepApi)
        }

        return new URL(raw)
    }

    /**
     * Reads a nested string value.
     * @param {any} value Raw value.
     * @param {string[]} path Property path.
     * @returns {string}
     */
    static #nestedString(value, path) {
        let cursor = value
        for (const key of path) {
            cursor = cursor?.[key]
        }
        return typeof cursor === 'string' ? cursor.trim() : ''
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
     * Delays a retry.
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
