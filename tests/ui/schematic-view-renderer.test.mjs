import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicViewRenderer } from '../../src/ui/SchematicViewRenderer.mjs'

/**
 * Builds a compact KiCad-style schematic model with owner-linked primitives.
 * @returns {object}
 */
function createKicadSchematicDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'schematic',
        fileName: 'symbol-highlight-fake.kicad_sch',
        summary: { title: 'Symbol Highlight Fake' },
        schematic: {
            sheet: { width: 120, height: 90 },
            components: [
                {
                    ownerIndex: 'owner-a',
                    designator: 'U1',
                    value: 'Logic',
                    x: 30,
                    y: 30
                }
            ],
            rectangles: [
                {
                    ownerIndex: 'owner-a',
                    x: 24,
                    y: 18,
                    width: 20,
                    height: 24,
                    transparent: true
                }
            ],
            pins: [
                {
                    ownerIndex: 'owner-a',
                    x: 24,
                    y: 24,
                    length: 4,
                    orientation: 'left',
                    designator: '1',
                    name: 'IN'
                }
            ],
            texts: [
                {
                    ownerIndex: 'owner-a',
                    x: 30,
                    y: 14,
                    value: 'U1',
                    text: 'U1',
                    fontSize: 1.27
                }
            ],
            lines: []
        }
    }
}

/**
 * Builds a compact Altium-style schematic model with owner-linked text.
 * @returns {object}
 */
function createAltiumSchematicDocument() {
    return {
        kind: 'schematic',
        fileName: 'symbol-highlight-fake.SchDoc',
        summary: { title: 'Symbol Highlight Fake' },
        schematic: {
            sheet: {
                width: 220,
                height: 140,
                sourceWidth: 220,
                sourceHeight: 140,
                borderOn: false,
                marginWidth: 10
            },
            components: [
                {
                    designator: 'R1',
                    value: '10k',
                    x: 80,
                    y: 70
                }
            ],
            rectangles: [
                {
                    ownerIndex: 'owner-r1',
                    x: 70,
                    y: 64,
                    width: 20,
                    height: 12,
                    transparent: false,
                    color: '#800000',
                    fill: '#ffffb0'
                }
            ],
            texts: [
                {
                    ownerIndex: 'owner-r1',
                    name: 'Designator',
                    x: 80,
                    y: 78,
                    text: 'R1',
                    fontSize: 10
                }
            ],
            pins: [
                {
                    ownerIndex: 'owner-r1',
                    x: 70,
                    y: 70,
                    length: 8,
                    orientation: 'left',
                    designator: '1',
                    name: 'A'
                }
            ],
            lines: [],
            polygons: [],
            ellipses: [],
            arcs: []
        }
    }
}

/**
 * Verifies selected KiCad schematic symbols get an SVG-local highlight.
 */
test('SchematicViewRenderer highlights selected KiCad symbols', () => {
    const html = SchematicViewRenderer.render(
        createKicadSchematicDocument(),
        'U1'
    )

    assert.doesNotMatch(html, /svg-panel__header/)
    assert.match(html, /class="schematic-component-highlight-style"/)
    assert.match(html, /data-schematic-component-key="U1"/)
    assert.match(html, /schematic-symbol-highlight/)
})

/**
 * Verifies selected Altium schematic symbols get an SVG-local highlight.
 */
test('SchematicViewRenderer highlights selected Altium symbols', () => {
    const html = SchematicViewRenderer.render(
        createAltiumSchematicDocument(),
        'R1'
    )

    assert.doesNotMatch(html, /svg-panel__header/)
    assert.match(html, /class="schematic-component-highlight-style"/)
    assert.match(html, /data-schematic-component-key="R1"/)
    assert.match(html, /schematic-symbol-highlight/)
})
