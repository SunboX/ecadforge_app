import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../', import.meta.url)
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
