/**
 * Resolves frontend runtime version state from the currently loaded module
 * graph and the latest server metadata.
 */
export class AppRuntimeVersion {
    /**
     * Extracts the loaded asset version from one module URL query string.
     * @param {string} moduleUrl
     * @returns {string}
     */
    static readLoadedVersion(moduleUrl) {
        const normalizedModuleUrl = String(moduleUrl || '').trim()
        if (!normalizedModuleUrl) {
            return ''
        }

        try {
            const parsedUrl = new URL(normalizedModuleUrl)
            return String(parsedUrl.searchParams.get('v') || '').trim()
        } catch (_error) {
            return ''
        }
    }

    /**
     * Chooses the version shown in the UI, preferring the version baked into
     * the loaded module graph over later server metadata.
     * @param {string} loadedVersion
     * @param {string} serverVersion
     * @returns {string}
     */
    static resolveDisplayVersion(loadedVersion, serverVersion) {
        const normalizedLoadedVersion = String(loadedVersion || '').trim()
        if (normalizedLoadedVersion) {
            return normalizedLoadedVersion
        }

        return String(serverVersion || '').trim()
    }

    /**
     * Returns true when the browser is still executing an older module graph
     * than the version currently served by the backend.
     * @param {string} loadedVersion
     * @param {string} serverVersion
     * @param {string} [pageUrl]
     * @returns {boolean}
     */
    static shouldReloadForStaleModules(loadedVersion, serverVersion, pageUrl) {
        const normalizedLoadedVersion = String(loadedVersion || '').trim()
        const normalizedServerVersion = String(serverVersion || '').trim()

        if (
            AppRuntimeVersion.#readReloadVersion(pageUrl) ===
            normalizedServerVersion
        ) {
            return false
        }

        return Boolean(
            normalizedLoadedVersion &&
            normalizedServerVersion &&
            normalizedLoadedVersion !== normalizedServerVersion
        )
    }

    /**
     * Builds one hard-reload URL that changes the page URL itself so the
     * browser cannot keep serving an already-open stale HTML shell.
     * @param {string} pageUrl
     * @param {string} serverVersion
     * @returns {string}
     */
    static buildReloadUrl(pageUrl, serverVersion) {
        const normalizedPageUrl = String(pageUrl || '').trim()
        const normalizedServerVersion = String(serverVersion || '').trim()
        if (!normalizedPageUrl) {
            return normalizedPageUrl
        }

        try {
            const parsedUrl = new URL(normalizedPageUrl)
            parsedUrl.searchParams.set(
                'reload',
                normalizedServerVersion || String(Date.now())
            )
            return parsedUrl.toString()
        } catch (_error) {
            return normalizedPageUrl
        }
    }

    /**
     * Reads the reload version already present on one page URL.
     * @param {string | undefined} pageUrl
     * @returns {string}
     */
    static #readReloadVersion(pageUrl) {
        const normalizedPageUrl = String(pageUrl || '').trim()
        if (!normalizedPageUrl) {
            return ''
        }

        try {
            const parsedUrl = new URL(normalizedPageUrl)
            return String(parsedUrl.searchParams.get('reload') || '').trim()
        } catch (_error) {
            return ''
        }
    }
}
