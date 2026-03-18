import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import test from 'node:test'

const root = new URL('../', import.meta.url)

/**
 * Checks whether a project-relative file exists.
 * @param {string} relativePath
 * @returns {Promise<boolean>}
 */
async function exists(relativePath) {
    try {
        await access(new URL(relativePath, root), constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Verifies mandatory project files.
 */
test('required project files exist', async () => {
    const required = [
        'README.md',
        'AGENTS.md',
        'package.json',
        'spec/web-app-specification.md',
        'docs/getting-started.md',
        'docs/architecture.md',
        'docs/testing.md',
        'docs/security.md',
        'docs/troubleshooting.md',
        'api/.htaccess',
        'api/app-meta.php',
        'api/app-version.json',
        'src/AppMetaLoader.mjs',
        'src/favicon.svg',
        'src/index.html',
        'src/main.mjs',
        'src/style.css',
        'src/server.mjs',
        'src/core/AppState.mjs',
        'src/core/altium/AltiumParser.mjs',
        'src/core/altium/AsciiRecordParser.mjs',
        'src/core/altium/PrintableTextDecoder.mjs',
        'src/ui/AppView.mjs',
        'src/ui/SchematicSvgRenderer.mjs',
        'src/ui/PcbSvgRenderer.mjs',
        'src/ui/BomTableRenderer.mjs',
        'src/ui/Scene3dRenderer.mjs',
        'tests/app-state.test.mjs',
        'tests/core/altium-parser.test.mjs',
        'tests/core/altium-parser/schematic-basics.mjs',
        'tests/core/altium-parser/schematic-symbols.mjs',
        'tests/core/altium-parser/schematic-layout.mjs',
        'tests/core/altium-parser/schematic-regressions.mjs',
        'tests/core/altium-parser/pcb-sample.mjs',
        'tests/ui/renderers.test.mjs',
        'tests/ui/renderers/schematic-core.mjs',
        'tests/ui/renderers/schematic-ports.mjs',
        'tests/ui/renderers/schematic-fixtures.mjs',
        'tests/ui/renderers/output-renderers.mjs',
        'tests/project-structure.test.mjs',
        'tests/mjs-line-limit.test.mjs',
        'src/I18n.mjs',
        'src/i18n/en.json',
        'src/i18n/de.json',
        'src/workers/altium-parser.worker.mjs'
    ]

    for (const relativePath of required) {
        assert.equal(
            await exists(relativePath),
            true,
            'Missing file: ' + relativePath
        )
    }
})

/**
 * Verifies core npm scripts are present.
 */
test('package scripts include start and test', async () => {
    const raw = await readFile(new URL('package.json', root), 'utf8')
    const pkg = JSON.parse(raw)

    assert.equal(typeof pkg.scripts?.start, 'string')
    assert.equal(typeof pkg.scripts?.test, 'string')
})

/**
 * Verifies app identity metadata is aligned across package and UI files.
 */
test('app identity metadata uses the ECAD Forge name', async () => {
    const packageRaw = await readFile(new URL('package.json', root), 'utf8')
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const englishRaw = await readFile(new URL('src/i18n/en.json', root), 'utf8')
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')

    const pkg = JSON.parse(packageRaw)
    const englishMessages = JSON.parse(englishRaw)
    const germanMessages = JSON.parse(germanRaw)

    assert.equal(pkg.name, 'ecadforge_app')
    assert.match(indexRaw, /<title>ECAD Forge<\/title>/)
    assert.match(indexRaw, /<h1[^>]*>ECAD Forge<\/h1>/)
    assert.match(indexRaw, /<link[^>]+rel="icon"[^>]+href="\/favicon\.svg"/)
    assert.equal(englishMessages['app.title'], 'ECAD Forge')
    assert.equal(germanMessages['app.title'], 'ECAD Forge')
})

/**
 * Verifies deployed app metadata stays aligned with the package version.
 */
test('deployed app version metadata matches package version', async () => {
    const packageRaw = await readFile(new URL('package.json', root), 'utf8')
    const appVersionRaw = await readFile(
        new URL('api/app-version.json', root),
        'utf8'
    )

    const pkg = JSON.parse(packageRaw)
    const appVersion = JSON.parse(appVersionRaw)

    assert.equal(appVersion.version, pkg.version)
})
