/**
 * Reads and writes URL state for shareable top-level viewer tabs.
 */
export class ViewDeepLinkState {
    /**
     * Builds the same URL with the active view query parameter applied.
     * @param {string} currentHref Current browser URL.
     * @param {string} viewName Requested top-level viewer tab.
     * @param {{ documentPath?: string, componentKey?: string, netName?: string, panelName?: string }} [options] Optional document, panel, and selection state.
     * @returns {string}
     */
    static build(currentHref, viewName, options = {}) {
        const normalizedView = ViewDeepLinkState.#sanitizeView(viewName)
        const url = new URL(
            String(currentHref || '/'),
            'https://ecadforge.app/'
        )

        if (normalizedView) {
            url.searchParams.set('view', normalizedView)
        }
        ViewDeepLinkState.#applyDocumentPath(url, options)
        ViewDeepLinkState.#applyComponentKey(url, options)
        ViewDeepLinkState.#applyNetName(url, options)
        ViewDeepLinkState.#applyPanelName(url, options)

        return url.href
    }

    /**
     * Builds the same URL with the active document query parameter applied.
     * @param {string} currentHref Current browser URL.
     * @param {string} documentPath Active document file path.
     * @returns {string}
     */
    static buildDocument(currentHref, documentPath) {
        const url = new URL(
            String(currentHref || '/'),
            'https://ecadforge.app/'
        )
        ViewDeepLinkState.#applyDocumentPath(url, { documentPath })

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
     * @param {{ documentPath?: string, componentKey?: string, netName?: string, panelName?: string }} [options] Optional document, panel, and selection state.
     * @returns {void}
     */
    static update(viewName, environment = globalThis, options = {}) {
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
            ViewDeepLinkState.build(
                browserLocation.href,
                normalizedView,
                options
            )
        )
    }

    /**
     * Replaces the current history entry with a URL for the active document.
     * @param {string} documentPath Active document file path.
     * @param {{ history?: History, location?: Location }} [environment]
     * @returns {void}
     */
    static updateDocument(documentPath, environment = globalThis) {
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
            ViewDeepLinkState.buildDocument(browserLocation.href, documentPath)
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
     * Resolves the active document query parameter from a browser URL.
     * @param {string} href Browser URL.
     * @returns {string}
     */
    static resolveDocument(href) {
        const url = new URL(String(href || '/'), 'https://ecadforge.app/')
        return ViewDeepLinkState.#sanitizeDocument(
            url.searchParams.get('document')
        )
    }

    /**
     * Resolves the selected component query parameter from a browser URL.
     * @param {string} href Browser URL.
     * @returns {string}
     */
    static resolveComponent(href) {
        const url = new URL(String(href || '/'), 'https://ecadforge.app/')
        return ViewDeepLinkState.#sanitizeComponent(
            url.searchParams.get('component')
        )
    }

    /**
     * Resolves the selected net query parameter from a browser URL.
     * @param {string} href Browser URL.
     * @returns {string}
     */
    static resolveNet(href) {
        const url = new URL(String(href || '/'), 'https://ecadforge.app/')
        return ViewDeepLinkState.#sanitizeNet(url.searchParams.get('net'))
    }

    /**
     * Resolves the active sidebar panel query parameter from a browser URL.
     * @param {string} href Browser URL.
     * @returns {string}
     */
    static resolvePanel(href) {
        const url = new URL(String(href || '/'), 'https://ecadforge.app/')
        return ViewDeepLinkState.#sanitizePanel(url.searchParams.get('panel'))
    }

    /**
     * Returns a supported view id, or an empty string when absent/invalid.
     * @param {unknown} value Candidate view id.
     * @returns {string}
     */
    static #sanitizeView(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
        const supported = new Set([
            'schematic',
            'pcb',
            '3d',
            'bom',
            'diagnostics'
        ])

        return supported.has(normalized) ? normalized : ''
    }

    /**
     * Applies the optional active document query parameter to a URL.
     * @param {URL} url URL to update.
     * @param {{ documentPath?: string }} options Optional document state.
     * @returns {void}
     */
    static #applyDocumentPath(url, options) {
        if (
            !Object.prototype.hasOwnProperty.call(options || {}, 'documentPath')
        ) {
            return
        }

        const documentPath = ViewDeepLinkState.#sanitizeDocument(
            options.documentPath
        )

        if (documentPath) {
            url.searchParams.set('document', documentPath)
            return
        }

        url.searchParams.delete('document')
    }

    /**
     * Applies the optional selected component query parameter to a URL.
     * @param {URL} url URL to update.
     * @param {{ componentKey?: string }} options Optional component state.
     * @returns {void}
     */
    static #applyComponentKey(url, options) {
        if (
            !Object.prototype.hasOwnProperty.call(options || {}, 'componentKey')
        ) {
            return
        }

        const componentKey = ViewDeepLinkState.#sanitizeComponent(
            options.componentKey
        )

        if (componentKey) {
            url.searchParams.set('component', componentKey)
            return
        }

        url.searchParams.delete('component')
    }

    /**
     * Applies the optional selected net query parameter to a URL.
     * @param {URL} url URL to update.
     * @param {{ netName?: string }} options Optional net state.
     * @returns {void}
     */
    static #applyNetName(url, options) {
        if (!Object.prototype.hasOwnProperty.call(options || {}, 'netName')) {
            return
        }

        const netName = ViewDeepLinkState.#sanitizeNet(options.netName)

        if (netName) {
            url.searchParams.set('net', netName)
            return
        }

        url.searchParams.delete('net')
    }

    /**
     * Applies the optional active sidebar panel query parameter to a URL.
     * @param {URL} url URL to update.
     * @param {{ panelName?: string }} options Optional panel state.
     * @returns {void}
     */
    static #applyPanelName(url, options) {
        if (!Object.prototype.hasOwnProperty.call(options || {}, 'panelName')) {
            return
        }

        const panelName = ViewDeepLinkState.#sanitizePanel(options.panelName)

        if (panelName && panelName !== 'project') {
            url.searchParams.set('panel', panelName)
            return
        }

        url.searchParams.delete('panel')
    }

    /**
     * Returns a URL-safe document path value, or an empty string.
     * @param {unknown} value Candidate document path.
     * @returns {string}
     */
    static #sanitizeDocument(value) {
        return String(value || '').trim()
    }

    /**
     * Returns a URL-safe component key value, or an empty string.
     * @param {unknown} value Candidate component key.
     * @returns {string}
     */
    static #sanitizeComponent(value) {
        return String(value || '').trim()
    }

    /**
     * Returns a URL-safe net name value, or an empty string.
     * @param {unknown} value Candidate net name.
     * @returns {string}
     */
    static #sanitizeNet(value) {
        return String(value || '').trim()
    }

    /**
     * Returns a supported sidebar panel id, or an empty string.
     * @param {unknown} value Candidate sidebar panel id.
     * @returns {string}
     */
    static #sanitizePanel(value) {
        const normalized = String(value || '')
            .trim()
            .toLowerCase()
        const supported = new Set([
            'project',
            'layers',
            'objects',
            'components',
            'nets',
            'properties',
            'model3d',
            'info',
            'preferences',
            'help'
        ])

        return supported.has(normalized) ? normalized : ''
    }
}
