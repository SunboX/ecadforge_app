import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'
import { PrivacySafeAnalytics } from '../../../src/PrivacySafeAnalytics.mjs'

/** Creates a provider using a controlled tool and monotonic clock. */
async function provider(handler, analyticsOverride) {
    const tools = []
    const events = []
    let time = 10
    const adapter = new WebMcpAdapter({
        getSnapshot: () => ({ documents: [] }),
        modelContext: { registerTool: (tool) => tools.push(tool) },
        registry: { getTools: () => [{ name: 'query_net', handler }] },
        analytics: analyticsOverride || {
            track: (name, properties) => events.push({ name, properties })
        },
        now: () => (time += 25),
        pageSessionId: '12345678-1234-4123-8123-123456789abc',
        appVersion: '1.2.3'
    })
    await adapter.initialize({ available: true, imported: false })
    return { execute: tools[0].execute, events }
}

test('returned tool errors are failures and preserve the original response', async () => {
    const response = { error: 'No design is loaded in the current session.' }
    const { execute, events } = await provider(() => response)
    assert.equal(
        await execute({ design: 'private-board', net_name: 'private-net' }),
        response
    )
    const terminal = events.at(-1)
    assert.equal(terminal.properties.resultStatus, 'error')
    assert.equal(terminal.properties.errorBucket, 'no_design')
    assert.equal(terminal.properties.durationMs, 25)
    assert.equal(terminal.properties.runtimeSource, 'native')
    assert.equal(terminal.properties.appVersion, '1.2.3')
    assert.equal(terminal.properties.designSelector, 'selected')
    assert.doesNotMatch(
        JSON.stringify(events),
        /private-board|private-net|No design/
    )
})

test('start and terminal events correlate concurrent calls by their invocation sequence', async () => {
    let resolveFirst
    let call = 0
    const { execute, events } = await provider(() =>
        ++call === 1
            ? new Promise((resolve) => {
                  resolveFirst = resolve
              })
            : []
    )
    const first = execute({
        compact: true,
        limit: 5,
        offset: 10,
        pattern: 'private-pattern',
        include_dns: false
    })
    await execute({})
    resolveFirst({ nets: ['private-net'] })
    await first
    const starts = events.filter(
        (event) => event.name === 'webmcp_tool_started'
    )
    const ends = events.filter((event) => event.name === 'webmcp_tool_called')
    assert.deepEqual(
        starts.map((event) => event.properties.callSequence),
        [1, 2]
    )
    assert.deepEqual(
        ends.map((event) => event.properties.callSequence),
        [2, 1]
    )
    assert.equal(
        starts[0].properties.pageSessionId,
        ends[1].properties.pageSessionId
    )
    assert.equal(starts[0].properties.pagination, 'later_page')
    assert.equal(starts[0].properties.queryMode, 'compact')
    assert.equal(starts[0].properties.hasFilter, 'yes')
    assert.equal(starts[0].properties.includeDns, 'no')
    assert.equal(ends[0].properties.resultShape, 'empty')
    assert.equal(ends[0].properties.resultCount, 0)
    assert.equal(ends[1].properties.resultCount, 1)
    assert.doesNotMatch(JSON.stringify(events), /private-pattern|private-net/)
})

test('cancellation retains exact abort reason and differs from errors', async () => {
    const abort = new AbortController()
    const reason = { private: 'sensitive abort reason' }
    abort.abort(reason)
    const { execute, events } = await provider((_args, options) =>
        options.signal.throwIfAborted()
    )
    await assert.rejects(
        execute({}, { signal: abort.signal }),
        (error) => error === reason
    )
    assert.equal(events.at(-1).properties.resultStatus, 'cancelled')
    assert.equal(events.at(-1).properties.errorBucket, 'cancelled')
    assert.doesNotMatch(JSON.stringify(events), /sensitive/)
})

test('analytics exceptions never replace tool results or original exceptions', async () => {
    const analytics = {
        track() {
            throw new Error('tracker failure')
        }
    }
    const success = await provider(() => ({ ok: true }), analytics)
    assert.deepEqual(await success.execute({}), { ok: true })
    const original = new Error('private failure')
    const failure = await provider(() => {
        throw original
    }, analytics)
    await assert.rejects(failure.execute({}), (error) => error === original)
})

test('MCP error envelopes are failures and unavailable runtime is recorded', async () => {
    const { execute, events } = await provider(() => ({
        isError: true,
        content: []
    }))
    await execute({})
    assert.equal(events.at(-1).properties.resultStatus, 'error')
    const unavailable = []
    const adapter = new WebMcpAdapter({
        modelContext: null,
        analytics: {
            track: (name, properties) => unavailable.push({ name, properties })
        }
    })
    assert.equal(
        (await adapter.initialize({ available: false, imported: false }))
            .available,
        false
    )
    assert.equal(unavailable[0].name, 'webmcp_unavailable')
})

test('early WebMCP events are bounded and flushed in order after tracker load', () => {
    let tracker
    const delivered = []
    const analytics = new PrivacySafeAnalytics({
        trackerProvider: () => tracker
    })
    for (let i = 0; i < 150; i++) {
        analytics.track('webmcp_tool_called', {
            methodName: 'list_designs',
            callSequence: i + 1,
            arguments: 'private'
        })
    }
    tracker = {
        trackEvent: (name, properties) => delivered.push({ name, properties }),
        setContext() {}
    }
    analytics.syncContext()
    assert.equal(delivered.length, 100)
    assert.deepEqual(
        delivered.map((event) => event.properties.call_sequence),
        Array.from({ length: 100 }, (_, i) => i + 51)
    )
    analytics.syncContext()
    assert.equal(delivered.length, 100)
    assert.doesNotMatch(JSON.stringify(delivered), /private/)
})

test('WebMCP values are typed, bounded and validated instead of copying arbitrary strings', () => {
    const delivered = []
    const analytics = new PrivacySafeAnalytics({
        tracker: {
            trackEvent: (name, properties) => delivered.push(properties)
        }
    })
    analytics.track('webmcp_tool_called', {
        methodName: 'query_net',
        durationMs: 0,
        resultCount: 0,
        callSequence: 1,
        runtimeSource: 'private-text',
        queryMode: 'private-text',
        errorBucket: 'private-text',
        pageSessionId: 'private-text',
        designSelector: 'private-text',
        appVersion: '1.2.3',
        rawError: 'private-text'
    })
    assert.equal(delivered[0].duration_ms, 0)
    assert.equal(delivered[0].result_count, 0)
    assert.equal(delivered[0].app_version, '1.2.3')
    assert.doesNotMatch(JSON.stringify(delivered), /private/)
})

test('uninspectable result accessors cannot turn a returned value into a rejection', async () => {
    const result = { usable: true }
    Object.defineProperty(result, 'error', {
        get() {
            throw new Error('observation failed')
        }
    })
    const { execute } = await provider(() => result)
    assert.equal(await execute({}), result)
})

test('uninspectable exception diagnostics preserve the exact original rejection', async () => {
    const original = new Error('original')
    Object.defineProperty(original, 'message', {
        get() {
            throw new Error('observation failed')
        }
    })
    const { execute } = await provider(() => {
        throw original
    })
    await assert.rejects(execute({}), (error) => error === original)
})

test('a known returned error remains a failure when its diagnostic accessor throws', async () => {
    const error = new Error('original')
    Object.defineProperty(error, 'message', {
        get() {
            throw new Error('observation failed')
        }
    })
    const result = { error }
    const { execute, events } = await provider(() => result)
    assert.equal(await execute({}), result)
    assert.equal(events.at(-1).properties.resultStatus, 'error')
    assert.equal(events.at(-1).properties.errorBucket, 'tool_error')
})
