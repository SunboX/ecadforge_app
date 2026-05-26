import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubSourceLoader } from '../src/GitHubSourceLoader.mjs'

/**
 * Builds a fetch double from URL-to-body mappings.
 * @param {Record<string, string | { status: number, body?: string }>} bodies
 * @returns {{ fetcher: (url: string) => Promise<Response>, urls: string[] }}
 */
function createFetchDouble(bodies) {
    const urls = []

    return {
        urls,
        async fetcher(url) {
            urls.push(String(url))
            const value = bodies[String(url)]

            if (!value) {
                return new Response('missing', { status: 404 })
            }

            if (typeof value === 'string') {
                return new Response(value, { status: 200 })
            }

            return new Response(value.body || '', { status: value.status })
        }
    }
}

test('GitHubSourceLoader converts GitHub blob URLs to raw URLs', () => {
    const resolved = GitHubSourceLoader.normalizeSourceUrl(
        'https://github.com/acme/demo/blob/main/hardware/board.kicad_pcb'
    )

    assert.equal(
        resolved.rawUrl,
        'https://raw.githubusercontent.com/acme/demo/main/hardware/board.kicad_pcb'
    )
    assert.equal(resolved.fileName, 'board.kicad_pcb')
    assert.equal(resolved.formatFamily, 'kicad')
})

test('GitHubSourceLoader resolves github query paths through raw GitHub URLs', () => {
    const resolved = GitHubSourceLoader.normalizeGitHubPath(
        'acme/demo/hardware/main.PcbDoc',
        'release'
    )

    assert.equal(
        resolved.rawUrl,
        'https://raw.githubusercontent.com/acme/demo/release/hardware/main.PcbDoc'
    )
    assert.equal(resolved.fileName, 'main.PcbDoc')
    assert.equal(resolved.formatFamily, 'altium')
})

test('GitHubSourceLoader fetches KiCad project siblings with the same stem', async () => {
    const baseUrl =
        'https://raw.githubusercontent.com/acme/demo/main/hardware/board'
    const { fetcher, urls } = createFetchDouble({
        [baseUrl + '.kicad_pro']: '{}',
        [baseUrl + '.kicad_sch']: '(kicad_sch)',
        [baseUrl + '.kicad_pcb']: '(kicad_pcb)'
    })
    const loader = new GitHubSourceLoader({ fetcher })

    const result = await loader.loadUrl(baseUrl + '.kicad_pro')

    assert.deepEqual(urls, [
        baseUrl + '.kicad_pro',
        baseUrl + '.kicad_sch',
        baseUrl + '.kicad_pcb'
    ])
    assert.deepEqual(
        result.entries.map((entry) => entry.name),
        ['board.kicad_pro', 'board.kicad_sch', 'board.kicad_pcb']
    )
    assert.equal(result.boardUrl, baseUrl + '.kicad_pcb')
})

test('GitHubSourceLoader rejects unsupported source files before fetching', async () => {
    const { fetcher, urls } = createFetchDouble({})
    const loader = new GitHubSourceLoader({ fetcher })

    await assert.rejects(
        () => loader.loadUrl('https://raw.githubusercontent.com/a/b/main/readme.md'),
        /not supported/
    )
    assert.deepEqual(urls, [])
})

test('GitHubSourceLoader reports HTTP fetch failures clearly', async () => {
    const url = 'https://raw.githubusercontent.com/acme/demo/main/bad.PcbDoc'
    const loader = new GitHubSourceLoader({
        fetcher: async () => new Response('missing', { status: 404 })
    })

    await assert.rejects(() => loader.loadUrl(url), /GitHub returned HTTP 404/)
})
