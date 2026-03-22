/**
 * Browser-side client wrapper for the dedicated 3D scene prep worker.
 */
export class PcbScene3dWorkerClient {
    /** @type {(() => Worker) | null} */
    #createWorker

    /** @type {Worker | null} */
    #worker

    /** @type {number} */
    #requestSequence

    /** @type {Map<string, { resolve: (sceneDescription: any) => void, reject: (error: Error) => void }>} */
    #pendingRequests

    /**
     * @param {(() => Worker) | null} workerFactory
     */
    constructor(workerFactory) {
        this.#createWorker = workerFactory || null
        this.#worker = null
        this.#requestSequence = 1
        this.#pendingRequests = new Map()
        this.#ensureWorker()
    }

    /**
     * Sends one 3D scene prep request through the worker.
     * @param {any} documentModel
     * @param {any[]} [sessionAssets]
     * @returns {Promise<any>}
     */
    prepareScene(documentModel, sessionAssets = []) {
        return new Promise((resolve, reject) => {
            if (!this.#worker) {
                reject(new Error('3D scene worker is unavailable.'))
                return
            }

            const requestId = 'scene3d-request-' + this.#requestSequence++
            this.#pendingRequests.set(requestId, { resolve, reject })
            this.#worker.postMessage({
                type: 'scene3d:prepare',
                requestId,
                documentModel,
                sessionAssets
            })
        })
    }

    /**
     * Releases the worker and rejects any pending requests.
     * @returns {void}
     */
    dispose() {
        this.#pendingRequests.forEach(({ reject }) => {
            reject(new Error('3D scene worker terminated.'))
        })
        this.#pendingRequests.clear()
        this.#worker?.terminate()
        this.#worker = null
        this.#createWorker = null
    }

    /**
     * Creates the backing worker and event listeners once.
     * @returns {void}
     */
    #ensureWorker() {
        if (!this.#createWorker || this.#worker) {
            return
        }

        this.#worker = this.#createWorker()
        this.#worker.addEventListener('message', (event) => {
            this.#handleWorkerMessage(event?.data || {})
        })
        this.#worker.addEventListener('error', (event) => {
            this.#rejectAllPending(
                new Error(
                    '3D scene worker failed: ' +
                        String(event?.message || 'Unknown error.')
                )
            )
        })
    }

    /**
     * Routes one worker payload to the matching pending request.
     * @param {{ type?: string, requestId?: string, sceneDescription?: any, message?: string }} payload
     * @returns {void}
     */
    #handleWorkerMessage(payload) {
        const requestId = String(payload?.requestId || '')
        const pendingRequest = this.#pendingRequests.get(requestId) || null
        if (!pendingRequest) {
            return
        }

        this.#pendingRequests.delete(requestId)
        if (payload?.type === 'scene3d:success') {
            pendingRequest.resolve(payload.sceneDescription || {})
            return
        }

        pendingRequest.reject(
            new Error(payload?.message || '3D scene worker failed.')
        )
    }

    /**
     * Rejects every unresolved worker request with one shared error.
     * @param {Error} error
     * @returns {void}
     */
    #rejectAllPending(error) {
        this.#pendingRequests.forEach(({ reject }) => {
            reject(error)
        })
        this.#pendingRequests.clear()
    }
}
