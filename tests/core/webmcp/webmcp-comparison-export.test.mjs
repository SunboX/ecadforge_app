import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'
import { BrowserMcpServer } from '@mcp-b/webmcp-ts-sdk'
import { LoadedDesignNetlistService } from '../../../src/core/webmcp/LoadedDesignNetlistService.mjs'

/** Builds repository-owned fake connectivity with one deliberate discrepancy. */
function snapshot() {
    return {
        activeDocumentId: 'sheet-id',
        documents: [
            {
                id: 'sheet-id',
                documentModel: {
                    fileName: 'fake.SchDoc',
                    kind: 'schematic',
                    schematic: {
                        components: [
                            { designator: 'U1' },
                            { designator: 'R2' }
                        ],
                        nets: [
                            {
                                name: 'SIGNAL',
                                pins: [
                                    { refdes: 'U1', designator: '1' },
                                    { refdes: 'R2', designator: '2' }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                id: 'board-id',
                documentModel: {
                    fileName: 'fake.PcbDoc',
                    kind: 'pcb',
                    pcb: {
                        components: [
                            {
                                designator: 'U1',
                                pads: [{ designator: '1', netName: 'SIGNAL' }]
                            }
                        ],
                        nets: [
                            {
                                name: 'SIGNAL',
                                pads: [{ refdes: 'U1', designator: '1' }]
                            }
                        ]
                    }
                }
            }
        ]
    }
}

/** Captures native provider descriptors without replacing app handlers. */
function nativeContext() {
    const tools = new Map()
    return {
        tools,
        registerTool(tool) {
            tools.set(tool.name, tool)
        }
    }
}

/** In-process MCP transport exercises the real dependency's request handlers. */
class LocalTransport {
    #sequence = 0
    #pending = new Map()
    /** Starts without opening any network connection. */
    async start() {}
    /** Resolves JSON-RPC responses, ignoring tool-list notifications. */
    async send(message) {
        const resolve = this.#pending.get(message.id)
        if (resolve) {
            this.#pending.delete(message.id)
            resolve(message)
        }
    }
    /** Closes the in-process transport. */
    async close() {
        this.onclose?.()
    }
    /** Calls a registered tool through its MCP transport boundary. */
    async call(name, args = {}) {
        const { response } = this.begin(name, args)
        const message = await response
        assert.equal(message.error, undefined)
        return message.result
    }
    /** Starts an MCP request so cancellation can be sent while it is pending. */
    begin(name, args = {}) {
        const id = ++this.#sequence
        const response = new Promise((resolve) =>
            this.#pending.set(id, resolve)
        )
        this.onmessage({
            jsonrpc: '2.0',
            id,
            method: 'tools/call',
            params: { name, arguments: args }
        })
        return { id, response }
    }
    /** Sends the standard MCP cancellation notification. */
    cancel(id) {
        this.onmessage({
            jsonrpc: '2.0',
            method: 'notifications/cancelled',
            params: { requestId: id, reason: 'Client cancelled' }
        })
    }
}

/** Registers the same application tools on native and actual MCP-B paths. */
async function providers(getSnapshot = snapshot, dependencies = {}) {
    const native = nativeContext()
    const fallback = new BrowserMcpServer({
        name: 'fake-comparison',
        version: '1'
    })
    const transport = new LocalTransport()
    await fallback.connect(transport)
    await new WebMcpAdapter({
        ...dependencies,
        modelContext: native,
        getSnapshot
    }).initialize({
        available: true,
        imported: false
    })
    await new WebMcpAdapter({
        ...dependencies,
        modelContext: fallback,
        getSnapshot
    }).initialize({ available: true, imported: true })
    return { native, fallback, transport }
}

test('comparison export has identical stable identifiers through native and MCP-B', async () => {
    const { native, fallback, transport } = await providers()
    try {
        const tool = native.tools.get('export_schematic_pcb_comparison')
        assert.ok(tool, 'local comparison export must be discoverable')
        assert.equal(tool.annotations.readOnlyHint, true)
        assert.equal(tool.annotations.consequentialHint, false)
        const args = { design: 'sheet-id', pcb_design: 'board-id' }
        const artifact = await tool.execute(args)
        const bridged = await transport.call(tool.name, args)
        assert.equal(bridged.isError, false)
        assert.deepEqual(bridged.structuredContent, artifact)
        assert.equal(artifact.mime_type, 'application/json')
        const report = JSON.parse(artifact.content)
        assert.equal(report.schema_version, 1)
        assert.equal(report.identifier_scope, 'loaded_session')
        assert.equal(report.designs.schematic.id, 'sheet-id')
        assert.equal(report.designs.pcb.id, 'board-id')
        assert.deepEqual(
            report.components.map(({ refdes }) => refdes),
            ['R2', 'U1']
        )
        assert.ok(
            report.components.every(
                ({ id }) => typeof id === 'string' && id.length
            )
        )
        assert.equal(new Set(report.components.map(({ id }) => id)).size, 2)
        assert.deepEqual(JSON.parse(report.components[0].id), [
            'sheet-id',
            'board-id',
            'R2'
        ])
        assert.equal(report.components[0].pcb_component_id, null)
        assert.deepEqual(
            JSON.parse(report.components[1].schematic_component_id),
            ['sheet-id', 'U1']
        )
        assert.deepEqual(report.comparison.mismatches, [
            {
                net: 'SIGNAL',
                missing_on_pcb: ['R2.2'],
                missing_on_schematic: []
            }
        ])
        assert.deepEqual(await tool.execute(args), artifact)
        assert.deepEqual(
            await tool.execute({
                design: 'fake.SchDoc',
                pcb_design: 'fake.PcbDoc'
            }),
            artifact
        )
    } finally {
        await fallback.close()
    }
})

test(
    'MCP-B cancellation reaches an active application callback',
    { timeout: 3000 },
    async () => {
        const fallback = new BrowserMcpServer({
            name: 'fake-abort',
            version: '1'
        })
        const transport = new LocalTransport()
        let started
        let cancelled
        const startedPromise = new Promise((resolve) => {
            started = resolve
        })
        const cancelledPromise = new Promise((resolve) => {
            cancelled = resolve
        })
        try {
            await fallback.connect(transport)
            await new WebMcpAdapter({
                modelContext: fallback,
                registry: {
                    getTools: () => [
                        {
                            name: 'wait_for_cancel',
                            description: 'Wait for cancellation.',
                            inputSchema: { type: 'object', properties: {} },
                            async handler(args, options) {
                                started()
                                await new Promise((resolve) =>
                                    options.signal.addEventListener(
                                        'abort',
                                        resolve,
                                        { once: true }
                                    )
                                )
                                cancelled(options.signal.aborted)
                                options.signal.throwIfAborted()
                            }
                        }
                    ]
                }
            }).initialize({ available: true, imported: true })
            const request = transport.begin('wait_for_cancel')
            await startedPromise
            transport.cancel(request.id)
            assert.equal(await cancelledPromise, true)
        } finally {
            await fallback.close()
        }
    }
)

test('comparison export reports unloaded designs with identical structured failure codes', async () => {
    const { native, fallback, transport } = await providers(() => ({
        documents: []
    }))
    try {
        const tool = native.tools.get('export_schematic_pcb_comparison')
        assert.ok(tool)
        const result = await tool.execute({})
        assert.equal(result.code, 'no_design_loaded')
        assert.equal(typeof result.error, 'string')
        const bridged = await transport.call(tool.name)
        assert.equal(bridged.isError, true)
        assert.deepEqual(bridged.structuredContent, result)
    } finally {
        await fallback.close()
    }
})

test('MCP-B passes a genuine cancellation signal to registered application handlers', async () => {
    const fallback = new BrowserMcpServer({
        name: 'fake-cancellation',
        version: '1'
    })
    const transport = new LocalTransport()
    try {
        await fallback.connect(transport)
        await new WebMcpAdapter({
            modelContext: fallback,
            registry: {
                getTools: () => [
                    {
                        name: 'check_signal',
                        description: 'Check execution context.',
                        inputSchema: { type: 'object', properties: {} },
                        handler(args, options) {
                            return {
                                genuine_signal:
                                    options?.signal instanceof AbortSignal
                            }
                        }
                    }
                ]
            }
        }).initialize({ available: true, imported: true })
        const result = await transport.call('check_signal')
        assert.equal(result.structuredContent.genuine_signal, true)
    } finally {
        await fallback.close()
    }
})

test('comparison export does not read session state after pre-execution cancellation', async () => {
    const native = nativeContext()
    let reads = 0
    await new WebMcpAdapter({
        modelContext: native,
        getSnapshot() {
            reads += 1
            return snapshot()
        }
    }).initialize()
    const controller = new AbortController()
    const reason = new DOMException('Cancelled by client', 'AbortError')
    controller.abort(reason)
    await assert.rejects(
        () =>
            native.tools
                .get('export_schematic_pcb_comparison')
                .execute({}, { signal: controller.signal }),
        (error) => error === reason
    )
    assert.equal(reads, 0)
})

test('comparison export distinguishes unknown, ambiguous and missing PCB selectors', () => {
    const service = new LoadedDesignNetlistService({ getSnapshot: snapshot })
    assert.equal(
        service.exportSchematicPcbComparison({ design: 'absent-id' }).code,
        'design_not_found'
    )
    assert.equal(
        service.exportSchematicPcbComparison({ design: 'fake' }).code,
        'ambiguous_design'
    )
    assert.equal(
        service.exportSchematicPcbComparison({ pcb_design: 'sheet-id' }).code,
        'missing_pcb_pads'
    )
    const onlySheet = snapshot()
    onlySheet.documents.pop()
    const missingBoard = new LoadedDesignNetlistService({
        getSnapshot: () => onlySheet
    })
    assert.equal(
        missingBoard.exportSchematicPcbComparison().code,
        'missing_pcb_pads'
    )
})

test('comparison export invokes neither analytics nor agent feedback', async () => {
    const calls = []
    const { native, fallback, transport } = await providers(snapshot, {
        analytics: {
            track(name) {
                calls.push(name)
            }
        },
        feedback: {
            createTool() {
                return {
                    name: 'submit_agent_feedback',
                    inputSchema: { type: 'object' },
                    handler() {
                        calls.push('feedback')
                    }
                }
            }
        }
    })
    try {
        calls.length = 0
        await native.tools.get('export_schematic_pcb_comparison').execute({})
        await transport.call('export_schematic_pcb_comparison')
        assert.deepEqual(calls, [])
    } finally {
        await fallback.close()
    }
})
