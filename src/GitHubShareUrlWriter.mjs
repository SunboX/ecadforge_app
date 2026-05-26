/**
 * Keeps browser URLs shareable after opening GitHub-hosted sources.
 */
export class GitHubShareUrlWriter {
    /**
     * Replaces the current address with a root share URL containing `url=`.
     * @param {string} sourceUrl Original GitHub URL supplied by the user.
     * @param {{ history?: History, location?: Location }} [environment]
     * @returns {void}
     */
    static update(sourceUrl, environment = globalThis) {
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
            GitHubShareUrlWriter.build(browserLocation.href, sourceUrl)
        )
    }

    /**
     * Builds a shareable ECAD Forge URL for one GitHub source.
     * @param {string} currentHref Current browser URL.
     * @param {string} sourceUrl Original GitHub URL supplied by the user.
     * @returns {string}
     */
    static build(currentHref, sourceUrl) {
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

        return shareUrl.href
    }
}
