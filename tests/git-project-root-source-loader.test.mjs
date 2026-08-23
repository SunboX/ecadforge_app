import assert from 'node:assert/strict'
import test from 'node:test'
import { GitProjectRootSourceLoader } from '../src/GitProjectRootSourceLoader.mjs'
import { GitHubSourceLoader } from '../src/GitHubSourceLoader.mjs'
import { GitSourceUrlResolver } from '../src/GitSourceUrlResolver.mjs'

const GITHUB_RATE_LIMIT_URL = 'https://api.github.com/rate_limit'

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

            if (!value) return new Response('missing', { status: 404 })
            if (typeof value === 'string') {
                return new Response(value, { status: 200 })
            }

            return new Response(value.body || '', { status: value.status })
        }
    }
}

test('GitHubSourceLoader encodes a percent-escaped metadata default branch once', async () => {
    const branch = 'release%2Fstable'
    const metadataApiUrl = 'https://api.github.com/repos/acme/demo'
    const contentsApiUrl =
        'https://api.github.com/repos/acme/demo/contents?ref=release%252Fstable'
    const rawUrl =
        'https://raw.githubusercontent.com/acme/demo/release%252Fstable/board.kicad_pcb'
    const { fetcher, urls } = createFetchDouble({
        [metadataApiUrl]: JSON.stringify({ default_branch: branch }),
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: { core: { remaining: 60 } }
        }),
        [contentsApiUrl]: JSON.stringify([
            { name: 'board.kicad_pcb', type: 'file', download_url: rawUrl }
        ]),
        [rawUrl]: '(kicad_pcb)'
    })

    await new GitHubSourceLoader({ fetcher }).loadUrl(
        'https://github.com/acme/demo'
    )

    assert.deepEqual(urls, [
        metadataApiUrl,
        GITHUB_RATE_LIMIT_URL,
        contentsApiUrl,
        rawUrl
    ])
})

test('GitHubSourceLoader encodes a bare percent metadata default branch once', async () => {
    const branch = 'release-100%'
    const metadataApiUrl = 'https://api.github.com/repos/acme/demo'
    const contentsApiUrl =
        'https://api.github.com/repos/acme/demo/contents?ref=release-100%25'
    const rawUrl =
        'https://raw.githubusercontent.com/acme/demo/release-100%25/board.kicad_pcb'
    const { fetcher, urls } = createFetchDouble({
        [metadataApiUrl]: JSON.stringify({ default_branch: branch }),
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: { core: { remaining: 60 } }
        }),
        [contentsApiUrl]: JSON.stringify([
            { name: 'board.kicad_pcb', type: 'file', download_url: rawUrl }
        ]),
        [rawUrl]: '(kicad_pcb)'
    })

    await new GitHubSourceLoader({ fetcher }).loadUrl(
        'https://github.com/acme/demo'
    )

    assert.deepEqual(urls, [
        metadataApiUrl,
        GITHUB_RATE_LIMIT_URL,
        contentsApiUrl,
        rawUrl
    ])
})

test('GitHubSourceLoader keeps a percent-escaped GitLab metadata branch in subsequent raw URLs', async () => {
    const branch = 'release%2Fstable'
    const metadataApiUrl =
        'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo'
    const treeApiUrl =
        'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo/repository/tree?ref=release%252Fstable&per_page=100'
    const rawApiUrl =
        'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo/repository/files/board.kicad_pcb/raw?ref=release%252Fstable'
    const { fetcher, urls } = createFetchDouble({
        [metadataApiUrl]: JSON.stringify({ default_branch: branch }),
        [treeApiUrl]: JSON.stringify([
            { name: 'board.kicad_pcb', type: 'blob', path: 'board.kicad_pcb' }
        ]),
        [rawApiUrl]: '(kicad_pcb)'
    })

    await new GitHubSourceLoader({ fetcher }).loadUrl(
        'https://gitlab.com/acme/hardware/demo'
    )

    assert.deepEqual(urls, [metadataApiUrl, treeApiUrl, rawApiUrl])
})

test('GitHubSourceLoader keeps a bare percent GitLab metadata branch in subsequent raw URLs', async () => {
    const branch = 'release-100%'
    const metadataApiUrl =
        'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo'
    const treeApiUrl =
        'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo/repository/tree?ref=release-100%25&per_page=100'
    const rawApiUrl =
        'https://gitlab.com/api/v4/projects/acme%2Fhardware%2Fdemo/repository/files/board.kicad_pcb/raw?ref=release-100%25'
    const { fetcher, urls } = createFetchDouble({
        [metadataApiUrl]: JSON.stringify({ default_branch: branch }),
        [treeApiUrl]: JSON.stringify([
            { name: 'board.kicad_pcb', type: 'blob', path: 'board.kicad_pcb' }
        ]),
        [rawApiUrl]: '(kicad_pcb)'
    })

    await new GitHubSourceLoader({ fetcher }).loadUrl(
        'https://gitlab.com/acme/hardware/demo'
    )

    assert.deepEqual(urls, [metadataApiUrl, treeApiUrl, rawApiUrl])
})

test('GitSourceUrlResolver rejects malformed GitHub and GitLab root tree URLs', () => {
    assert.throws(
        () =>
            GitSourceUrlResolver.normalizeTreeUrl(
                'https://github.com/acme/demo/tree'
            ),
        /GitHub tree URLs must include owner, repository, and branch/
    )
    assert.throws(
        () =>
            GitSourceUrlResolver.normalizeSourceUrl(
                'https://gitlab.com/acme/demo/-/tree'
            ),
        /Only GitLab blob\/raw file URLs or tree folder URLs are supported/
    )
})

test('GitSourceUrlResolver rejects pathless GitLab blob and raw URLs', () => {
    for (const action of ['blob', 'raw']) {
        assert.throws(
            () =>
                GitSourceUrlResolver.normalizeSourceUrl(
                    'https://gitlab.com/acme/demo/-/' + action + '/release-x'
                ),
            /Only GitLab blob\/raw file URLs or tree folder URLs are supported/
        )
    }
})

test('GitSourceUrlResolver preserves explicitly encoded GitHub blob, tree, and path inputs', () => {
    const encodedRef = 'release%2Fstable'
    const encodedPath = 'hardware%20one'
    const rawUrl =
        'https://raw.githubusercontent.com/acme/demo/release%2Fstable/hardware%20one/board.kicad_pcb'

    assert.equal(
        GitSourceUrlResolver.normalizeSourceUrl(
            'https://github.com/acme/demo/blob/' +
                encodedRef +
                '/' +
                encodedPath +
                '/board.kicad_pcb'
        ).rawUrl,
        rawUrl
    )
    assert.equal(
        GitSourceUrlResolver.normalizeTreeUrl(
            'https://github.com/acme/demo/tree/' +
                encodedRef +
                '/' +
                encodedPath
        ).apiUrl,
        'https://api.github.com/repos/acme/demo/contents/hardware%20one?ref=release%2Fstable'
    )
    assert.equal(
        GitSourceUrlResolver.normalizeGitHubPath(
            'acme/demo/' + encodedPath + '/board.kicad_pcb',
            encodedRef
        ).rawUrl,
        rawUrl
    )
})

test('GitProjectRootSourceLoader rejects missing and empty default branches', async () => {
    const source = {
        provider: 'github',
        providerLabel: 'GitHub',
        metadataApiUrl: 'https://api.github.com/repos/acme/demo',
        owner: 'acme',
        repositoryName: 'demo'
    }

    for (const payload of [{}, { default_branch: '  ' }]) {
        await assert.rejects(
            () =>
                GitProjectRootSourceLoader.resolve(
                    source,
                    async () => new Response(JSON.stringify(payload))
                ),
            /GitHub project does not expose a default branch/
        )
    }
})

test('GitProjectRootSourceLoader reports metadata network failures', async () => {
    await assert.rejects(
        () =>
            GitProjectRootSourceLoader.resolve(
                {
                    provider: 'github',
                    metadataApiUrl: 'https://api.github.com/repos/acme/demo'
                },
                async () => {
                    throw new Error('offline')
                }
            ),
        /Could not fetch the GitHub project metadata/
    )
})

test('GitProjectRootSourceLoader reports metadata HTTP failures', async () => {
    await assert.rejects(
        () =>
            GitProjectRootSourceLoader.resolve(
                {
                    provider: 'gitlab',
                    metadataApiUrl:
                        'https://gitlab.com/api/v4/projects/acme%2Fdemo'
                },
                async () => new Response('missing', { status: 404 })
            ),
        /GitLab returned HTTP 404 for the requested project/
    )
})

test('GitProjectRootSourceLoader reports metadata JSON failures', async () => {
    await assert.rejects(
        () =>
            GitProjectRootSourceLoader.resolve(
                {
                    provider: 'github',
                    metadataApiUrl: 'https://api.github.com/repos/acme/demo'
                },
                async () => new Response('not json')
            ),
        /Could not read the GitHub project metadata/
    )
})

test('GitProjectRootSourceLoader reports invalid metadata payloads', async () => {
    await assert.rejects(
        () =>
            GitProjectRootSourceLoader.resolve(
                {
                    provider: 'gitlab',
                    metadataApiUrl:
                        'https://gitlab.com/api/v4/projects/acme%2Fdemo'
                },
                async () => new Response(JSON.stringify([]))
            ),
        /The GitLab project metadata response is invalid/
    )
})
