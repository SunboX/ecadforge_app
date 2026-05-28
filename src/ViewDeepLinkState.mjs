/**
 * Reads and writes URL state for shareable top-level viewer tabs.
 */
export class ViewDeepLinkState {
    /**
     * Builds the same URL with the active view query parameter applied.
     * @param {string} currentHref Current browser URL.
     * @param {string} viewName Requested top-level viewer tab.
     * @returns {string}
     */
    static build(currentHref, viewName) {
        const normalizedView = ViewDeepLinkState.#sanitizeView(viewName)
        const url = new URL(
            String(currentHref || '/'),
            'https://ecadforge.app/'
        )

        if (normalizedView) {
            url.searchParams.set('view', normalizedView)
        }

        return url.href
    }

    /**
     * Builds a clean root app URL without query parameters or hash state.
     * @param {string} currentHref Current browser URL.
     * @returns {string}
     */
    static buildLanding(currentHref) {
        const url = new URL(
            String(currentHref || '/'),
            'https://ecadforge.app/'
        )
        url.pathname = '/'
        url.search = ''
        url.hash = ''

        return url.href
    }

    /**
     * Replaces the current history entry with a URL for the selected view.
     * @param {string} viewName Requested top-level viewer tab.
     * @param {{ history?: History, location?: Location }} [environment]
     * @returns {void}
     */
    static update(viewName, environment = globalThis) {
        const normalizedView = ViewDeepLinkState.#sanitizeView(viewName)
        const browserHistory = environment?.history
        const browserLocation = environment?.location

        if (
            !normalizedView ||
            typeof browserHistory?.replaceState !== 'function' ||
            !browserLocation?.href
        ) {
            return
        }

        browserHistory.replaceState(
            browserHistory.state || null,
            '',
            ViewDeepLinkState.build(browserLocation.href, normalizedView)
        )
    }

    /**
     * Replaces the current history entry with the clean landing page URL.
     * @param {{ history?: History, location?: Location }} [environment]
     * @returns {void}
     */
    static reset(environment = globalThis) {
        const browserHistory = environment?.history
        const browserLocation = environment?.location

        if (
            typeof browserHistory?.replaceState !== 'function' ||
            !browserLocation?.href
        ) {
            return
        }

        browserHistory.replaceState(
            browserHistory.state || null,
            '',
            ViewDeepLinkState.buildLanding(browserLocation.href)
        )
    }

    /**
     * Resolves a supported view query parameter from a browser URL.
     * @param {string} href Browser URL.
     * @returns {string}
     */
    static resolveView(href) {
        const url = new URL(String(href || '/'), 'https://ecadforge.app/')
        return ViewDeepLinkState.#sanitizeView(url.searchParams.get('view'))
    }

    /**
     * Returns a supported view id, or an empty string when absent/invalid.
     * @param {unknown} value Candidate view id.
     * @returns {string}
     */
    static #sanitizeView(value) {
        const normalized = String(value || '').trim().toLowerCase()
        const supported = new Set([
            'schematic',
            'pcb',
            '3d',
            'bom',
            'diagnostics'
        ])

        return supported.has(normalized) ? normalized : ''
    }
}
