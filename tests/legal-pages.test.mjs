import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import test from 'node:test'
import { LegalPageSync } from '../scripts/sync-legal-pages.mjs'
import { LegalDocuments } from '../src/legal/LegalDocuments.mjs'

const root = new URL('../', import.meta.url)

test('public disclosures are current, bilingual, readable without scripts and mutually linked', async () => {
    await LegalPageSync.run({ check: true })
    for (const document of LegalDocuments.all()) {
        const html = await readFile(
            new URL(`src/${document.slug}.html`, root),
            'utf8'
        )
        assert.match(html, /lang="de"/)
        assert.match(html, /lang="en"/)
        assert.match(html, /<address>/)
        assert.doesNotMatch(html, /<script|onclick=|{{seller}}/)
        for (const destination of LegalDocuments.all())
            assert.ok(html.includes(`href="/${destination.slug}.html"`))
    }
    const terms = await readFile(new URL('src/terms.html', root), 'utf8')
    assert.match(terms, /3,00 EUR/)
    assert.match(terms, /10,00 EUR/)
    const refunds = await readFile(new URL('src/refunds.html', root), 'utf8')
    assert.match(refunds, /14 Tagen/)
    assert.match(refunds, /Muster-Widerrufsformular/)
})

test('every public entry page offers terms, refunds, privacy and seller contact', async () => {
    for (const file of await readdir(new URL('src/', root))) {
        if (!file.endsWith('.html')) continue
        const html = await readFile(new URL(`src/${file}`, root), 'utf8')
        for (const document of LegalDocuments.all()) {
            assert.ok(
                html.includes(`href="/${document.slug}.html"`),
                `${file}: ${document.slug}`
            )
        }
    }
})

test('public seller fields are escaped and private configuration is never rendered', () => {
    const seller = {
        legalName: '<script>untrusted</script>',
        businessName: 'Synthetic & Co',
        address: { street: 'Example 1', city: 'Sample', postalCode: '12345' },
        email: 'contact@example.test',
        phone: '+49 123 456789',
        taxNumber: 'PRIVATE-TAX'
    }
    const html = LegalPageSync.render(LegalDocuments.all()[0], seller)
    assert.ok(html.includes('&lt;script&gt;untrusted&lt;/script&gt;'))
    assert.ok(html.includes('Synthetic &amp; Co'))
    assert.doesNotMatch(html, /PRIVATE-TAX|<script>/)
})
