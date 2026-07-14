import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadModelSourceClient } from '../../src/core/ecad/EcadModelSourceClient.mjs'

test('EcadModelSourceClient resolves provider search and model assets', async () => {
    const requestedUrls = []
    const requestedSignals = []
    const fetcher = async (url, options) => {
        requestedUrls.push(String(url))
        requestedSignals.push(options.signal instanceof AbortSignal)

        if (String(url).includes('/lookup?')) {
            return Response.json({
                results: [{ id: 'component-a', name: 'Component A' }]
            })
        }

        if (String(url).endsWith('/components/component-a')) {
            return Response.json({
                id: 'component-a',
                models: [
                    {
                        name: 'asset.step',
                        format: 'step',
                        sourceUrl: 'assets/component-a.step'
                    }
                ]
            })
        }

        return new Response('ISO-10303-21;', {
            headers: { 'content-type': 'model/step' }
        })
    }
    const client = new EcadModelSourceClient({
        fetcher,
        baseUrl: 'https://example.invalid/api/',
        searchPath: 'lookup',
        componentPath: 'components/{id}'
    })

    const rows = await client.searchComponents('FAKE PART', { limit: 1 })
    const bundle = await client.fetchComponentBundle(rows[0].id)
    const bytes = await client.fetchBinaryAsset(bundle.models[0].sourceUrl)

    assert.deepEqual(rows, [{ id: 'component-a', name: 'Component A' }])
    assert.equal(bundle.models[0].name, 'asset.step')
    assert.equal(new TextDecoder().decode(bytes), 'ISO-10303-21;')
    assert.deepEqual(requestedUrls, [
        'https://example.invalid/api/lookup?q=FAKE+PART&limit=1',
        'https://example.invalid/api/components/component-a',
        'https://example.invalid/api/assets/component-a.step'
    ])
    assert.deepEqual(requestedSignals, [true, true, true])
})

test('EcadModelSourceClient resolves relative same-origin provider URLs', async () => {
    const requestedUrls = []
    const client = new EcadModelSourceClient({
        fetcher: async (url) => {
            requestedUrls.push(String(url))
            return Response.json({ results: [] })
        },
        baseUrl: '/api/component-source/'
    })

    const rows = await client.searchComponents('FAKE PART', { limit: 1 })

    assert.deepEqual(rows, [])
    assert.deepEqual(requestedUrls, [
        'http://localhost/api/component-source/search?q=FAKE+PART&limit=1'
    ])
})

test('EcadModelSourceClient falls back to PHP component-source endpoint', async () => {
    const requestedUrls = []
    const client = new EcadModelSourceClient({
        fetcher: async (url) => {
            requestedUrls.push(String(url))
            if (String(url).includes('/component-source/search?')) {
                return new Response('missing', { status: 404 })
            }
            return Response.json({ results: [] })
        },
        baseUrl: '/api/component-source/',
        fallbackBaseUrl: '/api/component-source.php'
    })

    const rows = await client.searchComponents('FAKE PART', { limit: 1 })

    assert.deepEqual(rows, [])
    assert.deepEqual(requestedUrls, [
        'http://localhost/api/component-source/search?q=FAKE+PART&limit=1',
        'http://localhost/api/component-source.php?path=search&q=FAKE+PART&limit=1'
    ])
})
