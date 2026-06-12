import assert from 'node:assert/strict'
import test from 'node:test'
import { HeroPreviewDemoLoader } from '../src/HeroPreviewDemoLoader.mjs'

/**
 * Verifies landing-preview parsing is schedulable so it does not compete with
 * first viewer startup work.
 */
test('HeroPreviewDemoLoader schedules demo parsing on idle', async () => {
    const originalRequestIdleCallback = globalThis.requestIdleCallback
    let idleRequest = null
    const fetchedUrls = []
    const view = {
        documents: [],
        setHeroPreviewDocuments(documentModels) {
            this.documents = documentModels
        }
    }
    const parser = {
        parseCount: 0,
        async parseEntries(_entries) {
            this.parseCount += 1
            return {
                documents: [{ fileName: 'preview-board.kicad_pcb' }]
            }
        }
    }

    globalThis.requestIdleCallback = (callback, options) => {
        idleRequest = { callback, options }
        return 1
    }

    try {
        const scheduled = HeroPreviewDemoLoader.schedule(view, {
            fetcher: async (url) => {
                fetchedUrls.push(url)
                return new Response('demo', { status: 200 })
            },
            parser
        })

        assert.equal(scheduled, true)
        assert.equal(parser.parseCount, 0)
        assert.equal(fetchedUrls.length, 0)
        assert.equal(idleRequest?.options?.timeout, 1500)

        await idleRequest.callback()

        assert.equal(parser.parseCount, 1)
        assert.deepEqual(view.documents, [
            { fileName: 'preview-board.kicad_pcb' }
        ])
        assert.equal(fetchedUrls.length, 3)
    } finally {
        if (originalRequestIdleCallback === undefined) {
            delete globalThis.requestIdleCallback
        } else {
            globalThis.requestIdleCallback = originalRequestIdleCallback
        }
    }
})
