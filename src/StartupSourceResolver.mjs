import { ViewDeepLinkState } from './ViewDeepLinkState.mjs'

/**
 * Resolves app startup sources from the current browser URL.
 */
export class StartupSourceResolver {
    /**
     * Resolves a URL into a startup source descriptor.
     * @param {string} href Browser URL.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string } | null}
     */
    static resolve(href) {
        const url = new URL(String(href || ''), 'https://ecadforge.app/')
        const demoId = StartupSourceResolver.#resolveDemoId(url)
        const view = ViewDeepLinkState.resolveView(url.href)

        if (demoId) {
            return StartupSourceResolver.#withView(
                { type: 'demo', id: demoId },
                view
            )
        }

        const sourceUrl = String(url.searchParams.get('url') || '').trim()
        if (sourceUrl) {
            return StartupSourceResolver.#withView(
                { type: 'url', url: sourceUrl },
                view
            )
        }

        const githubPath = String(url.searchParams.get('github') || '').trim()
        if (githubPath) {
            return StartupSourceResolver.#withView(
                {
                    type: 'github',
                    path: githubPath,
                    ref: String(url.searchParams.get('ref') || 'main').trim()
                },
                view
            )
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

    /**
     * Adds a requested startup view when the URL carries one.
     * @param {{ type: string, id?: string, url?: string, path?: string, ref?: string }} source Startup source descriptor.
     * @param {string} view Requested view id.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string }}
     */
    static #withView(source, view) {
        return view ? { ...source, view } : source
    }
}
