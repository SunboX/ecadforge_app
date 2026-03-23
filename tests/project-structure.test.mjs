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
        'src/AppMetaLoader.mjs',
        'src/favicon.svg',
        'src/index.html',
        'src/main.mjs',
        'src/style.css',
        'src/server.mjs',
        'src/vendor/fflate/browser.mjs',
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
        'tests/core/altium-parser/forge-relic.mjs',
        'tests/fixtures/AltiumFixtureLoader.mjs',
        'tests/ui/renderers.test.mjs',
        'tests/ui/renderers/schematic-core.mjs',
        'tests/ui/renderers/schematic-ports.mjs',
        'tests/ui/renderers/starlit-relics.mjs',
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
 * Verifies the app shell exposes the shared legal footer and keeps the
 * runtime version display in the footer only.
 */
test('app shell includes localized footer metadata and footer-only version UI', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const englishRaw = await readFile(new URL('src/i18n/en.json', root), 'utf8')
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')

    const englishMessages = JSON.parse(englishRaw)
    const germanMessages = JSON.parse(germanRaw)

    assert.match(indexRaw, /<footer class="page-footer">/)
    assert.match(indexRaw, /data-i18n="footer\.title"/)
    assert.match(indexRaw, /data-i18n="footer\.responsible"/)
    assert.match(indexRaw, /data-i18n="footer\.contact"/)
    assert.match(indexRaw, /data-i18n="footer\.version"/)
    assert.match(indexRaw, /id="appVersion"/)
    assert.doesNotMatch(indexRaw, /class="version-pill"/)
    assert.equal(englishMessages['footer.title'], 'Imprint')
    assert.equal(germanMessages['footer.title'], 'Impressum')
    assert.equal(
        englishMessages['footer.responsible'],
        'Responsible for this website'
    )
    assert.equal(
        germanMessages['footer.responsible'],
        'Verantwortlich fuer diese Website'
    )
    assert.equal(englishMessages['footer.contact'], 'Contact')
    assert.equal(germanMessages['footer.contact'], 'Kontakt')
    assert.equal(englishMessages['footer.version'], 'Version')
    assert.equal(germanMessages['footer.version'], 'Version')
})

/**
 * Verifies the app shell exposes only the multi-file picker and does not ship
 * a dedicated project-folder picker button.
 */
test('app shell uses one multi-file picker instead of a folder picker button', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const englishRaw = await readFile(new URL('src/i18n/en.json', root), 'utf8')
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')

    const englishMessages = JSON.parse(englishRaw)
    const germanMessages = JSON.parse(germanRaw)

    assert.match(indexRaw, /id="fileInput"/)
    assert.match(indexRaw, /type="file"/)
    assert.match(indexRaw, /multiple/)
    assert.doesNotMatch(indexRaw, /id="folderInput"/)
    assert.doesNotMatch(indexRaw, /webkitdirectory/)
    assert.equal(englishMessages['app.dropHint'], 'Drag PCB files here')
    assert.equal(germanMessages['app.dropHint'], 'PCB-Dateien hier ablegen')
    assert.equal(
        englishMessages['status.ready'],
        'Drop a native SchDoc, PcbDoc, or companion model file to begin.'
    )
    assert.equal(
        germanMessages['status.ready'],
        'Native SchDoc-, PcbDoc- oder Begleitmodell-Datei ablegen, um zu starten.'
    )
})

/**
 * Verifies runtime metadata is sourced only from package.json.
 */
test('runtime app metadata uses package.json as the only version source', async () => {
    const packageRaw = await readFile(new URL('package.json', root), 'utf8')
    const serverRaw = await readFile(new URL('src/server.mjs', root), 'utf8')
    const phpEndpointRaw = await readFile(
        new URL('api/app-meta.php', root),
        'utf8'
    )

    const pkg = JSON.parse(packageRaw)

    assert.equal(await exists('api/app-version.json'), false)
    assert.equal(typeof pkg.version, 'string')
    assert.notEqual(pkg.version.trim(), '')
    assert.match(serverRaw, /package\.json/)
    assert.match(phpEndpointRaw, /package\.json/)
    assert.doesNotMatch(serverRaw, /app-version\.json/)
    assert.doesNotMatch(phpEndpointRaw, /app-version\.json/)
})

/**
 * Verifies browser parser source does not depend on a bare package specifier
 * that static FTP hosting cannot resolve.
 */
test('browser parser source resolves fflate through a deployable file path', async () => {
    const parserSource = await readFile(
        new URL('src/core/altium/PcbEmbeddedModelExtractor.mjs', root),
        'utf8'
    )

    assert.doesNotMatch(parserSource, /from ['"]fflate['"]/)
    assert.match(
        parserSource,
        /from ['"]\.\.\/\.\.\/vendor\/fflate\/browser\.mjs['"]/
    )
})
