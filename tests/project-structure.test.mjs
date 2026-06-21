import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
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
 * Reads the image dimensions from a PNG buffer.
 * @param {Buffer} buffer
 * @returns {{ width: number, height: number }}
 */
function readPngDimensions(buffer) {
    return {
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20)
    }
}

/**
 * Verifies mandatory project files.
 */
test('required project files exist', async () => {
    const required = [
        'README.md',
        'AGENTS.md',
        'COMMERCIAL-LICENSE.md',
        'CONTRIBUTING.md',
        'package.json',
        'occt-import-js-0.0.25.tgz',
        'LICENSE',
        'LICENSES/AGPL-3.0-or-later.txt',
        'LICENSES/CC-BY-SA-4.0.txt',
        'LICENSES/LGPL-2.1-only.txt',
        'LICENSES/LicenseRef-OCCT-exception-1.0.txt',
        'NOTICE',
        'NOTICE.md',
        '.reuse/dep5',
        'spec/web-app-specification.md',
        'docs/getting-started.md',
        'docs/architecture.md',
        'docs/testing.md',
        'docs/security.md',
        'docs/troubleshooting.md',
        'api/.htaccess',
        'api/app-meta.php',
        'api/component-source.php',
        'src/AppMetaLoader.mjs',
        'src/favicon.svg',
        'src/index.html',
        'src/main.mjs',
        'src/robots.txt',
        'src/sitemap.xml',
        'src/style.css',
        'src/server.mjs',
        'src/vendor/occt-import-js/dist/license.occt-import-js.txt',
        'src/vendor/occt-import-js/dist/license.occt.txt',
        'src/vendor/occt-import-js/dist/OCCT_LGPL_EXCEPTION.txt',
        'src/vendor/occt-import-js/dist/SOURCE-OFFER.md',
        'src/vendor/occt-import-js/dist/occt-import-js-worker.js',
        'src/vendor/occt-import-js/dist/occt-import-js.js',
        'src/vendor/occt-import-js/dist/occt-import-js.wasm',
        'src/core/AppState.mjs',
        'src/ui/AppView.mjs',
        'src/ui/SchematicViewportController.mjs',
        'tests/app-state.test.mjs',
        'tests/project-structure.test.mjs',
        'tests/mjs-line-limit.test.mjs',
        'src/I18n.mjs',
        'src/i18n/en.json',
        'src/i18n/de.json',
        'src/core/ecad/EcadFormatRegistry.mjs',
        'src/core/ecad/EcadParserService.mjs',
        'src/core/ecad/EcadRendererService.mjs',
        'src/core/ecad/EcadScene3dService.mjs',
        'src/workers/ecad-parser.worker.mjs'
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
 * Verifies the repository licensing metadata follows the public AGPL and
 * commercial-license notice model.
 */
test('project licensing metadata uses AGPL dual licensing', async () => {
    const packageRaw = await readFile(new URL('package.json', root), 'utf8')
    const readmeRaw = await readFile(new URL('README.md', root), 'utf8')
    const licenseRaw = await readFile(new URL('LICENSE', root), 'utf8')
    const commercialRaw = await readFile(
        new URL('COMMERCIAL-LICENSE.md', root),
        'utf8'
    )
    const noticeRaw = await readFile(new URL('NOTICE.md', root), 'utf8')
    const dep5Raw = await readFile(new URL('.reuse/dep5', root), 'utf8')
    const pkg = JSON.parse(packageRaw)

    assert.equal(pkg.license, 'AGPL-3.0-or-later')
    assert.match(readmeRaw, /AGPL-3\.0-or-later/)
    assert.match(readmeRaw, /Commercial\/proprietary license/)
    assert.match(licenseRaw, /LICENSES\/AGPL-3\.0-or-later\.txt/)
    assert.match(commercialRaw, /not itself a commercial license grant/)
    assert.match(noticeRaw, /Original project by André Fiedler \/ SunboX/)
    assert.match(dep5Raw, /License: AGPL-3\.0-or-later/)
    assert.match(dep5Raw, /License: CC-BY-SA-4\.0/)
    assert.doesNotMatch(dep5Raw, /LicenseRef-PolyForm-Noncommercial-1\.0\.0/)
    assert.match(dep5Raw, /LicenseRef-OCCT-exception-1\.0/)
})

/**
 * Verifies vendored occt-import-js and OCCT notices match their upstream LGPL
 * terms and include rebuild/source-offer guidance for the shipped WASM.
 */
test('vendored OCCT importer notices preserve LGPL terms and source guidance', async () => {
    const dep5Raw = await readFile(new URL('.reuse/dep5', root), 'utf8')
    const noticeRaw = await readFile(new URL('NOTICE.md', root), 'utf8')
    const packageLockRaw = await readFile(
        new URL('package-lock.json', root),
        'utf8'
    )
    const importNoticeRaw = await readFile(
        new URL(
            'src/vendor/occt-import-js/dist/license.occt-import-js.txt',
            root
        ),
        'utf8'
    )
    const occtExceptionRaw = await readFile(
        new URL('src/vendor/occt-import-js/dist/OCCT_LGPL_EXCEPTION.txt', root),
        'utf8'
    )
    const sourceOfferRaw = await readFile(
        new URL('src/vendor/occt-import-js/dist/SOURCE-OFFER.md', root),
        'utf8'
    )

    assert.match(importNoticeRaw, /GNU LESSER GENERAL PUBLIC LICENSE/)
    assert.doesNotMatch(importNoticeRaw, /PolyForm Noncommercial/)
    assert.doesNotMatch(importNoticeRaw, /Required Notice:/)
    assert.match(occtExceptionRaw, /Open CASCADE exception \(version 1\.0\)/)
    assert.match(
        occtExceptionRaw,
        /provided by the Open CASCADE Technology software/
    )
    assert.match(sourceOfferRaw, /@sunbox\/occt-import-js@0\.0\.25/)
    assert.match(sourceOfferRaw, /occt-import-js-0\.0\.25\.tgz/)
    assert.match(packageLockRaw, /"@sunbox\/occt-import-js": "\^0\.0\.25"/)
    assert.match(packageLockRaw, /"version": "0\.0\.25"/)
    assert.match(sourceOfferRaw, /sha512-/)
    assert.match(sourceOfferRaw, /git\.dev\.opencascade\.org\/repos\/occt\.git/)
    assert.match(sourceOfferRaw, /tools\\build_wasm_win_release\.bat/)
    assert.match(packageLockRaw, /"license": "LGPL-2\.1"/)
    assert.match(
        dep5Raw,
        /src\/vendor\/occt-import-js\/dist\/occt-import-js\.wasm[\s\S]*License: LGPL-2\.1/
    )
    assert.doesNotMatch(dep5Raw, /PolyForm Noncommercial/)
    assert.match(noticeRaw, /OCCT_LGPL_EXCEPTION\.txt/)
    assert.match(noticeRaw, /SOURCE-OFFER\.md/)
})

/**
 * Verifies reusable ECAD parser, renderer, and 3D cores resolve from the
 * intended package sources.
 */
test('package depends on intended ECAD toolkit package sources', async () => {
    const raw = await readFile(new URL('package.json', root), 'utf8')
    const pkg = JSON.parse(raw)
    const toolkitDependencies = [
        ['altium-toolkit', /^\^1\.1\.32$/],
        ['circuitjson-toolkit', /^\^1\.0\.3$/],
        ['gerber-toolkit', /^\^0\.1\.18$/],
        ['kicad-toolkit', /^\^1\.0\.15$/],
        ['pcb-scene3d-viewer', /^\^1\.1\.21$/]
    ]

    for (const [dependencyName, versionPattern] of toolkitDependencies) {
        const dependencyVersion = pkg.dependencies?.[dependencyName] ?? ''

        assert.match(dependencyVersion, versionPattern)
        assert.doesNotMatch(dependencyVersion, /^file:/)
    }

    assert.equal(pkg.scripts?.postinstall, undefined)
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
    assert.match(
        indexRaw,
        /<title>\s*ECAD Forge .* Altium, KiCad, Gerber & CircuitJSON Viewer in Your\s+Browser\s*<\/title>/
    )
    assert.match(indexRaw, /<h1[^>]*>ECAD Forge<\/h1>/)
    assert.match(indexRaw, /<link[^>]+rel="icon"[^>]+href="\/favicon\.svg"/)
    assert.equal(englishMessages['app.title'], 'ECAD Forge')
    assert.equal(germanMessages['app.title'], 'ECAD Forge')
})

/**
 * Verifies public crawler metadata exists without accidentally opting the
 * production app out of indexing.
 */
test('app shell exposes indexable search metadata', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const robotsRaw = await readFile(new URL('src/robots.txt', root), 'utf8')
    const sitemapRaw = await readFile(new URL('src/sitemap.xml', root), 'utf8')

    assert.match(
        indexRaw,
        /Altium, KiCad, Gerber & CircuitJSON Viewer in Your Browser/
    )
    assert.match(indexRaw, /<meta\s+name="description"/)
    assert.match(indexRaw, /property="og:image"/)
    assert.match(indexRaw, /application\/ld\+json/)
    assert.match(indexRaw, /<meta\s+name="robots"\s+content="index,follow"/)
    assert.match(
        indexRaw,
        /<link\s+rel="canonical"\s+href="https:\/\/ecadforge\.app\/"/
    )
    assert.doesNotMatch(indexRaw, /noindex/i)

    assert.match(robotsRaw, /^User-agent: \*/m)
    assert.match(robotsRaw, /^Allow: \/$/m)
    assert.match(
        robotsRaw,
        /^Sitemap: https:\/\/ecadforge\.app\/sitemap\.xml$/m
    )
    assert.doesNotMatch(robotsRaw, /^Disallow:\s*\/$/m)

    assert.match(sitemapRaw, /<loc>https:\/\/ecadforge\.app\/<\/loc>/)
})

/**
 * Verifies the public social card uses the refreshed PCB-oriented render at
 * the dimensions expected by Open Graph consumers.
 */
test('social preview image uses the refreshed PCB-oriented asset', async () => {
    const preview = await readFile(
        new URL('src/og/ecadforge-viewer-pcb.png', root)
    )
    const generatorRaw = await readFile(
        new URL('scripts/SocialPreviewGenerator.mjs', root),
        'utf8'
    )
    const staleChartPreviewDigest =
        'd2da5449cde11f9c82034c779688bc800537f07555270c74e15cd1bf1bac92e9'
    const digest = createHash('sha256').update(preview).digest('hex')

    assert.equal(preview.subarray(1, 4).toString('ascii'), 'PNG')
    assert.deepEqual(readPngDimensions(preview), {
        width: 1200,
        height: 630
    })
    assert.notEqual(digest, staleChartPreviewDigest)
    assert.doesNotMatch(generatorRaw, /HorizontalScaleCanvas/)
})

/**
 * Verifies public view navigation uses crawlable internal links in addition
 * to JavaScript handling.
 */
test('app shell uses normal internal links for important views', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const expectedRoutes = ['/schematic', '/pcb', '/3d', '/bom', '/diagnostics']

    for (const route of expectedRoutes) {
        assert.match(
            indexRaw,
            new RegExp('<a[^>]+href="' + route.replace('/', '\\/') + '"')
        )
    }
})

/**
 * Verifies the app shell exposes the compact brand footer and keeps the
 * runtime version display in the footer only.
 */
test('app shell includes localized footer metadata and footer-only version UI', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const layoutRaw = await readFile(
        new URL('src/styles/10-layout.css', root),
        'utf8'
    )
    const englishRaw = await readFile(new URL('src/i18n/en.json', root), 'utf8')
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')

    const englishMessages = JSON.parse(englishRaw)
    const germanMessages = JSON.parse(germanRaw)

    assert.match(
        indexRaw,
        /<footer class="[^"]*page-footer[^"]*footer-inline[^"]*">/
    )
    assert.match(indexRaw, /class="footer-inline__main"/)
    assert.match(indexRaw, /class="footer-inline__meta"/)
    assert.match(indexRaw, /data-i18n="footer\.contact"/)
    assert.match(indexRaw, /data-i18n="footer\.responsible"/)
    assert.match(indexRaw, /data-i18n="footer\.version"/)
    assert.match(indexRaw, /data-i18n="footer\.slogan"/)
    assert.match(indexRaw, /id="appVersion"/)
    assert.doesNotMatch(indexRaw, /class="version-pill"/)
    assert.doesNotMatch(indexRaw, /data-i18n="footer\.(imprint|privacy)"/)
    assert.doesNotMatch(indexRaw, />\s*(Imprint|Privacy)\s*</)
    assert.match(indexRaw, /08523 Plauen/)
    assert.match(layoutRaw, /\.footer-inline\s*{[^}]*grid-template-columns/s)
    assert.match(
        layoutRaw,
        /\.footer-inline__meta\s*{[^}]*justify-content:\s*center/s
    )
    assert.equal(englishMessages['footer.contact'], 'Contact')
    assert.equal(germanMessages['footer.contact'], 'Kontakt')
    assert.equal(englishMessages['footer.responsible'], 'Responsible')
    assert.equal(germanMessages['footer.responsible'], 'Verantwortlich')
    assert.equal(englishMessages['footer.version'], 'Version')
    assert.equal(germanMessages['footer.version'], 'Version')
    assert.equal(
        englishMessages['footer.slogan'],
        'Built and hosted in Germany'
    )
    assert.equal(
        germanMessages['footer.slogan'],
        'In Deutschland entwickelt und gehostet'
    )
})

/**
 * Verifies loaded document metrics live in the sidebar instead of a separate
 * footer-adjacent info strip.
 */
test('app shell omits the separate session summary strip', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const heroIndex = indexRaw.indexOf('<section class="panel hero-grid">')
    const viewerIndex = indexRaw.indexOf('id="viewerStage"')
    const footerIndex = indexRaw.indexOf(
        '<footer class="page-footer footer-inline">'
    )

    assert.ok(heroIndex >= 0)
    assert.ok(viewerIndex > heroIndex)
    assert.ok(footerIndex > viewerIndex)
    assert.equal(indexRaw.includes('class="panel meta-column"'), false)
    assert.equal(indexRaw.includes('id="summaryGrid"'), false)
    assert.equal(indexRaw.includes('id="activeDocumentName"'), false)
    assert.equal(indexRaw.includes('id="diagnosticsCount"'), false)
})

/**
 * Verifies the app shell exposes both multi-file and project-folder intake.
 */
test('app shell exposes multi-file and project-folder intake', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const englishRaw = await readFile(new URL('src/i18n/en.json', root), 'utf8')
    const germanRaw = await readFile(new URL('src/i18n/de.json', root), 'utf8')

    const englishMessages = JSON.parse(englishRaw)
    const germanMessages = JSON.parse(germanRaw)

    assert.match(indexRaw, /id="fileInput"/)
    assert.match(indexRaw, /type="file"/)
    assert.match(indexRaw, /multiple/)
    const fileInputMarkup =
        indexRaw.match(/<input[\s\S]*?id="fileInput"[\s\S]*?\/>/u)?.[0] || ''
    assert.match(fileInputMarkup, /multiple/)
    assert.doesNotMatch(fileInputMarkup, /webkitdirectory/)
    const accept = indexRaw.match(
        /id="fileInput"[\s\S]*?accept="([^"]+)"/u
    )?.[1]
    assert.match(
        accept || '',
        /\.kicad_sym[\s\S]*\.kicad_mod[\s\S]*\.step[\s\S]*\.wrl/
    )
    for (const extension of [
        '.gbr',
        '.gtl',
        '.gbl',
        '.gto',
        '.gbo',
        '.gts',
        '.gbs',
        '.gtp',
        '.gbp',
        '.gko',
        '.gm1',
        '.drl',
        '.xln'
    ]) {
        assert.match(accept || '', new RegExp(extension.replace('.', '\\.')))
    }
    const folderInputMarkup =
        indexRaw.match(/<input[\s\S]*?id="folderInput"[\s\S]*?\/>/u)?.[0] || ''
    assert.match(folderInputMarkup, /webkitdirectory/)
    assert.equal(englishMessages['app.dropHint'], 'Private · Local · No upload')
    assert.equal(germanMessages['app.dropHint'], 'Privat · Lokal · Kein Upload')
    assert.equal(
        englishMessages['status.ready'],
        'Drop .PcbDoc, .SchDoc, .kicad_pcb, Gerber/Excellon files, fabrication ZIPs, or KiCad project files here. Files are processed locally in your browser.'
    )
    assert.equal(
        germanMessages['status.ready'],
        '.PcbDoc-, .SchDoc-, .kicad_pcb-, Gerber-/Excellon-Dateien, Fertigungs-ZIPs oder KiCad-Projektdateien hier ablegen. Dateien werden lokal im Browser verarbeitet.'
    )
})

/**
 * Verifies the landing shell follows the marketing design with a compact
 * branded header, concrete ECAD previews, icon-backed actions, and a slim
 * legal footer.
 */
test('app shell implements the marketing landingpage design shell', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')
    const appViewRaw = await readFile(
        new URL('src/ui/AppView.mjs', root),
        'utf8'
    )
    const emptyStateRaw = await readFile(
        new URL('src/ui/ViewerEmptyStateRenderer.mjs', root),
        'utf8'
    )
    const heroStyleRaw = await readFile(
        new URL('src/styles/15-hero.css', root),
        'utf8'
    )
    const heroRaw = indexRaw.slice(
        indexRaw.indexOf('class="hero-actions"'),
        indexRaw.indexOf('<form')
    )

    assert.match(indexRaw, /class="brand-lockup"/)
    assert.match(indexRaw, /<img src="\/favicon\.svg" alt="" \/>/)
    assert.match(indexRaw, /class="topbar__description"/)
    assert.match(
        indexRaw,
        /Private ECAD viewer for Altium, KiCad, Gerber &amp;\s+CircuitJSON/
    )
    assert.match(indexRaw, /class="icon icon--upload"/)
    assert.match(indexRaw, /class="icon icon--folder"/)
    assert.match(indexRaw, /class="icon icon--globe"/)
    assert.match(indexRaw, /PRIVATE\s*&middot;\s*LOCAL\s*&middot;\s*NO UPLOAD/)
    assert.match(
        indexRaw,
        /Open Altium, KiCad, Gerber &amp; CircuitJSON designs\s+locally/
    )
    assert.match(indexRaw, /Gerber ZIP/)
    assert.doesNotMatch(indexRaw, /no tracking/)
    assert.match(indexRaw, /id="heroPreviewScreen"/)
    assert.match(indexRaw, /class="hero-proof__screen"/)
    assert.match(indexRaw, /src="\/og\/ecadforge-product-preview\.png"/)
    assert.match(indexRaw, /Preview of supported views/)
    assert.match(indexRaw, /id="heroViewChips"/)
    assert.match(
        indexRaw,
        /<button\s+type="button"\s+data-view-chip="schematic"/
    )
    assert.match(
        indexRaw,
        /class="support-tag__icon support-tag__icon--schematic"/
    )
    assert.match(indexRaw, /class="support-tag__icon support-tag__icon--board"/)
    assert.match(indexRaw, /class="support-tag__icon support-tag__icon--cloud"/)
    assert.match(indexRaw, /data-view-chip="schematic"/)
    assert.match(indexRaw, /data-view-chip="diagnostics"/)
    assert.match(
        heroStyleRaw,
        /\.hero-proof__views button\[aria-pressed='true'\]/
    )
    assert.match(heroStyleRaw, /\.hero-proof__svg/)
    assert.doesNotMatch(heroStyleRaw, /\.hero-proof__views li:first-child/)
    assert.match(indexRaw, /class="github-open__input-wrap"/)
    assert.match(indexRaw, /class="[^"]*footer-inline[^"]*"/)
    assert.doesNotMatch(indexRaw, /<div class="footer-card">/)
    assert.match(heroRaw, /class="file-pill file-pill--kicad"/)
    assert.match(heroRaw, /class="file-pill file-pill--altium"/)
    assert.match(
        heroRaw,
        /class="icon icon--sample-kicad"[\s\S]+Try KiCad sample/
    )
    assert.match(
        heroRaw,
        /class="icon icon--sample-altium"[\s\S]+Try Altium sample/
    )
    assert.ok(
        heroRaw.indexOf('Try KiCad sample') <
            heroRaw.indexOf('Try Altium sample')
    )
    assert.ok(
        heroRaw.indexOf('Try Altium sample') <
            heroRaw.indexOf('Open local files')
    )
    assert.match(appViewRaw, /ViewerEmptyStateRenderer\.render\(/)
    assert.match(
        emptyStateRaw,
        /file-pill file-pill--kicad[\s\S]+action\.tryKicad/
    )
    assert.match(
        emptyStateRaw,
        /file-pill file-pill--altium[\s\S]+action\.tryAltium/
    )
    assert.match(
        emptyStateRaw,
        /class="icon icon--sample-kicad"[\s\S]+action\.tryKicad/
    )
    assert.match(
        emptyStateRaw,
        /class="icon icon--sample-altium"[\s\S]+action\.tryAltium/
    )
})

/**
 * Verifies the static product preview is a fresh renderer capture at the
 * dimensions expected by the landing-page frame.
 */
test('marketing product preview uses the refreshed PCB render asset', async () => {
    const preview = await readFile(
        new URL('src/og/ecadforge-product-preview.png', root)
    )
    const stalePreKiCadViewDigest =
        '1e4f58b2a6974a0dc0d9c70202eec86b2a828d629162ad562bb5914db09f7380'
    const digest = createHash('sha256').update(preview).digest('hex')

    assert.equal(preview.subarray(1, 4).toString('ascii'), 'PNG')
    assert.deepEqual(readPngDimensions(preview), {
        width: 760,
        height: 430
    })
    assert.notEqual(digest, stalePreKiCadViewDigest)
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
 * Verifies ECAD libraries resolve through configured package sources.
 */
test('ECAD libraries resolve through configured package sources', async () => {
    const packageRaw = await readFile(new URL('package.json', root), 'utf8')
    const lockRaw = await readFile(new URL('package-lock.json', root), 'utf8')
    const pkg = JSON.parse(packageRaw)
    const lock = JSON.parse(lockRaw)
    const toolkitDependencies = [
        {
            name: 'altium-toolkit',
            registryVersion: '1.1.32'
        },
        {
            name: 'circuitjson-toolkit',
            registryVersion: '1.0.3'
        },
        {
            name: 'gerber-toolkit',
            registryVersion: '0.1.18'
        },
        {
            name: 'kicad-toolkit',
            registryVersion: '1.0.15'
        },
        {
            name: 'pcb-scene3d-viewer',
            registryVersion: '1.1.21'
        }
    ]

    for (const dependency of toolkitDependencies) {
        const packageDependency = pkg.dependencies[dependency.name]
        const lockedDependency =
            lock.packages['']?.dependencies?.[dependency.name]
        const dependencyPackage =
            lock.packages[`node_modules/${dependency.name}`]
        if (dependency.localPath) {
            const linkedPackage = lock.packages[dependency.localPath]

            assert.equal(packageDependency, `file:${dependency.localPath}`)
            assert.equal(lockedDependency, `file:${dependency.localPath}`)
            assert.equal(linkedPackage?.version, dependency.registryVersion)
            assert.equal(dependencyPackage?.resolved, dependency.localPath)
            assert.equal(dependencyPackage?.link, true)
        } else {
            assert.equal(packageDependency, `^${dependency.registryVersion}`)
            assert.equal(lockedDependency, `^${dependency.registryVersion}`)
            assert.equal(dependencyPackage?.version, dependency.registryVersion)
            assert.match(
                dependencyPackage?.resolved ?? '',
                new RegExp(
                    `^https://registry\\.npmjs\\.org/${dependency.name}/-/${dependency.name}-${dependency.registryVersion}\\.tgz$`
                )
            )
            assert.notEqual(dependencyPackage?.link, true)
        }
    }
})

/**
 * Verifies browser parser, renderer, and 3D viewer imports route through the
 * app ECAD facade and owned sibling packages.
 */
test('browser parser and render core resolve through ECAD facade', async () => {
    const controllerSource = await readFile(
        new URL('src/AppController.mjs', root),
        'utf8'
    )
    const workerSource = await readFile(
        new URL('src/workers/ecad-parser.worker.mjs', root),
        'utf8'
    )
    const mainSource = await readFile(new URL('src/main.mjs', root), 'utf8')
    const viewSource = await readFile(
        new URL('src/core/ecad/EcadRendererService.mjs', root),
        'utf8'
    )
    const appViewSource = await readFile(
        new URL('src/ui/AppView.mjs', root),
        'utf8'
    )
    const sceneShellSource = await readFile(
        new URL('src/ui/AppViewScene3dShellRenderer.mjs', root),
        'utf8'
    )
    const heroPreviewSource = await readFile(
        new URL('src/ui/HeroPreviewRenderer.mjs', root),
        'utf8'
    )

    assert.match(
        controllerSource,
        /from ['"]\.\/core\/ecad\/EcadParserService\.mjs['"]/
    )
    assert.match(
        workerSource,
        /from ['"]\.\.\/core\/ecad\/EcadParserService\.mjs['"]/
    )
    assert.match(viewSource, /from ['"]altium-toolkit\/renderers['"]/)
    assert.match(viewSource, /from ['"]gerber-toolkit\/renderers['"]/)
    assert.match(viewSource, /from ['"]kicad-toolkit\/renderers['"]/)
    assert.doesNotMatch(
        mainSource,
        /from ['"](?:pcb-scene3d-viewer|\.\/core\/ecad\/EcadScene3dService\.mjs)['"]/
    )
    assert.doesNotMatch(
        appViewSource,
        /from ['"](?:pcb-scene3d-viewer|\.\.\/core\/ecad\/EcadScene3dService\.mjs)['"]/
    )
    assert.match(sceneShellSource, /from ['"]pcb-scene3d-viewer['"]/)
    assert.match(heroPreviewSource, /from ['"]pcb-scene3d-viewer['"]/)
    assert.doesNotMatch(
        sceneShellSource,
        /node_modules\/pcb-scene3d-viewer\/src/
    )
    assert.doesNotMatch(
        heroPreviewSource,
        /node_modules\/pcb-scene3d-viewer\/src/
    )
    assert.doesNotMatch(appViewSource, /from ['"]\.\/Scene3dRenderer\.mjs['"]/)
})

/**
 * Verifies the static app shell provides an import map for browser-resolved
 * toolkit, viewer, compression, and Three.js dependencies on FTP-hosted
 * deployments.
 */
test('app shell defines a Three.js import map for static hosting', async () => {
    const indexRaw = await readFile(new URL('src/index.html', root), 'utf8')

    assert.match(indexRaw, /<script\s+type="importmap">/)
    assert.match(
        indexRaw,
        /"altium-toolkit"\s*:\s*"\/node_modules\/altium-toolkit\/src\/index\.mjs"/
    )
    assert.match(
        indexRaw,
        /"altium-toolkit\/parser"\s*:\s*"\/node_modules\/altium-toolkit\/src\/parser\.mjs"/
    )
    assert.match(
        indexRaw,
        /"altium-toolkit\/netlist-query"\s*:\s*"\/node_modules\/altium-toolkit\/src\/netlist-query\.mjs"/
    )
    assert.match(
        indexRaw,
        /"altium-toolkit\/renderers"\s*:\s*"\/node_modules\/altium-toolkit\/src\/renderers\.mjs"/
    )
    assert.match(
        indexRaw,
        /"altium-toolkit\/scene3d"\s*:\s*"\/node_modules\/altium-toolkit\/src\/scene3d\.mjs"/
    )
    assert.match(
        indexRaw,
        /"kicad-toolkit"\s*:\s*"\/node_modules\/kicad-toolkit\/src\/index\.mjs"/
    )
    assert.match(
        indexRaw,
        /"kicad-toolkit\/parser"\s*:\s*"\/node_modules\/kicad-toolkit\/src\/parser\.mjs"/
    )
    assert.match(
        indexRaw,
        /"kicad-toolkit\/netlist-query"\s*:\s*"\/node_modules\/kicad-toolkit\/src\/netlist-query\.mjs"/
    )
    assert.match(
        indexRaw,
        /"kicad-toolkit\/renderers"\s*:\s*"\/node_modules\/kicad-toolkit\/src\/renderers\.mjs"/
    )
    assert.match(
        indexRaw,
        /"kicad-toolkit\/scene3d"\s*:\s*"\/node_modules\/kicad-toolkit\/src\/scene3d\.mjs"/
    )
    assert.match(
        indexRaw,
        /"gerber-toolkit"\s*:\s*"\/node_modules\/gerber-toolkit\/src\/index\.mjs"/
    )
    assert.match(
        indexRaw,
        /"gerber-toolkit\/parser"\s*:\s*"\/node_modules\/gerber-toolkit\/src\/parser\.mjs"/
    )
    assert.match(
        indexRaw,
        /"gerber-toolkit\/renderers"\s*:\s*"\/node_modules\/gerber-toolkit\/src\/renderers\.mjs"/
    )
    assert.match(
        indexRaw,
        /"gerber-toolkit\/scene3d"\s*:\s*"\/node_modules\/gerber-toolkit\/src\/scene3d\.mjs"/
    )
    assert.match(
        indexRaw,
        /"pcb-scene3d-viewer"\s*:\s*"\/node_modules\/pcb-scene3d-viewer\/src\/index\.mjs"/
    )
    assert.match(
        indexRaw,
        /"pcb-scene3d-viewer\/scene3d"\s*:\s*"\/node_modules\/pcb-scene3d-viewer\/src\/scene3d\.mjs"/
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
        new URL(
            'node_modules/pcb-scene3d-viewer/src/PcbScene3dRuntime.mjs',
            root
        ),
        'utf8'
    )
    const externalModelsSource = await readFile(
        new URL(
            'node_modules/pcb-scene3d-viewer/src/PcbScene3dExternalModels.mjs',
            root
        ),
        'utf8'
    )
    const stepLoaderSource = await readFile(
        new URL(
            'node_modules/pcb-scene3d-viewer/src/PcbScene3dStepLoader.mjs',
            root
        ),
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
    assert.doesNotMatch(
        stepLoaderSource,
        /\/node_modules\/occt-import-js\/dist\//
    )
})
