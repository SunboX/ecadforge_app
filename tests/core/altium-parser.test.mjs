import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'

const schematicPath =
    '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01A.SchDoc'
const schematicBluetoothPath =
    '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01E.SchDoc'
const schematicMidiPath =
    '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.01F.SchDoc'
const pcbPath =
    '/Users/afiedler/Downloads/GEWA-G1.01.08 (2026-3-6 15-16-26)/GEWA-G1.01.08.PcbDoc'

/**
 * Converts a Node buffer into an exact ArrayBuffer slice.
 * @param {Buffer} buffer
 * @returns {ArrayBuffer}
 */
function toArrayBuffer(buffer) {
    return buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    )
}

/**
 * Verifies schematic samples produce a normalized document with visible entities.
 */
test('parseAltiumArrayBuffer parses a native SchDoc sample', async () => {
    const buffer = await readFile(schematicPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01A.SchDoc',
        toArrayBuffer(buffer)
    )

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(documentModel.fileType, 'SchDoc')
    assert.equal(documentModel.schematic.components.length > 0, true)
    assert.equal(documentModel.schematic.lines.length > 50, true)
    assert.equal(documentModel.schematic.texts.length > 20, true)
    assert.equal(documentModel.bom.length > 0, true)
    assert.match(documentModel.summary.title, /GEWA/i)
})

/**
 * Verifies Altium schematic colors and polyline wires are normalized from the
 * Bluetooth sheet sample.
 */
test('parseAltiumArrayBuffer decodes Bluetooth sheet colors and wires', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'Bluetooth Module' && text.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'Bluetooth Module' &&
                Math.abs(text.fontSize - 22) < 0.02 &&
                text.anchor === 'middle'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === '+3.3V' &&
                text.recordType === '17' &&
                text.style === 2 &&
                text.rotation === 0 &&
                text.anchor === 'middle'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'JTAG' && text.rotation === 90
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'D16' &&
                text.rotation === 90 &&
                text.anchor === 'start'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 175 &&
                line.y1 === 545 &&
                line.x2 === 175 &&
                line.y2 === 555 &&
                line.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some((text) => text.text === '=title'),
        false
    )
    assert.equal(
        documentModel.schematic.texts.some((text) =>
            /@DESIGNATOR|INITIAL VOLTAGE/i.test(text.text)
        ),
        false
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.name === 'EN' &&
                pin.designator === '3' &&
                pin.orientation === 'left' &&
                pin.x === 455 &&
                pin.y === 545 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) => pin.x === 300 && pin.y === 230
        ),
        false
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.x === 950 &&
                pin.y === 530 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.deepEqual(documentModel.schematic.sheet.titleBlock, {
        title: 'GEWA-EDRUM-G1',
        revision: '01',
        documentNumber: '',
        sheetNumber: '4',
        sheetTotal: '6',
        date: '',
        drawnBy: ''
    })
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '296' &&
                pin.name === 'A' &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '322' &&
                pin.name === 'A' &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '1231' &&
                pin.x === 695 &&
                pin.y === 535 &&
                pin.orientation === 'left' &&
                pin.labelMode === 'hidden'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '638' &&
                pin.x === 175 &&
                pin.y === 535 &&
                pin.orientation === 'top' &&
                pin.labelMode === 'hidden'
        ),
        true
    )
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'GEWA-EDRUM-G1' || text.text === '01'
        ),
        false
    )
    assert.equal(
        documentModel.schematic.crosses.some(
            (cross) =>
                cross.x === 990 && cross.y === 530 && cross.color === '#ff0000'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.ports.some(
            (port) =>
                port.name === 'UART_CTS' &&
                port.x === 680 &&
                port.y === 495 &&
                port.width === 60 &&
                port.height === 10
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.filter(
            (text) => text.text === '排针PH2.54 2x3P 180度 双塑 L=30.5'
        ).length,
        2
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'UART_CTS' || text.text === 'UART_RTS'
        ),
        false
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 690 &&
                line.y1 === 427 &&
                line.x2 === 690 &&
                line.y2 === 425
        ),
        false
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 702 &&
                line.y1 === 475 &&
                line.x2 === 700 &&
                line.y2 === 475
        ),
        true
    )
    assert.deepEqual(
        documentModel.schematic.components
            .filter((component) =>
                [
                    [255, 215],
                    [225, 270],
                    [950, 540],
                    [455, 595]
                ].some(([x, y]) => component.x === x && component.y === y)
            )
            .map((component) => ({
                x: component.x,
                y: component.y,
                designator: component.designator
            }))
            .sort((left, right) => left.x - right.x || left.y - right.y),
        [
            { x: 225, y: 270, designator: 'D16' },
            { x: 255, y: 215, designator: 'R94' },
            { x: 455, y: 595, designator: 'U6' },
            { x: 950, y: 540, designator: 'J6' }
        ]
    )
})

/**
 * Verifies the Bluetooth sheet preserves pin numbers on the two five-pin
 * SN74LVC1G00 gate symbols instead of collapsing them to name-only labels.
 */
test('parseAltiumArrayBuffer keeps gate pin numbers on the Bluetooth sheet', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )
    const gatePins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '296' || pin.ownerIndex === '322'
    )

    assert.equal(gatePins.length, 10)
    assert.equal(
        gatePins.every((pin) => pin.labelMode === 'name-and-number'),
        true
    )
    assert.deepEqual(
        gatePins
            .map((pin) => ({
                ownerIndex: pin.ownerIndex,
                name: pin.name,
                designator: pin.designator,
                orientation: pin.orientation
            }))
            .sort(
                (left, right) =>
                    left.ownerIndex.localeCompare(right.ownerIndex) ||
                    left.designator.localeCompare(right.designator, undefined, {
                        numeric: true
                    })
            ),
        [
            {
                ownerIndex: '296',
                name: 'A',
                designator: '1',
                orientation: 'left'
            },
            {
                ownerIndex: '296',
                name: 'B',
                designator: '2',
                orientation: 'left'
            },
            {
                ownerIndex: '296',
                name: 'GND',
                designator: '3',
                orientation: 'left'
            },
            {
                ownerIndex: '296',
                name: 'Y',
                designator: '4',
                orientation: 'right'
            },
            {
                ownerIndex: '296',
                name: 'VCC',
                designator: '5',
                orientation: 'right'
            },
            {
                ownerIndex: '322',
                name: 'A',
                designator: '1',
                orientation: 'left'
            },
            {
                ownerIndex: '322',
                name: 'B',
                designator: '2',
                orientation: 'left'
            },
            {
                ownerIndex: '322',
                name: 'GND',
                designator: '3',
                orientation: 'left'
            },
            {
                ownerIndex: '322',
                name: 'Y',
                designator: '4',
                orientation: 'right'
            },
            {
                ownerIndex: '322',
                name: 'VCC',
                designator: '5',
                orientation: 'right'
            }
        ]
    )
})

/**
 * Verifies recovered Bluetooth-sheet geometry occupies a reasonable share of
 * the parsed page size so the rendered sheet does not appear undersized.
 */
test('parseAltiumArrayBuffer infers a tight-enough Bluetooth sheet size', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )
    assert.equal(documentModel.schematic.sheet.paperSize, 'A4')
    assert.equal(documentModel.schematic.sheet.width, 1169)
    assert.equal(documentModel.schematic.sheet.height, 827)
})

/**
 * Verifies larger recovered pages snap to the next matching ISO paper size
 * instead of shrinking tightly to visible geometry.
 */
test('parseAltiumArrayBuffer resolves the sample power sheet to A3', async () => {
    const buffer = await readFile(schematicPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01A.SchDoc',
        toArrayBuffer(buffer)
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
})

/**
 * Verifies the MIDI/system sheet keeps only the active multipart U2 sections,
 * preserving one label per visible section and snapping back to A3.
 */
test('parseAltiumArrayBuffer restores active multipart sections on the MIDI sheet', async () => {
    const buffer = await readFile(schematicMidiPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01F.SchDoc',
        toArrayBuffer(buffer)
    )
    const u2Pins = documentModel.schematic.pins.filter((pin) =>
        ['1672', '2172', '3833'].includes(pin.ownerIndex)
    )
    const sectionLabels = documentModel.schematic.texts.filter((text) =>
        [
            'USB port',
            'Power',
            'System / MIDI',
            'NAND FLASH',
            'Digital Audio',
            'Ethernet MAC',
            'Multi-Purpose Quad SPI',
            'Slave 8-bit IF',
            'SDRAM controller'
        ].includes(text.text)
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
    assert.equal(u2Pins.length, 65)
    assert.deepEqual(
        sectionLabels
            .map((text) => text.text)
            .sort((left, right) => left.localeCompare(right)),
        ['Power', 'System / MIDI', 'USB port']
    )
})

/**
 * Verifies Bluetooth-sheet component texts anchor according to their owner
 * geometry instead of using one blanket rule for every designator.
 */
test('parseAltiumArrayBuffer anchors Bluetooth component texts from owner geometry', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )
    const anchors = documentModel.schematic.texts
        .filter((text) =>
            ['C70', 'C82', 'C68', 'R148', 'R134', 'C187', 'C190'].includes(
                text.text
            )
        )
        .map((text) => ({
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) =>
            left.text.localeCompare(right.text, undefined, { numeric: true })
        )

    assert.deepEqual(anchors, [
        { text: 'C68', anchor: 'start' },
        { text: 'C70', anchor: 'start' },
        { text: 'C82', anchor: 'start' },
        { text: 'C187', anchor: 'start' },
        { text: 'C190', anchor: 'start' },
        { text: 'R134', anchor: 'end' },
        { text: 'R148', anchor: 'end' }
    ])
})

/**
 * Verifies gate designators on the Bluetooth sheet sit just above the symbol
 * body instead of touching its outline.
 */
test('parseAltiumArrayBuffer pads Bluetooth gate designators above the body', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )
    const designators = documentModel.schematic.texts
        .filter((text) => ['U29', 'U31'].includes(text.text))
        .map((text) => ({
            text: text.text,
            y: text.y,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(designators, [
        { text: 'U29', y: 224, anchor: 'start' },
        { text: 'U31', y: 234, anchor: 'start' }
    ])
})

/**
 * Verifies bottom-side connector designators on the Bluetooth sheet keep their
 * original left-to-right anchor instead of being pulled left under the body.
 */
test('parseAltiumArrayBuffer keeps Bluetooth bottom connector designators left-to-right', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )
    const designator = documentModel.schematic.texts.find(
        (text) => text.text === 'J5'
    )

    assert.deepEqual(
        {
            text: designator?.text,
            x: designator?.x,
            y: designator?.y,
            anchor: designator?.anchor
        },
        {
            text: 'J5',
            x: 974,
            y: 244,
            anchor: 'start'
        }
    )
})

/**
 * Verifies only wire labels on open left runs flip away from nearby
 * designators, while labels attached to component pins stay left-to-right.
 */
test('parseAltiumArrayBuffer keeps component-connected wire labels readable on the Bluetooth sheet', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )
    const anchors = documentModel.schematic.texts
        .filter(
            (text) =>
                (text.text === 'BT_RESET' &&
                    text.x === 245 &&
                    text.y === 545) ||
                (text.text === 'ESP_TX2' && text.x === 630 && text.y === 475) ||
                (text.text === 'ESP_RX2' && text.x === 630 && text.y === 445) ||
                (text.text === 'ESP_BOOT' &&
                    text.x === 630 &&
                    text.y === 435) ||
                (text.text === 'ESP_TX0' && text.x === 760 && text.y === 535)
        )
        .map((text) => ({
            text: text.text,
            x: text.x,
            anchor: text.anchor
        }))
        .sort(
            (left, right) =>
                left.x - right.x || left.text.localeCompare(right.text)
        )

    assert.deepEqual(anchors, [
        { text: 'BT_RESET', x: 245, anchor: 'end' },
        { text: 'ESP_BOOT', x: 630, anchor: 'start' },
        { text: 'ESP_RX2', x: 630, anchor: 'start' },
        { text: 'ESP_TX2', x: 630, anchor: 'start' },
        { text: 'ESP_TX0', x: 760, anchor: 'start' }
    ])
})

/**
 * Verifies the Bluetooth sheet keeps the D16 diode body polygon as drawable
 * line segments so the symbol triangle is visible.
 */
test('parseAltiumArrayBuffer preserves the Bluetooth D16 diode triangle', async () => {
    const buffer = await readFile(schematicBluetoothPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.01E.SchDoc',
        toArrayBuffer(buffer)
    )

    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '167' &&
                line.x1 === 217 &&
                line.y1 === 238 &&
                line.x2 === 233 &&
                line.y2 === 238 &&
                line.color === '#0000ff'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '167' &&
                line.x1 === 233 &&
                line.y1 === 238 &&
                line.x2 === 225 &&
                line.y2 === 254 &&
                line.color === '#0000ff'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '167' &&
                line.x1 === 225 &&
                line.y1 === 254 &&
                line.x2 === 217 &&
                line.y2 === 238 &&
                line.color === '#0000ff'
        ),
        true
    )
})

/**
 * Verifies PCB samples produce board outline, layers, and placements.
 */
test('parseAltiumArrayBuffer parses a native PcbDoc sample', async () => {
    const buffer = await readFile(pcbPath)
    const documentModel = AltiumParser.parseArrayBuffer(
        'GEWA-G1.01.08.PcbDoc',
        toArrayBuffer(buffer)
    )

    assert.equal(documentModel.kind, 'pcb')
    assert.equal(documentModel.fileType, 'PcbDoc')
    assert.equal(documentModel.pcb.boardOutline.segments.length > 20, true)
    assert.equal(documentModel.pcb.layers.length > 8, true)
    assert.equal(documentModel.pcb.components.length > 50, true)
    assert.equal(documentModel.bom.length > 10, true)
    assert.equal(
        documentModel.pcb.components.some(
            (component) => component.designator === 'U4'
        ),
        true
    )
})
