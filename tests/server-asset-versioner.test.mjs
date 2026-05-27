import assert from 'node:assert/strict'
import test from 'node:test'
import { ServerAssetVersioner } from '../src/ServerAssetVersioner.mjs'

/**
 * Verifies the HTML shell cache-busts every visible app chrome asset.
 */
test('rewriteHtmlDocument versions favicon link and brand image assets', () => {
    const html = [
        '<link rel="icon" href="/favicon.svg" type="image/svg+xml" />',
        '<img src="/favicon.svg" alt="" />',
        '<link rel="stylesheet" href="/style.css" />',
        '<script type="module" src="/main.mjs"></script>'
    ].join('\n')

    const rewritten = ServerAssetVersioner.rewriteHtmlDocument(html, '1.4.39')

    assert.match(rewritten, /href="\/favicon\.svg\?v=1\.4\.39"/)
    assert.match(rewritten, /src="\/favicon\.svg\?v=1\.4\.39"/)
    assert.match(rewritten, /href="\/style\.css\?v=1\.4\.39"/)
    assert.match(rewritten, /src="\/main\.mjs\?v=1\.4\.39"/)
})
