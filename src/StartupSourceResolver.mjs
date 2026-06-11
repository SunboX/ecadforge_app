import { ViewDeepLinkState } from './ViewDeepLinkState.mjs'

/**
 * Resolves app startup sources from the current browser URL.
 */
export class StartupSourceResolver {
    /**
     * Resolves a URL into a startup source descriptor.
     * @param {string} href Browser URL.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string, document?: string } | null}
     */
    static resolve(href) {
        const url = new URL(String(href || ''), 'https://ecadforge.app/')
        const demoId = StartupSourceResolver.#resolveDemoId(url)
        const view = ViewDeepLinkState.resolveView(url.href)
        const documentPath = ViewDeepLinkState.resolveDocument(url.href)

        if (demoId) {
            return StartupSourceResolver.#withDeepLinkState(
                { type: 'demo', id: demoId },
                view,
                documentPath
            )
        }

        const sourceUrl = String(url.searchParams.get('url') || '').trim()
        if (sourceUrl) {
            return StartupSourceResolver.#withDeepLinkState(
                { type: 'url', url: sourceUrl },
                view,
                documentPath
            )
        }

        const githubPath = String(url.searchParams.get('github') || '').trim()
        if (githubPath) {
            return StartupSourceResolver.#withDeepLinkState(
                {
                    type: 'github',
                    path: githubPath,
                    ref: String(url.searchParams.get('ref') || 'main').trim()
                },
                view,
                documentPath
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
     * Adds requested startup view/document state when the URL carries it.
     * @param {{ type: string, id?: string, url?: string, path?: string, ref?: string }} source Startup source descriptor.
     * @param {string} view Requested view id.
     * @param {string} documentPath Requested document file path.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string, document?: string }}
     */
    static #withDeepLinkState(source, view, documentPath) {
        return {
            ...source,
            ...(view ? { view } : {}),
            ...(documentPath ? { document: documentPath } : {})
        }
    }
}
