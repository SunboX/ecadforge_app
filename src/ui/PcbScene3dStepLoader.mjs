/**
 * Browser-side STEP mesh loader backed by occt-import-js.
 */
export class PcbScene3dStepLoader {
    /** @type {(() => Promise<{ ReadStepFile?: (content: Uint8Array, params: Record<string, any> | null) => any }>) | null} */
    static #browserImporterLoader

    /** @type {Promise<{ ReadStepFile?: (content: Uint8Array, params: Record<string, any> | null) => any }> | null} */
    static #browserImporterPromise

    /** @type {Promise<void> | null} */
    static #browserScriptPromise

    /** @type {() => Promise<{ ReadStepFile?: (content: Uint8Array, params: Record<string, any> | null) => any }>} */
    #importerLoader

    /** @type {(() => Worker) | null} */
    #stepWorkerFactory

    /** @type {Map<string, Promise<{ meshPayloads: { name: string, color: number[] | null, positions: number[], normals: number[], indices: number[], faceColors: { first: number, last: number, color: number[] | null }[] }[] }>>} */
    #cache

    /** @type {Worker | null} */
    #stepWorker

    /** @type {{ resolve: (result: any) => void, reject: (error: Error) => void } | null} */
    #activeWorkerRequest

    /** @type {Promise<void>} */
    #workerRequestChain

    /** @type {(event: any) => void} */
    #boundWorkerMessage

    /** @type {(event: any) => void} */
    #boundWorkerError

    /** @type {boolean} */
    #isDisposed

    /**
     * @param {{ importerLoader?: () => Promise<{ ReadStepFile?: (content: Uint8Array, params: Record<string, any> | null) => any }>, stepWorkerFactory?: (() => Worker) | null }} [options]
     */
    constructor(options = {}) {
        this.#importerLoader =
            options.importerLoader ||
            (() => PcbScene3dStepLoader.#loadBrowserImporter())
        this.#stepWorkerFactory = options.stepWorkerFactory || null
        this.#cache = new Map()
        this.#stepWorker = null
        this.#activeWorkerRequest = null
        this.#workerRequestChain = Promise.resolve()
        this.#boundWorkerMessage = (event) =>
            this.#handleWorkerMessage(event)
        this.#boundWorkerError = (event) => this.#handleWorkerError(event)
        this.#isDisposed = false
    }

    /**
     * Releases any persistent STEP worker owned by this loader.
     * @returns {void}
     */
    dispose() {
        if (this.#isDisposed) {
            return
        }

        this.#isDisposed = true
        this.#rejectActiveWorkerRequest(
            new Error('STEP importer worker terminated.')
        )
        this.#disposeWorker()
    }

    /**
     * Loads one STEP model and normalizes it into triangle payloads.
     * @param {{ origin?: string, name?: string, sourceStream?: string, relativePath?: string, payloadText?: string, file?: Blob | File | null }} model
     * @returns {Promise<{ meshPayloads: { name: string, color: number[] | null, positions: number[], normals: number[], indices: number[], faceColors: { first: number, last: number, color: number[] | null }[] }[] }>}
     */
    async loadModel(model) {
        const cacheKey = PcbScene3dStepLoader.#resolveCacheKey(model)
        const cachedLoad = this.#cache.get(cacheKey)
        if (cachedLoad) {
            return await cachedLoad
        }

        const pendingLoad = this.#loadModelUncached(model)
        this.#cache.set(cacheKey, pendingLoad)

        try {
            return await pendingLoad
        } catch (error) {
            this.#cache.delete(cacheKey)
            throw error
        }
    }

    /**
     * Loads one uncached STEP model.
     * @param {{ origin?: string, name?: string, sourceStream?: string, relativePath?: string, payloadText?: string, file?: Blob | File | null }} model
     * @returns {Promise<{ meshPayloads: { name: string, color: number[] | null, positions: number[], normals: number[], indices: number[], faceColors: { first: number, last: number, color: number[] | null }[] }[] }>}
     */
    async #loadModelUncached(model) {
        const modelName = PcbScene3dStepLoader.#resolveModelName(model)

        try {
            const content =
                await PcbScene3dStepLoader.#readModelContent(model)
            const result =
                await this.#readImporterResult(content)

            const meshPayloads = Array.isArray(result?.meshes)
                ? result.meshes
                      .map((mesh) =>
                          PcbScene3dStepLoader.#normalizeMeshPayload(mesh)
                      )
                      .filter(Boolean)
                : []

            if (!result?.success || !meshPayloads.length) {
                throw new Error('Importer returned no mesh payloads.')
            }

            return {
                meshPayloads:
                    PcbScene3dStepLoader.#normalizeModelOrigin(meshPayloads)
            }
        } catch (error) {
            throw new Error(
                'STEP import failed for ' +
                    modelName +
                    ': ' +
                    String(error?.message || error || 'Unknown error.')
            )
        }
    }

    /**
     * Reads one importer result either through the page importer or a nested
     * worker-backed importer.
     * @param {Uint8Array} content
     * @returns {Promise<any>}
     */
    async #readImporterResult(content) {
        if (this.#stepWorkerFactory) {
            return await this.#readImporterResultWithWorker(content)
        }

        const importer = await this.#importerLoader()
        if (typeof importer?.ReadStepFile !== 'function') {
            throw new Error('STEP importer is unavailable.')
        }

        return importer.ReadStepFile(content, {
            linearUnit: 'inch',
            linearDeflectionType: 'bounding_box_ratio',
            linearDeflection: 0.0015,
            angularDeflection: 0.35
        })
    }

    /**
     * Reads one importer result through a short-lived worker-backed importer.
     * @param {Uint8Array} content
     * @returns {Promise<any>}
     */
    async #readImporterResultWithWorker(content) {
        const pendingResult = this.#workerRequestChain.then(() =>
            this.#readImporterResultWithPersistentWorker(content)
        )
        this.#workerRequestChain = pendingResult.then(
            () => undefined,
            () => undefined
        )

        return await pendingResult
    }

    /**
     * Reads one importer result through the loader-owned persistent worker.
     * Requests are serialized because the vendored worker does not echo a
     * request id back in its response payload.
     * @param {Uint8Array} content
     * @returns {Promise<any>}
     */
    async #readImporterResultWithPersistentWorker(content) {
        const stepWorker = this.#ensurePersistentWorker()

        return await new Promise((resolve, reject) => {
            this.#activeWorkerRequest = { resolve, reject }
            stepWorker.postMessage(
                {
                    format: 'step',
                    buffer: content,
                    params: {
                        linearUnit: 'inch',
                        linearDeflectionType: 'bounding_box_ratio',
                        linearDeflection: 0.0015,
                        angularDeflection: 0.35
                    }
                },
                [content.buffer]
            )
        })
    }

    /**
     * Creates the persistent STEP worker once and reuses it across imports.
     * @returns {Worker}
     */
    #ensurePersistentWorker() {
        if (this.#isDisposed) {
            throw new Error('STEP importer loader has been disposed.')
        }

        if (this.#stepWorker) {
            return this.#stepWorker
        }

        const stepWorker = this.#stepWorkerFactory?.()
        if (!stepWorker) {
            throw new Error('STEP importer worker is unavailable.')
        }

        stepWorker.addEventListener?.('message', this.#boundWorkerMessage)
        stepWorker.addEventListener?.('error', this.#boundWorkerError)
        this.#stepWorker = stepWorker

        return stepWorker
    }

    /**
     * Routes the active worker response back to the pending import promise.
     * @param {{ data?: any }} event
     * @returns {void}
     */
    #handleWorkerMessage(event) {
        const activeRequest = this.#activeWorkerRequest
        this.#activeWorkerRequest = null
        activeRequest?.resolve(event?.data || {})
    }

    /**
     * Rejects the active worker request and resets the worker after an error.
     * @param {{ message?: string }} event
     * @returns {void}
     */
    #handleWorkerError(event) {
        const error = new Error(
            String(event?.message || 'STEP importer worker failed.')
        )
        this.#rejectActiveWorkerRequest(error)
        this.#disposeWorker()
    }

    /**
     * Rejects the active worker request if one is still pending.
     * @param {Error} error
     * @returns {void}
     */
    #rejectActiveWorkerRequest(error) {
        const activeRequest = this.#activeWorkerRequest
        this.#activeWorkerRequest = null
        activeRequest?.reject(error)
    }

    /**
     * Terminates the persistent worker and clears its event listeners.
     * @returns {void}
     */
    #disposeWorker() {
        if (!this.#stepWorker) {
            return
        }

        this.#stepWorker.removeEventListener?.(
            'message',
            this.#boundWorkerMessage
        )
        this.#stepWorker.removeEventListener?.(
            'error',
            this.#boundWorkerError
        )
        this.#stepWorker.terminate?.()
        this.#stepWorker = null
    }

    /**
     * Resolves one model identity to a stable cache key.
     * @param {{ origin?: string, name?: string, sourceStream?: string, relativePath?: string }} model
     * @returns {string}
     */
    static #resolveCacheKey(model) {
        return [
            String(model?.origin || 'unknown'),
            String(model?.sourceStream || ''),
            String(model?.relativePath || ''),
            String(model?.name || '')
        ].join('|')
    }

    /**
     * Resolves one human-readable model name.
     * @param {{ name?: string, relativePath?: string, sourceStream?: string }} model
     * @returns {string}
     */
    static #resolveModelName(model) {
        return String(
            model?.name || model?.relativePath || model?.sourceStream || 'model'
        )
    }

    /**
     * Reads one STEP model into bytes from embedded text or a session file.
     * @param {{ payloadText?: string, file?: Blob | File | null }} model
     * @returns {Promise<Uint8Array>}
     */
    static async #readModelContent(model) {
        const payloadText =
            typeof model?.payloadText === 'string' ? model.payloadText : ''
        if (payloadText) {
            return new TextEncoder().encode(payloadText)
        }

        if (typeof model?.file?.arrayBuffer === 'function') {
            return new Uint8Array(await model.file.arrayBuffer())
        }

        throw new Error('STEP model content is not available.')
    }

    /**
     * Normalizes one importer mesh into serializable numeric arrays.
     * @param {any} mesh
     * @returns {{ name: string, color: number[] | null, positions: number[], normals: number[], indices: number[], faceColors: { first: number, last: number, color: number[] | null }[] } | null}
     */
    static #normalizeMeshPayload(mesh) {
        const positions = Array.from(mesh?.attributes?.position?.array || [])
        const indices = Array.from(mesh?.index?.array || [])
        if (!positions.length || !indices.length) {
            return null
        }

        const color = Array.isArray(mesh?.color) && mesh.color.length >= 3
            ? mesh.color.slice(0, 3).map((channel) => Number(channel || 0))
            : null
        const faceColors = Array.isArray(mesh?.brep_faces)
            ? mesh.brep_faces
                  .map((faceColor) =>
                      PcbScene3dStepLoader.#normalizeFaceColorRange(faceColor)
                  )
                  .filter(Boolean)
            : []

        return {
            name: String(mesh?.name || ''),
            color,
            positions: positions.map((value) => Number(value || 0)),
            normals: Array.from(mesh?.attributes?.normal?.array || []).map(
                (value) => Number(value || 0)
            ),
            indices: indices.map((value) => Number(value || 0)),
            faceColors
        }
    }

    /**
     * Normalizes one STEP face-color range into serializable numeric values.
     * @param {any} faceColor
     * @returns {{ first: number, last: number, color: number[] | null } | null}
     */
    static #normalizeFaceColorRange(faceColor) {
        const first = Number(faceColor?.first)
        const last = Number(faceColor?.last)

        if (!Number.isInteger(first) || !Number.isInteger(last) || last < first) {
            return null
        }

        return {
            first,
            last,
            color:
                Array.isArray(faceColor?.color) && faceColor.color.length >= 3
                    ? faceColor.color
                          .slice(0, 3)
                          .map((channel) => Number(channel || 0))
                    : null
        }
    }

    /**
     * Re-centers STEP payloads whose XY coordinates are obviously stored far
     * away from the local origin, which happens for some embedded Altium
     * models that retain absolute CAD world offsets.
     * @param {{ name: string, color: number[] | null, positions: number[], normals: number[], indices: number[], faceColors: { first: number, last: number, color: number[] | null }[] }[]} meshPayloads
     * @returns {{ name: string, color: number[] | null, positions: number[], normals: number[], indices: number[], faceColors: { first: number, last: number, color: number[] | null }[] }[]}
     */
    static #normalizeModelOrigin(meshPayloads) {
        const bounds = PcbScene3dStepLoader.#measureModelBounds(meshPayloads)
        if (!bounds) {
            return meshPayloads
        }

        const maxDimension = Math.max(
            bounds.maxX - bounds.minX,
            bounds.maxY - bounds.minY,
            bounds.maxZ - bounds.minZ,
            0.000001
        )
        const centerX = (bounds.minX + bounds.maxX) / 2
        const centerY = (bounds.minY + bounds.maxY) / 2
        const shouldNormalize =
            Math.max(Math.abs(centerX), Math.abs(centerY)) >
            maxDimension * 1.5

        if (!shouldNormalize) {
            return meshPayloads
        }

        return meshPayloads.map((meshPayload) => ({
            ...meshPayload,
            positions: meshPayload.positions.map((value, index) => {
                if (index % 3 === 0) {
                    return value - centerX
                }

                if (index % 3 === 1) {
                    return value - centerY
                }

                return value
            })
        }))
    }

    /**
     * Measures the combined bounds across all normalized STEP meshes.
     * @param {{ positions: number[] }[]} meshPayloads
     * @returns {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number } | null}
     */
    static #measureModelBounds(meshPayloads) {
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let minZ = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        let maxZ = Number.NEGATIVE_INFINITY

        meshPayloads.forEach((meshPayload) => {
            meshPayload.positions.forEach((value, index) => {
                const numericValue = Number(value || 0)

                if (index % 3 === 0) {
                    minX = Math.min(minX, numericValue)
                    maxX = Math.max(maxX, numericValue)
                } else if (index % 3 === 1) {
                    minY = Math.min(minY, numericValue)
                    maxY = Math.max(maxY, numericValue)
                } else {
                    minZ = Math.min(minZ, numericValue)
                    maxZ = Math.max(maxZ, numericValue)
                }
            })
        })

        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(minZ) ||
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY) ||
            !Number.isFinite(maxZ)
        ) {
            return null
        }

        return {
            minX,
            minY,
            minZ,
            maxX,
            maxY,
            maxZ
        }
    }

    /**
     * Loads the browser OCCT importer instance once per page.
     * @returns {Promise<{ ReadStepFile?: (content: Uint8Array, params: Record<string, any> | null) => any }>}
     */
    static async #loadBrowserImporter() {
        if (!PcbScene3dStepLoader.#browserImporterLoader) {
            PcbScene3dStepLoader.#browserImporterLoader = async () => {
                if (typeof window === 'undefined' || typeof document === 'undefined') {
                    throw new Error('Browser STEP importer requires window and document.')
                }

                await PcbScene3dStepLoader.#ensureBrowserScript()

                const factory = globalThis.occtimportjs
                if (typeof factory !== 'function') {
                    throw new Error('occt-import-js did not register a browser factory.')
                }

                return await factory({
                    locateFile: (fileName) =>
                        PcbScene3dStepLoader.#resolveVendorAssetUrl(fileName)
                })
            }
        }

        if (!PcbScene3dStepLoader.#browserImporterPromise) {
            PcbScene3dStepLoader.#browserImporterPromise =
                PcbScene3dStepLoader.#browserImporterLoader()
        }

        return await PcbScene3dStepLoader.#browserImporterPromise
    }

    /**
     * Ensures the browser importer script has been loaded once.
     * @returns {Promise<void>}
     */
    static async #ensureBrowserScript() {
        if (PcbScene3dStepLoader.#browserScriptPromise) {
            return await PcbScene3dStepLoader.#browserScriptPromise
        }

        PcbScene3dStepLoader.#browserScriptPromise = new Promise(
            (resolve, reject) => {
                const existingScript = document.querySelector(
                    'script[data-occt-import-js]'
                )
                if (existingScript) {
                    existingScript.addEventListener('load', () => resolve(), {
                        once: true
                    })
                    existingScript.addEventListener(
                        'error',
                        () => reject(new Error('STEP importer script failed to load.')),
                        { once: true }
                    )
                    if (typeof globalThis.occtimportjs === 'function') {
                        resolve()
                    }
                    return
                }

                const script = document.createElement('script')
                script.async = true
                script.dataset.occtImportJs = 'true'
                script.src = PcbScene3dStepLoader.#resolveVendorAssetUrl(
                    'occt-import-js.js'
                )
                script.addEventListener('load', () => resolve(), { once: true })
                script.addEventListener(
                    'error',
                    () => reject(new Error('STEP importer script failed to load.')),
                    { once: true }
                )
                document.head.append(script)
            }
        )

        return await PcbScene3dStepLoader.#browserScriptPromise
    }

    /**
     * Resolves one vendored importer asset URL with the current app version.
     * @param {string} fileName
     * @returns {string}
     */
    static #resolveVendorAssetUrl(fileName) {
        const versionKey = new URL(import.meta.url).searchParams.get('v') || ''
        const suffix = versionKey ? '?v=' + encodeURIComponent(versionKey) : ''
        return (
            '/vendor/occt-import-js/dist/' +
            String(fileName || '') +
            suffix
        )
    }
}
