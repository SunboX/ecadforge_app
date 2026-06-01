import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'

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
 * Builds a fake model context.
 * @param {{ throwFor?: string }} [options] Options.
 * @returns {{ calls: object[], modelContext: { registerTool: (...args: any[]) => void } }}
 */
function createModelContext(options = {}) {
    const calls = []
    return {
        calls,
        modelContext: {
            registerTool(...args) {
                if (args[0] === options.throwFor) {
                    throw new Error('registration failed')
                }
                calls.push({
                    name: args[0],
                    descriptor: args[1],
                    handler: args[2]
                })
            }
        }
    }
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
 * Verifies all loaded-session tools are registered and return MCP text content.
 */
test('WebMcpAdapter registers tools with native model context', async () => {
    const fake = createModelContext()
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext
    })

    const result = adapter.initialize()
    const toolNames = fake.calls.map((call) => call.name)

    assert.equal(result.available, true)
    assert.equal(result.registered, 10)
    assert.deepEqual(toolNames, [
        'list_designs',
        'list_components',
        'list_nets',
        'search_nets',
        'search_components_by_refdes',
        'search_components_by_mpn',
        'search_components_by_description',
        'query_component',
        'query_xnet_by_net_name',
        'query_xnet_by_pin_name'
    ])

    const listNets = fake.calls.find((call) => call.name === 'list_nets')
    const response = await listNets.handler({})
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
    const fake = createModelContext({ throwFor: 'list_nets' })
    const adapter = new WebMcpAdapter({
        getSnapshot: createSnapshot,
        modelContext: fake.modelContext
    })

    const result = adapter.initialize()

    assert.equal(result.available, true)
    assert.equal(result.registered, 9)
    assert.equal(result.failed, 1)
    assert.equal(
        fake.calls.some((call) => call.name === 'query_component'),
        true
    )
})
