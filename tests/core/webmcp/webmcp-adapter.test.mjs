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
 * Builds a fake promise-returning object-form model context.
 * @param {{ rejectFor?: string }} [options] Options.
 * @returns {{ calls: object[], modelContext: { registerTool: (tool: object, options?: object) => Promise<void> } }}
 */
function createAsyncObjectModelContext(options = {}) {
    const calls = []
    return {
        calls,
        modelContext: {
            registerTool(tool, registrationOptions) {
                calls.push({
                    tool,
                    registrationOptions
                })

                if (tool.name !== options.rejectFor) {
                    return Promise.resolve()
                }

                const rejection = Promise.reject(
                    new Error('registration failed')
                )
                rejection.catch(() => {})
                return rejection
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
 * Builds a fake four-argument legacy model context.
 * @param {{ throwFor?: string }} [options] Options.
 * @returns {{ calls: object[], modelContext: { registerTool: (name: string, description: string, inputSchema: object, handler: Function) => void } }}
 */
function createLegacyPositionalModelContext(options = {}) {
    const calls = []
    return {
        calls,
        modelContext: {
            registerTool(name, description, inputSchema, handler) {
                if (name === options.throwFor) {
                    throw new Error('registration failed')
                }
                calls.push({
                    name,
                    description,
                    inputSchema,
                    handler
                })
            }
        }
    }
}

/**
 * Builds a minimal registry for adapter instrumentation assertions.
 * @param {{ name?: string, handler?: (args: object) => unknown }} [options] Options.
 * @returns {{ getTools: () => object[] }}
 */
function createSingleToolRegistry(options = {}) {
    return {
        getTools() {
            return [
                {
                    name: options.name || 'query_pcb_component',
                    description: 'Return fake PCB component data.',
                    inputSchema: {
                        type: 'object',
                        properties: {},
                        additionalProperties: false
                    },
                    annotations: {
                        readOnlyHint: true,
                        untrustedContentHint: true
                    },
                    handler:
                        options.handler ||
                        (() => {
                            return { component: 'fake' }
                        })
                }
            ]
        }
    }
}

/**
 * Builds an analytics recorder.
 * @returns {{ events: object[], analytics: { track: (eventName: string, properties?: object) => void } }}
 */
function createAnalyticsRecorder() {
    const events = []
    return {
        events,
        analytics: {
            track(eventName, properties = {}) {
                events.push({ name: eventName, properties })
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
test('WebMcpAdapter no-ops when native support is unavailable', async () => {
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: null
    })

    assert.deepEqual(await adapter.initialize(), {
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

    const result = await adapter.initialize()
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
 * Verifies supported WebMCP registration emits availability analytics.
 */
test('WebMcpAdapter tracks WebMCP availability after registration', async () => {
    const fake = createObjectModelContext()
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry(),
        analytics: recorder.analytics
    })

    const result = await adapter.initialize()

    assert.deepEqual(result, {
        available: true,
        registered: 1,
        failed: 0
    })
    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_available',
            properties: {
                apiForm: 'object',
                resultStatus: 'success'
            }
        }
    ])
})

/**
 * Verifies promise-based registration failures are counted after settling.
 */
test('WebMcpAdapter awaits promise-based tool registration failures', async () => {
    const fake = createAsyncObjectModelContext({
        rejectFor: 'query_pcb_component'
    })
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry(),
        analytics: recorder.analytics
    })

    const result = await adapter.initialize()

    assert.deepEqual(result, {
        available: true,
        registered: 0,
        failed: 1
    })
    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_tool_registration_failed',
            properties: {
                methodName: 'query_pcb_component',
                apiForm: 'object',
                resultStatus: 'error'
            }
        },
        {
            name: 'webmcp_available',
            properties: {
                apiForm: 'object',
                resultStatus: 'error'
            }
        }
    ])
})

/**
 * Verifies object-form executions emit safe method-call analytics.
 */
test('WebMcpAdapter tracks successful object-form tool calls', async () => {
    const fake = createObjectModelContext()
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry(),
        analytics: recorder.analytics
    })
    await adapter.initialize()
    recorder.events.length = 0

    const response = await fake.calls[0].tool.execute({
        refdes: 'private-refdes'
    })

    assert.deepEqual(response, { component: 'fake' })
    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_tool_called',
            properties: {
                methodName: 'query_pcb_component',
                apiForm: 'object',
                resultStatus: 'success'
            }
        }
    ])
})

/**
 * Verifies current object-form executions preserve the browser cancellation
 * signal as execution context instead of mixing it into tool arguments.
 */
test('WebMcpAdapter forwards object-form execution signals', async () => {
    const fake = createObjectModelContext()
    const controller = new AbortController()
    const calls = []
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry({
            handler(args, executionOptions) {
                calls.push({ args, executionOptions })
                return { component: 'fake' }
            }
        })
    })
    await adapter.initialize()

    await fake.calls[0].tool.execute(
        { refdes: 'U1' },
        { signal: controller.signal }
    )

    assert.deepEqual(calls, [
        {
            args: { refdes: 'U1' },
            executionOptions: { signal: controller.signal }
        }
    ])
})

/**
 * Verifies rejected object-form executions preserve errors and track failures.
 */
test('WebMcpAdapter tracks failed object-form tool calls', async () => {
    const fake = createObjectModelContext()
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry({
            handler() {
                throw new Error('query failed')
            }
        }),
        analytics: recorder.analytics
    })
    await adapter.initialize()
    recorder.events.length = 0

    await assert.rejects(
        () => fake.calls[0].tool.execute({ refdes: 'private-refdes' }),
        /query failed/
    )

    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_tool_called',
            properties: {
                methodName: 'query_pcb_component',
                apiForm: 'object',
                resultStatus: 'error'
            }
        }
    ])
})

/**
 * Verifies the adapter prefers the current document-scoped API when available.
 */
test('WebMcpAdapter prefers document model context over deprecated navigator context', async () => {
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
        const result = await adapter.initialize()

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
test('WebMcpAdapter ignores deprecated navigator-only model context', async () => {
    const navigatorContext = createObjectModelContext()
    setGlobalProperty('document', {})
    setGlobalProperty('navigator', {
        modelContext: navigatorContext.modelContext
    })

    try {
        const adapter = new WebMcpAdapter({ getSnapshot: createSnapshot })
        const result = await adapter.initialize()

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
 * Verifies the adapter resolves package-provided model context at initialize
 * time, after the WebMCP runtime has loaded.
 */
test('WebMcpAdapter resolves document model context during initialization', async () => {
    const documentContext = createObjectModelContext()
    setGlobalProperty('document', {})

    try {
        const adapter = new WebMcpAdapter({ getSnapshot: createSnapshot })
        globalThis.document.modelContext = documentContext.modelContext

        const result = await adapter.initialize()

        assert.equal(result.registered, 28)
        assert.equal(documentContext.calls.length, 28)
    } finally {
        setGlobalProperty('document', originalDocument)
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

    const result = await adapter.initialize()
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
 * Verifies legacy descriptor executions emit safe method-call analytics.
 */
test('WebMcpAdapter tracks successful legacy descriptor tool calls', async () => {
    const fake = createLegacyModelContext()
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry(),
        analytics: recorder.analytics
    })
    await adapter.initialize()
    recorder.events.length = 0

    const response = await fake.calls[0].handler({
        refdes: 'private-refdes'
    })

    assert.deepEqual(response, {
        content: [
            {
                type: 'text',
                text: JSON.stringify({ component: 'fake' }, null, 2)
            }
        ]
    })
    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_tool_called',
            properties: {
                methodName: 'query_pcb_component',
                apiForm: 'legacy_descriptor',
                resultStatus: 'success'
            }
        }
    ])
})

/**
 * Verifies four-argument legacy executions report the positional API form.
 */
test('WebMcpAdapter tracks successful legacy positional tool calls', async () => {
    const fake = createLegacyPositionalModelContext()
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry(),
        analytics: recorder.analytics
    })
    await adapter.initialize()
    recorder.events.length = 0

    await fake.calls[0].handler({})

    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_tool_called',
            properties: {
                methodName: 'query_pcb_component',
                apiForm: 'legacy_positional',
                resultStatus: 'success'
            }
        }
    ])
})

/**
 * Verifies one failed tool registration does not block the rest.
 */
test('WebMcpAdapter continues after one registration failure', async () => {
    const fake = createObjectModelContext({ throwFor: 'list_nets' })
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext
    })

    const result = await adapter.initialize()

    assert.equal(result.available, true)
    assert.equal(result.registered, 27)
    assert.equal(result.failed, 1)
    assert.equal(
        fake.calls.some((call) => call.tool.name === 'query_component'),
        true
    )
})

/**
 * Verifies failed registrations emit safe failure analytics.
 */
test('WebMcpAdapter tracks failed tool registrations', async () => {
    const fake = createObjectModelContext({ throwFor: 'query_pcb_component' })
    const recorder = createAnalyticsRecorder()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext,
        registry: createSingleToolRegistry(),
        analytics: recorder.analytics
    })

    const result = await adapter.initialize()

    assert.deepEqual(result, {
        available: true,
        registered: 0,
        failed: 1
    })
    assert.deepEqual(recorder.events, [
        {
            name: 'webmcp_tool_registration_failed',
            properties: {
                methodName: 'query_pcb_component',
                apiForm: 'object',
                resultStatus: 'error'
            }
        },
        {
            name: 'webmcp_available',
            properties: {
                apiForm: 'object',
                resultStatus: 'error'
            }
        }
    ])
})
