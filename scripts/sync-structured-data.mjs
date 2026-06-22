import { readFile, rename, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { SeoStructuredDataBuilder } from '../src/SeoStructuredDataBuilder.mjs'

const projectRoot = new URL('../', import.meta.url)
const staticRoutes = [
    '/',
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
 * Rewrites static page JSON-LD blocks from shared Schema.org graph rules.
 */
export class StructuredDataSync {
    /**
     * Updates all public static page JSON-LD blocks.
     * @returns {Promise<void>}
     */
    static async run() {
        const softwareVersion = await StructuredDataSync.#readPackageVersion()

        for (const route of staticRoutes) {
            await StructuredDataSync.#syncRoute(route, softwareVersion)
        }
    }

    /**
     * Rewrites one static route's JSON-LD block.
     * @param {string} route
     * @param {string} softwareVersion
     * @returns {Promise<void>}
     */
    static async #syncRoute(route, softwareVersion) {
        const pageUrl = StructuredDataSync.#resolvePageUrl(route)
        const html = await readFile(pageUrl, 'utf8')
        const structuredData =
            route === '/'
                ? SeoStructuredDataBuilder.buildHomepageData({
                      softwareVersion
                  })
                : SeoStructuredDataBuilder.buildLandingPageData(
                      StructuredDataSync.#extractLandingPage(html),
                      { softwareVersion }
                  )
        const updatedHtml = StructuredDataSync.#replaceStructuredData(
            html,
            structuredData
        )

        await StructuredDataSync.#writeFileAtomically(pageUrl, updatedHtml)
    }

    /**
     * Reads the current app package version.
     * @returns {Promise<string>}
     */
    static async #readPackageVersion() {
        const packageRaw = await readFile(
            new URL('package.json', projectRoot),
            'utf8'
        )
        const pkg = JSON.parse(packageRaw)

        return String(pkg.version || '').trim()
    }

    /**
     * Resolves one route to its static source HTML file.
     * @param {string} route
     * @returns {URL}
     */
    static #resolvePageUrl(route) {
        const fileName = route === '/' ? 'index' : route.replace(/^\//, '')

        return new URL('src/' + fileName + '.html', projectRoot)
    }

    /**
     * Extracts visible and canonical landing page metadata from one HTML file.
     * @param {string} html
     * @returns {{ url: string, name: string, description: string }}
     */
    static #extractLandingPage(html) {
        return {
            url: StructuredDataSync.#extractAttributeFromTag(
                html,
                'link',
                'rel',
                'canonical',
                'href'
            ),
            name: StructuredDataSync.#extractHeading(html),
            description: StructuredDataSync.#extractAttributeFromTag(
                html,
                'meta',
                'name',
                'description',
                'content'
            )
        }
    }

    /**
     * Extracts an attribute from the first matching HTML tag.
     * @param {string} html
     * @param {string} tagName
     * @param {string} matchAttribute
     * @param {string} matchValue
     * @param {string} targetAttribute
     * @returns {string}
     */
    static #extractAttributeFromTag(
        html,
        tagName,
        matchAttribute,
        matchValue,
        targetAttribute
    ) {
        const tagPattern = new RegExp('<' + tagName + '\\s+[^>]*>', 'gi')
        const matchingTag = [...html.matchAll(tagPattern)]
            .map((match) => match[0])
            .find((tag) =>
                StructuredDataSync.#attributeEquals(
                    tag,
                    matchAttribute,
                    matchValue
                )
            )

        if (!matchingTag) {
            throw new Error(
                'Missing <' +
                    tagName +
                    '> tag with ' +
                    matchAttribute +
                    '="' +
                    matchValue +
                    '"'
            )
        }

        return StructuredDataSync.#extractAttribute(
            matchingTag,
            targetAttribute
        )
    }

    /**
     * Extracts the first page H1 as plain text.
     * @param {string} html
     * @returns {string}
     */
    static #extractHeading(html) {
        const headingMatch = html.match(/<h1(?:\s+[^>]*)?>([\s\S]*?)<\/h1>/i)

        if (!headingMatch) {
            throw new Error('Missing page <h1>')
        }

        return StructuredDataSync.#decodeHtmlText(
            headingMatch[1].replace(/<[^>]+>/g, '')
        )
    }

    /**
     * Checks whether one tag has an attribute with an exact value.
     * @param {string} tag
     * @param {string} attribute
     * @param {string} expectedValue
     * @returns {boolean}
     */
    static #attributeEquals(tag, attribute, expectedValue) {
        return (
            StructuredDataSync.#readAttribute(tag, attribute) === expectedValue
        )
    }

    /**
     * Writes one file through a temporary path before replacing the target.
     * @param {URL} targetUrl
     * @param {string} contents
     * @returns {Promise<void>}
     */
    static async #writeFileAtomically(targetUrl, contents) {
        const temporaryUrl = new URL(targetUrl.href + '.tmp')

        await writeFile(temporaryUrl, contents)
        await rename(temporaryUrl, targetUrl)
    }

    /**
     * Extracts one double-quoted HTML attribute value.
     * @param {string} tag
     * @param {string} attribute
     * @returns {string}
     */
    static #extractAttribute(tag, attribute) {
        const attributeValue = StructuredDataSync.#readAttribute(tag, attribute)

        if (attributeValue === null) {
            throw new Error('Missing attribute ' + attribute)
        }

        return attributeValue
    }

    /**
     * Reads one double-quoted HTML attribute value if it is present.
     * @param {string} tag
     * @param {string} attribute
     * @returns {string | null}
     */
    static #readAttribute(tag, attribute) {
        const attributePattern = new RegExp(attribute + '="([^"]*)"', 'i')
        const attributeMatch = tag.match(attributePattern)

        if (!attributeMatch) {
            return null
        }

        return StructuredDataSync.#decodeHtmlText(attributeMatch[1])
    }

    /**
     * Replaces one JSON-LD script block with generated structured data.
     * @param {string} html
     * @param {object} structuredData
     * @returns {string}
     */
    static #replaceStructuredData(html, structuredData) {
        const scriptPattern =
            /        <script type="application\/ld\+json">[\s\S]*?        <\/script>/
        const scriptMatches = html.match(
            /<script type="application\/ld\+json">/g
        )

        if (!scriptMatches || scriptMatches.length !== 1) {
            throw new Error('Expected exactly one JSON-LD script block')
        }

        return html.replace(
            scriptPattern,
            StructuredDataSync.#formatScript(structuredData)
        )
    }

    /**
     * Formats structured data for the repository's HTML indentation style.
     * @param {object} structuredData
     * @returns {string}
     */
    static #formatScript(structuredData) {
        const json = SeoStructuredDataBuilder.stringify(structuredData)
            .split('\n')
            .map((line) => '            ' + line)
            .join('\n')

        return (
            '        <script type="application/ld+json">\n' +
            json +
            '\n' +
            '        </script>'
        )
    }

    /**
     * Decodes the HTML entities used in static SEO metadata.
     * @param {string} value
     * @returns {string}
     */
    static #decodeHtmlText(value) {
        return String(value || '')
            .replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&middot;/g, '·')
            .replace(/\s+/g, ' ')
            .trim()
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    await StructuredDataSync.run()
}
