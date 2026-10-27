import { readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { format } from 'prettier'
import { LegalDocuments } from '../src/legal/LegalDocuments.mjs'

/** Builds script-free public disclosures from authored text and public seller facts. */
export class LegalPageSync {
    /** Render deterministic pages or check that committed output matches its source. */
    static async run({
        check = false,
        root = new URL('../', import.meta.url)
    } = {}) {
        const seller = JSON.parse(
            await readFile(new URL('src/legal/seller.json', root), 'utf8')
        )
        const documents = LegalDocuments.all()
        for (const document of documents) {
            const html = await format(
                this.render(document, seller, documents),
                { parser: 'html', tabWidth: 4 }
            )
            const url = new URL(`src/${document.slug}.html`, root)
            if (check) {
                if ((await readFile(url, 'utf8')) !== html)
                    throw new Error(`Stale legal page: ${document.slug}`)
            } else await writeFile(url, html)
        }
    }

    /** Render only authored document HTML; escape all public seller and metadata values. */
    static render(document, seller, documents = LegalDocuments.all()) {
        const e = (value) => this.escape(value)
        const address = seller.address
        const [titleDe, titleEn = titleDe] = document.title.split(' / ')
        const contact = `<address><strong>${e(seller.legalName)} – ${e(seller.businessName)}</strong><br>${e(address.street)}<br>${e(address.postalCode)} ${e(address.city)}<br>Deutschland / Germany<br><a href="mailto:${e(encodeURIComponent(seller.email))}">${e(seller.email)}</a><br><a href="tel:${e(seller.phone.replace(/[ ()-]/g, ''))}">${e(seller.phone)}</a>${document.slug === 'impressum' && seller.vatId ? `<br>USt-IdNr. / VAT ID: ${e(seller.vatId)}` : ''}</address>`
        const recipient = `${e(seller.legalName)} – ${e(seller.businessName)}\n${e(address.street)}, ${e(address.postalCode)} ${e(address.city)}\n${e(seller.email)}`
        const de = document.de
            .replaceAll('{{seller}}', contact)
            .replaceAll('{{recipient-de}}', 'An: ' + recipient)
        const en = document.en
            .replaceAll('{{seller}}', contact)
            .replaceAll('{{recipient-en}}', 'To: ' + recipient)
        const nav = documents
            .map(
                (item) =>
                    `<a href="/${item.slug}.html"${item.slug === document.slug ? ' aria-current="page"' : ''}><span data-legal-language-copy="de">${e(item.title.split(' / ')[0])}</span><span data-legal-language-copy="en">${e(item.title.split(' / ')[1] || item.title)}</span></a>`
            )
            .join('\n')
        const html = `<!doctype html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="description" content="${e(document.title)} für ECAD Forge von André Fiedler – Andrés Werkstatt."><link rel="canonical" href="https://ecadforge.app/${document.slug}.html"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles/50-legal.css"><link rel="stylesheet" href="/styles/51-legal-dialog.css"><title>${e(document.title)} | ECAD Forge</title></head>
<body class="legal-page"><a class="skip-link" href="#content">Zum Inhalt / Skip to content</a><header><a class="legal-brand" href="/">ECAD Forge</a><div class="legal-language-controls" data-legal-language-controls role="group" aria-label="Sprache / Language" hidden><button type="button" data-legal-language="de" aria-pressed="true" lang="de">Deutsch</button><button type="button" data-legal-language="en" aria-pressed="false" lang="en">English</button></div></header>
<main id="content"><h1 data-legal-title data-title-de="${e(titleDe)}" data-title-en="${e(titleEn)}">${e(document.title)}</h1><p class="legal-date">Stand / Updated: <time datetime="2026-10-27">27.10.2026</time></p><section id="de" lang="de" aria-label="Deutsch" data-legal-language-copy="de">${de}</section><section id="en" lang="en" aria-label="English" data-legal-language-copy="en">${en}</section></main>
<footer><nav aria-label="Rechtliche Informationen / Legal information">${nav}<a href="/">Zur Anwendung / Back to viewer</a></nav><p>André Fiedler – Andrés Werkstatt</p></footer><script type="module" src="/legal/main.mjs"></script></body></html>`
        return this.markLegalLinks(html, documents)
    }

    /** Mark authored document routes for modal navigation, including cross-document references. */
    static markLegalLinks(html, documents) {
        const paths = new Set(
            documents.map((document) => `/${document.slug}.html`)
        )
        return html.replace(
            /<a\b([^>]*?)href="([^"]+)"/g,
            (tag, before, href) => {
                const url = new URL(href, 'https://ecadforge.app')
                return paths.has(url.pathname) &&
                    url.origin === 'https://ecadforge.app'
                    ? `<a${before}data-legal-document href="${href}"`
                    : tag
            }
        )
    }

    /** Escape public facts in both HTML text and attribute contexts. */
    static escape(value) {
        return String(value).replace(
            /[&<>"']/g,
            (character) =>
                ({
                    '&': '&amp;',
                    '<': '&lt;',
                    '>': '&gt;',
                    '"': '&quot;',
                    "'": '&#39;'
                })[character]
        )
    }
}

if (
    process.argv[1] &&
    import.meta.url === pathToFileURL(process.argv[1]).href
) {
    await LegalPageSync.run({ check: process.argv.includes('--check') })
    console.log('Legal pages are synchronized.')
}
