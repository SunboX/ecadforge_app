/**
 * Browser worker client for local SPICE simulation requests.
 */
export class SpiceSimulationWorkerClient {
    /** @type {() => Worker} */
    #workerFactory

    /** @type {Worker | null} */
    #worker

    /** @type {Map<string, { resolve: (value: object) => void, reject: (reason?: unknown) => void }>} */
    #pendingRequests

    /** @type {number} */
    #nextRequestNumber

    /** @type {(event: MessageEvent) => void} */
    #messageListener

    /** @type {(event: ErrorEvent | { message?: string }) => void} */
    #errorListener

    /**
     * @param {{ workerFactory: () => Worker }} dependencies Worker dependencies.
     */
    constructor(dependencies) {
        this.#workerFactory = dependencies.workerFactory
        this.#worker = null
        this.#pendingRequests = new Map()
        this.#nextRequestNumber = 1
        this.#messageListener = this.#handleWorkerMessage.bind(this)
        this.#errorListener = this.#handleWorkerError.bind(this)
    }

    /**
     * Runs one SPICE simulation in the worker.
     * @param {string} spiceString SPICE netlist text.
     * @returns {Promise<{ simulationResultCircuitJson: object[], simulationCircuitJson: object[], graphSummary: object, diagnostics: object[] }>}
     */
    simulate(spiceString) {
        const worker = this.#resolveWorker()
        const requestId = 'spice_request_' + this.#nextRequestNumber++

        return new Promise((resolve, reject) => {
            this.#pendingRequests.set(requestId, { resolve, reject })
            worker.postMessage({
                type: 'spice:simulate',
                requestId,
                spiceString: String(spiceString || '')
            })
        })
    }

    /**
     * Disposes the worker and rejects pending requests.
     * @returns {void}
     */
    dispose() {
        if (!this.#worker) return

        this.#rejectAllPending(new Error('SPICE simulation worker disposed.'))
        this.#worker.removeEventListener?.('message', this.#messageListener)
        this.#worker.removeEventListener?.('error', this.#errorListener)
        this.#worker.terminate()
        this.#worker = null
    }

    /**
     * Lazily creates and returns the worker instance.
     * @returns {Worker}
     */
    #resolveWorker() {
        if (!this.#worker) {
            this.#worker = this.#workerFactory()
            this.#worker.addEventListener('message', this.#messageListener)
            this.#worker.addEventListener('error', this.#errorListener)
        }

        return this.#worker
    }

    /**
     * Resolves or rejects the pending request matching one worker response.
     * @param {MessageEvent} event Worker message event.
     * @returns {void}
     */
    #handleWorkerMessage(event) {
        const payload = event?.data || {}
        const requestId = String(payload.requestId || '')
        const pending = this.#pendingRequests.get(requestId)
        if (!pending) return

        this.#pendingRequests.delete(requestId)

        if (payload.type === 'spice:success') {
            pending.resolve({
                simulationResultCircuitJson:
                    payload.simulationResultCircuitJson || [],
                simulationCircuitJson: payload.simulationCircuitJson || [],
                graphSummary: payload.graphSummary || {
                    graphCount: 0,
                    voltageGraphCount: 0,
                    currentGraphCount: 0,
                    graphs: []
                },
                diagnostics: payload.diagnostics || []
            })
            return
        }

        if (payload.type === 'spice:error') {
            pending.reject(
                new Error(String(payload.message || 'SPICE failed.'))
            )
        }
    }

    /**
     * Rejects all pending requests after a worker transport error.
     * @param {ErrorEvent | { message?: string }} event Worker error event.
     * @returns {void}
     */
    #handleWorkerError(event) {
        this.#rejectAllPending(
            new Error(String(event?.message || 'SPICE worker failed.'))
        )
    }

    /**
     * Rejects and clears all pending requests.
     * @param {Error} error Rejection reason.
     * @returns {void}
     */
    #rejectAllPending(error) {
        for (const pending of this.#pendingRequests.values()) {
            pending.reject(error)
        }
        this.#pendingRequests.clear()
    }
}
