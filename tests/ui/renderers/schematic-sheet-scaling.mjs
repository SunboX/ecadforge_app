import { test } from 'node:test'
import assert from 'node:assert/strict'

import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies normalized larger sheets scale schematic primitives into the
 * expanded inner frame without moving the sheet chrome.
 */
test('renderSchematicSvg scales schematic content into the normalized inner frame', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Scaled schematic' },
        schematic: {
            sheet: {
                width: 1654,
                height: 1169,
                sourceWidth: 1500,
                sourceHeight: 950,
                marginWidth: 20,
                paperSize: 'A3'
            },
            lines: [
                {
                    x1: 130,
                    y1: 900,
                    x2: 1262,
                    y2: 900,
                    color: '#000080',
                    width: 1
                }
            ],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(
        markup,
        /<g class="schematic-content" transform="translate\(20 1149\) scale\(1\.11\) translate\(-20 -1149\)">/
    )
})
