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
                },
                {
                    ownerIndex: 'owner-a',
                    x: 40,
                    y: 24,
                    length: 4,
                    orientation: 'right',
                    designator: '2',
                    name: 'OUT'
                },
                {
                    ownerIndex: 'owner-a',
                    x: 30,
                    y: 22,
                    length: 4,
                    orientation: 'top',
                    designator: '3',
                    name: 'VCC'
                },
                {
                    ownerIndex: 'owner-a',
                    x: 34,
                    y: 22,
                    length: 4,
                    orientation: 'top',
                    designator: '4',
                    name: 'EN'
                },
                {
                    ownerIndex: 'owner-a',
                    x: 30,
                    y: 38,
                    length: 4,
                    orientation: 'bottom',
                    designator: '5',
                    name: 'GND'
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
 * Builds a compact Altium transistor symbol whose arrow body is smaller than
 * the owner-linked symbol lines and pins.
 * @returns {object}
 */
function createAltiumTransistorDocument() {
    const documentModel = createAltiumSchematicDocument()
    const schematic = documentModel.schematic
    schematic.components = [
        {
            designator: 'VT1',
            value: 'S8050',
            x: 50,
            y: 50
        }
    ]
    schematic.polygons = [
        {
            ownerIndex: 'owner-vt1',
            points: [
                { x: 40, y: 40 },
                { x: 43, y: 45 },
                { x: 46, y: 41 }
            ]
        }
    ]
    schematic.lines = [
        { ownerIndex: 'owner-vt1', x1: 40, y1: 60, x2: 50, y2: 53 },
        { ownerIndex: 'owner-vt1', x1: 50, y1: 47, x2: 40, y2: 40 },
        { ownerIndex: 'owner-vt1', x1: 50, y1: 59, x2: 50, y2: 41 }
    ]
    schematic.pins = [
        {
            ownerIndex: 'owner-vt1',
            x: 40,
            y: 60,
            length: 20,
            orientation: 'top'
        },
        {
            ownerIndex: 'owner-vt1',
            x: 50,
            y: 50,
            length: 20,
            orientation: 'right'
        },
        {
            ownerIndex: 'owner-vt1',
            x: 40,
            y: 40,
            length: 20,
            orientation: 'bottom'
        }
    ]
    schematic.texts = [
        {
            ownerIndex: 'owner-vt1',
            name: 'Designator',
            x: 72,
            y: 64,
            text: 'VT1',
            fontSize: 10
        }
    ]

    return documentModel
}

/**
 * Builds an Altium multi-part symbol whose body owner is named by a visible
 * designator suffix.
 * @returns {object}
 */
function createAltiumMultipartSchematicDocument() {
    const documentModel = createAltiumSchematicDocument()
    const schematic = documentModel.schematic
    schematic.sheet = {
        width: 180,
        height: 180,
        sourceWidth: 180,
        sourceHeight: 180,
        borderOn: false,
        marginWidth: 10
    }
    schematic.components = [
        {
            designator: 'U1',
            value: 'Logic',
            x: 36,
            y: 138,
            uniqueId: 'unmatched-component-id'
        },
        {
            designator: 'U1',
            value: 'Logic',
            x: 96,
            y: 78,
            uniqueId: 'second-unmatched-component-id'
        }
    ]
    schematic.rectangles = [
        {
            ownerIndex: 'owner-u1b',
            x: 30,
            y: 60,
            width: 50,
            height: 90
        },
        {
            ownerIndex: 'owner-u1c',
            x: 90,
            y: 20,
            width: 40,
            height: 50
        }
    ]
    schematic.texts = [
        {
            ownerIndex: 'owner-u1b',
            name: 'Designator',
            x: 28,
            y: 154,
            text: 'U1B',
            fontSize: 10
        },
        {
            ownerIndex: 'owner-u1c',
            name: 'Designator',
            x: 92,
            y: 94,
            text: 'U1C',
            fontSize: 10
        }
    ]
    schematic.pins = [
        {
            ownerIndex: 'owner-u1b',
            x: 80,
            y: 120,
            length: 8,
            orientation: 'right',
            designator: '1',
            name: 'OUT'
        },
        {
            ownerIndex: 'owner-u1c',
            x: 130,
            y: 42,
            length: 8,
            orientation: 'right',
            designator: '2',
            name: 'OUT2'
        }
    ]

    return documentModel
}

/**
 * Extracts the selected highlight fill attributes from rendered markup.
 * @param {string} html Rendered schematic HTML.
 * @returns {{ x: string, y: string, width: string, height: string }}
 */
function extractHighlightFillBox(html) {
    const match = String(html).match(
        /<rect class="schematic-symbol-highlight__fill" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/
    )
    assert.ok(match, 'Expected a schematic highlight fill rectangle.')

    return {
        x: match[1],
        y: match[2],
        width: match[3],
        height: match[4]
    }
}

/**
 * Extracts one schematic hit target rectangle by component key.
 * @param {string} html Rendered schematic HTML.
 * @param {string} key Component key.
 * @returns {{ x: string, y: string, width: string, height: string }}
 */
function extractHitTargetBox(html, key) {
    const pattern = new RegExp(
        '<g class="schematic-symbol-hit-target" data-schematic-component-key="' +
            key +
            '"><rect class="schematic-symbol-hit-target__area" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"'
    )
    const match = String(html).match(pattern)
    assert.ok(match, 'Expected a schematic hit target rectangle.')

    return {
        x: match[1],
        y: match[2],
        width: match[3],
        height: match[4]
    }
}

/**
 * Extracts selected schematic highlight rectangles by component key.
 * @param {string} html Rendered schematic HTML.
 * @param {string} key Component key.
 * @returns {{ x: string, y: string, width: string, height: string }[]}
 */
function extractHighlightBoxes(html, key) {
    const pattern = new RegExp(
        '<g class="schematic-symbol-highlight" data-schematic-component-key="' +
            key +
            '"><rect class="schematic-symbol-highlight__fill" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"',
        'g'
    )
    return [...String(html).matchAll(pattern)].map((match) => ({
        x: match[1],
        y: match[2],
        width: match[3],
        height: match[4]
    }))
}

/**
 * Verifies unselected schematic symbols expose invisible click targets.
 */
test('SchematicViewRenderer adds hit targets to unselected symbols', () => {
    const html = SchematicViewRenderer.render(createAltiumSchematicDocument())

    assert.doesNotMatch(html, /<g class="schematic-symbol-highlight"/)
    assert.match(html, /class="schematic-component-highlight-style"/)
    assert.match(html, /class="schematic-symbol-hit-target"/)
    assert.match(html, /data-schematic-component-key="R1"/)
    assert.match(html, /pointer-events: all;/)
})

/**
 * Verifies Altium multi-part suffix designators still map to the shared
 * component hit target.
 */
test('SchematicViewRenderer sizes multipart Altium symbol hit targets from the body', () => {
    const html = SchematicViewRenderer.render(
        createAltiumMultipartSchematicDocument()
    )

    assert.deepEqual(extractHitTargetBox(html, 'U1'), {
        x: '24',
        y: '19.2',
        width: '62',
        height: '111.6'
    })
})

/**
 * Verifies selecting a shared multi-part component highlights each visible
 * schematic part for that component key.
 */
test('SchematicViewRenderer highlights every selected multipart Altium symbol', () => {
    const html = SchematicViewRenderer.render(
        createAltiumMultipartSchematicDocument(),
        'U1'
    )

    assert.deepEqual(extractHighlightBoxes(html, 'U1'), [
        {
            x: '24',
            y: '19.2',
            width: '62',
            height: '111.6'
        },
        {
            x: '84',
            y: '104',
            width: '52',
            height: '62'
        }
    ])
})

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
    assert.match(html, /fill: rgba\(27, 191, 227, 0\.4\);/)
    assert.match(html, /stroke: rgba\(27, 191, 227, 0\.45\);/)
    assert.match(
        html,
        /filter: drop-shadow\(0 0 1\.4px rgba\(27, 191, 227, 0\.68\)\) drop-shadow\(0 0 3px rgba\(27, 191, 227, 0\.32\)\);/
    )
    assert.doesNotMatch(html, /stroke: #e35417;/)

    const box = extractHighlightFillBox(html)
    assert.deepEqual(box, {
        x: '17.12',
        y: '15.12',
        width: '29.76',
        height: '29.76'
    })
    const highlightIndex = html.indexOf('<g class="schematic-symbol-highlight"')
    assert.equal(highlightIndex > html.indexOf('x="24" y="18"'), true)
    assert.equal(highlightIndex < html.indexOf('x1="24" y1="24"'), true)
})

/**
 * Verifies selected schematic nets render as highlighted wire overlays.
 */
test('SchematicViewRenderer highlights the selected schematic net', () => {
    const documentModel = createKicadSchematicDocument()
    documentModel.schematic.nets = [
        {
            name: 'SENSE_A',
            pins: [{ refdes: 'U1', pin: '1' }],
            segments: [
                {
                    x1: 18,
                    y1: 24,
                    x2: 24,
                    y2: 24
                }
            ]
        },
        {
            name: 'RETURN',
            segments: [
                {
                    x1: 40,
                    y1: 38,
                    x2: 50,
                    y2: 38
                }
            ]
        }
    ]

    const html = SchematicViewRenderer.render(documentModel, '', 'SENSE_A')

    assert.match(html, /class="schematic-net-highlight-style"/)
    assert.match(html, /class="schematic-net-highlight"/)
    assert.match(html, /data-schematic-net-name="SENSE_A"/)
    assert.match(html, /class="schematic-net-hit-target"/)
    assert.match(html, /drop-shadow/)
    assert.doesNotMatch(
        html,
        /data-schematic-net-name="RETURN"[\s\S]+schematic-net-highlight/
    )
})

/**
 * Verifies selected Altium schematic symbols get an SVG-local highlight.
 */
test('SchematicViewRenderer keeps compact Altium highlights body-sized', () => {
    const html = SchematicViewRenderer.render(
        createAltiumSchematicDocument(),
        'R1'
    )

    assert.doesNotMatch(html, /svg-panel__header/)
    assert.match(html, /class="schematic-component-highlight-style"/)
    assert.match(html, /data-schematic-component-key="R1"/)
    assert.match(html, /schematic-symbol-highlight/)

    const box = extractHighlightFillBox(html)
    assert.deepEqual(box, {
        x: '64',
        y: '57',
        width: '32',
        height: '26'
    })
})

/**
 * Verifies compact Altium transistor highlights include owner-linked lines and
 * pins when the body polygon is only the arrow.
 */
test('SchematicViewRenderer keeps Altium transistor highlights symbol-sized', () => {
    const html = SchematicViewRenderer.render(
        createAltiumTransistorDocument(),
        'VT1'
    )

    const box = extractHighlightFillBox(html)
    assert.deepEqual(box, {
        x: '34',
        y: '74',
        width: '42',
        height: '32'
    })
})
