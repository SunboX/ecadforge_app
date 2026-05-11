// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

test('index html embeds centralized analytics tracker', async () => {
    const html = await readFile(new URL('src/index.html', root), 'utf8')

    assert.match(
        html,
        /src="https:\/\/analytics\.andrefiedler\.de\/tracker\.js"/
    )
    assert.match(html, /data-site="ecadforge_app"/)
    assert.match(html, /defer/)
    assert.doesNotMatch(html, /data-auto="false"/)
})

test('getting started docs include analytics site registration values', async () => {
    const docs = await readFile(
        new URL('docs/getting-started.md', root),
        'utf8'
    )

    assert.match(docs, /https:\/\/analytics\.andrefiedler\.de\/tracker\.js/)
    assert.match(docs, /ecadforge_app/)
    assert.match(docs, /analytics_sites/)
})
