import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const projectRootPath = fileURLToPath(new URL('../', import.meta.url))
const endpointPath = fileURLToPath(
    new URL('../api/app-meta.php', import.meta.url)
)
const appVersionPath = new URL('../api/app-version.json', import.meta.url)

/**
 * Executes the PHP metadata endpoint with one synthetic request method.
 * @param {string} method
 * @returns {string}
 */
function runPhpRequest(method) {
    const script =
        "$_SERVER['REQUEST_METHOD'] = " +
        JSON.stringify(method) +
        '; chdir(' +
        JSON.stringify(projectRootPath) +
        '); require ' +
        JSON.stringify(endpointPath) +
        ';'

    return execFileSync('php', ['-r', script], { encoding: 'utf8' }).trim()
}

/**
 * Verifies the PHP endpoint returns the deployed app version payload.
 */
test('php app-meta endpoint returns the deployed version payload', async () => {
    const expected = JSON.parse(await readFile(appVersionPath, 'utf8'))
    const payload = JSON.parse(runPhpRequest('GET'))

    assert.equal(payload.version, expected.version)
})

/**
 * Verifies the PHP endpoint rejects non-GET requests.
 */
test('php app-meta endpoint rejects unsupported methods', () => {
    const payload = JSON.parse(runPhpRequest('POST'))

    assert.deepEqual(payload, { error: 'Method not allowed' })
})
