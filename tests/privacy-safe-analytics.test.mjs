import assert from 'node:assert/strict'
import test from 'node:test'
import { PrivacySafeAnalytics } from '../src/PrivacySafeAnalytics.mjs'

test('PrivacySafeAnalytics forwards only allowlisted event properties', () => {
    const calls = []
    const analytics = new PrivacySafeAnalytics({
        tracker: {
            trackEvent(name, properties) {
                calls.push({ name, properties })
            }
        }
    })

    analytics.track('github_url_loaded_success', {
        sourceType: 'github',
        formatFamily: 'kicad',
        activeView: 'pcb',
        errorBucket: 'none',
        fileName: 'customer-board.kicad_pcb',
        rawUrl: 'https://raw.githubusercontent.com/acme/private/main/board.kicad_pcb',
        contents: '(kicad_pcb secret)'
    })

    assert.deepEqual(calls, [
        {
            name: 'github_url_loaded_success',
            properties: {
                source_type: 'github',
                format_family: 'kicad',
                active_view: 'pcb',
                error_bucket: 'none'
            }
        }
    ])
})

test('PrivacySafeAnalytics forwards only safe WebMCP event properties', () => {
    const calls = []
    const analytics = new PrivacySafeAnalytics({
        tracker: {
            trackEvent(name, properties) {
                calls.push({ name, properties })
            }
        }
    })

    analytics.track('webmcp_tool_called', {
        methodName: 'query_pcb_component',
        apiForm: 'object',
        resultStatus: 'success',
        arguments: { refdes: 'U1' },
        result: { design: 'private-board.PcbDoc' },
        rawError: 'Cannot read customer net'
    })

    assert.deepEqual(calls, [
        {
            name: 'webmcp_tool_called',
            properties: {
                method_name: 'query_pcb_component',
                api_form: 'object',
                result_status: 'success'
            }
        }
    ])
})

test('PrivacySafeAnalytics ignores unsupported event names and missing trackers', () => {
    const analytics = new PrivacySafeAnalytics({ tracker: null })

    assert.doesNotThrow(() => {
        analytics.track('github_url_loaded_success', {
            sourceType: 'github'
        })
        analytics.track('debug_dump', {
            sourceType: 'local'
        })
    })
})

test('PrivacySafeAnalytics resolves window tracker at track time', () => {
    const calls = []
    let tracker = null
    const analytics = new PrivacySafeAnalytics({
        trackerProvider: () => tracker
    })

    analytics.track('landing_view')
    tracker = {
        trackEvent(name, properties) {
            calls.push({ name, properties })
        }
    }
    analytics.track('landing_view')

    assert.deepEqual(calls, [
        {
            name: 'landing_view',
            properties: {}
        }
    ])
})
