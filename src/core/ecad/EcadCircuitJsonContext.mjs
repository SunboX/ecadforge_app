import { CircuitJsonDocumentContext } from 'circuitjson-toolkit'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Reuses one shared CircuitJSON request context across app services.
 */
export class EcadCircuitJsonContext {
    static #contexts = new WeakMap()
    static #pendingContexts = new WeakMap()

    /**
     * Returns a prepared context with any requested indexes added lazily.
     * @param {unknown} documentModel CircuitJSON document input.
     * @param {{ indexes?: string[] }} [options] Requested shared indexes.
     * @returns {CircuitJsonDocumentContext}
     */
    static prepare(documentModel, options = {}) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            throw new TypeError(
                'Expected a canonical or source-neutral CircuitJSON document.'
            )
        }
        EcadCircuitJsonContext.#throwIfSharedPreparationUnavailable(
            documentModel
        )

        let context = EcadCircuitJsonContext.#contexts.get(documentModel)
        if (!context) {
            context = CircuitJsonDocumentContext.prepare(documentModel)
            EcadCircuitJsonContext.#contexts.set(documentModel, context)
            EcadCircuitJsonContext.#contexts.set(context, context)
        }
        return CircuitJsonDocumentContext.prepare(context, options)
    }

    /**
     * Adopts a document received from the parser worker's structured-clone
     * boundary and caches its provenance-aware context.
     * @param {unknown} documentModel Structured-cloned CircuitJSON document.
     * @param {{ indexes?: string[] }} [options] Requested shared indexes.
     * @returns {CircuitJsonDocumentContext}
     */
    static adoptStructuredClone(documentModel, options = {}) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            throw new TypeError(
                'Expected a structured-cloned CircuitJSON document.'
            )
        }
        EcadCircuitJsonContext.#throwIfSharedPreparationUnavailable(
            documentModel
        )

        let context = EcadCircuitJsonContext.#contexts.get(documentModel)
        if (!context) {
            context =
                CircuitJsonDocumentContext.prepareStructuredClone(documentModel)
            EcadCircuitJsonContext.#contexts.set(documentModel, context)
            EcadCircuitJsonContext.#contexts.set(context, context)
        }
        return CircuitJsonDocumentContext.prepare(context, options)
    }

    /**
     * Cooperatively adopts one parser-worker document and caches the exact
     * context shared by subsequent synchronous app services.
     * @param {unknown} documentModel Structured-cloned CircuitJSON document.
     * @param {{ indexes?: string[], yield?: () => Promise<void> | void, signal?: AbortSignal }} [options] Requested indexes, host scheduler, and caller cancellation.
     * @returns {Promise<CircuitJsonDocumentContext>} Prepared shared context.
     */
    static async adoptStructuredCloneAsync(documentModel, options = {}) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            throw new TypeError(
                'Expected a structured-cloned CircuitJSON document.'
            )
        }

        EcadCircuitJsonContext.#throwIfAborted(options?.signal)
        const existing = EcadCircuitJsonContext.#contexts.get(documentModel)
        if (existing) {
            return CircuitJsonDocumentContext.prepare(existing, {
                indexes: options?.indexes
            })
        }
        let pending = EcadCircuitJsonContext.#pendingContexts.get(documentModel)
        if (!pending) {
            EcadCircuitJsonContext.#requireYieldControl(options?.yield)
            pending = EcadCircuitJsonContext.#createPendingContext()
            EcadCircuitJsonContext.#pendingContexts.set(documentModel, pending)
            void EcadCircuitJsonContext.#runPendingContext(
                documentModel,
                options?.yield,
                pending
            )
        }

        const context = await EcadCircuitJsonContext.#awaitPendingContext(
            pending,
            options?.signal
        )
        EcadCircuitJsonContext.#throwIfAborted(options?.signal)
        const adopted =
            EcadCircuitJsonContext.#contexts.get(documentModel) || context
        EcadCircuitJsonContext.#contexts.set(documentModel, adopted)
        EcadCircuitJsonContext.#contexts.set(adopted, adopted)
        return CircuitJsonDocumentContext.prepare(adopted, {
            indexes: options?.indexes
        })
    }

    /**
     * Creates a deferred shared promise so it can be published before toolkit
     * preparation invokes any potentially reentrant scheduler callback.
     * @returns {{ promise: Promise<CircuitJsonDocumentContext>, resolve: (context: CircuitJsonDocumentContext) => void, reject: (error: unknown) => void, status: 'pending' | 'rejected', error: unknown }} Pending preparation.
     */
    static #createPendingContext() {
        let resolve
        let reject
        const promise = new Promise((resolvePromise, rejectPromise) => {
            resolve = resolvePromise
            reject = rejectPromise
        })
        void promise.catch(() => undefined)
        return {
            promise,
            resolve,
            reject,
            status: 'pending',
            error: undefined
        }
    }

    /**
     * Runs one non-interruptible preparation after its shared promise has been
     * published, then caches either the completed context or terminal failure.
     * @param {object} documentModel Structured-cloned CircuitJSON document.
     * @param {(() => Promise<void> | void) | undefined} yieldControl Host scheduler from the first consumer.
     * @param {{ promise: Promise<CircuitJsonDocumentContext>, resolve: (context: CircuitJsonDocumentContext) => void, reject: (error: unknown) => void, status: 'pending' | 'rejected', error: unknown }} pending Published preparation.
     * @returns {Promise<void>}
     */
    static async #runPendingContext(documentModel, yieldControl, pending) {
        try {
            const context =
                await CircuitJsonDocumentContext.prepareStructuredCloneAsync(
                    documentModel,
                    {
                        ownership: 'exclusive',
                        yield: EcadCircuitJsonContext.#createSharedYield(
                            yieldControl
                        )
                    }
                )
            EcadCircuitJsonContext.#contexts.set(documentModel, context)
            EcadCircuitJsonContext.#contexts.set(context, context)
            if (
                EcadCircuitJsonContext.#pendingContexts.get(documentModel) ===
                pending
            ) {
                EcadCircuitJsonContext.#pendingContexts.delete(documentModel)
            }
            pending.resolve(context)
        } catch (error) {
            pending.status = 'rejected'
            pending.error = error
            pending.reject(error)
        }
    }

    /**
     * Creates a stable scheduler that permanently falls back to a host task if
     * the injected or platform scheduler rejects.
     * @param {(() => Promise<void> | void) | undefined} yieldControl Optional injected scheduler.
     * @returns {() => Promise<void>} Non-rejecting shared scheduler.
     */
    static #createSharedYield(yieldControl) {
        let schedule = yieldControl
        if (!schedule) {
            try {
                const scheduler = globalThis.scheduler
                const schedulerYield = scheduler?.yield
                if (typeof schedulerYield === 'function') {
                    schedule = () =>
                        Reflect.apply(schedulerYield, scheduler, [])
                }
            } catch {
                schedule = undefined
            }
        }
        return async () => {
            if (schedule) {
                try {
                    await schedule()
                    return
                } catch {
                    schedule = undefined
                }
            }
            await EcadCircuitJsonContext.#yieldToFallbackTask()
        }
    }

    /**
     * Yields through a zero-delay task and degrades to a microtask if the host
     * timer API itself is unavailable or throws.
     * @returns {Promise<void>}
     */
    static async #yieldToFallbackTask() {
        const timeout = globalThis.setTimeout
        if (typeof timeout !== 'function') {
            await Promise.resolve()
            return
        }
        await new Promise((resolve) => {
            try {
                Reflect.apply(timeout, globalThis, [resolve, 0])
            } catch {
                resolve()
            }
        })
    }

    /**
     * Validates an optional scheduler before publishing shared document state.
     * @param {unknown} yieldControl Scheduler candidate.
     * @returns {void}
     */
    static #requireYieldControl(yieldControl) {
        if (yieldControl !== undefined && typeof yieldControl !== 'function') {
            throw new TypeError(
                'CircuitJSON context yield control must be a function.'
            )
        }
    }

    /**
     * Prevents synchronous consumers from creating a second context while a
     * progressive adoption is running or after it terminally failed.
     * @param {object} documentModel CircuitJSON document identity.
     * @returns {void}
     */
    static #throwIfSharedPreparationUnavailable(documentModel) {
        const pending =
            EcadCircuitJsonContext.#pendingContexts.get(documentModel)
        if (!pending) return
        if (pending.status === 'rejected') throw pending.error
        throw new Error('CircuitJSON document adoption is in progress.')
    }

    /**
     * Awaits shared preparation while allowing one caller to cancel only its
     * own wait.
     * @param {{ promise: Promise<CircuitJsonDocumentContext> }} pending Shared preparation.
     * @param {AbortSignal | undefined} signal Caller cancellation signal.
     * @returns {Promise<CircuitJsonDocumentContext>} Prepared context.
     */
    static async #awaitPendingContext(pending, signal) {
        if (!signal) return pending.promise
        EcadCircuitJsonContext.#throwIfAborted(signal)
        let abortListener
        const aborted = new Promise((_resolve, reject) => {
            abortListener = () => {
                reject(EcadCircuitJsonContext.#abortReason(signal))
            }
            signal.addEventListener('abort', abortListener, { once: true })
            if (signal.aborted) abortListener()
        })
        try {
            return await Promise.race([pending.promise, aborted])
        } finally {
            signal.removeEventListener('abort', abortListener)
        }
    }

    /**
     * Returns a stable Error for one aborted signal.
     * @param {AbortSignal} signal Aborted signal.
     * @returns {Error} Cancellation error.
     */
    static #abortReason(signal) {
        if (signal.reason instanceof Error) return signal.reason
        const error = new Error('CircuitJSON context caller was cancelled.')
        error.name = 'AbortError'
        return error
    }

    /**
     * Throws when a caller or shared preparation signal is aborted.
     * @param {AbortSignal | undefined} signal Cancellation signal.
     * @returns {void}
     */
    static #throwIfAborted(signal) {
        if (signal?.aborted) {
            throw EcadCircuitJsonContext.#abortReason(signal)
        }
    }
}
