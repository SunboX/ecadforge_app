import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpRuntimeLoader } from '../../../src/core/webmcp/WebMcpRuntimeLoader.mjs'

/**
 * Builds an isolated browser-like environment for WebMCP runtime tests.
 * @param {string} origin Origin exposed by the fake window.
 * @returns {{ document: object, window: object }}
 */
function createBrowserEnvironment(origin = 'https://ecadforge.app') {
    const documentRef = {}
    const windowRef = {
        location: {
            origin
        }
    }
    windowRef.window = windowRef
    windowRef.parent = windowRef

    return {
        document: documentRef,
        window: windowRef
    }
}

/**
 * Clones JSON-safe test data for assertions.
 * @param {unknown} value Value to clone.
 * @returns {unknown}
 */
function clone(value) {
    return JSON.parse(JSON.stringify(value))
}

/**
 * Verifies the loader configures the package before importing it.
 */
test('WebMcpRuntimeLoader configures same-origin runtime options before package import', async () => {
    const environment = createBrowserEnvironment()
    const imports = []
    const result = await WebMcpRuntimeLoader.initialize(environment, {
        importer: async (specifier) => {
            imports.push({
                specifier,
                options: clone(environment.window.__webModelContextOptions)
            })
            environment.document.modelContext = {
                registerTool() {}
            }
        }
    })

    assert.deepEqual(imports, [
        {
            specifier: '@mcp-b/global/iife',
            options: {
                autoInitialize: true,
                nativeModelContextBehavior: 'preserve',
                installTestingShim: 'if-missing',
                transport: {
                    tabServer: {
                        allowedOrigins: ['https://ecadforge.app']
                    },
                    iframeServer: {
                        allowedOrigins: ['https://ecadforge.app']
                    }
                }
            }
        }
    ])
    assert.deepEqual(result, {
        available: true,
        imported: true
    })
})

/**
 * Verifies non-browser runtimes do not import browser-only WebMCP code.
 */
test('WebMcpRuntimeLoader no-ops outside browser environments', async () => {
    const imports = []
    const result = await WebMcpRuntimeLoader.initialize(
        {},
        {
            importer: async (specifier) => {
                imports.push(specifier)
            }
        }
    )

    assert.deepEqual(imports, [])
    assert.deepEqual(result, {
        available: false,
        imported: false
    })
})
