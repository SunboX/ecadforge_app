import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const serverEntryPath = fileURLToPath(
    new URL('../src/server.mjs', import.meta.url)
)

/**
 * Allocates an available TCP port for the spawned server process.
 * @returns {Promise<number>}
 */
async function allocatePort() {
    return await new Promise((resolve, reject) => {
        const probeServer = createServer()

        probeServer.once('error', reject)
        probeServer.listen(0, '127.0.0.1', () => {
            const address = probeServer.address()
            if (!address || typeof address === 'string') {
                probeServer.close()
                reject(new Error('Unable to resolve an available TCP port'))
                return
            }

            probeServer.close((error) => {
                if (error) {
                    reject(error)
                    return
                }
                resolve(address.port)
            })
        })
    })
}

/**
 * Waits until the server process logs that it is listening on the requested
 * port, or rejects with captured process output if the process exits first.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} childProcess
 * @param {number} port
 * @returns {Promise<{ stdout: string, stderr: string }>}
 */
async function waitForServerListening(childProcess, port) {
    return await new Promise((resolve, reject) => {
        const listeningMessage =
            'Server listening on http://localhost:' + String(port)
        let stdout = ''
        let stderr = ''
        let settled = false

        const cleanup = () => {
            clearTimeout(timeoutId)
            childProcess.stdout.off('data', handleStdout)
            childProcess.stderr.off('data', handleStderr)
            childProcess.off('error', handleError)
            childProcess.off('exit', handleExit)
        }

        const settle = (callback) => {
            if (settled) return
            settled = true
            cleanup()
            callback()
        }

        const handleStdout = (chunk) => {
            stdout += String(chunk)
            if (stdout.includes(listeningMessage)) {
                settle(() => resolve({ stdout, stderr }))
            }
        }

        const handleStderr = (chunk) => {
            stderr += String(chunk)
        }

        const handleError = (error) => {
            settle(() => reject(error))
        }

        const handleExit = (code, signal) => {
            const output = [stderr.trim(), stdout.trim()]
                .filter(Boolean)
                .join('\n')
            const details = output ? '\n' + output : ''
            settle(() => {
                reject(
                    new Error(
                        'Server exited before listening (code=' +
                            String(code) +
                            ', signal=' +
                            String(signal) +
                            ')' +
                            details
                    )
                )
            })
        }

        const timeoutId = setTimeout(() => {
            const output = [stderr.trim(), stdout.trim()]
                .filter(Boolean)
                .join('\n')
            const details = output ? '\n' + output : ''
            settle(() => {
                reject(
                    new Error(
                        'Timed out waiting for server startup on port ' +
                            String(port) +
                            details
                    )
                )
            })
        }, 5000)

        childProcess.stdout.on('data', handleStdout)
        childProcess.stderr.on('data', handleStderr)
        childProcess.once('error', handleError)
        childProcess.once('exit', handleExit)
    })
}

/**
 * Stops the spawned server process if it is still running.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} childProcess
 * @returns {Promise<void>}
 */
async function stopChildProcess(childProcess) {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
        return
    }

    childProcess.kill('SIGTERM')
    await once(childProcess, 'exit')
}

/**
 * Verifies the browser server entrypoint boots and starts listening.
 */
test('server entrypoint starts listening on the configured port', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    const output = await waitForServerListening(childProcess, port)
    assert.match(output.stdout, new RegExp('localhost:' + String(port)))
})

/**
 * Verifies frontend modules are served with no-store cache headers so browser
 * reloads do not keep stale parser worker code after local edits.
 */
test('server serves static app modules with no-store cache headers', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' + String(port) + '/main.mjs'
    )

    assert.equal(response.ok, true)
    assert.match(
        String(response.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies the server exposes vendored Three.js browser modules with the same
 * no-store policy used by the app source.
 */
test('server serves browser vendor modules with no-store cache headers', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/vendor/three/build/three.module.js'
    )

    assert.equal(response.ok, true)
    assert.match(
        String(response.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies the local server exposes raw node_modules browser dependencies so
 * localhost matches the static FTP deployment shape.
 */
test('server serves browser node_modules modules with no-store cache headers', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/node_modules/three/examples/jsm/controls/OrbitControls.js'
    )

    assert.equal(response.ok, true)
    assert.match(
        String(response.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies the local browser server exposes the browser-safe fflate package
 * module used by the Altium Toolkit parser.
 */
test('server serves the fflate browser module with no-store cache headers', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/node_modules/fflate/esm/browser.js'
    )

    assert.equal(response.ok, true)
    assert.match(
        String(response.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies Three.js addon loader modules are rewritten for direct browser use
 * instead of retaining bare package imports.
 */
test('server rewrites browser vendor addon modules away from bare three imports', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/vendor/three/examples/jsm/loaders/VRMLLoader.js'
    )
    const source = await response.text()

    assert.equal(response.ok, true)
    assert.doesNotMatch(source, /from 'three'/)
    assert.match(
        source,
        /from ['"]\/vendor\/three\/build\/three\.module\.js(?:\?v=[^'"]+)?['"]/
    )
})

/**
 * Verifies the served Three.js core module graph keeps the requested app
 * version on its internal relative imports so browser ESM caches cannot mix
 * fresh app code with stale Three internals.
 */
test('server rewrites Three.js build module relative imports with the current version key', async (t) => {
    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url),
        'utf8'
    )
    const pkg = JSON.parse(packageRaw)
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/vendor/three/build/three.module.js?v=' +
            encodeURIComponent(String(pkg.version))
    )
    const source = await response.text()

    assert.equal(response.ok, true)
    assert.match(
        source,
        new RegExp(
            'from [\'"]\\./three\\.core\\.js\\?v=' + pkg.version + '[\'"]'
        )
    )
})

/**
 * Verifies browser-served Altium Toolkit parser modules are rewritten so
 * worker module graphs do not depend on the page import map.
 */
test('server rewrites browser Altium Toolkit parser module bare imports', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/node_modules/altium-toolkit/src/core/altium/PcbEmbeddedModelExtractor.mjs'
    )
    const source = await response.text()

    assert.equal(response.ok, true)
    assert.doesNotMatch(source, /node:zlib/)
    assert.doesNotMatch(source, /from ['"]fflate['"]/)
    assert.match(
        source,
        /from ['"]\/node_modules\/fflate\/esm\/browser\.js(?:\?v=[^'"]+)?['"]/
    )
    assert.match(
        String(response.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies browser-served Scene3D viewer modules are rewritten so package
 * source copied from the sibling library can run under static browser paths.
 */
test('server rewrites browser Scene3D viewer module bare imports', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const response = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/node_modules/pcb-scene3d-viewer/src/PcbScene3dCircuitJsonAdapter.mjs'
    )
    const source = await response.text()

    assert.equal(response.ok, true)
    assert.doesNotMatch(source, /from ['"]circuitjson-toolkit['"]/)
    assert.match(
        source,
        /from ['"]\/node_modules\/circuitjson-toolkit\/src\/index\.mjs(?:\?v=[^'"]+)?['"]/
    )
    assert.match(
        String(response.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies the browser-runnable STEP importer assets are served from the local
 * vendor path with the same cache policy as other runtime assets.
 */
test('server serves browser STEP importer javascript and wasm assets', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const expectedJsSource = await readFile(
        new URL(
            '../src/vendor/occt-import-js/dist/occt-import-js.js',
            import.meta.url
        ),
        'utf8'
    )
    const expectedWasmSource = await readFile(
        new URL(
            '../src/vendor/occt-import-js/dist/occt-import-js.wasm',
            import.meta.url
        )
    )
    const jsResponse = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/vendor/occt-import-js/dist/occt-import-js.js'
    )
    const wasmResponse = await fetch(
        'http://127.0.0.1:' +
            String(port) +
            '/vendor/occt-import-js/dist/occt-import-js.wasm'
    )

    assert.equal(jsResponse.ok, true)
    assert.equal(wasmResponse.ok, true)
    assert.equal(await jsResponse.text(), expectedJsSource)
    assert.deepEqual(
        Buffer.from(await wasmResponse.arrayBuffer()),
        expectedWasmSource
    )
    assert.match(
        String(jsResponse.headers.get('cache-control') || ''),
        /no-store/i
    )
    assert.match(
        String(wasmResponse.headers.get('cache-control') || ''),
        /no-store/i
    )
})

/**
 * Verifies the vendored STEP importer worker keeps the app-owned wasm loading
 * cache while loading the ESM-shaped importer as a module.
 */
test('vendored STEP importer worker caches wasm binary instantiation inputs', async () => {
    const workerSource = await readFile(
        new URL(
            '../src/vendor/occt-import-js/dist/occt-import-js-worker.js',
            import.meta.url
        ),
        'utf8'
    )

    assert.match(workerSource, /wasmBinaryPromise/)
    assert.match(workerSource, /function InstantiateWasm/)
    assert.match(
        workerSource,
        /WebAssembly\.instantiate\(wasmBinary, imports\)/
    )
    assert.match(workerSource, /credentials:\s*'same-origin'/)
    assert.match(workerSource, /new URL\(self\.location\.href\)\.search/)
    assert.match(workerSource, /import\(\s*importerUrl\.href\s*\)/)
    assert.doesNotMatch(workerSource, /importScripts/)
})

/**
 * Verifies the server rewrites frontend entrypoints and module imports with
 * the current app version so browser ESM graphs cannot keep stale parser code.
 */
test('server serves versioned HTML and module imports', async (t) => {
    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url),
        'utf8'
    )
    const pkg = JSON.parse(packageRaw)
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const baseUrl = 'http://127.0.0.1:' + String(port)
    const appMetaResponse = await fetch(baseUrl + '/api/app-meta')
    const appMeta = await appMetaResponse.json()
    const versionSuffix = '?v=' + String(appMeta.version)
    const indexResponse = await fetch(baseUrl + '/')
    const indexHtml = await indexResponse.text()
    const mainResponse = await fetch(baseUrl + '/main.mjs' + versionSuffix)
    const mainSource = await mainResponse.text()
    const workerResponse = await fetch(
        baseUrl + '/workers/ecad-parser.worker.mjs' + versionSuffix
    )
    const workerSource = await workerResponse.text()
    const parserServiceResponse = await fetch(
        baseUrl + '/core/ecad/EcadParserService.mjs' + versionSuffix
    )
    const parserServiceSource = await parserServiceResponse.text()
    const sceneWorkerResponse = await fetch(
        baseUrl + '/workers/pcb-scene3d.worker.mjs' + versionSuffix
    )
    const sceneWorkerSource = await sceneWorkerResponse.text()

    assert.equal(appMeta.version, pkg.version)
    assert.equal(indexResponse.ok, true)
    assert.match(indexHtml, new RegExp('/style\\.css\\?v=' + appMeta.version))
    assert.match(indexHtml, new RegExp('/main\\.mjs\\?v=' + appMeta.version))

    assert.equal(mainResponse.ok, true)
    assert.match(
        mainSource,
        new RegExp('\\./AppController\\.mjs\\?v=' + appMeta.version)
    )
    assert.match(
        mainSource,
        new RegExp('\\./WorkerUrlBuilder\\.mjs\\?v=' + appMeta.version)
    )

    assert.equal(workerResponse.ok, true)
    assert.doesNotMatch(
        workerSource,
        /from ['"]\.\.\/core\/ecad\/EcadParserService\.mjs['"]/
    )
    assert.match(
        workerSource,
        /from ['"]\.\.\/core\/ecad\/EcadParserService\.mjs\?v=/
    )

    assert.equal(parserServiceResponse.ok, true)
    assert.doesNotMatch(parserServiceSource, /from ['"]circuitjson-toolkit['"]/)
    assert.match(
        parserServiceSource,
        /from ['"]\/node_modules\/circuitjson-toolkit\/src\/index\.mjs\?v=/
    )

    assert.equal(sceneWorkerResponse.ok, true)
    assert.doesNotMatch(
        sceneWorkerSource,
        /from ['"]altium-toolkit\/scene3d['"]/
    )
    assert.match(
        sceneWorkerSource,
        /from ['"]\.\.\/core\/ecad\/EcadScene3dService\.mjs\?v=/
    )
})

/**
 * Verifies public pages and crawler assets are reachable without auth and do
 * not expose accidental noindex directives.
 */
test('server exposes public indexable app URLs and crawl assets', async (t) => {
    const port = await allocatePort()
    const childProcess = spawn(process.execPath, [serverEntryPath], {
        env: { ...process.env, PORT: String(port) },
        stdio: ['ignore', 'pipe', 'pipe']
    })

    t.after(async () => {
        await stopChildProcess(childProcess)
    })

    await waitForServerListening(childProcess, port)

    const baseUrl = 'http://127.0.0.1:' + String(port)
    const publicPaths = [
        '/',
        '/index.html',
        '/schematic',
        '/pcb',
        '/3d',
        '/bom',
        '/diagnostics',
        '/demo/kicad',
        '/demo/altium',
        '/altium-pcbdoc-viewer',
        '/altium-schdoc-viewer',
        '/kicad-viewer-online',
        '/kicad-project-viewer',
        '/ecad-viewer-no-upload',
        '/altium-kicad-browser-viewer',
        '/pcb-3d-viewer-browser',
        '/bom-viewer-kicad-altium',
        '/robots.txt',
        '/sitemap.xml'
    ]

    for (const publicPath of publicPaths) {
        const response = await fetch(baseUrl + publicPath)
        assert.equal(response.status, 200, publicPath + ' should return 200')
    }

    const indexResponse = await fetch(baseUrl + '/schematic')
    const indexHtml = await indexResponse.text()
    const robotsResponse = await fetch(baseUrl + '/robots.txt')
    const robotsText = await robotsResponse.text()
    const sitemapResponse = await fetch(baseUrl + '/sitemap.xml')
    const sitemapText = await sitemapResponse.text()

    assert.doesNotMatch(indexHtml, /noindex/i)
    assert.match(indexHtml, /rel="canonical"/)
    assert.doesNotMatch(robotsText, /^Disallow:\s*\/$/m)
    assert.match(robotsText, /^Allow: \/$/m)
    assert.match(sitemapText, /https:\/\/ecadforge\.app\//)
})
