/**
 * Resolves app startup sources from the current browser URL.
 */
export class StartupSourceResolver {
    /**
     * Resolves a URL into a startup source descriptor.
     * @param {string} href Browser URL.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string } | null}
     */
    static resolve(href) {
        const url = new URL(String(href || ''), 'https://ecadforge.app/')
        const demoId = StartupSourceResolver.#resolveDemoId(url)

        if (demoId) {
            return { type: 'demo', id: demoId }
        }

        const sourceUrl = String(url.searchParams.get('url') || '').trim()
        if (sourceUrl) {
            return { type: 'url', url: sourceUrl }
        }

        const githubPath = String(url.searchParams.get('github') || '').trim()
        if (githubPath) {
            return {
                type: 'github',
                path: githubPath,
                ref: String(url.searchParams.get('ref') || 'main').trim()
            }
        }

        return null
    }

    /**
     * Resolves a demo id from route or query input.
     * @param {URL} url Parsed URL.
     * @returns {string}
     */
    static #resolveDemoId(url) {
        const queryDemoId = String(url.searchParams.get('demo') || '')
            .trim()
            .toLowerCase()
        if (queryDemoId) {
            return queryDemoId
        }

        const routeMatch = url.pathname.match(/^\/demo\/([^/]+)\/?$/i)
        return routeMatch ? routeMatch[1].toLowerCase() : ''
    }
}
