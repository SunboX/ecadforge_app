/**
 * Privacy-safe event wrapper for the host analytics tracker.
 */
export class PrivacySafeAnalytics {
    /** @type {{ trackEvent?: (eventName: string, properties?: object) => void } | null} */
    #tracker

    /** @type {() => ({ trackEvent?: (eventName: string, properties?: object) => void } | null)} */
    #trackerProvider

    /**
     * @param {{ tracker?: { trackEvent?: (eventName: string, properties?: object) => void } | null, trackerProvider?: () => ({ trackEvent?: (eventName: string, properties?: object) => void } | null) }} [dependencies]
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
    }

    /**
     * Emits one allowlisted event with only coarse, non-identifying fields.
     * @param {string} eventName Event name.
     * @param {{ sourceType?: string, formatFamily?: string, errorBucket?: string, activeView?: string }} [properties]
     * @returns {void}
     */
    track(eventName, properties = {}) {
        if (!PrivacySafeAnalytics.#eventNames.has(eventName)) {
            return
        }

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
     * Builds the default analytics adapter from the browser window.
     * @returns {PrivacySafeAnalytics}
     */
    static fromWindow() {
        return new PrivacySafeAnalytics()
    }

    /**
     * Converts allowlisted property names and values to event payload fields.
     * @param {{ sourceType?: string, formatFamily?: string, errorBucket?: string, activeView?: string }} properties Raw properties.
     * @returns {{ source_type?: string, format_family?: string, error_bucket?: string, active_view?: string }}
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
     * Resolves the current tracker, including trackers installed after app
     * bootstrap.
     * @returns {{ trackEvent?: (eventName: string, properties?: object) => void } | null}
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
        'crosslink_pcb_styler_clicked'
    ])

    /** @type {Map<string, string>} */
    static #propertyMap = new Map([
        ['sourceType', 'source_type'],
        ['formatFamily', 'format_family'],
        ['errorBucket', 'error_bucket'],
        ['activeView', 'active_view']
    ])
}
