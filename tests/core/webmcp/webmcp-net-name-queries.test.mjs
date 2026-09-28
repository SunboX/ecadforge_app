import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpAdapter } from '../../../src/core/webmcp/WebMcpAdapter.mjs'

for (const [format, extension] of [
    ['altium', 'PcbDoc'],
    ['kicad', 'kicad_pcb']
]) {
    test(`registered tools list and search retained ${format} PCB nets`, async () => {
        const native = {
            sourceFormat: format,
            fileName: `query-board.${extension}`,
            kind: 'pcb',
            summary: { title: 'Query Board' },
            pcb: {
                nets: [
                    { name: 'SIGNAL_C' },
                    { name: 'SIGNAL_A' },
                    { name: 'SIGNAL_B' }
                ]
            }
        }
        const tools = new Map()
        const events = []
        const adapter = new WebMcpAdapter({
            getSnapshot: () => ({
                activeDocumentId: 'board',
                documents: [
                    {
                        id: 'board',
                        documentModel: {
                            schema: 'ecad-toolkit.document.v1',
                            source: { format, fileName: native.fileName },
                            model: [],
                            extensions: { [format]: { native } }
                        }
                    }
                ]
            }),
            modelContext: {
                registerTool: (tool) => tools.set(tool.name, tool)
            },
            analytics: {
                track: (name, properties) => events.push({ name, properties })
            }
        })
        await adapter.initialize({ available: true, imported: false })
        const result = await tools
            .get('list_nets')
            .execute({ design: 'board', limit: 2, offset: 0 })
        assert.deepEqual(result, {
            nets: ['SIGNAL_A', 'SIGNAL_B'],
            total_count: 3,
            returned_count: 2,
            limit: 2,
            offset: 0,
            has_more: true
        })
        assert.equal(events.at(-1).properties.resultStatus, 'success')
        assert.equal(events.at(-1).properties.errorBucket, 'none')
        assert.equal(events.at(-1).properties.resultCount, 2)
        assert.deepEqual(
            await tools
                .get('list_nets')
                .execute({ design: 'board', limit: 2, offset: 2 }),
            {
                nets: ['SIGNAL_C'],
                total_count: 3,
                returned_count: 1,
                limit: 2,
                offset: 2,
                has_more: false
            }
        )
        assert.deepEqual(
            await tools
                .get('search_nets')
                .execute({ design: 'board', pattern: '_B$' }),
            {
                results: { 'Query Board': ['SIGNAL_B'] }
            }
        )
        assert.match(
            (
                await tools
                    .get('query_xnet_by_net_name')
                    .execute({ design: 'board', net_name: 'SIGNAL_B' })
            ).error,
            /No schematic connectivity/
        )
        assert.equal(events.at(-1).properties.errorBucket, 'missing_data')
        assert.doesNotMatch(
            JSON.stringify(events),
            /SIGNAL_|Query Board|query-board/
        )
        const abort = new AbortController()
        abort.abort()
        await assert.rejects(
            tools
                .get('list_nets')
                .execute({ design: 'board' }, { signal: abort.signal }),
            { name: 'AbortError' }
        )
    })
}
