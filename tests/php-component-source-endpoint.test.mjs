import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:net'
import { once } from 'node:events'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const endpointPath = fileURLToPath(
    new URL('../api/component-source.php', import.meta.url)
)

/**
 * Allocates an available TCP port.
 * @returns {Promise<number>}
 */
async function allocatePort() {
    return await new Promise((resolve, reject) => {
        const server = createServer()
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            server.close(() => {
                if (!address || typeof address === 'string') {
                    reject(new Error('Unable to allocate port'))
                    return
                }
                resolve(address.port)
            })
        })
    })
}

/**
 * Stops one child process.
 * @param {import('node:child_process').ChildProcessWithoutNullStreams} childProcess
 * @returns {Promise<void>}
 */
async function stopProcess(childProcess) {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
        return
    }

    childProcess.kill('SIGTERM')
    await once(childProcess, 'exit')
}

/**
 * Waits until a PHP server answers HTTP requests.
 * @param {string} url Probe URL.
 * @returns {Promise<void>}
 */
async function waitForHttp(url) {
    const startedAt = Date.now()
    while (Date.now() - startedAt < 5000) {
        try {
            const response = await fetch(url)
            if (response.status < 500) {
                return
            }
        } catch (_error) {
            await new Promise((resolve) => setTimeout(resolve, 50))
        }
    }

    throw new Error('Timed out waiting for PHP server.')
}

/**
 * Starts a fake upstream source service.
 * @param {import('node:test').TestContext} t Test context.
 * @returns {Promise<string>}
 */
async function startUpstream(t) {
    const root = join(
        tmpdir(),
        'ecadforge-component-source-' + String(Date.now())
    )
    await mkdir(root, { recursive: true })
    await writeFile(
        join(root, 'router.php'),
        `<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
if ($path === '/search') {
    header('Content-Type: application/json');
    echo json_encode(['result' => [[
        'display_title' => 'Fake connector',
        'product_code' => 'C2040',
        'attributes' => ['3D Model' => 'seed-model']
    ]]]);
    return;
}
if ($path === '/components/seed-model') {
    header('Content-Type: application/json');
    echo json_encode(['code' => 0, 'result' => ['3d_model_uuid' => 'resolved-model']]);
    return;
}
if ($path === '/models/resolved-model') {
    header('Content-Type: model/step');
    echo 'ISO-10303-21;';
    return;
}
http_response_code(404);
echo 'Not Found';
`
    )

    const port = await allocatePort()
    const childProcess = spawn(
        'php',
        ['-S', '127.0.0.1:' + String(port), join(root, 'router.php')],
        {
            cwd: root,
            stdio: ['ignore', 'pipe', 'pipe']
        }
    )
    t.after(async () => {
        await stopProcess(childProcess)
    })
    const baseUrl = 'http://127.0.0.1:' + String(port)
    await waitForHttp(baseUrl + '/search')
    return baseUrl
}

/**
 * Runs the component-source PHP endpoint on PHP's built-in server.
 * @param {import('node:test').TestContext} t Test context.
 * @param {string} upstreamBaseUrl Fake upstream base URL.
 * @returns {Promise<string>}
 */
async function startEndpoint(t, upstreamBaseUrl) {
    const port = await allocatePort()
    const childProcess = spawn('php', ['-S', '127.0.0.1:' + String(port)], {
        cwd: new URL('../api/', import.meta.url),
        env: {
            ...process.env,
            ECAD_FORGE_EASYEDA_SEARCH_API: upstreamBaseUrl + '/search',
            ECAD_FORGE_EASYEDA_COMPONENT_API: upstreamBaseUrl + '/components/',
            ECAD_FORGE_EASYEDA_STEP_API: upstreamBaseUrl + '/models/'
        },
        stdio: ['ignore', 'pipe', 'pipe']
    })
    t.after(async () => {
        await stopProcess(childProcess)
    })

    const baseUrl = 'http://127.0.0.1:' + String(port)
    await waitForHttp(baseUrl + '/component-source.php?path=search&q=C2040')
    return baseUrl
}

test('php component-source endpoint proxies search, detail, and STEP bytes', async (t) => {
    const upstreamBaseUrl = await startUpstream(t)
    const endpointBaseUrl = await startEndpoint(t, upstreamBaseUrl)

    const searchResponse = await fetch(
        endpointBaseUrl + '/component-source.php?path=search&q=C2040&limit=1'
    )
    const searchPayload = await searchResponse.json()
    const componentResponse = await fetch(
        endpointBaseUrl + '/component-source.php?path=components/seed-model'
    )
    const componentPayload = await componentResponse.json()
    const modelResponse = await fetch(
        endpointBaseUrl +
            '/component-source.php?path=models/resolved-model.step'
    )
    const modelText = await modelResponse.text()

    assert.equal(searchResponse.ok, true)
    assert.equal(searchPayload.results[0].id, 'seed-model')
    assert.equal(searchPayload.results[0].name, 'Fake connector')
    assert.equal(componentResponse.ok, true)
    assert.equal(
        componentPayload.models[0].sourceUrl,
        'models/resolved-model.step'
    )
    assert.equal(modelResponse.ok, true)
    assert.equal(modelText, 'ISO-10303-21;')
    assert.equal(endpointPath.endsWith('api/component-source.php'), true)
})
