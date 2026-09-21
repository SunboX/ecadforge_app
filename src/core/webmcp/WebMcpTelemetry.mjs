/** Records bounded provider observations without changing tool behavior. */
export class WebMcpTelemetry {
    #analytics
    #now
    #getSnapshot
    #pageSessionId
    #appVersion
    #sequence = 0
    #runtimeSource = 'unknown'

    /** @param {object} dependencies Analytics, clock and loaded-session access. */
    constructor(dependencies = {}) {
        this.#analytics = dependencies.analytics
        this.#now = dependencies.now || (() => globalThis.performance.now())
        this.#getSnapshot = dependencies.getSnapshot
        this.#pageSessionId =
            dependencies.pageSessionId || globalThis.crypto?.randomUUID?.()
        this.#appVersion = dependencies.appVersion
    }

    /** @param {{ available?: boolean, imported?: boolean }} runtime Loader result. */
    setRuntime(runtime = {}) {
        this.#runtimeSource =
            runtime.available === false
                ? 'unavailable'
                : runtime.imported === true
                  ? 'fallback'
                  : runtime.available === true
                    ? 'native'
                    : 'unknown'
    }

    /** Emits metadata only; analytics is never part of tool success or failure. */
    track(name, properties = {}) {
        try {
            const pending = this.#analytics?.track?.(name, {
                runtimeSource: this.#runtimeSource,
                ...(this.#pageSessionId
                    ? { pageSessionId: this.#pageSessionId }
                    : {}),
                ...(this.#appVersion ? { appVersion: this.#appVersion } : {}),
                ...properties
            })
            pending?.catch?.(() => {})
        } catch (_error) {
            // A blocked or broken tracker must leave provider behavior intact.
        }
    }

    /** Executes once, correlating start and completion without retaining arguments. */
    async execute(tool, apiForm, args, executionOptions) {
        const start = this.#time()
        const properties = {
            methodName: tool.name,
            apiForm,
            callSequence: ++this.#sequence,
            ...WebMcpTelemetry.#queryShape(args),
            ...this.#sessionShape()
        }
        this.track('webmcp_tool_started', {
            ...properties,
            resultStatus: 'started'
        })
        try {
            const result = await tool.handler(args, executionOptions)
            this.track('webmcp_tool_called', {
                ...properties,
                durationMs: this.#duration(start),
                ...WebMcpTelemetry.#observeResult(result)
            })
            return result
        } catch (error) {
            this.track('webmcp_tool_called', {
                ...properties,
                durationMs: this.#duration(start),
                ...WebMcpTelemetry.#observeError(error, executionOptions)
            })
            throw error
        }
    }

    /** Contains all result inspection so getters cannot alter provider outcomes. */
    static #observeResult(result) {
        let failed = false
        try {
            failed = Boolean(
                result &&
                typeof result === 'object' &&
                (result.error || result.isError === true)
            )
            return {
                resultStatus: failed ? 'error' : 'success',
                errorBucket: failed
                    ? this.#errorBucket(result.error, 'tool_error')
                    : 'none',
                ...this.#resultShape(result, failed)
            }
        } catch (_error) {
            return {
                resultStatus: failed ? 'error' : 'success',
                errorBucket: failed ? 'tool_error' : 'none',
                resultShape: failed ? 'error' : 'unknown'
            }
        }
    }

    /** Contains all exception inspection so the original rejection is preserved. */
    static #observeError(error, options) {
        try {
            const cancelled = this.#isCancellation(error, options)
            return {
                resultStatus: cancelled ? 'cancelled' : 'error',
                errorBucket: cancelled
                    ? 'cancelled'
                    : this.#errorBucket(error, 'exception'),
                resultShape: 'error'
            }
        } catch (_error) {
            return {
                resultStatus: 'error',
                errorBucket: 'exception',
                resultShape: 'error'
            }
        }
    }

    /** Reads only coarse loaded-session size; snapshot failures are non-fatal. */
    #sessionShape() {
        try {
            const documents = this.#getSnapshot?.()?.documents
            return Array.isArray(documents)
                ? { documentCount: Math.min(documents.length, 1000000) }
                : {}
        } catch (_error) {
            return {}
        }
    }

    /** Returns monotonic time without making the clock a provider dependency. */
    #time() {
        try {
            const value = this.#now()
            return typeof value === 'number' && Number.isFinite(value)
                ? value
                : 0
        } catch (_error) {
            return 0
        }
    }

    /** Bounds elapsed milliseconds. */
    #duration(start) {
        return Math.max(
            0,
            Math.min(3600000, Math.round(this.#time() - start) || 0)
        )
    }

    /** Describes query options without recording a single selector/filter value. */
    static #queryShape(args) {
        try {
            return {
                designSelector: !args?.design
                    ? 'default'
                    : typeof args.design === 'string' &&
                        args.design.trim().toLowerCase() === 'active'
                      ? 'active'
                      : 'selected',
                queryMode: args?.compact === true ? 'compact' : 'default',
                pagination:
                    Number(args?.offset) > 0
                        ? 'later_page'
                        : args?.limit !== undefined ||
                            args?.offset !== undefined
                          ? 'first_page'
                          : 'none',
                hasLimit:
                    args?.limit !== undefined ||
                    args?.max_results !== undefined ||
                    args?.max_issues !== undefined
                        ? 'yes'
                        : 'no',
                hasFilter: [
                    'pattern',
                    'query',
                    'type',
                    'refdes',
                    'net_name',
                    'pin_name',
                    'mpn',
                    'skip_types'
                ].some((key) => args?.[key] !== undefined)
                    ? 'yes'
                    : 'no',
                includeDns:
                    args?.include_dns === true
                        ? 'yes'
                        : args?.include_dns === false
                          ? 'no'
                          : 'default'
            }
        } catch (_error) {
            return {}
        }
    }

    /** Counts only immediate list fields, never serializing or walking result contents. */
    static #resultShape(result, failed) {
        if (failed) return { resultShape: 'error' }
        const list = Array.isArray(result)
            ? result
            : result && typeof result === 'object'
              ? [
                    'components',
                    'nets',
                    'items',
                    'rows',
                    'diagnostics',
                    'issues',
                    'rules',
                    'pins',
                    'connections'
                ]
                    .map((key) => result[key])
                    .find(Array.isArray)
              : null
        if (list)
            return {
                resultShape: list.length ? 'list' : 'empty',
                resultCount: Math.min(list.length, 1000000)
            }
        return {
            resultShape:
                result && typeof result === 'object' ? 'object' : 'unknown'
        }
    }

    /** Recognizes genuine cancellation while preserving arbitrary native abort reasons. */
    static #isCancellation(error, options) {
        try {
            const signal = options?.signal
            const getter = Object.getOwnPropertyDescriptor(
                globalThis.AbortSignal?.prototype || {},
                'aborted'
            )?.get
            if (
                signal &&
                getter &&
                Reflect.apply(getter, signal, []) &&
                signal.reason === error
            )
                return true
        } catch (_error) {
            // Invalid signal lookalikes are errors, not cancellations.
        }
        return error instanceof Error && error.name === 'AbortError'
    }

    /** Classifies generic query diagnostics locally; message text never leaves the page. */
    static #errorBucket(error, fallback) {
        const message =
            typeof error === 'string'
                ? error
                : error instanceof Error
                  ? error.message
                  : ''
        if (/no design is loaded/i.test(message)) return 'no_design'
        if (
            /design.*(?:not found|ambiguous|did not match)|(?:unknown|missing) design/i.test(
                message
            )
        )
            return 'design_not_found'
        if (/unsupported.*format/i.test(message)) return 'unsupported_format'
        if (
            /no (?:loaded )?(?:schematic|pcb)|no schematic connectivity/i.test(
                message
            )
        )
            return 'missing_data'
        if (
            /required|invalid|pattern|regex|regular expression|match every|must be/i.test(
                message
            )
        )
            return 'invalid_input'
        if (/not found|no matching/i.test(message)) return 'not_found'
        return fallback
    }
}
