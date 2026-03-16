import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumFixtureLoader } from '../fixtures/AltiumFixtureLoader.mjs'
import { BomTableRenderer } from '../../src/ui/BomTableRenderer.mjs'
import { PcbSvgRenderer } from '../../src/ui/PcbSvgRenderer.mjs'
import { Scene3dRenderer } from '../../src/ui/Scene3dRenderer.mjs'
import { SchematicSvgRenderer } from '../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies schematic renderer emits an SVG scene.
 */
test('renderSchematicSvg renders lines and labels', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Demo schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 0, y1: 0, x2: 200, y2: 0, color: '#000000', width: 1 }
            ],
            texts: [
                { x: 20, y: 20, text: 'R1', color: '#111111', hidden: false }
            ],
            components: []
        }
    })

    assert.match(markup, /<svg/)
    assert.match(markup, /Demo schematic/)
    assert.match(markup, /<line/)
    assert.match(markup, />R1</)
})

/**
 * Verifies imported schematic colors are normalized to theme variables so the
 * rendered SVG can switch palettes without rewriting document data.
 */
test('renderSchematicSvg maps imported schematic colors to theme variables', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Theme schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [{ x1: 10, y1: 50, x2: 60, y2: 50, color: '#000080', width: 1 }],
            rectangles: [
                {
                    x: 80,
                    y: 40,
                    width: 20,
                    height: 10,
                    color: '#800000',
                    fill: '#ffffb0',
                    isSolid: true,
                    transparent: false,
                    lineWidth: 1
                }
            ],
            texts: [
                { x: 20, y: 20, text: 'MD11', color: '#800000', hidden: false }
            ],
            components: [],
            pins: [
                {
                    x: 120,
                    y: 60,
                    length: 10,
                    name: 'EN',
                    designator: '1',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [
                {
                    x: 140,
                    y: 30,
                    width: 30,
                    height: 10,
                    name: 'UART',
                    fill: '#ffe16f',
                    color: '#8d2b2b'
                }
            ],
            crosses: [{ x: 180, y: 20, size: 6, color: '#ff0000' }]
        }
    })

    assert.match(markup, /stroke="var\(--schematic-default-ink-color\)"/)
    assert.match(
        markup,
        /fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MD11</
    )
    assert.match(
        markup,
        /class="schematic-pin-line"[^>]*stroke="var\(--schematic-accent-ink-color\)"/
    )
    assert.match(
        markup,
        /class="schematic-pin-name"[^>]*fill="var\(--schematic-text-color\)"/
    )
    assert.match(
        markup,
        /<rect class="schematic-rectangle"[^>]*fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)"/
    )
    assert.match(
        markup,
        /<polygon points="140,65 162,65 170,70 162,75 140,75" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /class="schematic-cross"><line[^>]*stroke="var\(--schematic-alert-color\)"/
    )
    assert.doesNotMatch(
        markup,
        /#000080|#0000ff|#1f1f1f|#800000|#8d2b2b|#ffffb0|#ffe16f|#ff0000/
    )
})

/**
 * Verifies schematic bus trunks render thicker than ordinary wires so grouped
 * routes remain visually distinct.
 */
test('renderSchematicSvg renders bus lines with a thicker stroke', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Bus schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                {
                    x1: 10,
                    y1: 70,
                    x2: 60,
                    y2: 70,
                    color: '#000080',
                    width: 1
                },
                {
                    x1: 80,
                    y1: 70,
                    x2: 80,
                    y2: 20,
                    color: '#000080',
                    width: 1,
                    isBus: true
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
        /<line x1="10" y1="30" x2="60" y2="30" stroke="var\(--schematic-default-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="80" y1="30" x2="80" y2="80" stroke="var\(--schematic-default-ink-color\)" stroke-width="3" \/>/
    )
})

/**
 * Verifies electrical tee junctions render a dot while simple owner linework
 * corners do not.
 */
test('renderSchematicSvg renders junction dots only for connected wire tees', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Junction schematic' },
        schematic: {
            sheet: { width: 120, height: 100 },
            lines: [
                { x1: 25, y1: 30, x2: 25, y2: 50, color: '#0000ff', width: 1 },
                { x1: 25, y1: 50, x2: 25, y2: 70, color: '#0000ff', width: 1 },
                { x1: 25, y1: 50, x2: 45, y2: 50, color: '#0000ff', width: 1 },
                {
                    x1: 70,
                    y1: 20,
                    x2: 70,
                    y2: 40,
                    color: '#0000ff',
                    width: 1,
                    ownerIndex: 'U1'
                },
                {
                    x1: 70,
                    y1: 40,
                    x2: 90,
                    y2: 40,
                    color: '#0000ff',
                    width: 1,
                    ownerIndex: 'U1'
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
        /<circle class="schematic-junction" cx="25" cy="50" r="2" fill="var\(--schematic-accent-ink-color\)" \/>/
    )
    assert.equal((markup.match(/class="schematic-junction"/g) || []).length, 1)
})

/**
 * Verifies schematic SVG output projects document-space Y into screen-space Y
 * and renders schematic primitives around the sheet.
 */
test('renderSchematicSvg inverts schematic Y coordinates for SVG', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: AltiumFixtureLoader.aetherSheetFileName,
        summary: { title: 'Projected schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 10,
                xZones: 4,
                yZones: 4,
                titleBlock: {
                    title: 'LUMEN-VEIL-A1',
                    revision: '01',
                    documentNumber: '',
                    sheetNumber: '4',
                    sheetTotal: '6',
                    date: '3/09/2026',
                    drawnBy: ''
                }
            },
            lines: [
                { x1: 20, y1: 80, x2: 50, y2: 80, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 20,
                    y: 80,
                    text: 'Zephyr Node',
                    color: '#000080',
                    hidden: false,
                    recordType: '4',
                    style: 0,
                    fontSize: 22,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'middle'
                },
                {
                    x: 120,
                    y: 70,
                    text: '+3.3V',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'middle'
                },
                {
                    x: 160,
                    y: 60,
                    text: 'WYRN',
                    color: '#8d2b2b',
                    hidden: false,
                    recordType: '25',
                    style: 0,
                    fontSize: 12,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 90,
                    anchor: 'start'
                }
            ],
            components: [{ x: 40, y: 80, designator: 'U6' }],
            pins: [
                {
                    x: 20,
                    y: 80,
                    length: 10,
                    name: 'EN',
                    designator: '3',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                },
                {
                    x: 140,
                    y: 80,
                    length: 10,
                    name: '1',
                    designator: '1',
                    orientation: 'right',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'number-only'
                },
                {
                    x: 70,
                    y: 40,
                    length: 10,
                    name: 'A',
                    designator: '1',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-only'
                },
                {
                    x: 90,
                    y: 30,
                    length: 10,
                    name: '2',
                    designator: '2',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'hidden'
                }
            ],
            ports: [
                {
                    x: 90,
                    y: 60,
                    width: 30,
                    height: 10,
                    name: 'RUNE_CTL',
                    fill: '#ffe16f',
                    color: '#8d2b2b'
                }
            ],
            crosses: [{ x: 150, y: 60, size: 6, color: '#ff0000' }]
        }
    })

    assert.match(markup, /<line x1="20" y1="20" x2="50" y2="20"/)
    assert.match(
        markup,
        /<text class="schematic-label" x="100" y="31" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="22" font-family="Times New Roman"/
    )
    assert.match(markup, /schematic-power-port--rail/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="120" y="14" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="10"/
    )
    assert.match(markup, /transform="rotate\(-90 160 40\)"/)
    assert.match(markup, /<circle cx="40" cy="20" r="4"/)
    assert.match(markup, /sheet-frame/)
    assert.match(markup, /sheet-title-block/)
    assert.match(markup, /schematic-pin-name/)
    assert.match(
        markup,
        /class="schematic-pin-line" x1="20" y1="20" x2="10" y2="20"/
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="24" y="23" fill="var\(--schematic-text-color\)"[^>]*>EN</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="142" y="19" fill="var\(--schematic-text-color\)" text-anchor="start"[^>]*>1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="80" y="63" fill="var\(--schematic-text-color\)" text-anchor="start"[^>]*>A</
    )
    assert.doesNotMatch(
        markup,
        /text class="schematic-pin-number" x="76" y="58"/
    )
    assert.match(markup, /x1="90" y1="70" x2="80" y2="70"/)
    assert.doesNotMatch(markup, /class="schematic-pin-number"[^>]*>2</)
    assert.match(markup, /LUMEN-VEIL-A1/)
    assert.match(markup, /Sheet 4 of 6/)
    assert.match(markup, /sheet-zone-label/)
    assert.match(markup, /File/)
    assert.match(markup, /Number/)
    assert.match(markup, /Date:/)
    assert.match(markup, /Drawn By:/)
    assert.match(markup, /LumenVeil-A1\.01\.01E\.SchDoc/)
    assert.match(markup, /schematic-port/)
    assert.match(markup, /schematic-cross/)
})

/**
 * Verifies normalized schematic arcs render as SVG path arc commands instead
 * of being ignored like unsupported geometry.
 */
test('renderSchematicSvg renders normalized schematic arcs as SVG paths', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Arc schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            arcs: [
                {
                    x: 20,
                    y: 20,
                    radius: 5,
                    startAngle: 0,
                    endAngle: 180,
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
        /<path class="schematic-arc" d="M [^"]*A 5 5 0 [01] [01] [^"]*" stroke="var\(--schematic-default-ink-color\)" stroke-width="1" fill="none" \/>/
    )
})

/**
 * Verifies the synthesized title block uses the resolved sheet paper size
 * instead of a hard-coded A4 label.
 */
test('renderSchematicSvg renders the resolved paper size in the title block', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: AltiumFixtureLoader.solaceSheetFileName,
        summary: { title: 'Solace schematic' },
        schematic: {
            sheet: {
                width: 300,
                height: 180,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 10,
                paperSize: 'A3',
                titleBlock: {
                    title: 'LUMEN-VEIL-A1',
                    revision: '01',
                    documentNumber: '',
                    sheetNumber: '1',
                    sheetTotal: '6',
                    date: '3/09/2026',
                    drawnBy: ''
                }
            },
            lines: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, />A3</)
})

/**
 * Verifies fallback component markers disappear when the schematic already
 * contains a visible designator, and synthetic labels inherit sheet fonts.
 */
test('renderSchematicSvg uses sheet fonts for synthetic labels and skips duplicate component markers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Duplicate-free schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [
                {
                    x: 40,
                    y: 80,
                    text: 'U6',
                    color: '#000080',
                    hidden: false,
                    name: 'Designator',
                    recordType: '34',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start'
                }
            ],
            components: [{ x: 40, y: 80, designator: 'U6' }],
            pins: [
                {
                    x: 20,
                    y: 80,
                    length: 10,
                    name: 'EN',
                    designator: '3',
                    orientation: 'left',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: [
                {
                    x: 90,
                    y: 60,
                    width: 30,
                    height: 10,
                    name: 'RUNE_CTL',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                }
            ]
        }
    })

    assert.doesNotMatch(markup, /class="schematic-node"/)
    assert.match(
        markup,
        /text class="schematic-pin-name" x="24" y="23" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">EN</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="18" y="19" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">3</
    )
    assert.match(
        markup,
        /<polygon points="90,40 98,35 120,35 120,45 98,45" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="41\.91" fill="var\(--schematic-port-color\)" text-anchor="middle" font-size="5\.31" font-family="Times New Roman" font-weight="400">RUNE_CTL</
    )
})

/**
 * Verifies unresolved fallback component placements do not render the
 * synthetic green node marker or a placeholder U? designator.
 */
test('renderSchematicSvg skips unresolved fallback component markers', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Unresolved component schematic' },
        schematic: {
            sheet: { width: 120, height: 100 },
            lines: [],
            texts: [],
            components: [{ x: 40, y: 80, designator: 'U?' }],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.doesNotMatch(markup, /class="schematic-node"/)
    assert.doesNotMatch(markup, />U\?</)
})

/**
 * Verifies vertically adjacent off-sheet ports render as one stacked symbol
 * with a shared pointed outline and divider line.
 */
test('renderSchematicSvg stacks adjacent off-sheet ports into one symbol', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Stacked ports schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 100,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [],
            ports: [
                {
                    x: 90,
                    y: 60,
                    width: 30,
                    height: 10,
                    name: 'RUNE_CTL',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                },
                {
                    x: 90,
                    y: 50,
                    width: 30,
                    height: 10,
                    name: 'RUNE_FLOW',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<polygon points="90,40 98,35 120,35 120,45 98,45" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="90,50 98,45 120,45 120,55 98,55" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-port-color\)" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="41\.91" fill="var\(--schematic-port-color\)" text-anchor="middle" font-size="5\.31" font-family="Times New Roman" font-weight="400">RUNE_CTL</
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="51\.64" fill="var\(--schematic-port-color\)" text-anchor="middle" font-size="4\.55" font-family="Times New Roman" font-weight="400">RUNE_FLOW</
    )
    assert.equal((markup.match(/<g class="schematic-port">/g) || []).length, 1)
})

/**
 * Verifies top and bottom pin numbers stay centered on each pin axis instead
 * of left-aligning into neighboring pin labels.
 */
test('renderSchematicSvg centers vertical pin numbers on the pin axis', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Pin axis schematic' },
        schematic: {
            sheet: {
                width: 200,
                height: 120,
                fonts: {
                    1: {
                        size: 10,
                        family: 'Times New Roman',
                        bold: false,
                        rotation: 0
                    }
                }
            },
            lines: [],
            texts: [],
            components: [],
            pins: [
                {
                    x: 80,
                    y: 60,
                    length: 12,
                    name: 'IO13',
                    designator: '16',
                    orientation: 'bottom',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                },
                {
                    x: 100,
                    y: 60,
                    length: 12,
                    name: 'EN',
                    designator: '3',
                    orientation: 'top',
                    color: '#0000ff',
                    labelColor: '#1f1f1f',
                    labelMode: 'name-and-number'
                }
            ],
            ports: []
        }
    })

    assert.match(
        markup,
        /text class="schematic-pin-number" x="78" y="67" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 78 67\)">16</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="84" y="56" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 84 56\)">IO13</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="98" y="54" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">3</
    )
})

/**
 * Verifies dense multi-side number-only connector symbols rotate top pin
 * numbers so multi-digit labels follow the pin axis instead of rendering
 * horizontally into nearby power-port graphics.
 */
test(
    'renderSchematicSvg rotates top numbers for dense number-only connectors',
    () => {
        const markup = SchematicSvgRenderer.render({
            summary: { title: 'Connector top pin rotation' },
            schematic: {
                sheet: {
                    width: 220,
                    height: 140,
                    fonts: {
                        1: {
                            size: 10,
                            family: 'Times New Roman',
                            bold: false,
                            rotation: 0
                        }
                    }
                },
                lines: [],
                texts: [],
                components: [],
                pins: [
                    {
                        x: 80,
                        y: 40,
                        length: 12,
                        name: '',
                        designator: '14',
                        orientation: 'left',
                        ownerIndex: 'J7',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    },
                    {
                        x: 80,
                        y: 50,
                        length: 12,
                        name: '',
                        designator: '15',
                        orientation: 'left',
                        ownerIndex: 'J7',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    },
                    {
                        x: 80,
                        y: 60,
                        length: 12,
                        name: '',
                        designator: '16',
                        orientation: 'left',
                        ownerIndex: 'J7',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    },
                    {
                        x: 80,
                        y: 70,
                        length: 12,
                        name: '',
                        designator: '17',
                        orientation: 'left',
                        ownerIndex: 'J7',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    },
                    {
                        x: 100,
                        y: 60,
                        length: 12,
                        name: '',
                        designator: '19',
                        orientation: 'top',
                        ownerIndex: 'J7',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    },
                    {
                        x: 100,
                        y: 20,
                        length: 12,
                        name: '',
                        designator: '20',
                        orientation: 'bottom',
                        ownerIndex: 'J7',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    }
                ],
                ports: []
            }
        })

        assert.match(
            markup,
            /text class="schematic-pin-number" x="98" y="74" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 98 74\)">19</
        )
    }
)

/**
 * Verifies tall connector symbols whose numbered contacts sit on one side plus
 * a top row still rotate multi-digit top numbers along the pin axis.
 */
test(
    'renderSchematicSvg rotates top numbers for one-sided number-only connectors',
    () => {
        const leftPins = Array.from({ length: 6 }, (_, index) => ({
            x: 120,
            y: 40 + index * 10,
            length: 10,
            name: String(index + 1),
            designator: String(index + 1),
            orientation: 'left',
            ownerIndex: 'J26',
            color: '#0000ff',
            labelColor: '#1f1f1f',
            labelMode: 'number-only'
        }))
        const markup = SchematicSvgRenderer.render({
            summary: { title: 'Connector side-plus-top rotation' },
            schematic: {
                sheet: {
                    width: 260,
                    height: 180,
                    fonts: {
                        1: {
                            size: 10,
                            family: 'Times New Roman',
                            bold: false,
                            rotation: 0
                        }
                    }
                },
                lines: [],
                texts: [],
                components: [],
                pins: [
                    ...leftPins,
                    {
                        x: 120,
                        y: 120,
                        length: 10,
                        name: '16',
                        designator: '16',
                        orientation: 'top',
                        ownerIndex: 'J26',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    },
                    {
                        x: 140,
                        y: 120,
                        length: 10,
                        name: '15',
                        designator: '15',
                        orientation: 'top',
                        ownerIndex: 'J26',
                        color: '#0000ff',
                        labelColor: '#1f1f1f',
                        labelMode: 'number-only'
                    }
                ],
                ports: []
            }
        })

        assert.match(
            markup,
            /text class="schematic-pin-number" x="118" y="54" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 118 54\)">16</
        )
        assert.match(
            markup,
            /text class="schematic-pin-number" x="138" y="54" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 138 54\)">15</
        )
    }
)

/**
 * Verifies ground power ports rotate away from the connected wire direction.
 */
test('renderSchematicSvg rotates ground ports from attached wire direction', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Ground orientation' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 120, y1: 50, x2: 150, y2: 50, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 150,
                    y: 50,
                    text: 'GND',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 4,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: []
        }
    })

    assert.match(markup, /schematic-power-port--ground/)
    assert.match(markup, /x1="150" y1="50" x2="157" y2="50"/)
    assert.match(markup, /x1="157" y1="43" x2="157" y2="57"/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="168" y="53.60" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="10"/
    )
})

/**
 * Verifies explicit Altium power-port direction overrides attached-wire
 * heuristics when the source specifies an orientation.
 */
test('renderSchematicSvg prefers explicit power-port direction over wire inference', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Power orientation' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [
                { x1: 120, y1: 50, x2: 150, y2: 50, color: '#000080', width: 1 }
            ],
            texts: [
                {
                    x: 150,
                    y: 50,
                    text: '+3.3V',
                    color: '#800000',
                    hidden: false,
                    recordType: '17',
                    style: 2,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    powerPortDirection: 'up',
                    anchor: 'middle'
                }
            ],
            components: [],
            pins: []
        }
    })

    assert.match(markup, /schematic-power-port--rail/)
    assert.match(markup, /x1="150" y1="50" x2="150" y2="38"/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="150" y="34" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="10"/
    )
    assert.doesNotMatch(markup, /x1="150" y1="50" x2="138" y2="50"/)
})

/**
 * Verifies CSS does not override recovered schematic text metrics.
 */
test('schematic stylesheet leaves typography to recovered SVG attributes', async () => {
    const cssPath = new URL('../../src/styles/20-viewer.css', import.meta.url)
    const css = await readFile(cssPath, 'utf8')
    const schematicLabelBlock = css.match(/\.schematic-label\s*\{[^}]*\}/)?.[0]
    const schematicPinBlock = css.match(
        /\.schematic-pin-name,\s*\.schematic-pin-number\s*\{[^}]*\}/
    )?.[0]
    const schematicPortBlock = css.match(
        /\.schematic-port-label\s*\{[^}]*\}/
    )?.[0]

    assert.ok(schematicLabelBlock)
    assert.ok(schematicPinBlock)
    assert.ok(schematicPortBlock)
    assert.doesNotMatch(schematicLabelBlock, /font-size\s*:/)
    assert.doesNotMatch(schematicLabelBlock, /font-family\s*:/)
    assert.doesNotMatch(schematicPinBlock, /font-size\s*:/)
    assert.doesNotMatch(schematicPinBlock, /font-family\s*:/)
    assert.doesNotMatch(schematicPinBlock, /font-weight\s*:/)
    assert.doesNotMatch(schematicPortBlock, /font-size\s*:/)
    assert.doesNotMatch(schematicPortBlock, /font-family\s*:/)
    assert.doesNotMatch(schematicPortBlock, /font-weight\s*:/)
})

/**
 * Verifies real schematic renders do not duplicate port labels from both text
 * and port primitives.
 */
test('renderSchematicSvg renders rune off-sheet ports only once per label', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/>RUNE_CTL</g) || []).length, 1)
    assert.equal((markup.match(/>RUNE_FLOW</g) || []).length, 1)
    assert.match(
        markup,
        /<polygon points="680,332 688,327 740,327 740,337 688,337" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="680,342 688,337 740,337 740,347 688,347" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="714" y="334\.70" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="7\.50" font-family="Times New Roman" font-weight="400">RUNE_CTL</
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="714" y="344\.70" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="7\.50" font-family="Times New Roman" font-weight="400">RUNE_FLOW</
    )
    assert.equal(
        (markup.match(/<g class="schematic-port">/g) || []).length,
        1
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="915" cy="562" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="915" cy="542" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
})

/**
 * Verifies the solace-sheet off-sheet ports keep the corrected pointed side in
 * the final SVG output.
 */
test('renderSchematicSvg keeps solace-sheet off-sheet ports pointed the right way', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<polygon points="85,724 93,719 145,719 145,729 93,729" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="85,734 93,729 145,729 145,739 93,739" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        markup,
        /<polygon points="85,789 137,789 145,794 137,799 85,799" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
})

/**
 * Verifies style-4 off-sheet ports render as vertical callouts with rotated
 * labels instead of the default horizontal left/right port geometry.
 */
test('renderSchematicSvg rotates style-4 off-sheet ports vertically', async () => {
    const solaceDocument = await AltiumFixtureLoader.parseSolaceSheet()
    const solaceMarkup = SchematicSvgRenderer.render(solaceDocument)
    const bastionDocument = await AltiumFixtureLoader.parseBastionSheet()
    const bastionMarkup = SchematicSvgRenderer.render(bastionDocument)

    assert.match(
        solaceMarkup,
        /<polygon points="470,989 480,989 480,1011 475,1019 470,1011" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        solaceMarkup,
        /text class="schematic-port-label" x="477\.25" y="1004" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="6\.25" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 477\.25 1004\)">GLYPH_1</
    )
    assert.match(
        bastionMarkup,
        /<polygon points="910,494 915,502 915,519 905,519 905,502" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.match(
        bastionMarkup,
        /text class="schematic-port-label" x="911\.82" y="506\.50" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="5\.05" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 911\.82 506\.50\)">GLYPH_0</
    )
    assert.match(
        bastionMarkup,
        /<circle class="schematic-junction" cx="910" cy="494" r="2" fill="var\(--schematic-default-ink-color\)" \/>/
    )
})

/**
 * Verifies solace-sheet off-sheet port labels shrink from the default sheet
 * font size so they fit within the yellow port outline.
 */
test('renderSchematicSvg scales solace-sheet off-sheet port labels to fit their boxes', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()
    const markup = SchematicSvgRenderer.render(documentModel)
    const resolvePortLabelFontSize = (name) =>
        Number(
            markup.match(
                new RegExp(
                    '<text class="schematic-port-label"[^>]*font-size="([^"]+)"[^>]*>' +
                        name +
                        '<'
                )
            )?.[1]
        )

    const auraResetSize = resolvePortLabelFontSize('AURA_RST')
    const sigilSelectSize = resolvePortLabelFontSize('SIGIL_SEL')
    const emberResetSize = resolvePortLabelFontSize('EMBER_RST')
    const emberSenseSize = resolvePortLabelFontSize('EMBER_SENSE')

    assert.equal(auraResetSize < 10, true)
    assert.equal(sigilSelectSize < 10, true)
    assert.equal(emberResetSize < 10, true)
    assert.equal(emberSenseSize <= emberResetSize, true)
})

/**
 * Verifies the solace-sheet MD/DRDM bus breakout labels and adjacent resistor
 * designators keep reading left-to-right like the Altium reference.
 */
test('renderSchematicSvg keeps solace-sheet bus breakout labels left-to-right', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="300" y="349" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MD11</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="300" y="389" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MD7</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="300" y="429" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>MD3</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="310" y="479" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>DRDM1</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="310" y="489" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>DRDM0</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="335" y="349" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>R97</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="330" y="389" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>R154</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="330" y="429" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>R162</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="479" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>R53</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="340" y="489" fill="var\(--schematic-default-ink-color\)" text-anchor="start"[^>]*>R18</
    )
})

/**
 * Verifies the aether sheet renders U6 pin numbers outside the body and
 * restores missing U29/U31 gate pin numbers.
 */
test('renderSchematicSvg aligns aether-sheet pin number and name columns', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /text class="schematic-pin-number" x="453" y="261" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="459" y="265" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="601" y="265" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="379" y="615" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">A</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="431" y="615" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">VCC</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="624" y="625" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">A</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="676" y="625" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">VCC</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="618" y="621" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="682" y="621" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="373" y="611" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="437" y="611" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="483" y="419" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 483 419\)">15</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="499" y="408" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 499 408\)">IO13</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="619" y="603" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">K29</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="715" y="622" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">C187</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="974" y="583" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">P5</
    )
})

/**
 * Verifies the aether-sheet D16 diode symbol includes the triangle body
 * linework from the source polygon primitive.
 */
test('renderSchematicSvg renders the aether Q12 diode triangle', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<line x1="217" y1="589" x2="233" y2="589" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="233" y1="589" x2="225" y2="573" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="225" y1="573" x2="217" y2="589" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
})

/**
 * Verifies the lyra sheet renders one copy of each visible U2 section
 * and includes the multipart body outlines recovered from record 6.
 */
test('renderSchematicSvg restores multipart U2 bodies on the lyra sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/>Rune Gate</g) || []).length, 1)
    assert.equal((markup.match(/>Cinder Well</g) || []).length, 1)
    assert.equal((markup.match(/>Lyra \/ Echo</g) || []).length, 1)
    assert.match(
        markup,
        /<line x1="670" y1="369" x2="670" y2="159" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="280" y1="519" x2="280" y2="189" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(markup, />A3</)
    assert.match(markup, />Sheet 5 of 6</)
})

/**
 * Verifies lyra-sheet text records beyond the old 300-item truncation limit still
 * render in the SVG output.
 */
test('renderSchematicSvg keeps late lyra-sheet labels beyond the old text cap', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, />U9</)
    assert.match(markup, />U11</)
    assert.match(markup, />NOVA_SEND</)
    assert.match(markup, />LYRA_LINK</)
})

/**
 * Verifies lyra-sheet note/comment records render as boxed multiline callouts.
 */
test('renderSchematicSvg renders the lyra-sheet mode note as a boxed multiline callout', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, /class="schematic-note"/)
    assert.match(markup, />RY1 \| RY0: sampled at dawn\.</)
    assert.match(markup, />Glyph core reads tone on OSC1</)
    assert.match(markup, />\| 10--&gt;Star Chime    \|</)
})

/**
 * Verifies record-28 wrapped notes reuse the note-box renderer instead of
 * falling back to one long plain text label.
 */
test('renderSchematicSvg renders record-28 notes as boxed multiline callouts', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Record-28 note schematic' },
        schematic: {
            sheet: { width: 200, height: 100 },
            lines: [],
            texts: [
                {
                    x: 20,
                    y: 20,
                    text: '*NOTE:\n1)Alpha\n2)Beta',
                    color: '#ff0000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start',
                    cornerX: 120,
                    cornerY: 60,
                    fill: '#ffffff',
                    borderColor: '#c0c0c0',
                    isSolid: true,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['*NOTE:', '1)Alpha', '2)Beta']
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, /class="schematic-note"/)
    assert.match(
        markup,
        /<rect class="schematic-note-box" x="20" y="40" width="100" height="40" fill="var\(--schematic-fill-light-color\)" stroke="none" \/>/
    )
    assert.match(markup, />\*NOTE:</)
    assert.match(markup, />1\)Alpha</)
    assert.match(markup, />2\)Beta</)
    assert.doesNotMatch(markup, /class="schematic-label"[^>]*>\*NOTE:/)
})

/**
 * Verifies note text wraps to the available box width instead of overflowing
 * as one long SVG text line.
 */
test('renderSchematicSvg wraps note rows to the note box width', () => {
    const markup = SchematicSvgRenderer.render({
        summary: { title: 'Wrapped note schematic' },
        schematic: {
            sheet: { width: 200, height: 120 },
            lines: [],
            texts: [
                {
                    x: 20,
                    y: 20,
                    text: 'Alpha Beta Gamma Delta',
                    color: '#ff0000',
                    hidden: false,
                    recordType: '28',
                    style: 0,
                    fontSize: 10,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400,
                    rotation: 0,
                    anchor: 'start',
                    cornerX: 90,
                    cornerY: 80,
                    fill: '#ffffff',
                    borderColor: '#c0c0c0',
                    isSolid: true,
                    showBorder: false,
                    textMargin: 4,
                    noteLines: ['Alpha Beta Gamma Delta']
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, />Alpha Beta</)
    assert.match(markup, />Gamma Delta</)
    assert.doesNotMatch(markup, />Alpha Beta Gamma Delta</)
})

/**
 * Verifies dashed schematic guide frames keep their stroke pattern in the
 * rendered SVG.
 */
test('renderSchematicSvg keeps dashed module frames dashed', async () => {
    const documentModel = await AltiumFixtureLoader.parseBastionSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, /stroke-dasharray=/)
})

/**
 * Verifies the lyra-sheet boot labels keep reading rightward from the port.
 */
test('renderSchematicSvg keeps lyra-sheet boot wire labels anchored to the right', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<text class="schematic-label" x="1075" y="139" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>WYRD</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="1075" y="149" fill="var\(--schematic-power-color\)" text-anchor="start"[^>]*>CHRD</
    )
})

/**
 * Verifies the lyra block renders multipart unit suffixes, readable
 * decoded pin names, and the crystal pin numbers shown in Altium.
 */
test('renderSchematicSvg restores lyra-sheet multipart suffixes and Y2 crystal pin numbers', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(markup, />U2A</)
    assert.match(markup, />U2B</)
    assert.match(markup, />U2J</)
    assert.doesNotMatch(markup, />U2</)
    assert.match(markup, />RST</)
    assert.doesNotMatch(markup, /\\R\\S\\T\\/)
    assert.match(
        markup,
        /text class="schematic-pin-number" x="163" y="773" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="187" y="773" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">3</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="193" y="748" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="203" y="748" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">4</
    )
})

/**
 * Verifies lyra-sheet D12 renders as the filled dual-row TVS package from the
 * Altium reference instead of a diagonal line with partial labels.
 */
test('renderSchematicSvg renders the lyra-sheet D12 package body and both pin rows', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<rect class="schematic-rectangle" x="1210" y="284" width="60" height="60" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" stroke-width="1" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<line x1="1210" y1="344" x2="1270" y2="284" stroke="var\(--schematic-power-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1220" y="288" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1220 288\)">I\/O4</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1240" y="288" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1240 288\)">VDD</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1260" y="288" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1260 288\)">I\/O3</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1224" y="340" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1224 340\)">I\/O1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1244" y="340" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1244 340\)">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="1264" y="340" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1264 340\)">I\/O2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1218" y="278" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">6</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1238" y="278" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1258" y="278" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">4</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1218" y="351" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1218 351\)">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1238" y="351" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1238 351\)">2</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="1258" y="351" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 1258 351\)">3</
    )
})

/**
 * Verifies the lyra-sheet D12 ground power port falls back to the default
 * downward ground symbol instead of treating ground orientation 3 like a
 * right-facing rail direction.
 */
test('renderSchematicSvg keeps the lyra-sheet D12 ground power port downward', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground"><line x1="1240" y1="354" x2="1240" y2="361" stroke="var\(--schematic-power-color\)" \/><line x1="1233" y1="361" x2="1247" y2="361" stroke="var\(--schematic-power-color\)" \/><line x1="1235" y1="364" x2="1245" y2="364" stroke="var\(--schematic-power-color\)" \/><line x1="1237" y1="367" x2="1243" y2="367" stroke="var\(--schematic-power-color\)" \/>/
    )
    assert.doesNotMatch(
        markup,
        /<g class="schematic-power-port schematic-power-port--ground"><line x1="1240" y1="354" x2="1247" y2="354" stroke="var\(--schematic-power-color\)" \/><line x1="1247" y1="347" x2="1247" y2="361" stroke="var\(--schematic-power-color\)"/
    )
})

/**
 * Verifies the lyra-sheet inductors emit visible arc paths for their coil bodies.
 */
test('renderSchematicSvg renders the lyra-sheet inductor coils as SVG arcs', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/class="schematic-arc"/g) || []).length >= 3, true)
})

/**
 * Verifies the bastion-sheet dawn-sigil region matches the reference layout by keeping
 * the note heading centered, the mixed off-sheet port directions, and the
 * visible same-row wire labels.
 */
test(
    'renderSchematicSvg matches the bastion-sheet dawn-sigil reference layout',
    async () => {
        const documentModel = await AltiumFixtureLoader.parseBastionSheet()
        const markup = SchematicSvgRenderer.render(documentModel)

        assert.match(
            markup,
            /<text class="schematic-label" x="349" y="593" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="8" font-family="Times New Roman" font-weight="700">Needed for Dawn Sigil!</
        )
        assert.match(
            markup,
            /<line x1="289" y1="579" x2="409" y2="579" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
        )
        assert.match(
            markup,
            /<line x1="409" y1="579" x2="409" y2="645" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
        )
        assert.match(
            markup,
            /<line x1="409" y1="645" x2="289" y2="645" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
        )
        assert.match(
            markup,
            /<line x1="289" y1="645" x2="289" y2="579" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
        )
        assert.doesNotMatch(
            markup,
            /<line x1="260" y1="579" x2="515" y2="579" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" stroke-dasharray="8 5" stroke-linecap="round" \/>/
        )
        assert.match(
            markup,
            /<polygon points="280,679 288,674 330,674 330,684 288,684" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
        )
        assert.match(
            markup,
            /<polygon points="280,684 322,684 330,689 322,694 280,694" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
        )
        assert.match(
            markup,
            /<polygon points="280,694 322,694 330,699 322,704 280,704" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
        )
        assert.match(
            markup,
            /<text class="schematic-port-label" x="309" y="681\.70" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="7\.50" font-family="Times New Roman" font-weight="400">GLYPH_CS</
        )
        assert.match(
            markup,
            /<text class="schematic-port-label" x="301" y="691\.70" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="7\.50" font-family="Times New Roman" font-weight="400">AURA_CS</
        )
        assert.match(
            markup,
            /<text class="schematic-port-label" x="301" y="701\.70" fill="var\(--schematic-power-color\)" text-anchor="middle" font-size="7\.50" font-family="Times New Roman" font-weight="400">AURA_IRQ</
        )
        assert.match(
            markup,
            /<text class="schematic-label" x="340" y="679" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">GLYPH_CS</
        )
        assert.match(
            markup,
            /<text class="schematic-label" x="340" y="689" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">AURA_CS</
        )
        assert.match(
            markup,
            /<text class="schematic-label" x="340" y="699" fill="var\(--schematic-power-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">AURA_IRQ</
        )
    }
)

/**
 * Verifies opposite Altium rotated-text orientations emit opposite signed SVG
 * transforms instead of collapsing to the same vertical flow.
 */
test(
    'renderSchematicSvg preserves opposite signed rotations for vertical texts',
    async () => {
        const aetherDocument = await AltiumFixtureLoader.parseAetherSheet()
        const aetherMarkup = SchematicSvgRenderer.render(aetherDocument)
        const bastionDocument = await AltiumFixtureLoader.parseBastionSheet()
        const bastionMarkup = SchematicSvgRenderer.render(bastionDocument)

        assert.match(
            aetherMarkup,
            /<text class="schematic-label" x="225" y="612" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 225 612\)">Q12</
        )
        assert.match(
            aetherMarkup,
            /<text class="schematic-label" x="995" y="552" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="22" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 995 552\)">WYRN</
        )
        assert.match(
            bastionMarkup,
            /<text class="schematic-label" x="415" y="794" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(90 415 794\)">Q24</
        )
        assert.match(
            bastionMarkup,
            /<text class="schematic-label" x="415" y="844" fill="var\(--schematic-default-ink-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(90 415 844\)">4K7</
        )
    }
)

/**
 * Verifies the bastion-sheet multipart resistor labels render with section suffixes,
 * while the nearby connector keeps its raw bastion-sheet designator.
 */
test(
    'renderSchematicSvg renders multipart resistor suffixes without suffixing the bastion-sheet connector',
    async () => {
        const documentModel = await AltiumFixtureLoader.parseBastionSheet()
        const markup = SchematicSvgRenderer.render(documentModel)

        assert.match(markup, />Q92A</)
        assert.match(
            markup,
            /<text class="schematic-label" x="934" y="235" fill="var\(--schematic-default-ink-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">Q92B</
        )
        assert.match(markup, />Q92C</)
        assert.match(markup, />Q92D</)
        assert.match(markup, />P4</)
        assert.doesNotMatch(markup, />P4A</)
        assert.match(
            markup,
            /text class="schematic-pin-number" x="968" y="233" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">2</
        )
        assert.match(
            markup,
            /text class="schematic-pin-number" x="992" y="233" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">7</
        )
        assert.match(
            markup,
            /text class="schematic-pin-number" x="963" y="363" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
        )
        assert.match(
            markup,
            /text class="schematic-pin-number" x="987" y="363" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">8</
        )
    }
)

/**
 * Verifies PCB renderer emits board geometry and placements.
 */
test('renderPcbSvg renders board outline and placements', () => {
    const markup = PcbSvgRenderer.render({
        summary: { title: 'Demo board' },
        pcb: {
            boardOutline: {
                widthMil: 1000,
                heightMil: 500,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 500 },
                    { type: 'line', x1: 1000, y1: 500, x2: 0, y2: 500 },
                    { type: 'line', x1: 0, y1: 500, x2: 0, y2: 0 }
                ]
            },
            layers: [{ name: 'Top Layer' }, { name: 'Bottom Layer' }],
            components: [
                {
                    designator: 'U1',
                    x: 200,
                    y: 250,
                    rotation: 90,
                    layer: 'TOP',
                    pattern: 'QFN'
                }
            ]
        }
    })

    assert.match(markup, /<svg/)
    assert.match(markup, /U1/)
    assert.match(markup, /Top Layer/)
    assert.match(markup, /board-outline/)
})

/**
 * Verifies BOM renderer groups rows into a table.
 */
test('renderBomTable renders grouped BOM rows', () => {
    const markup = BomTableRenderer.render([
        {
            designators: ['R1', 'R2'],
            quantity: 2,
            pattern: '0603',
            source: 'RES/10K',
            value: '10K'
        }
    ])

    assert.match(markup, /<table/)
    assert.match(markup, /R1, R2/)
    assert.match(markup, />2</)
    assert.match(markup, /0603/)
})

/**
 * Verifies the 3D renderer emits a presentational scene.
 */
test('renderScene3d renders a board summary scene', () => {
    const markup = Scene3dRenderer.render({
        pcb: {
            boardOutline: { widthMil: 1200, heightMil: 800, segments: [] },
            components: [{ designator: 'U1' }, { designator: 'R1' }]
        },
        bom: [{ quantity: 2 }]
    })

    assert.match(markup, /3D/)
    assert.match(markup, /1200/)
    assert.match(markup, /2 components/)
})
