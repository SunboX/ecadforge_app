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

test('PrivacySafeAnalytics publishes only bounded runtime context', () => {
    const contexts = []
    const analytics = new PrivacySafeAnalytics({
        tracker: {
            setContext(context) {
                contexts.push(context)
            }
        }
    })

    analytics.setContext({
        appVersion: '1.13.24',
        runtimePhase: 'Ready',
        sourceType: 'Local File',
        formatFamily: 'KiCad',
        activeView: 'PCB',
        documentCount: 2,
        traceComputations: 6,
        traceDependencies: 19,
        traceReaderEdges: 11,
        fileName: 'private-board.kicad_pcb',
        rawUrl: 'https://example.test/private'
    })

    assert.deepEqual(contexts, [
        {
            app_version: '1_13_24',
            runtime_phase: 'ready',
            source_type: 'local_file',
            format_family: 'kicad',
            active_view: 'pcb',
            document_count: 2,
            trace_computations: 6,
            trace_dependencies: 19,
            trace_reader_edges: 11
        }
    ])
})

test('PrivacySafeAnalytics synchronizes retained context after tracker load', () => {
    const contexts = []
    let tracker = null
    const analytics = new PrivacySafeAnalytics({
        trackerProvider: () => tracker
    })

    analytics.setContext({ appVersion: '1.13.24', documentCount: 0 })
    tracker = {
        setContext(context) {
            contexts.push(context)
        }
    }

    assert.equal(analytics.syncContext(), true)
    assert.deepEqual(contexts, [{ app_version: '1_13_24', document_count: 0 }])
})

test('PrivacySafeAnalytics promotes safe event dimensions into error context', () => {
    const contexts = []
    const analytics = new PrivacySafeAnalytics({
        tracker: {
            setContext(context) {
                contexts.push(context)
            },
            trackEvent() {}
        }
    })

    analytics.track('sample_loaded_success', {
        sourceType: 'sample',
        formatFamily: 'altium',
        activeView: 'pcb'
    })

    assert.deepEqual(contexts.at(-1), {
        source_type: 'sample',
        format_family: 'altium',
        active_view: 'pcb'
    })
})
