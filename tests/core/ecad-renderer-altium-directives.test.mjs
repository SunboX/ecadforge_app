import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Verifies generic Altium parameter-set directives render as info callouts.
 */
test('ECAD renderer draws Altium parameter-set info callouts', () => {
    const markup = EcadRendererService.renderSchematic({
        sourceFormat: 'altium',
        kind: 'schematic',
        summary: { title: 'Fake Directive Sheet' },
        schematic: {
            sheet: {
                width: 240,
                height: 180,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false
                    }
                }
            },
            lines: [],
            rectangles: [],
            texts: [],
            components: [],
            pins: [],
            ports: [],
            crosses: [],
            directives: [
                {
                    x: 120,
                    y: 60,
                    color: '#ff0000',
                    name: 'FAKE_SCOPE',
                    orientation: 3
                }
            ]
        }
    })

    assert.match(
        markup,
        /schematic-directive schematic-directive--parameter-set/
    )
    assert.match(markup, />FAKE_SCOPE</)
    assert.match(markup, /schematic-directive-info/)
})
