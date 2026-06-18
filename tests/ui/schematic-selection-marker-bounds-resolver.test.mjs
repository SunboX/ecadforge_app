import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSelectionMarkerBoundsResolver } from '../../src/ui/SchematicSelectionMarkerBoundsResolver.mjs'

/**
 * Verifies selected schematic marker bounds include the scene scale used by
 * toolkit-rendered KiCad schematics.
 */
test('SchematicSelectionMarkerBoundsResolver applies schematic scene scale', () => {
    const markup =
        '<svg class="schematic-svg" viewBox="0 0 800 600">' +
        '<g class="schematic-scene" transform="scale(10)">' +
        '<g class="schematic-symbol-highlight" data-schematic-component-key="Q1">' +
        '<rect class="schematic-symbol-highlight__fill" x="12" y="34" width="5" height="7"/>' +
        '</g></g></svg>'

    assert.deepEqual(
        SchematicSelectionMarkerBoundsResolver.resolve(markup, 'Q1'),
        {
            x: 120,
            y: 340,
            width: 50,
            height: 70
        }
    )
})
