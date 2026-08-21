import assert from 'node:assert/strict'
import test from 'node:test'
import { WebMcpToolRegistry } from '../../../src/core/webmcp/WebMcpToolRegistry.mjs'

/**
 * Verifies registry handlers forward execution context independently from
 * JSON tool arguments.
 */
test('WebMcpToolRegistry forwards tool execution context', () => {
    const controller = new AbortController()
    const calls = []
    const registry = new WebMcpToolRegistry({
        getSnapshot: () => ({ documents: [] }),
        service: {
            listDesigns(args, executionOptions) {
                calls.push({ args, executionOptions })
                return []
            }
        }
    })
    const tool = registry
        .getTools()
        .find((candidate) => candidate.name === 'list_designs')

    assert.deepEqual(
        tool.handler({ pattern: '.*' }, { signal: controller.signal }),
        []
    )
    assert.deepEqual(calls, [
        {
            args: { pattern: '.*' },
            executionOptions: { signal: controller.signal }
        }
    ])
})
