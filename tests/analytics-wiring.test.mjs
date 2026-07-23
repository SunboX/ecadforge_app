// SPDX-FileCopyrightText: 2026 André Fiedler
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const root = new URL('../', import.meta.url)

test('index html leaves tracker loading to the browser entrypoint', async () => {
    const html = await readFile(new URL('src/index.html', root), 'utf8')
    const main = await readFile(new URL('src/main.mjs', root), 'utf8')

    assert.doesNotMatch(
        html,
        /src="https:\/\/analytics\.andrefiedler\.de\/tracker\.js"/
    )
    assert.match(main, /AnalyticsTrackerLoader/)
})

test('browser entry loads analytics only after startup content is ready', async () => {
    const main = await readFile(new URL('src/main.mjs', root), 'utf8')

    assert.ok(
        main.indexOf('await controller.init()') <
            main.indexOf('AnalyticsTrackerLoader.loadBrowserTracker'),
        'analytics must not compete with startup source loading'
    )
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
