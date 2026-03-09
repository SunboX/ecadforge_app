import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'
import { BomTableRenderer } from '../../src/ui/BomTableRenderer.mjs'
import { PcbSvgRenderer } from '../../src/ui/PcbSvgRenderer.mjs'
import { Scene3dRenderer } from '../../src/ui/Scene3dRenderer.mjs'
import { SchematicSvgRenderer } from '../../src/ui/SchematicSvgRenderer.mjs'

const schematicMidiPath =
    '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01F.SchDoc'

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
        /<circle class="schematic-junction" cx="25" cy="50" r="2" fill="#0000ff" \/>/
    )
    assert.equal((markup.match(/class="schematic-junction"/g) || []).length, 1)
})

/**
 * Verifies schematic SVG output projects document-space Y into screen-space Y
 * and renders schematic primitives around the sheet.
 */
test('renderSchematicSvg inverts schematic Y coordinates for SVG', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'GEWA-G1.01.01E.SchDoc',
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
                    title: 'GEWA-EDRUM-G1',
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
                    text: 'Bluetooth Module',
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
                    text: 'JTAG',
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
                    name: 'UART_CTS',
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
        /<text class="schematic-label" x="100" y="31" fill="#000080" text-anchor="middle" font-size="22" font-family="Times New Roman"/
    )
    assert.match(markup, /schematic-power-port--rail/)
    assert.match(
        markup,
        /<text class="schematic-power-port-label" x="120" y="14" fill="#800000" text-anchor="middle" font-size="10"/
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
        /text class="schematic-pin-name" x="24" y="23" fill="#1f1f1f"[^>]*>EN</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="142" y="19" fill="#1f1f1f" text-anchor="start"[^>]*>1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="80" y="63" fill="#1f1f1f" text-anchor="start"[^>]*>A</
    )
    assert.doesNotMatch(
        markup,
        /text class="schematic-pin-number" x="76" y="58"/
    )
    assert.match(markup, /x1="90" y1="70" x2="80" y2="70"/)
    assert.doesNotMatch(markup, /class="schematic-pin-number"[^>]*>2</)
    assert.match(markup, /GEWA-EDRUM-G1/)
    assert.match(markup, /Sheet 4 of 6/)
    assert.match(markup, /sheet-zone-label/)
    assert.match(markup, /File/)
    assert.match(markup, /Number/)
    assert.match(markup, /Date:/)
    assert.match(markup, /Drawn By:/)
    assert.match(markup, /GEWA-G1\.01\.01E\.SchDoc/)
    assert.match(markup, /schematic-port/)
    assert.match(markup, /schematic-cross/)
})

/**
 * Verifies the synthesized title block uses the resolved sheet paper size
 * instead of a hard-coded A4 label.
 */
test('renderSchematicSvg renders the resolved paper size in the title block', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'GEWA-G1.01.01A.SchDoc',
        summary: { title: 'Power schematic' },
        schematic: {
            sheet: {
                width: 300,
                height: 180,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 10,
                paperSize: 'A3',
                titleBlock: {
                    title: 'GEWA-EDRUM-G1',
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
                    name: 'UART_CTS',
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
        /text class="schematic-pin-name" x="24" y="23" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">EN</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="18" y="19" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">3</
    )
    assert.match(
        markup,
        /<polygon points="90,40 98,35 120,35 120,45 98,45" fill="#ffe16f" stroke="#8d2b2b" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="42\.20" fill="#8d2b2b" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">UART_CTS</
    )
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
                    name: 'UART_CTS',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                },
                {
                    x: 90,
                    y: 50,
                    width: 30,
                    height: 10,
                    name: 'UART_RTS',
                    fill: '#ffe16f',
                    color: '#8d2b2b',
                    direction: 'left'
                }
            ]
        }
    })

    assert.match(
        markup,
        /<polygon points="90,40 98,35 120,35 120,45 98,45" fill="#ffe16f" stroke="#8d2b2b" \/>/
    )
    assert.match(
        markup,
        /<polygon points="90,50 98,45 120,45 120,55 98,55" fill="#ffe16f" stroke="#8d2b2b" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="42\.20" fill="#8d2b2b" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">UART_CTS</
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="109" y="52\.20" fill="#8d2b2b" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">UART_RTS</
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
        /text class="schematic-pin-number" x="78" y="67" fill="#1f1f1f" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 78 67\)">16</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="84" y="56" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 84 56\)">IO13</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="100" y="54" fill="#1f1f1f" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">3</
    )
})

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
        /<text class="schematic-power-port-label" x="168" y="53.60" fill="#800000" text-anchor="start" font-size="10"/
    )
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
test('renderSchematicSvg renders UART off-sheet ports only once per label', async () => {
    const samplePath =
        '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01E.SchDoc'
    const buffer = await readFile(samplePath)
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    )
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/>UART_CTS</g) || []).length, 1)
    assert.equal((markup.match(/>UART_RTS</g) || []).length, 1)
    assert.match(
        markup,
        /<polygon points="680,332 688,327 740,327 740,337 688,337" fill="#ffff80" stroke="#800000" \/>/
    )
    assert.match(
        markup,
        /<polygon points="680,342 688,337 740,337 740,347 688,347" fill="#ffff80" stroke="#800000" \/>/
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="714" y="334\.20" fill="#800000" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">UART_CTS</
    )
    assert.match(
        markup,
        /text class="schematic-port-label" x="714" y="344\.20" fill="#800000" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">UART_RTS</
    )
    assert.equal(
        (markup.match(/<g class="schematic-port">/g) || []).length,
        1
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="915" cy="562" r="2" fill="#000080" \/>/
    )
    assert.match(
        markup,
        /<circle class="schematic-junction" cx="915" cy="542" r="2" fill="#000080" \/>/
    )
})

/**
 * Verifies the Bluetooth sheet renders U6 pin numbers outside the body and
 * restores missing U29/U31 gate pin numbers.
 */
test('renderSchematicSvg aligns Bluetooth-sheet pin number and name columns', async () => {
    const samplePath =
        '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01E.SchDoc'
    const buffer = await readFile(samplePath)
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    )
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /text class="schematic-pin-number" x="453" y="261" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="459" y="265" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="601" y="265" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">GND</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="379" y="615" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">A</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="431" y="615" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">VCC</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="624" y="625" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">A</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="676" y="625" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">VCC</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="618" y="621" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="682" y="621" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="373" y="611" fill="#1f1f1f" text-anchor="end" font-size="10" font-family="Times New Roman" font-weight="400">1</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="437" y="611" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">5</
    )
    assert.match(
        markup,
        /text class="schematic-pin-number" x="483" y="419" fill="#1f1f1f" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 483 419\)">15</
    )
    assert.match(
        markup,
        /text class="schematic-pin-name" x="499" y="408" fill="#1f1f1f" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 499 408\)">IO13</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="619" y="603" fill="#000080" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">U29</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="715" y="622" fill="#000080" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">C187</
    )
    assert.match(
        markup,
        /text class="schematic-label" x="974" y="583" fill="#000080" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">J5</
    )
})

/**
 * Verifies the Bluetooth-sheet D16 diode symbol includes the triangle body
 * linework from the source polygon primitive.
 */
test('renderSchematicSvg renders the Bluetooth D16 diode triangle', async () => {
    const samplePath =
        '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01E.SchDoc'
    const buffer = await readFile(samplePath)
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    )
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.match(
        markup,
        /<line x1="217" y1="589" x2="233" y2="589" stroke="#0000ff" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="233" y1="589" x2="225" y2="573" stroke="#0000ff" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="225" y1="573" x2="217" y2="589" stroke="#0000ff" stroke-width="1" \/>/
    )
})

/**
 * Verifies the MIDI/system sheet renders one copy of each visible U2 section
 * and includes the multipart body outlines recovered from record 6.
 */
test('renderSchematicSvg restores multipart U2 bodies on the MIDI sheet', async () => {
    const buffer = await readFile(schematicMidiPath)
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    )
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01F.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/>USB port</g) || []).length, 1)
    assert.equal((markup.match(/>Power</g) || []).length, 1)
    assert.equal((markup.match(/>System \/ MIDI</g) || []).length, 1)
    assert.match(
        markup,
        /<line x1="670" y1="369" x2="670" y2="159" stroke="#0000ff" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<line x1="280" y1="519" x2="280" y2="189" stroke="#0000ff" stroke-width="1" \/>/
    )
    assert.match(markup, />A3</)
    assert.match(markup, />Sheet 5 of 6</)
})

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
