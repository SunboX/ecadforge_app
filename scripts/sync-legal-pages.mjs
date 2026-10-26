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
                    `<a href="/${item.slug}.html"${item.slug === document.slug ? ' aria-current="page"' : ''}>${e(item.title)}</a>`
            )
            .join('\n')
        return `<!doctype html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="referrer" content="no-referrer"><meta name="description" content="${e(document.title)} für ECAD Forge von André Fiedler – Andrés Werkstatt."><link rel="canonical" href="https://ecadforge.app/${document.slug}.html"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles/50-legal.css"><title>${e(document.title)} | ECAD Forge</title></head>
<body class="legal-page"><a class="skip-link" href="#content">Zum Inhalt / Skip to content</a><header><a class="legal-brand" href="/">ECAD Forge</a><nav aria-label="Sprache / Language"><a href="#de" lang="de">Deutsch</a><a href="#en" lang="en">English</a></nav></header>
<main id="content"><h1>${e(document.title)}</h1><p class="legal-date">Stand / Updated: <time datetime="2026-10-26">26.10.2026</time></p><section id="de" lang="de" aria-label="Deutsch">${de}</section><section id="en" lang="en" aria-label="English"><h2 class="legal-language-title">English</h2>${en}</section></main>
<footer><nav aria-label="Rechtliche Informationen / Legal information">${nav}<a href="/">Zur Anwendung / Back to viewer</a></nav><p>André Fiedler – Andrés Werkstatt</p></footer></body></html>`
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
