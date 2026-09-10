import { EcadParserService } from './core/ecad/EcadParserService.mjs'
import { DemoProjectRegistry } from './DemoProjectRegistry.mjs'

/**
 * @typedef {{ documentModel?: object | null, parseStatus?: string }} PreviewSnapshot
 * @typedef {{ getSnapshot: () => PreviewSnapshot, subscribe: (listener: (snapshot: PreviewSnapshot) => void) => (() => void) }} PreviewState
 * @typedef {{ requestIdleCallback?: Function, cancelIdleCallback?: Function, setTimeout?: Function, clearTimeout?: Function }} PreviewScheduler
 * @typedef {{ fetcher?: (url: string, init?: RequestInit) => Promise<Response>, parser?: { parseEntries: (entries: { name: string, buffer: ArrayBuffer }[]) => Promise<object> | object }, state?: PreviewState, scheduler?: PreviewScheduler }} PreviewLoaderOptions
 */

/**
 * Loads one bundled preview per view while giving foreground imports priority.
 */
export class HeroPreviewDemoLoader {
    static #sessions = new WeakMap()

    #view
    #options
    #eligible = true
    #watching = false
    #unsubscribe = null
    #scheduled = null
    #task = null
    #documents = null
    #delivered = false

    /**
     * @param {{ setHeroPreviewDocuments: (documentModels: any[]) => void }} view App view.
     * @param {PreviewLoaderOptions} options Loader dependencies.
     */
    constructor(view, options) {
        this.#view = view
        this.#options = options
    }

    /**
     * Schedules preview work when no document or foreground import is active.
     * With no state source, retains the original one-shot startup scheduling.
     * @param {{ setHeroPreviewDocuments?: (documentModels: any[]) => void }} view App view.
     * @param {PreviewLoaderOptions} [options] Loader options, retained for this view.
     * @returns {boolean}
     */
    static schedule(view, options = {}) {
        const session = HeroPreviewDemoLoader.#sessionFor(view, options)
        if (!session) {
            return false
        }

        session.#watchState()
        session.#queue()
        return true
    }

    /**
     * Loads immediately if landing is eligible, sharing pending or cached work.
     * Returns false when delivery is deferred or the load fails.
     * @param {{ setHeroPreviewDocuments?: (documentModels: any[]) => void }} view App view.
     * @param {PreviewLoaderOptions} [options] Loader options, retained for this view.
     * @returns {Promise<boolean>}
     */
    static async load(view, options = {}) {
        const session = HeroPreviewDemoLoader.#sessionFor(view, options)
        if (!session) {
            return false
        }

        session.#watchState()
        session.#cancelScheduled()
        return session.#load()
    }

    /**
     * Resolves a single owner for a view's preview work and parsed documents.
     * @param {{ setHeroPreviewDocuments?: (documentModels: any[]) => void }} view App view.
     * @param {PreviewLoaderOptions} options Loader options.
     * @returns {HeroPreviewDemoLoader | null}
     */
    static #sessionFor(view, options) {
        if (typeof view?.setHeroPreviewDocuments !== 'function') {
            return null
        }
        if (!HeroPreviewDemoLoader.#sessions.has(view)) {
            HeroPreviewDemoLoader.#sessions.set(
                view,
                new HeroPreviewDemoLoader(view, options)
            )
        }
        return HeroPreviewDemoLoader.#sessions.get(view)
    }

    /** Subscribes only until the preview has been delivered to its owner. */
    #watchState() {
        if (this.#watching || this.#delivered) {
            return
        }
        this.#watching = true
        const state = this.#options.state
        this.#eligible = HeroPreviewDemoLoader.#isEligible(
            state?.getSnapshot?.()
        )
        this.#unsubscribe = state?.subscribe?.((snapshot) => {
            const wasEligible = this.#eligible
            this.#eligible = HeroPreviewDemoLoader.#isEligible(snapshot)
            if (!this.#eligible) {
                this.#cancelScheduled()
                if (this.#task?.phase === 'fetching') {
                    this.#task.aborted = true
                    this.#task.controller?.abort()
                }
            } else if (!wasEligible) {
                this.#queue()
            }
        })
    }

    /**
     * Matches the app's landing visibility and foreground parser activity.
     * @param {PreviewSnapshot} [snapshot] Current app state.
     * @returns {boolean}
     */
    static #isEligible(snapshot) {
        return !snapshot?.documentModel && snapshot?.parseStatus !== 'loading'
    }

    /** Queues at most one idle callback, including after returning home. */
    #queue() {
        if (
            !this.#eligible ||
            this.#delivered ||
            this.#scheduled ||
            this.#task
        ) {
            return
        }
        const scheduler = this.#options.scheduler || globalThis
        const pending = { id: null, cancel: null }
        this.#scheduled = pending
        const runLoad = () => {
            // Cancellation can race an already-dequeued browser callback.
            if (this.#scheduled !== pending) {
                return false
            }
            this.#scheduled = null
            return this.#load()
        }
        try {
            if (typeof scheduler.requestIdleCallback === 'function') {
                pending.cancel = scheduler.cancelIdleCallback?.bind(scheduler)
                pending.id = scheduler.requestIdleCallback(runLoad, {
                    timeout: 1500
                })
            } else if (typeof scheduler.setTimeout === 'function') {
                pending.cancel = scheduler.clearTimeout?.bind(scheduler)
                pending.id = scheduler.setTimeout(runLoad, 250)
            } else {
                void runLoad()
            }
        } catch (_error) {
            // A later landing transition can retry without a scheduling loop.
            this.#scheduled = null
        }
    }

    /** Invalidates queued work even when no scheduler cancellation API exists. */
    #cancelScheduled() {
        const pending = this.#scheduled
        this.#scheduled = null
        pending?.cancel?.(pending.id)
    }

    /**
     * Starts one fetch/parse operation or delivers an already parsed preview.
     * @returns {Promise<boolean>}
     */
    async #load() {
        if (this.#delivered) {
            return true
        }
        if (!this.#eligible) {
            return false
        }
        if (this.#task) {
            return this.#task.promise
        }
        if (this.#documents !== null) {
            return this.#deliver()
        }
        const task = {
            phase: 'fetching',
            aborted: false,
            awaitingLanding: false,
            controller:
                typeof globalThis.AbortController === 'function'
                    ? new AbortController()
                    : null,
            promise: null
        }
        this.#task = task
        task.promise = this.#fetchAndParse(task).finally(() => {
            this.#task = null
            // Landing can return between async completion and this cleanup.
            if (task.aborted || task.awaitingLanding) {
                this.#queue()
            }
        })
        return task.promise
    }

    /**
     * Fetches the demo and checks eligibility before starting its parser.
     * @param {{ phase: string, aborted: boolean, awaitingLanding: boolean, controller: AbortController | null }} task Current work.
     * @returns {Promise<boolean>}
     */
    async #fetchAndParse(task) {
        try {
            const fetcher =
                this.#options.fetcher ||
                (typeof globalThis.fetch === 'function'
                    ? globalThis.fetch.bind(globalThis)
                    : null)
            const demo = DemoProjectRegistry.get('kicad')
            if (!fetcher || !demo) {
                return false
            }
            const entries = await Promise.all(
                demo.files.map((file) =>
                    HeroPreviewDemoLoader.#fetchParserEntry(fetcher, file, task)
                )
            )
            if (task.aborted || !this.#eligible) {
                return false
            }

            // The parser has no abort contract. Cache its result if an import
            // starts during parsing, and defer rendering until landing returns.
            task.phase = 'parsing'
            const parser = this.#options.parser || EcadParserService
            const parseResult = await parser.parseEntries(entries)
            this.#documents = Array.isArray(parseResult?.documents)
                ? parseResult.documents
                : []
            task.awaitingLanding = !this.#eligible
            return this.#deliver()
        } catch (_error) {
            task.controller?.abort()
            return false
        }
    }

    /**
     * Delivers exactly once; the preview controller retains documents thereafter.
     * @returns {boolean}
     */
    #deliver() {
        if (!this.#eligible) {
            return false
        }
        try {
            this.#view.setHeroPreviewDocuments(this.#documents)
            this.#delivered = true
            this.#unsubscribe?.()
            this.#unsubscribe = null
            return true
        } catch (_error) {
            return false
        }
    }

    /**
     * Fetches one bundled demo file as a parser entry.
     * @param {(url: string, init?: RequestInit) => Promise<Response>} fetcher Browser fetch function.
     * @param {{ path: string, name: string }} file Demo file descriptor.
     * @param {{ aborted: boolean, controller: AbortController | null }} task Current work.
     * @returns {Promise<{ name: string, buffer: ArrayBuffer } | null>}
     */
    static async #fetchParserEntry(fetcher, file, task) {
        const response = await fetcher(file.path, {
            signal: task.controller?.signal
        })
        if (task.aborted) {
            return null
        }
        if (!response?.ok) {
            throw new Error(
                'Could not load preview demo file. HTTP ' +
                    String(response?.status || 0)
            )
        }

        return {
            name: file.name,
            buffer: await response.arrayBuffer()
        }
    }
}
