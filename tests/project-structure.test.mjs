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
        'src/vendor/occt-import-js/dist/license.occt-import-js.txt',
        'src/vendor/occt-import-js/dist/license.occt.txt',
        'src/vendor/occt-import-js/dist/occt-import-js-worker.js',
        'src/vendor/occt-import-js/dist/occt-import-js.js',
        'src/vendor/occt-import-js/dist/occt-import-js.wasm',
        'src/core/AppState.mjs',
        'src/ui/AppView.mjs',
        'src/ui/Scene3dRenderer.mjs',
        'src/ui/SchematicViewportController.mjs',
        'tests/app-state.test.mjs',
        'tests/ui/renderers.test.mjs',
        'tests/ui/renderers/scene3d.mjs',
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
 * Verifies the reusable Altium parser and non-interactive render core is an
 * external package dependency instead of app-local source.
 */
test('package depends on Altium Toolkit', async () => {
    const raw = await readFile(new URL('package.json', root), 'utf8')
    const pkg = JSON.parse(raw)

    assert.equal(
        pkg.dependencies?.['@sunbox/altium-toolkit'],
        'git+ssh://git@github.com/SunboX/altium-toolkit.git'
    )
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
 * Verifies browser parser and renderer imports come from Altium Toolkit.
 */
test('browser parser and render core resolve through Altium Toolkit', async () => {
    const controllerSource = await readFile(
        new URL('src/AppController.mjs', root),
        'utf8'
    )
    const workerSource = await readFile(
        new URL('src/workers/altium-parser.worker.mjs', root),
        'utf8'
    )
    const viewSource = await readFile(new URL('src/ui/AppView.mjs', root), 'utf8')

    assert.match(
        controllerSource,
        /from ['"]@sunbox\/altium-toolkit\/parser['"]/
    )
    assert.match(workerSource, /from ['"]@sunbox\/altium-toolkit\/parser['"]/)
    assert.match(
        viewSource,
        /from ['"]@sunbox\/altium-toolkit\/renderers['"]/
    )
})

/**
 * Verifies the static app shell provides an import map for browser-resolved
 * toolkit, compression, and Three.js dependencies on FTP-hosted deployments.
 */
test('app shell defines a Three.js import map for static hosting', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')

    assert.match(indexRaw, /<script\s+type="importmap">/)
    assert.match(
        indexRaw,
        /"@sunbox\/altium-toolkit"\s*:\s*"\/node_modules\/@sunbox\/altium-toolkit\/src\/index\.mjs"/
    )
    assert.match(
        indexRaw,
        /"@sunbox\/altium-toolkit\/parser"\s*:\s*"\/node_modules\/@sunbox\/altium-toolkit\/src\/parser\.mjs"/
    )
    assert.match(
        indexRaw,
        /"@sunbox\/altium-toolkit\/renderers"\s*:\s*"\/node_modules\/@sunbox\/altium-toolkit\/src\/renderers\.mjs"/
    )
    assert.match(
        indexRaw,
        /"@sunbox\/altium-toolkit\/scene3d"\s*:\s*"\/node_modules\/@sunbox\/altium-toolkit\/src\/scene3d\.mjs"/
    )
    assert.match(
        indexRaw,
        /"fflate"\s*:\s*"\/node_modules\/fflate\/esm\/browser\.js"/
    )
    assert.match(
        indexRaw,
        /"three"\s*:\s*"\/node_modules\/three\/build\/three\.module\.js"/
    )
    assert.match(
        indexRaw,
        /"three\/addons\/"\s*:\s*"\/node_modules\/three\/examples\/jsm\/"/
    )
})

/**
 * Verifies the browser 3D runtime uses the same deployed dependency paths that
 * the static app and local server publish.
 */
test('3d runtime source resolves browser dependencies through deployed asset paths', async () => {
    const runtimeSource = await readFile(
        new URL('src/ui/PcbScene3dRuntime.mjs', root),
        'utf8'
    )
    const externalModelsSource = await readFile(
        new URL('src/ui/PcbScene3dExternalModels.mjs', root),
        'utf8'
    )
    const stepLoaderSource = await readFile(
        new URL('src/ui/PcbScene3dStepLoader.mjs', root),
        'utf8'
    )

    assert.match(
        runtimeSource,
        /\/node_modules\/three\/build\/three\.module\.js/
    )
    assert.match(
        runtimeSource,
        /\/node_modules\/three\/examples\/jsm\/controls\/OrbitControls\.js/
    )
    assert.match(
        externalModelsSource,
        /\/node_modules\/three\/examples\/jsm\/loaders\/VRMLLoader\.js/
    )
    assert.match(stepLoaderSource, /\/vendor\/occt-import-js\/dist\//)
    assert.doesNotMatch(stepLoaderSource, /\/node_modules\/occt-import-js\/dist\//)
})
