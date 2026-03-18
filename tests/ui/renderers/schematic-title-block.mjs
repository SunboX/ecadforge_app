import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies source-provided footer hints replace the generic title-block grid
 * with the corrected A3 footer layout and label placement.
 */
test('renderSchematicSvg uses footer title-block hints for A3 footer placement', () => {
    const markup = SchematicSvgRenderer.render({
        fileName: 'footer-hints.SchDoc',
        summary: { title: 'Footer hints schematic' },
        schematic: {
            sheet: {
                width: 1654,
                height: 1169,
                sourceWidth: 1500,
                borderOn: true,
                titleBlockOn: true,
                marginWidth: 20,
                xZones: 8,
                yZones: 4,
                paperSize: 'A3',
                titleBlock: {
                    title: 'EMBER-UNIT Power',
                    documentNumber: 'CORE-MOD',
                    revision: '03',
                    sheetNumber: '2',
                    sheetTotal: '7',
                    date: '3/17/2026',
                    drawnBy: '',
                    footerHints: {
                        title: {
                            x: 1225,
                            y: 75,
                            color: '#000080',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        documentNumber: {
                            x: 1420,
                            y: 80,
                            color: '#ff0000',
                            fontSize: 14,
                            fontFamily: 'Times New Roman',
                            fontWeight: 700
                        },
                        revision: {
                            x: 1455,
                            y: 50,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        },
                        sheetNumber: {
                            x: 1405,
                            y: 30,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        },
                        sheetTotal: {
                            x: 1435,
                            y: 30,
                            color: '#000080',
                            fontSize: 10,
                            fontFamily: 'Times New Roman',
                            fontWeight: 400
                        }
                    }
                }
            },
            lines: [],
            texts: [],
            components: []
        }
    })

    assert.match(markup, /<rect x="1259" y="1071" width="375" height="78" \/>/)
    assert.match(markup, /<line x1="1259" y1="1110" x2="1634" y2="1110" \/>/)
    assert.match(
        markup,
        /<line x1="1259" y1="1129.50" x2="1634" y2="1129.50" \/>/
    )
    assert.match(
        markup,
        /<line x1="1259" y1="1139.25" x2="1634" y2="1139.25" \/>/
    )
    assert.match(
        markup,
        /<line x1="1510.25" y1="1071" x2="1510.25" y2="1110" \/>/
    )
    assert.match(
        markup,
        /<line x1="1319" y1="1110" x2="1319" y2="1129.50" \/>/
    )
    assert.match(
        markup,
        /<line x1="1529" y1="1110" x2="1529" y2="1129.50" \/>/
    )
    assert.match(
        markup,
        /<line x1="1472.75" y1="1129.50" x2="1472.75" y2="1149" \/>/
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1270.25" y="1083.48" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Title</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1277.75" y="1114.88" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Size</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1331" y="1114.88" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Number</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1537" y="1114.88" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Revision</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1267" y="1135.84" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Date:</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1267" y="1145.59" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">File:</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1480.75" y="1145.59" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Drawn By:</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1379" y="1094" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">EMBER-UNIT Power</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1574" y="1089" fill="var\(--schematic-alert-color\)" text-anchor="middle" font-size="14" font-family="Times New Roman" font-weight="700">CORE-MOD</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1609" y="1122.19" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">03</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1289" y="1124.63" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">A3</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1480.75" y="1135.84" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">Sheet</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1559" y="1135.84" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">2</
    )
    assert.match(
        markup,
        /<text class="sheet-title-label" x="1569" y="1135.84" fill="var\(--schematic-sheet-label-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">of</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1589" y="1135.84" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">7</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1349" y="1135.84" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">3\/17\/2026</
    )
    assert.match(
        markup,
        /<text class="sheet-title-value" x="1349" y="1145.59" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="10" font-family="Times New Roman" font-weight="400">footer-hints\.SchDoc</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="1574" y="1139" fill="var\(--schematic-default-ink-color\)" text-anchor="middle" font-size="10" font-family="Times New Roman" font-weight="400">Sheet 2 of 7</
    )
    assert.doesNotMatch(
        markup,
        /<text class="sheet-title-value" x="1349" y="1141.20" fill="var\(--schematic-text-color\)" text-anchor="start">3\/17\/2026</
    )
})
