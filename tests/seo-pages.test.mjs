import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
const siteUrl = 'https://ecadforge.app/'
const seoRoutes = [
    '/altium-pcbdoc-viewer',
    '/altium-schdoc-viewer',
    '/kicad-viewer-online',
    '/kicad-project-viewer',
    '/ecad-viewer-no-upload',
    '/altium-kicad-browser-viewer',
    '/pcb-3d-viewer-browser',
    '/bom-viewer-kicad-altium'
]

/**
 * Extracts and parses the single JSON-LD block from an HTML document.
 * @param {string} html
 * @returns {object}
 */
function parseStructuredData(html) {
    const scriptMatch = html.match(
        /<script\s+type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/
    )

    assert.ok(scriptMatch, 'Expected one JSON-LD script block')

    return JSON.parse(scriptMatch[1])
}

/**
 * Finds one graph node by Schema.org type.
 * @param {object[]} graph
 * @param {string} type
 * @returns {object}
 */
function findGraphNode(graph, type) {
    const node = graph.find((item) => item?.['@type'] === type)

    assert.ok(node, 'Expected graph node of type ' + type)

    return node
}

/**
 * Reads a static HTML page from the source tree.
 * @param {string} route
 * @returns {Promise<string>}
 */
async function readStaticPage(route) {
    const pagePath = route === '/' ? 'src/index.html' : 'src' + route + '.html'

    return readFile(new URL(pagePath, root), 'utf8')
}

test('SEO landing pages expose canonical metadata, app CTAs, and PCB Styler links', async () => {
    for (const route of seoRoutes) {
        const html = await readFile(
            new URL('src' + route + '.html', root),
            'utf8'
        )

        assert.match(html, /<h1>/, route)
        assert.match(html, /<meta\s+name="description"/, route)
        assert.match(
            html,
            new RegExp(
                '<link\\s+rel="canonical"\\s+href="https://ecadforge\\.app' +
                    route +
                    '"'
            ),
            route
        )
        assert.match(html, /application\/ld\+json/, route)
        assert.match(html, /local browser parsing/i, route)
        assert.match(html, /no upload/i, route)
        assert.match(html, /href="\/"/, route)
        assert.match(html, /href="https:\/\/pcb-styler\.app\//, route)
        assert.match(html, /src="\/og\/ecadforge-viewer-pcb\.png"/, route)
    }
})

test('homepage structured data exposes the site and app graph', async () => {
    const html = await readStaticPage('/')
    const structuredData = parseStructuredData(html)

    assert.equal(structuredData['@context'], 'https://schema.org')
    assert.ok(Array.isArray(structuredData['@graph']))

    const website = findGraphNode(structuredData['@graph'], 'WebSite')
    const app = findGraphNode(structuredData['@graph'], 'SoftwareApplication')

    assert.equal(website['@id'], siteUrl + '#website')
    assert.equal(website.name, 'ECAD Forge')
    assert.equal(website.url, siteUrl)
    assert.deepEqual(website.alternateName, ['ecadforge.app', 'ECAD viewer'])
    assert.deepEqual(website.publisher, { '@id': siteUrl + '#publisher' })

    assert.equal(app['@id'], siteUrl + '#app')
    assert.equal(app.name, 'ECAD Forge')
    assert.equal(app.url, siteUrl)
    assert.equal(app.applicationCategory, 'DesignApplication')
    assert.equal(app.operatingSystem, 'Any')
    assert.equal(app.runtimePlatform, 'Modern browser with JavaScript enabled')
    assert.equal(app.isAccessibleForFree, true)
    assert.deepEqual(app.offers, {
        '@type': 'Offer',
        price: 0,
        priceCurrency: 'EUR'
    })
    assert.ok(app.featureList.includes('Local browser parsing with no upload'))
    assert.ok(app.featureList.includes('Altium SchDoc and PcbDoc viewing'))
    assert.ok(
        app.featureList.includes('KiCad project, schematic and PCB viewing')
    )
    assert.ok(
        app.featureList.includes('Gerber and Excellon fabrication viewing')
    )
    assert.ok(app.featureList.includes('CircuitJSON design viewing'))
    assert.equal(app.mainEntityOfPage['@id'], siteUrl + '#webpage')
})

test('site name structured data keeps full identity hints on the homepage only', async () => {
    const homepage = parseStructuredData(await readStaticPage('/'))
    const homepageWebsites = homepage['@graph'].filter(
        (item) => item?.['@type'] === 'WebSite'
    )

    assert.equal(homepageWebsites.length, 1)
    assert.deepEqual(homepageWebsites[0].alternateName, [
        'ecadforge.app',
        'ECAD viewer'
    ])
    assert.deepEqual(homepageWebsites[0].publisher, {
        '@id': siteUrl + '#publisher'
    })

    for (const route of seoRoutes) {
        const structuredData = parseStructuredData(await readStaticPage(route))
        const website = findGraphNode(structuredData['@graph'], 'WebSite')

        assert.equal(website['@id'], siteUrl + '#website', route)
        assert.equal(website.name, 'ECAD Forge', route)
        assert.equal(website.url, siteUrl, route)
        assert.equal(website.alternateName, undefined, route)
        assert.equal(website.publisher, undefined, route)
    }
})

test('SEO landing page structured data identifies the page and breadcrumb', async () => {
    for (const route of seoRoutes) {
        const html = await readStaticPage(route)
        const structuredData = parseStructuredData(html)
        const canonicalUrl = siteUrl.replace(/\/$/, '') + route

        assert.equal(structuredData['@context'], 'https://schema.org', route)
        assert.ok(Array.isArray(structuredData['@graph']), route)

        const website = findGraphNode(structuredData['@graph'], 'WebSite')
        const app = findGraphNode(
            structuredData['@graph'],
            'SoftwareApplication'
        )
        const page = findGraphNode(structuredData['@graph'], 'WebPage')
        const breadcrumb = findGraphNode(
            structuredData['@graph'],
            'BreadcrumbList'
        )

        assert.equal(website['@id'], siteUrl + '#website', route)
        assert.equal(app['@id'], siteUrl + '#app', route)
        assert.equal(page['@id'], canonicalUrl + '#webpage', route)
        assert.equal(page.url, canonicalUrl, route)
        assert.deepEqual(page.isPartOf, { '@id': siteUrl + '#website' }, route)
        assert.deepEqual(page.mainEntity, { '@id': siteUrl + '#app' }, route)
        assert.deepEqual(page.breadcrumb, {
            '@id': canonicalUrl + '#breadcrumb'
        })
        assert.equal(breadcrumb['@id'], canonicalUrl + '#breadcrumb', route)
        assert.deepEqual(breadcrumb.itemListElement, [
            {
                '@type': 'ListItem',
                position: 1,
                name: 'ECAD Forge',
                item: siteUrl
            },
            {
                '@type': 'ListItem',
                position: 2,
                name: page.name,
                item: canonicalUrl
            }
        ])
        assert.equal(
            structuredData['@graph'].some(
                (item) => item?.['@type'] === 'FAQPage'
            ),
            false,
            route
        )
    }
})

test('package exposes a structured data drift check command', async () => {
    const packageRaw = await readFile(new URL('package.json', root), 'utf8')
    const pkg = JSON.parse(packageRaw)

    assert.equal(
        pkg.scripts?.['check:structured-data'],
        'node scripts/check-structured-data.mjs'
    )
})

test('structured data drift checker reports generated page drift', async () => {
    const { StructuredDataDriftChecker } =
        await import('../scripts/check-structured-data.mjs')
    const result = await StructuredDataDriftChecker.check({
        sync: async () => {},
        diffChangedFiles: async () =>
            'src/index.html\nsrc/kicad-viewer-online.html\n'
    })

    assert.equal(result.clean, false)
    assert.deepEqual(result.changedFiles, [
        'src/index.html',
        'src/kicad-viewer-online.html'
    ])
    assert.match(result.message, /npm run sync:structured-data/)
})

test('structured data drift checker accepts clean generated pages', async () => {
    const { StructuredDataDriftChecker } =
        await import('../scripts/check-structured-data.mjs')
    let syncCalled = false
    const result = await StructuredDataDriftChecker.check({
        sync: async () => {
            syncCalled = true
        },
        diffChangedFiles: async () => ''
    })

    assert.equal(syncCalled, true)
    assert.equal(result.clean, true)
    assert.deepEqual(result.changedFiles, [])
})

test('getting started docs cover deployed structured data validation', async () => {
    const docs = await readFile(
        new URL('docs/getting-started.md', root),
        'utf8'
    )

    assert.match(docs, /Rich Results Test/)
    assert.match(docs, /Schema\.org Validator/)
    assert.match(docs, /npm run check:structured-data/)
})

test('sitemap includes every SEO landing page', async () => {
    const sitemap = await readFile(new URL('src/sitemap.xml', root), 'utf8')

    for (const route of seoRoutes) {
        assert.match(
            sitemap,
            new RegExp('<loc>https://ecadforge\\.app' + route + '</loc>'),
            route
        )
    }
})
