/**
 * Installs the centralized analytics tracker only for deployed browser origins.
 */
export class AnalyticsTrackerLoader {
    static #siteKey = 'ecadforge_app'
    static #trackerSelector = 'script[data-analytics-tracker="ecadforge"]'
    static #trackerUrl = 'https://analytics.andrefiedler.de/tracker.js'

    /**
     * Appends the analytics tracker script when the current origin should send
     * production-key analytics.
     * @param {Document} [documentObject] Browser document.
     * @param {Location | URL | string} [locationObject] Browser location.
     * @returns {boolean}
     */
    static loadBrowserTracker(
        documentObject = globalThis.document,
        locationObject = globalThis.location
    ) {
        if (
            !documentObject?.head ||
            typeof documentObject.createElement !== 'function' ||
            !AnalyticsTrackerLoader.shouldLoadForLocation(locationObject) ||
            AnalyticsTrackerLoader.#hasExistingTrackerScript(documentObject)
        ) {
            return false
        }

        documentObject.head.appendChild(
            AnalyticsTrackerLoader.#createTrackerScript(documentObject)
        )
        return true
    }

    /**
     * Returns whether analytics should be enabled for one browser location.
     * @param {Location | URL | string} locationObject Browser location.
     * @returns {boolean}
     */
    static shouldLoadForLocation(locationObject) {
        const protocol =
            AnalyticsTrackerLoader.#protocolForLocation(locationObject)
        if (protocol !== 'http:' && protocol !== 'https:') {
            return false
        }

        return !AnalyticsTrackerLoader.#isLocalHostname(
            AnalyticsTrackerLoader.#hostnameForLocation(locationObject)
        )
    }

    /**
     * Creates the external tracker script node.
     * @param {Document} documentObject Browser document.
     * @returns {HTMLScriptElement}
     */
    static #createTrackerScript(documentObject) {
        const script = documentObject.createElement('script')
        script.async = false
        script.defer = true
        script.src = AnalyticsTrackerLoader.#trackerUrl
        script.dataset.analyticsTracker = 'ecadforge'
        script.dataset.site = AnalyticsTrackerLoader.#siteKey
        return script
    }

    /**
     * Returns whether a tracker script has already been installed.
     * @param {Document} documentObject Browser document.
     * @returns {boolean}
     */
    static #hasExistingTrackerScript(documentObject) {
        return Boolean(
            documentObject.querySelector?.(
                AnalyticsTrackerLoader.#trackerSelector
            )
        )
    }

    /**
     * Extracts a hostname from URL-like input.
     * @param {Location | URL | string} locationObject Browser location.
     * @returns {string}
     */
    static #hostnameForLocation(locationObject) {
        if (typeof locationObject === 'string') {
            return new URL(locationObject, 'http://localhost').hostname
        }

        return String(locationObject?.hostname || '')
    }

    /**
     * Extracts a protocol from URL-like input.
     * @param {Location | URL | string} locationObject Browser location.
     * @returns {string}
     */
    static #protocolForLocation(locationObject) {
        if (typeof locationObject === 'string') {
            return new URL(locationObject, 'http://localhost').protocol
        }

        return String(locationObject?.protocol || '')
    }

    /**
     * Returns whether a hostname represents a local or private dev origin.
     * @param {string} hostname Hostname.
     * @returns {boolean}
     */
    static #isLocalHostname(hostname) {
        const normalizedHostname = String(hostname || '')
            .trim()
            .toLowerCase()
            .replace(/^\[|\]$/g, '')

        if (
            !normalizedHostname ||
            normalizedHostname === 'localhost' ||
            normalizedHostname === '::1' ||
            normalizedHostname === '0.0.0.0' ||
            normalizedHostname.endsWith('.localhost') ||
            normalizedHostname.endsWith('.local') ||
            normalizedHostname.endsWith('.test')
        ) {
            return true
        }

        return (
            /^127(?:\.\d{1,3}){3}$/.test(normalizedHostname) ||
            /^10\./.test(normalizedHostname) ||
            /^192\.168\./.test(normalizedHostname) ||
            /^172\.(?:1[6-9]|2\d|3[0-1])\./.test(normalizedHostname)
        )
    }
}
