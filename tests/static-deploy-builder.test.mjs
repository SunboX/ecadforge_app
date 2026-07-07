import assert from 'node:assert/strict'
import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { constants } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const rootUrl = new URL('../', import.meta.url)
const rootPath = fileURLToPath(rootUrl)
const builderUrl = new URL('../src/StaticDeployBuilder.mjs', import.meta.url)

/**
 * Checks whether a repository file exists.
 * @param {URL} fileUrl
 * @returns {Promise<boolean>}
 */
async function exists(fileUrl) {
    try {
        await access(fileUrl, constants.F_OK)
        return true
    } catch {
        return false
    }
}

/**
 * Asserts that a built static deploy file exists.
 * @param {string} outputRoot
 * @param {string} relativePath
 * @returns {Promise<string>}
 */
async function readRequiredOutputFile(outputRoot, relativePath) {
    const filePath = path.join(outputRoot, relativePath)
    const source = await readFile(filePath, 'utf8')

    assert.notEqual(source.trim(), '', relativePath + ' is empty')

    return source
}

/**
 * Asserts that a deployed asset did not receive the app HTML shell.
 * @param {string} source
 * @param {string} relativePath
 * @returns {void}
 */
function assertNotHtmlShell(source, relativePath) {
    assert.doesNotMatch(
        source.trimStart().slice(0, 120),
        /<!doctype html>/i,
        relativePath + ' contains the app HTML shell'
    )
}

/**
 * Imports a fresh copy of the static deploy builder.
 * @returns {Promise<typeof import('../src/StaticDeployBuilder.mjs')>}
 */
async function importStaticDeployBuilder() {
    return import(builderUrl.href + '?test=' + Date.now())
}

/**
 * Verifies the static deploy builder emits the same cache-busted shell and
 * browser-safe module graph that the local Node server serves dynamically.
 */
test('static deploy builder writes versioned Apache assets', async (t) => {
    assert.equal(
        await exists(builderUrl),
        true,
        'Missing src/StaticDeployBuilder.mjs'
    )

    const packageRaw = await readFile(
        new URL('../package.json', import.meta.url)
    )
    const pkg = JSON.parse(packageRaw)
    const outputRoot = await mkdtemp(
        path.join(tmpdir(), 'ecadforge-static-deploy-')
    )
    const { StaticDeployBuilder } = await importStaticDeployBuilder()

    t.after(async () => {
        await rm(outputRoot, { force: true, recursive: true })
    })

    await StaticDeployBuilder.build({
        projectRoot: rootPath,
        sourceRoot: path.join(rootPath, 'src'),
        outputRoot
    })

    const indexHtml = await readFile(
        path.join(outputRoot, 'index.html'),
        'utf8'
    )
    const mainSource = await readFile(path.join(outputRoot, 'main.mjs'), 'utf8')
    const parserWorkerSource = await readFile(
        path.join(outputRoot, 'workers', 'ecad-parser.worker.mjs'),
        'utf8'
    )
    const altiumParserSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/altium-toolkit/src/parser.mjs'
    )
    const kicadParserSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/kicad-toolkit/src/parser.mjs'
    )
    const circuitJsonToolkitSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/circuitjson-toolkit/src/index.mjs'
    )
    const gerberToolkitSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/gerber-toolkit/src/parser.mjs'
    )
    const scene3dViewerSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/pcb-scene3d-viewer/src/PcbModelArchiveExporter.mjs'
    )
    const fflateSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/fflate/esm/browser.js'
    )
    const polygonClippingSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/polygon-clipping/dist/polygon-clipping.esm.js'
    )
    const robustPredicatesSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/robust-predicates/index.js'
    )
    const robustOrient2dSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/robust-predicates/esm/orient2d.js'
    )
    const splaytreeSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/splaytree/dist/splaytree.js'
    )
    const altiumFontSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/altium-toolkit/src/core/altium/PcbEmbeddedFontExtractor.mjs'
    )
    const threeRuntimeSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/three/build/three.module.js'
    )
    const threeCoreSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/three/build/three.core.js'
    )
    const orbitControlsSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/three/examples/jsm/controls/OrbitControls.js'
    )
    const vrmlLoaderSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/three/examples/jsm/loaders/VRMLLoader.js'
    )
    const chevrotainSource = await readRequiredOutputFile(
        outputRoot,
        'node_modules/three/examples/jsm/libs/chevrotain.module.min.js'
    )
    const htaccessSource = await readFile(
        path.join(outputRoot, '.htaccess'),
        'utf8'
    )

    assert.match(indexHtml, new RegExp('/style\\.css\\?v=' + pkg.version))
    assert.match(indexHtml, new RegExp('/main\\.mjs\\?v=' + pkg.version))
    assert.match(indexHtml, /http-equiv="origin-trial"/)
    assert.match(indexHtml, /content="AnJTFnSlAlC65FIT2VeQQPPLzX97dfpvn/)
    assert.match(
        mainSource,
        new RegExp('\\./AppController\\.mjs\\?v=' + pkg.version)
    )
    assert.doesNotMatch(
        parserWorkerSource,
        /from ['"]\.\.\/core\/ecad\/EcadParserService\.mjs['"]/
    )
    assert.match(
        parserWorkerSource,
        new RegExp(
            '\\.\\./core/ecad/EcadParserService\\.mjs\\?v=' + pkg.version
        )
    )
    assertNotHtmlShell(
        altiumParserSource,
        'node_modules/altium-toolkit/src/parser.mjs'
    )
    assert.match(altiumParserSource, /AltiumParser/)
    assertNotHtmlShell(
        kicadParserSource,
        'node_modules/kicad-toolkit/src/parser.mjs'
    )
    assert.match(kicadParserSource, /KicadParser/)
    assertNotHtmlShell(
        circuitJsonToolkitSource,
        'node_modules/circuitjson-toolkit/src/index.mjs'
    )
    assert.match(circuitJsonToolkitSource, /CircuitJsonParser/)
    assertNotHtmlShell(
        gerberToolkitSource,
        'node_modules/gerber-toolkit/src/parser.mjs'
    )
    assert.match(gerberToolkitSource, /GerberProjectLoader/)
    assertNotHtmlShell(
        scene3dViewerSource,
        'node_modules/pcb-scene3d-viewer/src/PcbModelArchiveExporter.mjs'
    )
    assert.match(
        scene3dViewerSource,
        new RegExp('/node_modules/fflate/esm/browser\\.js\\?v=' + pkg.version)
    )
    assertNotHtmlShell(fflateSource, 'node_modules/fflate/esm/browser.js')
    assert.match(fflateSource, /unzlibSync/)
    assertNotHtmlShell(
        polygonClippingSource,
        'node_modules/polygon-clipping/dist/polygon-clipping.esm.js'
    )
    assert.match(polygonClippingSource, /export \{ index as default \}/)
    assert.match(
        polygonClippingSource,
        new RegExp(
            '/node_modules/splaytree/dist/splaytree\\.js\\?v=' + pkg.version
        )
    )
    assert.match(
        polygonClippingSource,
        new RegExp(
            '/node_modules/robust-predicates/index\\.js\\?v=' + pkg.version
        )
    )
    assertNotHtmlShell(
        robustPredicatesSource,
        'node_modules/robust-predicates/index.js'
    )
    assert.match(
        robustPredicatesSource,
        new RegExp('\\./esm/orient2d\\.js\\?v=' + pkg.version)
    )
    assertNotHtmlShell(
        robustOrient2dSource,
        'node_modules/robust-predicates/esm/orient2d.js'
    )
    assert.match(robustOrient2dSource, /orient2d/)
    assertNotHtmlShell(
        splaytreeSource,
        'node_modules/splaytree/dist/splaytree.js'
    )
    assert.match(splaytreeSource, /export \{\s*z as default\s*\}/)
    assert.match(
        altiumFontSource,
        new RegExp('/node_modules/fflate/esm/browser\\.js\\?v=' + pkg.version)
    )
    assertNotHtmlShell(
        threeRuntimeSource,
        'node_modules/three/build/three.module.js'
    )
    assert.match(threeRuntimeSource, /three\.core\.js/)
    assertNotHtmlShell(
        threeCoreSource,
        'node_modules/three/build/three.core.js'
    )
    assert.match(threeCoreSource, /REVISION/)
    assertNotHtmlShell(
        orbitControlsSource,
        'node_modules/three/examples/jsm/controls/OrbitControls.js'
    )
    assert.match(orbitControlsSource, /OrbitControls/)
    assertNotHtmlShell(
        vrmlLoaderSource,
        'node_modules/three/examples/jsm/loaders/VRMLLoader.js'
    )
    assert.match(vrmlLoaderSource, /VRMLLoader/)
    assertNotHtmlShell(
        chevrotainSource,
        'node_modules/three/examples/jsm/libs/chevrotain.module.min.js'
    )
    assert.match(chevrotainSource, /chevrotain/)
    assert.match(htaccessSource, /Cache-Control/)
    assert.match(htaccessSource, /no-store/)
    assert.match(htaccessSource, /Header set Origin-Agent-Cluster "\?1"/)
    assert.match(
        htaccessSource,
        /Header set Permissions-Policy "tools=\(self\)"/
    )
    assert.match(htaccessSource, /RewriteEngine On/)
    assert.match(htaccessSource, /RewriteRule \^\(\.\+\)\$ \$1\.html \[L\]/)
    assert.match(htaccessSource, /RewriteRule \^ index\.html \[L\]/)
    assert.match(htaccessSource, /RewriteCond %\{REQUEST_FILENAME\} !-f/)
    assert.match(htaccessSource, /RewriteCond %\{REQUEST_FILENAME\} !-d/)
    assert.match(
        htaccessSource,
        /RewriteCond %\{REQUEST_URI\} !\\\.\[\^\/\]\+\$/
    )
})
