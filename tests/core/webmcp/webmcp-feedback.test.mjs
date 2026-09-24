import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpFeedback } from '../../../src/core/webmcp/WebMcpFeedback.mjs'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'

const request = {
    kind: 'feature_request',
    area: 'output',
    summary: 'Provide selectable columns in compact result tables.',
    related_tool: 'list_components'
}

/** Creates a production-origin feedback service with an observed collector. */
function feedback(response = { ok: true, event_id: 42 }) {
    const calls = []
    const service = new WebMcpFeedback({
        location: 'https://ecadforge.app/',
        appVersion: '1.2.3',
        fetch: async (url, options) => {
            calls.push({ url, options })
            return { ok: true, json: async () => response }
        }
    })
    return { tool: service.createTool(['list_components']), calls }
}

test('feedback is explicitly outbound, acknowledged and deduplicated per page', async () => {
    const { tool, calls } = feedback()
    assert.equal(tool.name, 'submit_agent_feedback')
    assert.equal(tool.annotations.readOnlyHint, false)
    assert.equal(tool.annotations.consequentialHint, true)
    assert.equal(tool.inputSchema.additionalProperties, false)
    const result = await tool.handler(request)
    assert.equal(result.submitted, true)
    assert.equal(result.event_id, 42)
    assert.equal(calls.length, 1)
    const payload = JSON.parse(calls[0].options.body)
    assert.equal(payload.event_name, 'webmcp_feedback')
    assert.equal(payload.properties.feedback_summary, request.summary)
    assert.equal(payload.properties.related_method, 'list_components')
    assert.equal(calls[0].options.credentials, 'omit')
    assert.equal(payload.page, undefined)
    assert.equal(payload.fingerprint, undefined)
    assert.equal((await tool.handler(request)).status, 'duplicate')
    assert.equal(calls.length, 1)
})

test('feedback rejects unknown fields, invalid categories and unknown related tools', async () => {
    const { tool, calls } = feedback()
    for (const invalid of [
        { ...request, raw_design: 'sensitive' },
        { ...request, kind: 'random' },
        { ...request, summary: 'tiny' },
        { ...request, summary: 'x'.repeat(501) },
        { ...request, related_tool: 'invented_tool' },
        { ...request, area: 'private-area' }
    ])
        assert.ok((await tool.handler(invalid)).error)
    assert.equal(calls.length, 0)
})

test('local sessions and malformed server acknowledgements never claim delivery', async () => {
    const local = new WebMcpFeedback({
        location: 'http://localhost:3000/',
        fetch: () => {
            throw new Error('must not send')
        }
    }).createTool(['list_components'])
    assert.equal((await local.handler(request)).status, 'unavailable')
    const { tool } = feedback({ ok: false })
    assert.ok((await tool.handler(request)).error)
})

test('feedback fails honestly on network rejection and does not cache failed requests', async () => {
    let count = 0
    const service = new WebMcpFeedback({
        location: 'https://ecadforge.app/',
        fetch: async () => {
            count++
            throw new Error('private network failure')
        }
    })
    const tool = service.createTool(['list_components'])
    const result = await tool.handler(request)
    assert.equal(result.submitted, false)
    assert.doesNotMatch(JSON.stringify(result), /private network/)
    await tool.handler(request)
    assert.equal(count, 2)
})

test('cancelled feedback sends nothing and preserves cancellation reason', async () => {
    const { tool, calls } = feedback()
    const controller = new AbortController()
    const reason = new Error('cancelled by browser')
    controller.abort(reason)
    await assert.rejects(
        tool.handler(request, { signal: controller.signal }),
        (error) => error === reason
    )
    assert.equal(calls.length, 0)
})

test('adapter adds the configured feedback tool with truthful annotations', async () => {
    const tools = []
    const adapter = new WebMcpAdapter({
        modelContext: { registerTool: (tool) => tools.push(tool) },
        feedback: new WebMcpFeedback({ location: 'http://localhost:3000/' })
    })
    const result = await adapter.initialize()
    assert.equal(result.registered, 30)
    assert.equal(
        tools.find((tool) => tool.name === 'submit_agent_feedback').annotations
            .readOnlyHint,
        false
    )
    assert.ok(
        tools
            .filter((tool) => tool.name !== 'submit_agent_feedback')
            .every((tool) => tool.annotations.readOnlyHint)
    )
})

test('feedback is restricted to the configured production origin including public forks', async () => {
    for (const location of [
        'https://fork.example/',
        'http://ecadforge.app/',
        'https://ecadforge.app.evil.example/',
        'https://ecadforge.app:8443/'
    ]) {
        let sent = false
        const tool = new WebMcpFeedback({
            location,
            fetch: () => {
                sent = true
            }
        }).createTool(['list_components'])
        assert.equal((await tool.handler(request)).status, 'unavailable')
        assert.equal(sent, false)
    }
})

test('feedback page limit includes both delivered and concurrent pending submissions', async () => {
    let release
    let count = 0
    const tool = new WebMcpFeedback({
        location: 'https://ecadforge.app/',
        fetch: async () => {
            if (++count === 10)
                await new Promise((resolve) => {
                    release = resolve
                })
            return {
                ok: true,
                json: async () => ({ ok: true, event_id: count })
            }
        }
    }).createTool(['list_components'])
    for (let i = 0; i < 9; i++)
        await tool.handler({
            ...request,
            summary: `${request.summary} Request ${i}.`
        })
    const pending = tool.handler({
        ...request,
        summary: `${request.summary} Request 9.`
    })
    const rejected = await tool.handler({
        ...request,
        summary: `${request.summary} Request 10.`
    })
    release()
    await pending
    assert.equal(rejected.status, 'rate_limited')
    assert.equal(count, 10)
})
