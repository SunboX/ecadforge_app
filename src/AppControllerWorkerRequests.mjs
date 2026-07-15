/**
 * Coordinates parser-worker request lookup and guarded asynchronous settlement.
 */
export class AppControllerWorkerRequests {
    /**
     * Finds the exact request claimed by a worker response. Request ids are
     * mandatory because an id-less late response cannot be distinguished from
     * the result of a newer request.
     * @param {Map<string, object>} requests Pending requests.
     * @param {string} requestId Worker request id.
     * @returns {{ requestId: string, request: object } | null} Matched request.
     */
    static match(requests, requestId) {
        if (!requestId || !requests.has(requestId)) return null
        const request = requests.get(requestId)
        return request ? { requestId, request } : null
    }

    /**
     * Settles one request only while it is still the current map entry. A
     * request already rejected by controller disposal is left untouched.
     * @param {Map<string, object>} requests Pending requests.
     * @param {string} requestId Matched request id.
     * @param {{ resolve: (value: unknown) => void, reject: (error: unknown) => void }} request Matched request.
     * @param {'resolve' | 'reject'} action Settlement action.
     * @param {unknown} value Parse result or error.
     * @returns {boolean} Whether the request was settled.
     */
    static settle(requests, requestId, request, action, value) {
        if (requests.get(requestId) !== request) return false
        requests.delete(requestId)
        if (action === 'resolve') request.resolve(value)
        else request.reject(value)
        return true
    }

    /**
     * Aborts and rejects every unresolved parse before clearing the registry.
     * @param {Map<string, object>} requests Pending requests.
     * @param {Error} error Terminal worker error.
     * @returns {void}
     */
    static rejectAll(requests, error) {
        requests.forEach(({ abortController, reject }) => {
            abortController.abort(error)
            reject(error)
        })
        requests.clear()
    }

    /**
     * Terminates an optional parser worker and returns its cleared slot value.
     * @param {{ terminate: () => void } | null} worker Parser worker.
     * @returns {null} Cleared worker slot.
     */
    static terminate(worker) {
        worker?.terminate()
        return null
    }

    /**
     * Reports whether an error requests direct-parser fallback.
     * @param {unknown} error Worker error candidate.
     * @returns {boolean} Whether the worker transport failed.
     */
    static isFailure(error) {
        return Boolean(error && error.workerFailure)
    }

    /**
     * Reports whether a response error likely came from cloning a large model.
     * @param {Error} error Worker response error.
     * @returns {boolean} Whether direct parsing may recover.
     */
    static isRecoverableResponseError(error) {
        return /maximum call stack size exceeded/i.test(error.message)
    }
}

Object.freeze(AppControllerWorkerRequests.prototype)
Object.freeze(AppControllerWorkerRequests)
