import assert from 'node:assert/strict'
import test from 'node:test'
import { AppRuntimeVersion } from '../src/AppRuntimeVersion.mjs'

/**
 * Verifies the loaded frontend version comes from the current module URL.
 */
test('readLoadedVersion extracts the module query version', () => {
    assert.equal(
        AppRuntimeVersion.readLoadedVersion(
            'http://localhost:3000/main.mjs?v=1.1.104'
        ),
        '1.1.104'
    )
})

/**
 * Verifies the displayed version prefers the currently loaded module graph
 * over the latest server metadata.
 */
test('resolveDisplayVersion prefers the loaded module version', () => {
    assert.equal(
        AppRuntimeVersion.resolveDisplayVersion('1.1.103', '1.1.104'),
        '1.1.103'
    )
})

/**
 * Verifies stale tabs trigger a frontend reload once the server advertises a
 * newer app version than the loaded module graph.
 */
test('shouldReloadForStaleModules detects stale loaded modules', () => {
    assert.equal(
        AppRuntimeVersion.shouldReloadForStaleModules('1.1.103', '1.1.104'),
        true
    )
    assert.equal(
        AppRuntimeVersion.shouldReloadForStaleModules('1.1.104', '1.1.104'),
        false
    )
    assert.equal(
        AppRuntimeVersion.shouldReloadForStaleModules('', '1.1.104'),
        false
    )
})

/**
 * Verifies stale-tab reloads change the page URL itself so browsers fetch a
 * fresh HTML shell instead of reusing an already-open document state.
 */
test('buildReloadUrl appends the current server version to the page URL', () => {
    assert.equal(
        AppRuntimeVersion.buildReloadUrl(
            'http://localhost:3000/?foo=1',
            '1.1.104'
        ),
        'http://localhost:3000/?foo=1&reload=1.1.104'
    )
})
