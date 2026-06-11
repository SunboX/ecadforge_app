import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'

const originalDocument = globalThis.document
const originalNavigator = globalThis.navigator

/**
 * Builds one fake app snapshot for adapter tool calls.
 * @returns {object}
 */
function createSnapshot() {
    return {
        activeDocumentId: 'doc-1',
        documents: [
            {
                id: 'doc-1',
                documentModel: {
                    fileName: 'logic.SchDoc',
                    kind: 'schematic',
                    summary: { title: 'Logic Sheet' },
                    schematic: {
                        components: [{ designator: 'U1', value: 'controller' }],
                        nets: [
                            {
                                name: 'I2C_SDA',
                                pins: [
                                    {
                                        refdes: 'U1',
                                        designator: '5',
                                        name: 'SDA'
                                    }
                                ]
                            }
                        ]
                    },
                    bom: [
                        {
                            designators: ['U1'],
                            pattern: 'MCU-FAKE-48',
                            source: 'IC MCU fake 48QFN',
                            value: 'controller'
                        }
                    ]
                }
            }
        ]
    }
}

/**
 * Builds a fake object-form model context.
 * @param {{ throwFor?: string }} [options] Options.
 * @returns {{ calls: object[], modelContext: { registerTool: (tool: object, options?: object) => void } }}
 */
function createObjectModelContext(options = {}) {
    const calls = []
    return {
        calls,
        modelContext: {
            registerTool(tool, registrationOptions) {
                if (tool.name === options.throwFor) {
                    throw new Error('registration failed')
                }
                calls.push({
                    tool,
                    registrationOptions
                })
            }
        }
    }
}

/**
 * Builds a fake legacy positional model context.
 * @param {{ throwFor?: string }} [options] Options.
 * @returns {{ calls: object[], modelContext: { registerTool: (name: string, descriptor: object, handler: Function) => void } }}
 */
function createLegacyModelContext(options = {}) {
    const calls = []
    return {
        calls,
        modelContext: {
            registerTool(name, descriptor, handler) {
                if (name === options.throwFor) {
                    throw new Error('registration failed')
                }
                calls.push({
                    name,
                    descriptor,
                    handler
                })
            }
        }
    }
}

/**
 * Replaces one global object for the duration of one test.
 * @param {string} property Property name.
 * @param {unknown} value Replacement value.
 * @returns {void}
 */
function setGlobalProperty(property, value) {
    Object.defineProperty(globalThis, property, {
        configurable: true,
        value
    })
}

/**
 * Verifies unsupported browsers keep the app unchanged.
 */
test('WebMcpAdapter no-ops when native support is unavailable', () => {
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: null
    })

    assert.deepEqual(adapter.initialize(), {
        available: false,
        registered: 0,
        failed: 0
    })
})

/**
 * Verifies all loaded-session tools are registered with the current object API.
 */
test('WebMcpAdapter registers tools with object-form native model context', async () => {
    const fake = createObjectModelContext()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext
    })

    const result = adapter.initialize()
    const toolNames = fake.calls.map((call) => call.tool.name)

    assert.equal(result.available, true)
    assert.equal(result.registered, 28)
    assert.deepEqual(toolNames, [
        'list_designs',
        'list_components',
        'list_nets',
        'review_design',
        'audit_design',
        'crossref_net',
        'compare_schematic_pcb',
        'summarize_design',
        'find_components',
        'query_bom_item',
        'list_pin_connections',
        'query_net',
        'list_component_types',
        'list_diagnostics',
        'compare_bom_pcb',
        'list_single_pin_nets',
        'query_pcb_component',
        'query_pcb_net',
        'summarize_pcb',
        'list_design_rules',
        'review_fabrication_readiness',
        'search_nets',
        'search_components_by_refdes',
        'search_components_by_mpn',
        'search_component_descriptions',
        'query_component',
        'query_xnet_by_net_name',
        'query_xnet_by_pin_name'
    ])

    const listNets = fake.calls.find((call) => call.tool.name === 'list_nets')
    assert.deepEqual(listNets.tool.annotations, {
        readOnlyHint: true,
        untrustedContentHint: true
    })
    assert.deepEqual(await listNets.tool.execute({}), { nets: ['I2C_SDA'] })
})

/**
 * Verifies the adapter prefers the current document-scoped API when available.
 */
test('WebMcpAdapter prefers document model context over deprecated navigator context', () => {
    const documentContext = createObjectModelContext()
    const navigatorContext = createObjectModelContext()
    setGlobalProperty('document', {
        modelContext: documentContext.modelContext
    })
    setGlobalProperty('navigator', {
        modelContext: navigatorContext.modelContext
    })

    try {
        const adapter = new WebMcpAdapter({ getSnapshot: createSnapshot })
        const result = adapter.initialize()

        assert.equal(result.registered, 28)
        assert.equal(documentContext.calls.length, 28)
        assert.equal(navigatorContext.calls.length, 0)
    } finally {
        setGlobalProperty('document', originalDocument)
        setGlobalProperty('navigator', originalNavigator)
    }
})

/**
 * Verifies the adapter does not rely on the deprecated navigator-scoped API.
 */
test('WebMcpAdapter ignores deprecated navigator-only model context', () => {
    const navigatorContext = createObjectModelContext()
    setGlobalProperty('document', {})
    setGlobalProperty('navigator', {
        modelContext: navigatorContext.modelContext
    })

    try {
        const adapter = new WebMcpAdapter({ getSnapshot: createSnapshot })
        const result = adapter.initialize()

        assert.deepEqual(result, {
            available: false,
            registered: 0,
            failed: 0
        })
        assert.equal(navigatorContext.calls.length, 0)
    } finally {
        setGlobalProperty('document', originalDocument)
        setGlobalProperty('navigator', originalNavigator)
    }
})

/**
 * Verifies legacy browser registrations still receive MCP text content.
 */
test('WebMcpAdapter supports legacy positional model context', async () => {
    const fake = createLegacyModelContext()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext
    })

    const result = adapter.initialize()
    const listNets = fake.calls.find((call) => call.name === 'list_nets')
    const response = await listNets.handler({})

    assert.equal(result.registered, 28)
    assert.deepEqual(response, {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ nets: ['I2C_SDA'] }, null, 2)
            }
        ]
    })
})

/**
 * Verifies one failed tool registration does not block the rest.
 */
test('WebMcpAdapter continues after one registration failure', () => {
    const fake = createObjectModelContext({ throwFor: 'list_nets' })
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext
    })

    const result = adapter.initialize()

    assert.equal(result.available, true)
    assert.equal(result.registered, 27)
    assert.equal(result.failed, 1)
    assert.equal(
        fake.calls.some((call) => call.tool.name === 'query_component'),
        true
    )
})
