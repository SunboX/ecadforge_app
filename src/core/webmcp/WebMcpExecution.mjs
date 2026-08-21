const abortedGetter = Object.getOwnPropertyDescriptor(
    globalThis.AbortSignal?.prototype || {},
    'aborted'
)?.get
const reasonGetter = Object.getOwnPropertyDescriptor(
    globalThis.AbortSignal?.prototype || {},
    'reason'
)?.get

/**
 * Validates cancellation state at synchronous WebMCP execution boundaries.
 */
export class WebMcpExecution {
    /**
     * Throws when the optional genuine AbortSignal has already been aborted.
     * @param {{ signal?: AbortSignal | null } | null} [executionOptions] Execution options.
     * @returns {void}
     */
    static throwIfAborted(executionOptions = {}) {
        const signal = executionOptions?.signal
        if (signal === undefined || signal === null) return
        if (!abortedGetter) {
            throw new TypeError('AbortSignal state is unavailable.')
        }

        let aborted = false
        try {
            aborted = Boolean(Reflect.apply(abortedGetter, signal, []))
        } catch (_error) {
            throw new TypeError('WebMCP signal must be an AbortSignal.')
        }
        if (!aborted) return

        if (reasonGetter) {
            const reason = Reflect.apply(reasonGetter, signal, [])
            if (reason !== undefined) throw reason
        }
        throw new DOMException('The operation was aborted.', 'AbortError')
    }
}
