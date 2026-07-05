import { ViewDeepLinkState } from './ViewDeepLinkState.mjs'

/**
 * Keeps browser URLs shareable after opening GitHub-hosted sources.
 */
export class GitHubShareUrlWriter {
    /**
     * Replaces the current address with a root share URL containing `url=`.
     * @param {string} sourceUrl Original GitHub URL supplied by the user.
     * @param {{ history?: History, location?: Location }} [environment]
     * @param {{ viewName?: string, documentPath?: string, componentKey?: string, netName?: string, panelName?: string }} [options] Optional viewer state.
     * @returns {void}
     */
    static update(sourceUrl, environment = globalThis, options = {}) {
        const browserHistory = environment?.history
        const browserLocation = environment?.location

        if (
            !sourceUrl ||
            typeof browserHistory?.replaceState !== 'function' ||
            !browserLocation?.href
        ) {
            return
        }

        browserHistory.replaceState(
            browserHistory.state || null,
            '',
            GitHubShareUrlWriter.build(browserLocation.href, sourceUrl, options)
        )
    }

    /**
     * Builds a shareable ECAD Forge URL for one GitHub source.
     * @param {string} currentHref Current browser URL.
     * @param {string} sourceUrl Original GitHub URL supplied by the user.
     * @param {{ viewName?: string, documentPath?: string, componentKey?: string, netName?: string, panelName?: string }} [options] Optional viewer state.
     * @returns {string}
     */
    static build(currentHref, sourceUrl, options = {}) {
        const shareUrl = new URL(
            String(currentHref || '/'),
            'https://ecadforge.app/'
        )
        shareUrl.pathname = '/'
        shareUrl.hash = ''
        shareUrl.searchParams.delete('demo')
        shareUrl.searchParams.delete('github')
        shareUrl.searchParams.delete('ref')
        shareUrl.searchParams.set('url', String(sourceUrl || '').trim())

        if (GitHubShareUrlWriter.#hasViewOrDocumentOption(options)) {
            return ViewDeepLinkState.build(
                shareUrl.href,
                options.viewName ||
                    ViewDeepLinkState.resolveView(shareUrl.href),
                options
            )
        }

        return shareUrl.href
    }

    /**
     * Returns true when explicit viewer state should be written.
     * @param {{ viewName?: string, documentPath?: string, componentKey?: string, netName?: string, panelName?: string }} options Options.
     * @returns {boolean}
     */
    static #hasViewOrDocumentOption(options) {
        return (
            Object.prototype.hasOwnProperty.call(options || {}, 'viewName') ||
            Object.prototype.hasOwnProperty.call(
                options || {},
                'documentPath'
            ) ||
            Object.prototype.hasOwnProperty.call(
                options || {},
                'componentKey'
            ) ||
            Object.prototype.hasOwnProperty.call(options || {}, 'netName') ||
            Object.prototype.hasOwnProperty.call(options || {}, 'panelName')
        )
    }
}
