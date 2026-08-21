import assert from 'node:assert/strict'
import test from 'node:test'
import { AppViewRenderGraph } from '../../src/ui/AppViewRenderGraph.mjs'

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
