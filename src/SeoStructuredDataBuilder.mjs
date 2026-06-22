const siteUrl = 'https://ecadforge.app/'
const siteOrigin = siteUrl.replace(/\/$/, '')
const websiteId = siteUrl + '#website'
const publisherId = siteUrl + '#publisher'
const appId = siteUrl + '#app'
const primaryImageId = siteUrl + '#primary-image'
const repositoryUrl = 'https://github.com/SunboX/ecadforge_app'
const mastodonUrl = 'https://mastodon.social/@sonnenkiste'
const previewImageUrl = siteUrl + 'og/ecadforge-viewer-pcb.png'
const licenseUrl = 'https://www.gnu.org/licenses/agpl-3.0.html'
const appDescription =
    'Open Altium, KiCad, Gerber and CircuitJSON designs locally in your browser. View schematics, PCB layouts, fabrication layers, 3D boards, BOMs and diagnostics without uploading your files.'
const appFeatureList = [
    'Local browser parsing with no upload',
    'Altium SchDoc and PcbDoc viewing',
    'KiCad project, schematic and PCB viewing',
    'Gerber and Excellon fabrication viewing',
    'CircuitJSON design viewing',
    'Interactive PCB layout, schematic, 3D, BOM and diagnostics views'
]

/**
 * Builds Schema.org JSON-LD graphs for ECAD Forge public pages.
 */
export class SeoStructuredDataBuilder {
    /**
     * Builds structured data for the ECAD Forge homepage.
     * @param {{ softwareVersion?: string }} [options]
     * @returns {object}
     */
    static buildHomepageData(options = {}) {
        const pageId = siteUrl + '#webpage'

        return SeoStructuredDataBuilder.#buildDocument([
            SeoStructuredDataBuilder.#buildPublisherNode(),
            SeoStructuredDataBuilder.#buildWebsiteNode({
                includeSiteNameHints: true
            }),
            SeoStructuredDataBuilder.#buildPrimaryImageNode(),
            SeoStructuredDataBuilder.#buildHomepageNode(pageId),
            SeoStructuredDataBuilder.#buildAppNode({
                mainEntityOfPageId: pageId,
                softwareVersion: options.softwareVersion
            })
        ])
    }

    /**
     * Builds structured data for one static SEO landing page.
     * @param {{ url: string, name: string, description: string }} page
     * @param {{ softwareVersion?: string }} [options]
     * @returns {object}
     */
    static buildLandingPageData(page, options = {}) {
        const pageUrl = SeoStructuredDataBuilder.#normalizePageUrl(page.url)
        const pageId = pageUrl + '#webpage'
        const breadcrumbId = pageUrl + '#breadcrumb'

        return SeoStructuredDataBuilder.#buildDocument([
            SeoStructuredDataBuilder.#buildPublisherNode(),
            SeoStructuredDataBuilder.#buildWebsiteNode(),
            SeoStructuredDataBuilder.#buildPrimaryImageNode(),
            SeoStructuredDataBuilder.#buildAppNode({
                softwareVersion: options.softwareVersion
            }),
            SeoStructuredDataBuilder.#buildLandingPageNode({
                breadcrumbId,
                description: page.description,
                name: page.name,
                pageId,
                pageUrl
            }),
            SeoStructuredDataBuilder.#buildBreadcrumbNode({
                breadcrumbId,
                pageName: page.name,
                pageUrl
            })
        ])
    }

    /**
     * Serializes structured data for embedding inside a script tag.
     * @param {object} structuredData
     * @returns {string}
     */
    static stringify(structuredData) {
        return JSON.stringify(structuredData, null, 4)
    }

    /**
     * Builds one JSON-LD document object.
     * @param {object[]} graph
     * @returns {object}
     */
    static #buildDocument(graph) {
        return {
            '@context': 'https://schema.org',
            '@graph': graph
        }
    }

    /**
     * Builds the publisher identity node from visible homepage footer facts.
     * @returns {object}
     */
    static #buildPublisherNode() {
        return {
            '@type': 'Person',
            '@id': publisherId,
            name: 'André Fiedler',
            url: 'https://github.com/SunboX',
            sameAs: [repositoryUrl, mastodonUrl]
        }
    }

    /**
     * Builds the site identity node used by Google site-name parsing.
     * @param {{ includeSiteNameHints?: boolean }} [options]
     * @returns {object}
     */
    static #buildWebsiteNode(options = {}) {
        const websiteNode = {
            '@type': 'WebSite',
            '@id': websiteId,
            name: 'ECAD Forge',
            url: siteUrl
        }

        if (!options.includeSiteNameHints) {
            return websiteNode
        }

        return {
            ...websiteNode,
            alternateName: ['ecadforge.app', 'ECAD viewer'],
            description: appDescription,
            inLanguage: 'en',
            publisher: SeoStructuredDataBuilder.#reference(publisherId),
            image: SeoStructuredDataBuilder.#reference(primaryImageId)
        }
    }

    /**
     * Builds the shared Open Graph screenshot image node.
     * @returns {object}
     */
    static #buildPrimaryImageNode() {
        return {
            '@type': 'ImageObject',
            '@id': primaryImageId,
            url: previewImageUrl,
            caption: 'ECAD Forge PCB, schematic, 3D and BOM viewer',
            width: 1200,
            height: 630
        }
    }

    /**
     * Builds the homepage node.
     * @param {string} pageId
     * @returns {object}
     */
    static #buildHomepageNode(pageId) {
        return {
            '@type': 'WebPage',
            '@id': pageId,
            url: siteUrl,
            name: 'ECAD Forge - Altium, KiCad, Gerber & CircuitJSON Viewer in Your Browser',
            description: appDescription,
            inLanguage: 'en',
            isPartOf: SeoStructuredDataBuilder.#reference(websiteId),
            mainEntity: SeoStructuredDataBuilder.#reference(appId),
            primaryImageOfPage:
                SeoStructuredDataBuilder.#reference(primaryImageId)
        }
    }

    /**
     * Builds the shared ECAD Forge software app node.
     * @param {{ mainEntityOfPageId?: string, softwareVersion?: string }} options
     * @returns {object}
     */
    static #buildAppNode(options) {
        const appNode = {
            '@type': 'SoftwareApplication',
            '@id': appId,
            name: 'ECAD Forge',
            url: siteUrl,
            description: appDescription,
            applicationCategory: 'DesignApplication',
            operatingSystem: 'Any',
            runtimePlatform: 'Modern browser with JavaScript enabled',
            isAccessibleForFree: true,
            featureList: appFeatureList,
            screenshot: SeoStructuredDataBuilder.#reference(primaryImageId),
            image: SeoStructuredDataBuilder.#reference(primaryImageId),
            creator: SeoStructuredDataBuilder.#reference(publisherId),
            publisher: SeoStructuredDataBuilder.#reference(publisherId),
            copyrightHolder: SeoStructuredDataBuilder.#reference(publisherId),
            sameAs: [repositoryUrl],
            license: licenseUrl,
            offers: {
                '@type': 'Offer',
                price: 0,
                priceCurrency: 'EUR'
            }
        }

        if (options.softwareVersion) {
            appNode.softwareVersion = String(options.softwareVersion)
        }

        if (options.mainEntityOfPageId) {
            appNode.mainEntityOfPage = SeoStructuredDataBuilder.#reference(
                options.mainEntityOfPageId
            )
        }

        return appNode
    }

    /**
     * Builds one static landing page node.
     * @param {{ breadcrumbId: string, description: string, name: string, pageId: string, pageUrl: string }} options
     * @returns {object}
     */
    static #buildLandingPageNode(options) {
        return {
            '@type': 'WebPage',
            '@id': options.pageId,
            url: options.pageUrl,
            name: options.name,
            description: options.description,
            inLanguage: 'en',
            isPartOf: SeoStructuredDataBuilder.#reference(websiteId),
            mainEntity: SeoStructuredDataBuilder.#reference(appId),
            breadcrumb: SeoStructuredDataBuilder.#reference(
                options.breadcrumbId
            ),
            primaryImageOfPage:
                SeoStructuredDataBuilder.#reference(primaryImageId)
        }
    }

    /**
     * Builds a two-level breadcrumb from ECAD Forge to one landing page.
     * @param {{ breadcrumbId: string, pageName: string, pageUrl: string }} options
     * @returns {object}
     */
    static #buildBreadcrumbNode(options) {
        return {
            '@type': 'BreadcrumbList',
            '@id': options.breadcrumbId,
            itemListElement: [
                {
                    '@type': 'ListItem',
                    position: 1,
                    name: 'ECAD Forge',
                    item: siteUrl
                },
                {
                    '@type': 'ListItem',
                    position: 2,
                    name: options.pageName,
                    item: options.pageUrl
                }
            ]
        }
    }

    /**
     * Normalizes one ECAD Forge page URL without mutating canonical roots.
     * @param {string} pageUrl
     * @returns {string}
     */
    static #normalizePageUrl(pageUrl) {
        const url = String(pageUrl || '').trim()

        if (!url.startsWith(siteOrigin + '/')) {
            throw new Error('Structured data page URL must use ' + siteOrigin)
        }

        return url.endsWith('/') && url !== siteUrl ? url.slice(0, -1) : url
    }

    /**
     * Creates a compact reference to another graph node.
     * @param {string} id
     * @returns {{ '@id': string }}
     */
    static #reference(id) {
        return { '@id': id }
    }
}
