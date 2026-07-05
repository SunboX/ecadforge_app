import { ViewDeepLinkState } from './ViewDeepLinkState.mjs'
import { DemoProjectRegistry } from './DemoProjectRegistry.mjs'

/**
 * Resolves app startup sources from the current browser URL.
 */
export class StartupSourceResolver {
    /**
     * Resolves a URL into a startup source descriptor.
     * @param {string} href Browser URL.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string, document?: string, component?: string, net?: string, panel?: string } | null}
     */
    static resolve(href) {
        const url = new URL(String(href || ''), 'https://ecadforge.app/')
        const demoId = StartupSourceResolver.#resolveDemoId(url)
        const view = ViewDeepLinkState.resolveView(url.href)
        const documentPath = ViewDeepLinkState.resolveDocument(url.href)
        const componentKey = ViewDeepLinkState.resolveComponent(url.href)
        const netName = ViewDeepLinkState.resolveNet(url.href)
        const panelName = ViewDeepLinkState.resolvePanel(url.href)

        if (demoId) {
            return StartupSourceResolver.#withDeepLinkState(
                { type: 'demo', id: demoId },
                view,
                documentPath,
                componentKey,
                netName,
                panelName
            )
        }

        const sourceUrl = String(url.searchParams.get('url') || '').trim()
        if (sourceUrl) {
            return StartupSourceResolver.#withDeepLinkState(
                { type: 'url', url: sourceUrl },
                view,
                documentPath,
                componentKey,
                netName,
                panelName
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
                documentPath,
                componentKey,
                netName,
                panelName
            )
        }

        const documentDemoId =
            StartupSourceResolver.#resolveDemoIdByDocumentPath(documentPath)
        if (documentDemoId) {
            return StartupSourceResolver.#withDeepLinkState(
                { type: 'demo', id: documentDemoId },
                view,
                documentPath,
                componentKey,
                netName,
                panelName
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
     * Recovers a bundled demo source from an otherwise source-less document
     * deep link.
     * @param {string} documentPath Requested document path.
     * @returns {string}
     */
    static #resolveDemoIdByDocumentPath(documentPath) {
        const normalizedPath =
            StartupSourceResolver.#normalizeDocumentPath(documentPath)
        if (!normalizedPath) {
            return ''
        }

        const matchingDemoIds = DemoProjectRegistry.list()
            .filter((demo) =>
                demo.files.some((file) =>
                    StartupSourceResolver.#demoFileMatchesDocument(
                        file,
                        normalizedPath
                    )
                )
            )
            .map((demo) => demo.id)

        return matchingDemoIds.length === 1 ? matchingDemoIds[0] : ''
    }

    /**
     * Returns true when a demo file can satisfy one document link.
     * @param {{ name: string, path: string }} file Demo file descriptor.
     * @param {string} normalizedPath Normalized document path.
     * @returns {boolean}
     */
    static #demoFileMatchesDocument(file, normalizedPath) {
        const fileName = StartupSourceResolver.#normalizeDocumentPath(file.name)
        const filePath = StartupSourceResolver.#normalizeDocumentPath(file.path)

        return (
            normalizedPath === fileName ||
            normalizedPath === filePath ||
            normalizedPath.endsWith('/' + fileName)
        )
    }

    /**
     * Normalizes document paths for stable query matching.
     * @param {unknown} value Raw document path.
     * @returns {string}
     */
    static #normalizeDocumentPath(value) {
        return String(value || '')
            .trim()
            .replaceAll('\\', '/')
            .replace(/^\/+/u, '')
            .toLowerCase()
    }

    /**
     * Adds requested startup view/document state when the URL carries it.
     * @param {{ type: string, id?: string, url?: string, path?: string, ref?: string }} source Startup source descriptor.
     * @param {string} view Requested view id.
     * @param {string} documentPath Requested document file path.
     * @param {string} componentKey Requested selected component key.
     * @param {string} netName Requested selected net name.
     * @param {string} panelName Requested sidebar panel id.
     * @returns {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string, document?: string, component?: string, net?: string, panel?: string }}
     */
    static #withDeepLinkState(
        source,
        view,
        documentPath,
        componentKey,
        netName,
        panelName
    ) {
        return {
            ...source,
            ...(view ? { view } : {}),
            ...(documentPath ? { document: documentPath } : {}),
            ...(componentKey ? { component: componentKey } : {}),
            ...(netName ? { net: netName } : {}),
            ...(panelName ? { panel: panelName } : {})
        }
    }
}
