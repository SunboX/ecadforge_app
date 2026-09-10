import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewRenderGraph } from '../../src/ui/AppViewRenderGraph.mjs'
import { AppState } from '../../src/core/AppState.mjs'

test('AppViewRenderGraph exposes a copied bounded statistics snapshot', () => {
    const graph = new AppViewRenderGraph({
        document: {
            body: null,
            querySelector() {
                return null
            }
        },
        statusNode: null,
        localeSelect: null,
        tabsNode: null,
        renderSidebar(snapshot) {
            void snapshot.documents
        },
        renderContent(snapshot) {
            void snapshot.documentModel
        }
    })
    const snapshot = {
        activeView: 'pcb',
        locale: 'en',
        parseStatus: 'ready',
        statusMessage: 'Ready',
        documents: [],
        documentModel: null
    }

    graph.render(snapshot, null)
    const statistics = graph.getStatistics()

    assert.equal(statistics.computations, 6)
    assert.ok(statistics.dependencies >= 4)
    assert.ok(statistics.readerEdges >= 4)
    statistics.computations = 0
    assert.equal(graph.getStatistics().computations, 6)
})

test('AppViewRenderGraph keeps worker assets cloneable and tracks asset replacement', () => {
    const requests = []
    const graph = new AppViewRenderGraph({
        document: {
            body: null,
            /** Returns no landing nodes in this render harness. */
            querySelector() {
                return null
            }
        },
        statusNode: null,
        localeSelect: null,
        tabsNode: null,
        /** This stage does not consume session assets. */
        renderSidebar() {},
        /** Captures the same payload passed to asynchronous scene preparation. */
        renderContent(snapshot) {
            requests.push({
                documentModel: snapshot.documentModel,
                sessionAssets: snapshot.sessionAssets
            })
        }
    })
    const state = new AppState({
        activeView: '3d',
        sessionAssets: [
            {
                name: 'part.step',
                relativePath: 'models/part.step',
                format: 'step',
                file: new Uint8Array([1, 2, 3]),
                aliases: ['part']
            }
        ]
    })
    state.subscribe((snapshot, changedPaths) =>
        graph.render({ ...snapshot }, changedPaths)
    )

    // Controllers retain this payload after synchronous dependency tracing ends.
    assert.deepEqual(
        structuredClone(requests[0]).sessionAssets[0].file,
        new Uint8Array([1, 2, 3])
    )
    state.setValue('statusMessage', 'Loading')
    assert.equal(requests.length, 1)
    state.setValue('sessionAssets', [
        {
            name: 'replacement.step',
            relativePath: 'models/replacement.step',
            format: 'step',
            file: new Uint8Array([4, 5])
        }
    ])
    assert.equal(requests.length, 2)
    assert.equal(
        structuredClone(requests[1]).sessionAssets[0].name,
        'replacement.step'
    )
    assert.equal(
        structuredClone(requests[0]).sessionAssets[0].name,
        'part.step'
    )
})
