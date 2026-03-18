import assert from 'node:assert/strict'
import test from 'node:test'
import { AppMetaLoader } from '../src/AppMetaLoader.mjs'

/**
 * Verifies the browser loader uses the primary metadata route first.
 */
test('app meta loader returns the version from the primary endpoint', async () => {
    const calls = []

    const version = await AppMetaLoader.loadVersion(async (url, options) => {
        calls.push({ url, options })

        return {
            ok: true,
            async json() {
                return { version: '1.1.140' }
            }
        }
    })

    assert.equal(version, '1.1.140')
    assert.deepEqual(calls, [
        {
            url: '/api/app-meta',
            options: { cache: 'no-store' }
        }
    ])
})

/**
 * Verifies the browser loader retries the PHP alias when the clean route is
 * unavailable on a PHP-only host.
 */
test('app meta loader falls back to the php endpoint alias', async () => {
    const calls = []

    const version = await AppMetaLoader.loadVersion(async (url) => {
        calls.push(url)

        if (url === '/api/app-meta') {
            return {
                ok: false,
                async json() {
                    return {}
                }
            }
        }

        return {
            ok: true,
            async json() {
                return { version: '1.1.140' }
            }
        }
    })

    assert.equal(version, '1.1.140')
    assert.deepEqual(calls, ['/api/app-meta', '/api/app-meta.php'])
})

/**
 * Verifies the browser loader degrades to an empty version when neither route
 * is available.
 */
test('app meta loader returns an empty version when all endpoints fail', async () => {
    const version = await AppMetaLoader.loadVersion(async () => {
        throw new Error('missing')
    })

    assert.equal(version, '')
})
