import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'

/** Registers real tools without reading a design or sending analytics. */
async function supportTool() {
    const tools = []
    const events = []
    const adapter = new WebMcpAdapter({
        appVersion: '1.2.3',
        getSnapshot() {
            throw new Error('Support must not read private design state')
        },
        analytics: {
            track: (name, properties) => events.push({ name, properties })
        },
        modelContext: { registerTool: (tool) => tools.push(tool) }
    })
    await adapter.initialize()
    const tool = tools.find(
        (candidate) => candidate.name === 'prepare_issue_report'
    )
    assert.ok(
        tool,
        'Agents can discover GitHub issue reporting without a loaded design'
    )
    return { tool, events }
}

const report = {
    title: 'WebMCP result is missing pagination',
    description:
        'Call list_components with a limit. Expected a next offset; received no pagination.',
    area: 'webmcp'
}

test('agents can prepare a public GitHub report without exporting session state', async () => {
    const { tool, events } = await supportTool()
    const result = await tool.execute(report)
    assert.equal(result.submitted, false)
    assert.equal(result.status, 'prepared')
    assert.equal(result.repository, 'SunboX/ecadforge_app')
    assert.equal(
        result.issues_url,
        'https://github.com/SunboX/ecadforge_app/issues'
    )
    const url = new URL(result.new_issue_url)
    assert.equal(url.origin + url.pathname, result.issues_url + '/new')
    assert.equal(url.searchParams.get('title'), report.title)
    assert.equal(url.searchParams.get('body'), result.body)
    assert.match(result.body, /ECAD Forge version: 1\.2\.3/)
    assert.ok(result.body.includes(report.description))
    assert.equal(tool.annotations.readOnlyHint, true)
    assert.equal(tool.annotations.consequentialHint, false)
    assert.ok(!JSON.stringify(events).includes(report.description))
    assert.ok(!JSON.stringify(events).includes(report.title))
})

test('support report rejects malformed or extra fields and oversized text', async () => {
    const { tool } = await supportTool()
    for (const args of [
        null,
        [],
        {},
        { ...report, title: ' ' },
        { ...report, description: 42 },
        { ...report, description: 'x'.repeat(2001) },
        { ...report, area: 'unknown' },
        { ...report, raw_design: 'private content' },
        { ...report, title: 'Title\nwith a new line' }
    ]) {
        const result = await tool.execute(args)
        assert.equal(result.status, 'invalid_input')
        assert.equal(result.submitted, false)
        assert.ok(result.error)
        assert.equal(result.new_issue_url, undefined)
    }
})

test('support report preserves Unicode and query punctuation without injecting URL fields', async () => {
    const { tool } = await supportTool()
    const title = 'Fehler: Hilfe & Größe? #工具'
    const result = await tool.execute({ ...report, title })
    const url = new URL(result.new_issue_url)
    assert.equal(url.searchParams.get('title'), title)
    assert.equal(url.hash, '')
    assert.deepEqual([...url.searchParams.keys()], ['title', 'body'])

    const longReport = await tool.execute({
        ...report,
        description: '测'.repeat(2000)
    })
    assert.equal(longReport.prefilled, false)
    assert.equal(longReport.new_issue_url, longReport.issues_url + '/new')
    assert.ok(longReport.body.includes('测'.repeat(2000)))
})

test('support preparation honours browser cancellation before creating a report', async () => {
    const { tool } = await supportTool()
    const controller = new AbortController()
    const reason = new Error('Cancelled support request')
    controller.abort(reason)
    await assert.rejects(
        tool.execute(report, { signal: controller.signal }),
        (error) => error === reason
    )
})
