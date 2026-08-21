/**
 * Privacy-safe event wrapper for the host analytics tracker.
 */
export class PrivacySafeAnalytics {
    /** @type {{ trackEvent?: (eventName: string, properties?: object) => void, setContext?: (context: object) => void } | null} */
    #tracker

    /** @type {() => ({ trackEvent?: (eventName: string, properties?: object) => void, setContext?: (context: object) => void } | null)} */
    #trackerProvider

    /** @type {Record<string, string|number>} */
    #context

    /**
     * @param {{ tracker?: { trackEvent?: (eventName: string, properties?: object) => void, setContext?: (context: object) => void } | null, trackerProvider?: () => ({ trackEvent?: (eventName: string, properties?: object) => void, setContext?: (context: object) => void } | null) }} [dependencies]
     */
    constructor(dependencies = {}) {
        const hasStaticTracker = Object.hasOwn(dependencies, 'tracker')
        this.#tracker = hasStaticTracker ? dependencies.tracker : null
        this.#trackerProvider =
            typeof dependencies.trackerProvider === 'function'
                ? dependencies.trackerProvider
                : hasStaticTracker
                  ? () => null
                  : () => globalThis.window?.AnalyticsTracker || null
        this.#context = {}
    }

    /**
     * Emits one allowlisted event with only coarse, non-identifying fields.
     * @param {string} eventName Event name.
     * @param {{ sourceType?: string, formatFamily?: string, errorBucket?: string, activeView?: string, methodName?: string, apiForm?: string, resultStatus?: string }} [properties]
     * @returns {void}
     */
    track(eventName, properties = {}) {
        if (!PrivacySafeAnalytics.#eventNames.has(eventName)) {
            return
        }

        this.setContext(properties)

        const tracker = this.#resolveTracker()
        if (typeof tracker?.trackEvent !== 'function') {
            return
        }

        tracker.trackEvent(
            eventName,
            PrivacySafeAnalytics.#buildSafeProperties(properties)
        )
    }

    /**
     * Retains and publishes allowlisted runtime context for later errors.
     * @param {{ appVersion?: string, runtimePhase?: string, sourceType?: string, formatFamily?: string, activeView?: string, documentCount?: number, traceComputations?: number, traceDependencies?: number, traceReaderEdges?: number }} [context]
     * @returns {void}
     */
    setContext(context = {}) {
        this.#context = {
            ...this.#context,
            ...PrivacySafeAnalytics.#buildSafeContext(context)
        }
        this.syncContext()
    }

    /**
     * Publishes retained context when the central tracker is available.
     * @returns {boolean} Whether context was delivered.
     */
    syncContext() {
        const tracker = this.#resolveTracker()
        if (typeof tracker?.setContext !== 'function') {
            return false
        }

        tracker.setContext({ ...this.#context })
        return true
    }

    /**
     * Builds the default analytics adapter from the browser window.
     * @returns {PrivacySafeAnalytics}
     */
    static fromWindow() {
        return new PrivacySafeAnalytics()
    }

    /**
     * Converts allowlisted property names and values to event payload fields.
     * @param {{ sourceType?: string, formatFamily?: string, errorBucket?: string, activeView?: string, methodName?: string, apiForm?: string, resultStatus?: string }} properties Raw properties.
     * @returns {{ source_type?: string, format_family?: string, error_bucket?: string, active_view?: string, method_name?: string, api_form?: string, result_status?: string }}
     */
    static #buildSafeProperties(properties) {
        const safeProperties = {}
        PrivacySafeAnalytics.#propertyMap.forEach((targetKey, sourceKey) => {
            const safeValue = PrivacySafeAnalytics.#sanitizeValue(
                properties[sourceKey]
            )

            if (safeValue) {
                safeProperties[targetKey] = safeValue
            }
        })

        return safeProperties
    }

    /**
     * Converts allowlisted runtime context to tracker payload fields.
     * @param {{ appVersion?: string, runtimePhase?: string, sourceType?: string, formatFamily?: string, activeView?: string, documentCount?: number, traceComputations?: number, traceDependencies?: number, traceReaderEdges?: number }} context Raw runtime context.
     * @returns {Record<string, string|number>}
     */
    static #buildSafeContext(context) {
        const safeContext = {}
        PrivacySafeAnalytics.#contextStringMap.forEach(
            (targetKey, sourceKey) => {
                const safeValue = PrivacySafeAnalytics.#sanitizeValue(
                    context[sourceKey]
                )
                if (safeValue) {
                    safeContext[targetKey] = safeValue
                }
            }
        )
        PrivacySafeAnalytics.#contextNumberMap.forEach(
            (targetKey, sourceKey) => {
                const safeValue = PrivacySafeAnalytics.#sanitizeNumber(
                    context[sourceKey]
                )
                if (safeValue !== null) {
                    safeContext[targetKey] = safeValue
                }
            }
        )

        return safeContext
    }

    /**
     * Normalizes a low-cardinality analytics value.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #sanitizeValue(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/[^a-z0-9_-]/g, '_')
            .slice(0, 48)
    }

    /**
     * Normalizes one bounded non-negative counter.
     * @param {unknown} value Raw value.
     * @returns {number|null}
     */
    static #sanitizeNumber(value) {
        if (value === '' || value === null || value === undefined) {
            return null
        }

        const number = Number(value)
        if (!Number.isFinite(number) || number < 0) {
            return null
        }

        return Math.min(Math.round(number), 1000000)
    }

    /**
     * Resolves the current tracker, including trackers installed after app
     * bootstrap.
     * @returns {{ trackEvent?: (eventName: string, properties?: object) => void, setContext?: (context: object) => void } | null}
     */
    #resolveTracker() {
        return this.#tracker || this.#trackerProvider()
    }

    /** @type {Set<string>} */
    static #eventNames = new Set([
        'landing_view',
        'sample_kicad_clicked',
        'sample_altium_clicked',
        'sample_loaded_success',
        'sample_loaded_error',
        'local_file_open_clicked',
        'local_file_loaded_success',
        'local_file_loaded_error',
        'github_url_open_attempted',
        'github_url_loaded_success',
        'github_url_loaded_error',
        'view_schematic_opened',
        'view_pcb_opened',
        'view_3d_opened',
        'view_bom_opened',
        'view_diagnostics_opened',
        'crosslink_pcb_styler_clicked',
        'webmcp_available',
        'webmcp_tool_registration_failed',
        'webmcp_tool_called'
    ])

    /** @type {Map<string, string>} */
    static #propertyMap = new Map([
        ['sourceType', 'source_type'],
        ['formatFamily', 'format_family'],
        ['errorBucket', 'error_bucket'],
        ['activeView', 'active_view'],
        ['methodName', 'method_name'],
        ['apiForm', 'api_form'],
        ['resultStatus', 'result_status']
    ])

    /** @type {Map<string, string>} */
    static #contextStringMap = new Map([
        ['appVersion', 'app_version'],
        ['runtimePhase', 'runtime_phase'],
        ['sourceType', 'source_type'],
        ['formatFamily', 'format_family'],
        ['activeView', 'active_view']
    ])

    /** @type {Map<string, string>} */
    static #contextNumberMap = new Map([
        ['documentCount', 'document_count'],
        ['traceComputations', 'trace_computations'],
        ['traceDependencies', 'trace_dependencies'],
        ['traceReaderEdges', 'trace_reader_edges']
    ])
}
