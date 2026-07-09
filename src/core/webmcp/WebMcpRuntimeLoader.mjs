const runtimeSpecifier = '@mcp-b/global/iife'

/**
 * Imports the package runtime through a literal specifier so deploy rewriting
 * can add the current app version to the emitted asset URL.
 * @returns {Promise<unknown>}
 */
const importRuntime = () => import('@mcp-b/global/iife')

/**
 * Loads the packaged WebMCP runtime before ECAD Forge registers app tools.
 */
export class WebMcpRuntimeLoader {
    /**
     * Configures and imports the browser WebMCP runtime.
     * @param {object} [environment=globalThis] Browser-like environment.
     * @param {{ importer?: (specifier: string) => Promise<unknown>, specifier?: string }} [options] Loader options.
     * @returns {Promise<{ available: boolean, imported: boolean }>}
     */
    static async initialize(environment = globalThis, options = {}) {
        const browser = WebMcpRuntimeLoader.#resolveBrowser(environment)
        if (!browser) {
            return { available: false, imported: false }
        }

        WebMcpRuntimeLoader.configureOptions(browser.window)

        try {
            if (options.importer) {
                await options.importer(options.specifier || runtimeSpecifier)
            } else {
                await importRuntime()
            }
        } catch (error) {
            WebMcpRuntimeLoader.#warnImportFailure(browser.window, error)
            return { available: false, imported: false }
        }

        return {
            available: Boolean(browser.document.modelContext),
            imported: true
        }
    }

    /**
     * Writes package options before the runtime bundle auto-initializes.
     * @param {object} windowRef Browser window.
     * @returns {object}
     */
    static configureOptions(windowRef) {
        const origin = WebMcpRuntimeLoader.#resolveOrigin(windowRef)
        const existingOptions =
            WebMcpRuntimeLoader.#readExistingOptions(windowRef)
        const nextOptions = WebMcpRuntimeLoader.#buildRuntimeOptions(
            origin,
            existingOptions
        )

        windowRef.__webModelContextOptions = nextOptions
        return nextOptions
    }

    /**
     * Returns the browser window and document from an injected environment.
     * @param {object} environment Browser-like environment.
     * @returns {{ window: object, document: object } | null}
     */
    static #resolveBrowser(environment) {
        const windowRef = environment?.window || environment || null
        const documentRef = environment?.document || windowRef?.document || null

        if (!windowRef || !documentRef) {
            return null
        }

        return {
            window: windowRef,
            document: documentRef
        }
    }

    /**
     * Reads pre-existing package options when another script already set them.
     * @param {object} windowRef Browser window.
     * @returns {object}
     */
    static #readExistingOptions(windowRef) {
        const options = windowRef.__webModelContextOptions
        if (!options || typeof options !== 'object' || Array.isArray(options)) {
            return {}
        }

        return options
    }

    /**
     * Builds safe package options for the current page origin.
     * @param {string} origin Page origin.
     * @param {object} existingOptions Existing package options.
     * @returns {object}
     */
    static #buildRuntimeOptions(origin, existingOptions) {
        const transport =
            existingOptions.transport &&
            typeof existingOptions.transport === 'object'
                ? existingOptions.transport
                : {}

        return {
            ...existingOptions,
            autoInitialize: true,
            nativeModelContextBehavior: 'preserve',
            installTestingShim:
                existingOptions.installTestingShim || 'if-missing',
            transport: {
                ...transport,
                tabServer: WebMcpRuntimeLoader.#sameOriginTransportOptions(
                    origin,
                    transport.tabServer
                ),
                iframeServer: WebMcpRuntimeLoader.#sameOriginTransportOptions(
                    origin,
                    transport.iframeServer
                )
            }
        }
    }

    /**
     * Combines existing transport options with a same-origin allowlist.
     * @param {string} origin Page origin.
     * @param {object | boolean | undefined} existingTransport Existing options.
     * @returns {object}
     */
    static #sameOriginTransportOptions(origin, existingTransport) {
        const transport =
            existingTransport &&
            typeof existingTransport === 'object' &&
            !Array.isArray(existingTransport)
                ? existingTransport
                : {}

        return {
            ...transport,
            allowedOrigins: [origin]
        }
    }

    /**
     * Resolves the current page origin without falling back to a wildcard.
     * @param {object} windowRef Browser window.
     * @returns {string}
     */
    static #resolveOrigin(windowRef) {
        const location = windowRef.location || {}
        const origin = String(location.origin || '').trim()
        if (origin && origin !== 'null') {
            return origin
        }

        const href = String(location.href || '').trim()
        if (href) {
            try {
                return new URL(href).origin
            } catch (_error) {
                return 'null'
            }
        }

        return 'null'
    }

    /**
     * Logs a non-fatal import failure when a console is available.
     * @param {object} windowRef Browser window.
     * @param {unknown} error Import failure.
     * @returns {void}
     */
    static #warnImportFailure(windowRef, error) {
        if (typeof windowRef.console?.warn === 'function') {
            windowRef.console.warn(
                '[WebMCP] Runtime package could not be loaded.',
                error
            )
        }
    }
}
