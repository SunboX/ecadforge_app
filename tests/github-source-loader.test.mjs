import assert from 'node:assert/strict'
import test from 'node:test'
import { GitHubSourceLoader } from '../src/GitHubSourceLoader.mjs'

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

test('GitHubSourceLoader accepts standalone CircuitJSON raw URLs', async () => {
    const rawUrl = 'https://raw.githubusercontent.com/acme/demo/main/board.json'
    const { fetcher } = createFetchDouble({
        [rawUrl]: '[{"type":"pcb_board","pcb_board_id":"board_1"}]'
    })
    const loader = new GitHubSourceLoader({ fetcher })

    const result = await loader.loadUrl(rawUrl)

    assert.equal(result.formatFamily, 'circuitjson')
    assert.equal(result.rawUrl, rawUrl)
    assert.equal(result.boardUrl, '')
    assert.deepEqual(
        result.entries.map((entry) => entry.name),
        ['board.json']
    )
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

test('GitHubSourceLoader discovers a KiCad project from GitHub tree folders', async () => {
    const apiUrl =
        'https://api.github.com/repos/acme/demo/contents/hardware/project?ref=main'
    const baseUrl =
        'https://raw.githubusercontent.com/acme/demo/main/hardware/project/board'
    const { fetcher, urls } = createFetchDouble({
        [apiUrl]: JSON.stringify([
            {
                name: 'board.kicad_pro',
                type: 'file',
                download_url: baseUrl + '.kicad_pro'
            },
            {
                name: 'board.kicad_sch',
                type: 'file',
                download_url: baseUrl + '.kicad_sch'
            },
            {
                name: 'board.kicad_pcb',
                type: 'file',
                download_url: baseUrl + '.kicad_pcb'
            }
        ]),
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: { core: { remaining: 60 } }
        }),
        [baseUrl + '.kicad_pro']: '{}',
        [baseUrl + '.kicad_sch']: '(kicad_sch)',
        [baseUrl + '.kicad_pcb']: '(kicad_pcb)'
    })
    const loader = new GitHubSourceLoader({ fetcher })

    const result = await loader.loadUrl(
        'https://github.com/acme/demo/tree/main/hardware/project'
    )

    assert.deepEqual(urls, [
        GITHUB_RATE_LIMIT_URL,
        apiUrl,
        baseUrl + '.kicad_pro',
        baseUrl + '.kicad_sch',
        baseUrl + '.kicad_pcb'
    ])
    assert.deepEqual(
        result.entries.map((entry) => entry.name),
        ['board.kicad_pro', 'board.kicad_sch', 'board.kicad_pcb']
    )
    assert.equal(result.rawUrl, baseUrl + '.kicad_pro')
    assert.equal(result.boardUrl, baseUrl + '.kicad_pcb')
})

test('GitHubSourceLoader resolves Altium project manifests before generated folder zips', async () => {
    const apiUrl =
        'https://api.github.com/repos/acme/demo/contents/hardware/project?ref=main'
    const baseUrl =
        'https://raw.githubusercontent.com/acme/demo/main/hardware/project/'
    const projectUrl = baseUrl + 'Demo.PrjPcb'
    const schematicUrl = baseUrl + 'Schematics/Main.SchDoc'
    const boardUrl = baseUrl + 'PCB/Main.PcbDoc'
    const zipUrl = baseUrl + 'Demo_DFM.zip'
    const { fetcher, urls } = createFetchDouble({
        [apiUrl]: JSON.stringify([
            {
                name: 'Demo.PrjPcb',
                type: 'file',
                download_url: projectUrl
            },
            {
                name: 'Demo_DFM.zip',
                type: 'file',
                download_url: zipUrl
            }
        ]),
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: { core: { remaining: 60 } }
        }),
        [projectUrl]:
            '[Document1]\n' +
            'DocumentPath=Schematics\\Main.SchDoc\n' +
            '[Document2]\n' +
            'DocumentPath=Libraries\\Ignored.SchLib\n' +
            '[Document3]\n' +
            'DocumentPath=PCB\\Main.PcbDoc\n',
        [schematicUrl]: '|HEADER=Schematic Document',
        [boardUrl]: '|HEADER=Protel for Windows - PCB'
    })
    const loader = new GitHubSourceLoader({ fetcher })

    const result = await loader.loadUrl(
        'https://github.com/acme/demo/tree/main/hardware/project'
    )

    assert.deepEqual(urls, [
        GITHUB_RATE_LIMIT_URL,
        apiUrl,
        projectUrl,
        'https://api.github.com/repos/acme/demo/contents/hardware/project/3D%20Bodies?ref=main',
        projectUrl,
        schematicUrl,
        boardUrl
    ])
    assert.equal(result.formatFamily, 'altium')
    assert.equal(result.rawUrl, projectUrl)
    assert.equal(result.boardUrl, boardUrl)
    assert.deepEqual(
        result.entries.map((entry) => entry.name),
        ['Demo.PrjPcb', 'Schematics/Main.SchDoc', 'PCB/Main.PcbDoc']
    )
})

test('GitHubSourceLoader fetches Altium project-local board assembly assets', async () => {
    const apiUrl =
        'https://api.github.com/repos/acme/demo/contents/hardware/project?ref=main'
    const bodiesApiUrl =
        'https://api.github.com/repos/acme/demo/contents/hardware/project/3D%20Bodies?ref=main'
    const baseUrl =
        'https://raw.githubusercontent.com/acme/demo/main/hardware/project/'
    const projectUrl = baseUrl + 'Demo.PrjPcb'
    const boardUrl = baseUrl + 'PCB/FixtureBoard.PcbDoc'
    const assemblyUrl = baseUrl + '3D%20Bodies/FixtureBoard.step'
    const { fetcher, urls } = createFetchDouble({
        [apiUrl]: JSON.stringify([
            {
                name: 'Demo.PrjPcb',
                type: 'file',
                download_url: projectUrl
            }
        ]),
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: { core: { remaining: 60 } }
        }),
        [projectUrl]: 'DocumentPath=PCB\\FixtureBoard.PcbDoc\n',
        [boardUrl]: '|HEADER=Protel for Windows - PCB',
        [bodiesApiUrl]: JSON.stringify([
            {
                name: 'FixtureBoard.step',
                type: 'file',
                download_url: assemblyUrl
            },
            {
                name: 'notes.txt',
                type: 'file',
                download_url: baseUrl + '3D%20Bodies/notes.txt'
            }
        ]),
        [assemblyUrl]: 'ISO-10303-21;'
    })
    const loader = new GitHubSourceLoader({ fetcher })

    const result = await loader.loadUrl(
        'https://github.com/acme/demo/tree/main/hardware/project'
    )

    assert.ok(urls.includes(bodiesApiUrl))
    assert.ok(urls.includes(assemblyUrl))
    assert.deepEqual(
        result.assets.map((asset) => ({
            name: asset.name,
            relativePath: asset.relativePath,
            format: asset.format
        })),
        [
            {
                name: 'FixtureBoard.step',
                relativePath: '3D Bodies/FixtureBoard.step',
                format: 'step'
            }
        ]
    )
})

test('GitHubSourceLoader reports exhausted folder discovery rate limit before listing folders', async () => {
    const apiUrl =
        'https://api.github.com/repos/acme/demo/contents/hardware/project?ref=main'
    const { fetcher, urls } = createFetchDouble({
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: {
                core: {
                    remaining: 0,
                    reset: 1780510776
                }
            }
        })
    })
    const loader = new GitHubSourceLoader({ fetcher })

    await assert.rejects(
        () =>
            loader.loadUrl(
                'https://github.com/acme/demo/tree/main/hardware/project'
            ),
        (error) => {
            const message = String(error?.message || '')
            assert.match(message, /GitHub API rate limit is exhausted/)
            assert.match(message, /Try again after .+ \(local time\)\./)
            assert.doesNotMatch(
                message,
                /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/
            )
            return true
        }
    )
    assert.deepEqual(urls, [GITHUB_RATE_LIMIT_URL])
    assert.ok(!urls.includes(apiUrl))
})

test('GitHubSourceLoader fetches project-local KiCad 3D model assets', async () => {
    const apiUrl =
        'https://api.github.com/repos/acme/demo/contents/hardware/project?ref=main'
    const baseUrl =
        'https://raw.githubusercontent.com/acme/demo/main/hardware/project/board'
    const modelUrl =
        'https://raw.githubusercontent.com/acme/demo/main/hardware/project/parts/body.step'
    const boardSource = `
        (kicad_pcb
            (footprint "Fixture:Body"
                (property "Reference" "U1")
                (property "Value" "Body")
                (at 1 2 90)
                (layer "F.Cu")
                (model "\${KIPRJMOD}/parts/body.step"
                    (offset (xyz 1.25 -2 1.5))
                    (scale (xyz 2 3 4))
                    (rotate (xyz 0 0 90))
                )
            )
        )
    `
    const { fetcher, urls } = createFetchDouble({
        [apiUrl]: JSON.stringify([
            {
                name: 'board.kicad_pro',
                type: 'file',
                download_url: baseUrl + '.kicad_pro'
            },
            {
                name: 'board.kicad_sch',
                type: 'file',
                download_url: baseUrl + '.kicad_sch'
            },
            {
                name: 'board.kicad_pcb',
                type: 'file',
                download_url: baseUrl + '.kicad_pcb'
            }
        ]),
        [GITHUB_RATE_LIMIT_URL]: JSON.stringify({
            resources: { core: { remaining: 60 } }
        }),
        [baseUrl + '.kicad_pro']: '{}',
        [baseUrl + '.kicad_sch']: '(kicad_sch)',
        [baseUrl + '.kicad_pcb']: boardSource,
        [modelUrl]: 'ISO-10303-21;'
    })
    const loader = new GitHubSourceLoader({ fetcher })

    const result = await loader.loadUrl(
        'https://github.com/acme/demo/tree/main/hardware/project'
    )

    assert.ok(urls.includes(modelUrl))
    assert.deepEqual(
        result.assets.map((asset) => ({
            name: asset.name,
            relativePath: asset.relativePath,
            format: asset.format
        })),
        [
            {
                name: 'body.step',
                relativePath: 'parts/body.step',
                format: 'step'
            }
        ]
    )
    assert.deepEqual(result.modelReferences, [
        {
            designator: 'U1',
            modelName: 'body.step',
            modelPath: '\${KIPRJMOD}/parts/body.step',
            relativePath: 'parts/body.step',
            modelTransform: {
                rotationDeg: { x: 0, y: 0, z: 90 },
                offsetMil: {
                    x: 49.21259842519685,
                    y: -78.74015748031496,
                    z: 59.05511811023622
                },
                dxMil: 49.21259842519685,
                dyMil: -78.74015748031496,
                scale: { x: 2, y: 3, z: 4 },
                dzMil: 59.05511811023622
            }
        }
    ])
})

test('GitHubSourceLoader rejects unsupported source files before fetching', async () => {
    const { fetcher, urls } = createFetchDouble({})
    const loader = new GitHubSourceLoader({ fetcher })

    await assert.rejects(
        () =>
            loader.loadUrl(
                'https://raw.githubusercontent.com/a/b/main/readme.md'
            ),
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
