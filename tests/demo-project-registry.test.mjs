import assert from 'node:assert/strict'
import { access } from 'node:fs/promises'
import { constants } from 'node:fs'
import test from 'node:test'
import { DemoProjectRegistry } from '../src/DemoProjectRegistry.mjs'

const root = new URL('../src/', import.meta.url)

/**
 * Checks whether a bundled source asset exists.
 * @param {string} absolutePath Asset path from the browser root.
 * @returns {Promise<boolean>}
 */
async function demoAssetExists(absolutePath) {
    try {
        await access(new URL('.' + absolutePath, root), constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Verifies bundled demo metadata stays complete enough for attribution and UI.
 */
test('demo registry exposes licensed Altium and KiCad sample projects', () => {
    const demos = DemoProjectRegistry.list()
    const demoIds = demos.map((demo) => demo.id).sort()

    assert.deepEqual(demoIds, ['altium', 'kicad'])

    for (const demo of demos) {
        assert.equal(typeof demo.title, 'string')
        assert.notEqual(demo.title, '')
        assert.match(demo.license, /MIT|BSD-3-Clause/)
        assert.match(demo.sourceUrl, /^https:\/\/github\.com\//)
        assert.equal(demo.files.length >= 2, true)
        assert.equal(
            demo.files.every((file) => file.path.startsWith('/demo/')),
            true
        )
    }
})

/**
 * Verifies demo lookup rejects unknown ids instead of guessing.
 */
test('demo registry returns null for unknown demo ids', () => {
    assert.equal(DemoProjectRegistry.get('missing'), null)
})

test('demo registry points to bundled files that exist in src/demo', async () => {
    for (const demo of DemoProjectRegistry.list()) {
        for (const file of demo.files) {
            assert.equal(
                await demoAssetExists(file.path),
                true,
                'Missing demo asset: ' + file.path
            )
        }
    }
})
