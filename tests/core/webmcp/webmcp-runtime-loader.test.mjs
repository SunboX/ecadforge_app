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
 * Verifies the fallback cannot replace native tool descriptors or callbacks.
 */
test('WebMcpRuntimeLoader leaves a usable document model context untouched', async () => {
    const environment = createBrowserEnvironment()
    const native = { registerTool() {} }
    environment.document.modelContext = native
    const existingOptions = { autoInitialize: false }
    environment.window.__webModelContextOptions = existingOptions
    let imports = 0

    const result = await WebMcpRuntimeLoader.initialize(environment, {
        importer: async () => {
            imports += 1
            environment.document.modelContext = { registerTool() {} }
        }
    })

    assert.deepEqual(result, { available: true, imported: false })
    assert.equal(imports, 0)
    assert.equal(environment.document.modelContext, native)
    assert.equal(environment.window.__webModelContextOptions, existingOptions)
})

/**
 * Verifies a partial context does not suppress the package import attempt.
 */
test('WebMcpRuntimeLoader attempts the fallback for an unusable document context', async () => {
    const environment = createBrowserEnvironment()
    environment.document.modelContext = { registerTool: true }
    const fallback = { registerTool() {} }
    let imports = 0

    const result = await WebMcpRuntimeLoader.initialize(environment, {
        importer: async () => {
            imports += 1
            environment.document.modelContext = fallback
        }
    })

    assert.deepEqual(result, { available: true, imported: true })
    assert.equal(imports, 1)
    assert.equal(environment.document.modelContext, fallback)
})

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
