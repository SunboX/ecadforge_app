import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies schematic samples produce a normalized document with visible entities.
 */
test('parseAltiumArrayBuffer parses a native SchDoc sample', async () => {
    const documentModel = await AltiumFixtureLoader.parsePowerSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(documentModel.fileType, 'SchDoc')
    assert.equal(documentModel.schematic.components.length > 0, true)
    assert.equal(documentModel.schematic.lines.length > 50, true)
    assert.equal(documentModel.schematic.texts.length > 20, true)
    assert.equal(documentModel.bom.length > 0, true)
    assert.match(documentModel.summary.title, /Atlas/i)
})

/**
 * Verifies wrapped record-28 note boxes stay in the text model and do not
 * leak into the line model as a diagonal location-to-corner segment.
 */
test('parseAltiumArrayBuffer keeps record-28 notes out of schematic lines', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=200|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=28|Location.X=20|Location.Y=20|Corner.X=120|Corner.Y=60' +
            '|AreaColor=16777215|TextColor=255|FontID=1|IsSolid=T|Alignment=1|WordWrap=T|ClipToRect=T' +
            '|Text=*NOTE:~11)Alpha~12)Beta'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'wrapped-note.SchDoc',
        arrayBuffer
    )
    const note = documentModel.schematic.texts.find(
        (text) => text.recordType === '28'
    )

    assert.ok(note)
    assert.equal(documentModel.schematic.lines.length, 0)
    assert.equal(note.color, '#ff0000')
    assert.deepEqual(note.noteLines, ['*NOTE:', '1)Alpha', '2)Beta'])
    assert.equal(note.cornerX, 120)
    assert.equal(note.cornerY, 60)
})

/**
 * Verifies Altium schematic colors and polyline wires are normalized from the
 * Bluetooth sheet sample.
 */
test('parseAltiumArrayBuffer decodes Bluetooth sheet colors and wires', async () => {
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()

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
        title: 'ATLAS-CONTROL-A1',
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
            (text) => text.text === 'ATLAS-CONTROL-A1' || text.text === '01'
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
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()
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
 * Verifies sheet-F packages keep the top and bottom pin rows encoded by the
 * less-common 57/49/51 conglomerate variants, including the full dual-row
 * TVS labelling used by D12.
 */
test('parseAltiumArrayBuffer maps sheet-F top and bottom variant pin conglomerates', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()
    const d12Pins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '5547'
    )

    assert.equal(d12Pins.length, 6)
    assert.equal(
        d12Pins.some(
            (pin) =>
                pin.name === 'I/O4' &&
                pin.designator === '6' &&
                pin.orientation === 'top' &&
                pin.x === 1220 &&
                pin.y === 885 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        d12Pins.some(
            (pin) =>
                pin.name === 'VDD' &&
                pin.designator === '5' &&
                pin.orientation === 'top' &&
                pin.x === 1240 &&
                pin.y === 885 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        d12Pins.some(
            (pin) =>
                pin.name === 'GND' &&
                pin.designator === '2' &&
                pin.orientation === 'bottom' &&
                pin.x === 1240 &&
                pin.y === 825 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '5760' &&
                pin.name === '5' &&
                pin.designator === '5' &&
                pin.orientation === 'bottom' &&
                pin.x === 1450 &&
                pin.y === 700 &&
                pin.labelMode === 'name-and-number'
        ),
        true
    )
})

/**
 * Verifies sheet-F power ports preserve Altium orientation metadata so the
 * renderer can honor explicit port direction before inferring from wires.
 */
test('parseAltiumArrayBuffer keeps sheet-F +3.3V power-port orientation', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()

    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.recordType === '17' &&
                text.text === '+3.3V' &&
                text.x === 100 &&
                text.y === 1010 &&
                text.powerPortDirection === 'up'
        ),
        true
    )
})

/**
 * Verifies sheet-F multipart unit designators keep the visible section suffix
 * derived from the active Altium part id instead of rendering as bare U2.
 */
test('parseAltiumArrayBuffer appends active multipart suffixes to sheet-F designators', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()

    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.ownerIndex === '1672' &&
                text.name === 'Designator' &&
                text.text === 'U2A'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.ownerIndex === '3833' &&
                text.name === 'Designator' &&
                text.text === 'U2B'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.ownerIndex === '2172' &&
                text.name === 'Designator' &&
                text.text === 'U2J'
        ),
        true
    )
})

/**
 * Verifies escaped Altium active-low pin names are normalized into readable
 * labels before rendering.
 */
test('parseAltiumArrayBuffer decodes escaped sheet-F pin names like RST', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()

    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '3833' &&
                pin.designator === '1' &&
                pin.orientation === 'left' &&
                pin.name === 'RST'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.pins.some(
            (pin) =>
                pin.ownerIndex === '3833' &&
                /\\/.test(pin.name)
        ),
        false
    )
})

/**
 * Verifies the sheet-F crystal Y2 keeps its four numbered passive pins rather
 * than dropping them because the symbol spans multiple sides.
 */
test('parseAltiumArrayBuffer keeps the sheet-F Y2 crystal pins as number-only labels', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()
    const y2Pins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '6355'
    )

    assert.equal(y2Pins.length, 4)
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '1' &&
                pin.orientation === 'left' &&
                pin.x === 165 &&
                pin.y === 395 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '3' &&
                pin.orientation === 'right' &&
                pin.x === 185 &&
                pin.y === 395 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '2' &&
                pin.orientation === 'top' &&
                pin.x === 195 &&
                pin.y === 415 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
    assert.equal(
        y2Pins.some(
            (pin) =>
                pin.designator === '4' &&
                pin.orientation === 'top' &&
                pin.x === 205 &&
                pin.y === 415 &&
                pin.labelMode === 'number-only'
        ),
        true
    )
})

/**
 * Verifies anonymous numbered connector pins stay visible even when the symbol
 * spans multiple sides, so the renderer can keep their ground ports attached.
 */
test('parseAltiumArrayBuffer keeps anonymous multi-side connector pins and grounds', () => {
    const connectorRecords = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1000|CustomY=500|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=19|Location.X=919|Location.Y=175|Designator=1',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=19|Location.X=919|Location.Y=195|Designator=2',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=58|PinLength=19|Location.X=919|Location.Y=215|Designator=3',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=57|PinLength=19|Location.X=930|Location.Y=356|Designator=4',
        '|RECORD=2|OwnerIndex=4773|OwnerPartId=1|FormalType=1|Electrical=4' +
            '|PinConglomerate=59|PinLength=19|Location.X=930|Location.Y=164|Designator=5',
        '|RECORD=17|Style=4|ShowNetName=T|Location.X=930|Location.Y=375|Color=128|FontID=1|Text=GND',
        '|RECORD=17|Style=4|ShowNetName=T|Location.X=930|Location.Y=145|Color=128|FontID=1|Text=GND'
    ]
    const arrayBuffer = new TextEncoder().encode(connectorRecords.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'anonymous-connector.SchDoc',
        arrayBuffer
    )
    const connectorPins = documentModel.schematic.pins.filter(
        (pin) => pin.ownerIndex === '4773'
    )
    const sheetHeight = documentModel.schematic.sheet.height
    const topGroundY = sheetHeight - 375
    const bottomGroundY = sheetHeight - 145
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal(connectorPins.length, 5)
    assert.equal(
        connectorPins.every((pin) => pin.labelMode === 'number-only'),
        true
    )
    assert.equal(
        connectorPins.some(
            (pin) =>
                pin.designator === '4' &&
                pin.orientation === 'top' &&
                pin.x === 930 &&
                pin.y === 356
        ),
        true
    )
    assert.equal(
        connectorPins.some(
            (pin) =>
                pin.designator === '5' &&
                pin.orientation === 'bottom' &&
                pin.x === 930 &&
                pin.y === 164
        ),
        true
    )
    assert.match(markup, />4</)
    assert.match(markup, />5</)
    assert.match(
        markup,
        new RegExp(
            '<g class="schematic-power-port schematic-power-port--ground">' +
                '<line x1="930" y1="' +
                topGroundY +
                '" x2="930" y2="' +
                (topGroundY - 7) +
                '" stroke="var\\(--schematic-power-color\\)" \\/>'
        )
    )
    assert.match(
        markup,
        new RegExp(
            '<g class="schematic-power-port schematic-power-port--ground">' +
                '<line x1="930" y1="' +
                bottomGroundY +
                '" x2="930" y2="' +
                (bottomGroundY + 7) +
                '" stroke="var\\(--schematic-power-color\\)" \\/>'
        )
    )
})

/**
 * Verifies sheet-F record-14 package bodies are parsed as filled rectangles
 * instead of diagonal line segments.
 */
test('parseAltiumArrayBuffer keeps the sheet-F D12 body as a rectangle primitive', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()

    assert.equal(
        documentModel.schematic.rectangles.some(
            (rectangle) =>
                rectangle.ownerIndex === '5547' &&
                rectangle.x === 1210 &&
                rectangle.y === 825 &&
                rectangle.width === 60 &&
                rectangle.height === 60 &&
                rectangle.color === '#800000' &&
                rectangle.fill === '#ffffb0' &&
                rectangle.isSolid === true
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.ownerIndex === '5547' &&
                line.x1 === 1210 &&
                line.y1 === 825 &&
                line.x2 === 1270 &&
                line.y2 === 885
        ),
        false
    )
})

/**
 * Verifies sheet-F inductor body arcs survive normalization with their
 * fractional center coordinates instead of being dropped entirely.
 */
test('parseAltiumArrayBuffer keeps the sheet-F inductor coil arcs as record-12 primitives', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()
    const l52Arcs = documentModel.schematic.arcs?.filter(
        (arc) => arc.ownerIndex === '5602'
    )

    assert.deepEqual(l52Arcs, [
        {
            x: 565,
            y: 284.8,
            radius: 5,
            startAngle: 2.3,
            endAngle: 177.7,
            color: '#0000ff',
            width: 1,
            ownerIndex: '5602'
        },
        {
            x: 575,
            y: 284.8,
            radius: 5,
            startAngle: 2.3,
            endAngle: 177.7,
            color: '#0000ff',
            width: 1,
            ownerIndex: '5602'
        },
        {
            x: 585,
            y: 284.8,
            radius: 5,
            startAngle: 2.3,
            endAngle: 177.7,
            color: '#0000ff',
            width: 1,
            ownerIndex: '5602'
        }
    ])
})

/**
 * Verifies recovered Bluetooth-sheet geometry occupies a reasonable share of
 * the parsed page size so the rendered sheet does not appear undersized.
 */
test('parseAltiumArrayBuffer infers a tight-enough Bluetooth sheet size', async () => {
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()
    assert.equal(documentModel.schematic.sheet.paperSize, 'A4')
    assert.equal(documentModel.schematic.sheet.width, 1169)
    assert.equal(documentModel.schematic.sheet.height, 827)
})

/**
 * Verifies larger recovered pages snap to the next matching ISO paper size
 * instead of shrinking tightly to visible geometry.
 */
test('parseAltiumArrayBuffer resolves the sample power sheet to A3', async () => {
    const documentModel = await AltiumFixtureLoader.parsePowerSheet()

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
})

/**
 * Verifies power-sheet off-sheet ports keep the same pointed side Altium uses
 * when explicit port style is omitted from the stored record.
 */
test('parseAltiumArrayBuffer infers power-sheet port direction from connectivity', async () => {
    const documentModel = await AltiumFixtureLoader.parsePowerSheet()
    const resolveDirection = (name) =>
        documentModel.schematic.ports.find((port) => port.name === name)
            ?.direction

    assert.equal(resolveDirection('STM_Reset'), 'left')
    assert.equal(resolveDirection('BOOT_SEL'), 'left')
    assert.equal(resolveDirection('MIX_RESET'), 'left')
    assert.equal(resolveDirection('MIX_IN_DETECT'), 'right')
})

/**
 * Verifies record-26 bus trunks on the power sheet survive normalization so
 * grouped net routes render instead of disappearing entirely.
 */
test('parseAltiumArrayBuffer preserves power-sheet bus trunks', async () => {
    const documentModel = await AltiumFixtureLoader.parsePowerSheet()

    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 300 &&
                line.y1 === 700 &&
                line.x2 === 300 &&
                line.y2 === 680 &&
                line.isBus === true
        ),
        true
    )
    assert.equal(
        documentModel.schematic.lines.some(
            (line) =>
                line.x1 === 415 &&
                line.y1 === 550 &&
                line.x2 === 415 &&
                line.y2 === 460 &&
                line.isBus === true
        ),
        true
    )
})

/**
 * Verifies the MIDI/system sheet keeps only the active multipart U2 sections,
 * preserving one label per visible section and snapping back to A3.
 */
test('parseAltiumArrayBuffer restores active multipart sections on the MIDI sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseMidiSheet()
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
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()
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
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()
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
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()
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
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()
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
    const documentModel = await AltiumFixtureLoader.parseWirelessSheet()

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
    const documentModel = await AltiumFixtureLoader.parsePcb()

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
