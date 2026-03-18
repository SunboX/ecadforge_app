/**
 * Loads deploy-time app metadata from the first available backend endpoint.
 */
export class AppMetaLoader {
    static #endpointPaths = ['/api/app-meta', '/api/app-meta.php']

    /**
     * Resolves the current app version from the active server contract.
     * @param {typeof fetch | undefined} fetchImplementation
     * @returns {Promise<string>}
     */
    static async loadVersion(fetchImplementation = globalThis.fetch) {
        if (typeof fetchImplementation !== 'function') {
            return ''
        }

        for (const endpointPath of AppMetaLoader.#endpointPaths) {
            const version = await AppMetaLoader.#loadEndpointVersion(
                fetchImplementation,
                endpointPath
            )

            if (version) {
                return version
            }
        }

        return ''
    }

    /**
     * Loads one version payload from one metadata endpoint.
     * @param {typeof fetch} fetchImplementation
     * @param {string} endpointPath
     * @returns {Promise<string>}
     */
    static async #loadEndpointVersion(fetchImplementation, endpointPath) {
        try {
            const response = await fetchImplementation(endpointPath, {
                cache: 'no-store'
            })

            if (!response || !response.ok) {
                return ''
            }

            const payload = await response.json()
            return String(payload?.version || '').trim()
        } catch (_error) {
            return ''
        }
    }
}
