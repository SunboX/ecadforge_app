import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies the reduced embedded solace-sheet fixture still produces normalized
 * ports, labels, and bus geometry.
 */
test('parseAltiumArrayBuffer parses an embedded fake SchDoc sample', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(documentModel.fileType, 'SchDoc')
    assert.equal(documentModel.schematic.components.length, 0)
    assert.equal(documentModel.schematic.lines.length, 14)
    assert.equal(documentModel.schematic.texts.length, 10)
    assert.equal(documentModel.schematic.ports.length, 5)
    assert.equal(
        documentModel.schematic.lines.filter((line) => line.isBus).length,
        2
    )
    assert.equal(documentModel.bom.length, 0)
    assert.equal(documentModel.summary.title, 'LUMEN-VEIL-A1')
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
 * Verifies Altium schematic colors, title typography, and synthesized
 * connector notes are normalized from the aether-sheet fixture.
 */
test('parseAltiumArrayBuffer decodes aether sheet colors and wires', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()

    assert.equal(documentModel.kind, 'schematic')
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'Zephyr Node' && text.color === '#000080'
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'WYRN' &&
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
            (text) => text.text === 'WYRN' && text.rotation === 90
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) =>
                text.text === 'Q12' &&
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
        title: 'LUMEN-VEIL-A1',
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
            (text) => text.text === 'LUMEN-VEIL-A1' || text.text === '01'
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
                port.name === 'RUNE_CTL' &&
                port.x === 680 &&
                port.y === 495 &&
                port.width === 60 &&
                port.height === 10
        ),
        true
    )
    assert.equal(
        documentModel.schematic.texts.filter(
            (text) => text.text === 'RUNE HEADER P2.54 2X3P VERTICAL L=30.5'
        ).length,
        1
    )
    assert.equal(
        documentModel.schematic.texts.some(
            (text) => text.text === 'RUNE_CTL' || text.text === 'RUNE_FLOW'
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
                line.x1 === 697 &&
                line.y1 === 535 &&
                line.x2 === 695 &&
                line.y2 === 535
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
            { x: 225, y: 270, designator: 'Q12' },
            { x: 255, y: 215, designator: 'R94' },
            { x: 455, y: 595, designator: 'U6' },
            { x: 950, y: 540, designator: 'J6' }
        ]
    )
})

/**
 * Verifies rotated schematic texts preserve their raw Altium orientation so
 * the renderer can distinguish opposite vertical reading directions.
 */
test(
    'parseAltiumArrayBuffer preserves rotated text source orientation',
    async () => {
        const aetherDocument = await AltiumFixtureLoader.parseAetherSheet()
        const bastionDocument = await AltiumFixtureLoader.parseBastionSheet()
        const d16 = aetherDocument.schematic.texts.find(
            (text) => text.text === 'Q12'
        )
        const jtag = aetherDocument.schematic.texts.find(
            (text) => text.text === 'WYRN'
        )
        const r24 = bastionDocument.schematic.texts.find(
            (text) => text.text === 'Q24'
        )
        const r24Value = bastionDocument.schematic.texts.find(
            (text) => text.text === '4K7' && text.ownerIndex === '3652'
        )

        assert.deepEqual(
            {
                text: d16?.text,
                rotation: d16?.rotation,
                sourceOrientation: d16?.sourceOrientation
            },
            {
                text: 'Q12',
                rotation: 90,
                sourceOrientation: 1
            }
        )
        assert.deepEqual(
            {
                text: jtag?.text,
                rotation: jtag?.rotation,
                sourceOrientation: jtag?.sourceOrientation
            },
            {
                text: 'WYRN',
                rotation: 90,
                sourceOrientation: 1
            }
        )
        assert.deepEqual(
            {
                text: r24?.text,
                rotation: r24?.rotation,
                sourceOrientation: r24?.sourceOrientation
            },
            {
                text: 'Q24',
                rotation: 90,
                sourceOrientation: 3
            }
        )
        assert.deepEqual(
            {
                text: r24Value?.text,
                rotation: r24Value?.rotation,
                sourceOrientation: r24Value?.sourceOrientation
            },
            {
                text: '4K7',
                rotation: 90,
                sourceOrientation: 3
            }
        )
    }
)

/**
 * Verifies the aether sheet preserves pin numbers on the two five-pin
 * SN74LVC1G00 gate symbols instead of collapsing them to name-only labels.
 */
test('parseAltiumArrayBuffer keeps gate pin numbers on the aether sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
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
 * Verifies lyra-sheet packages keep the top and bottom pin rows encoded by the
 * less-common 57/49/51 conglomerate variants, including the full dual-row
 * TVS labelling used by D12.
 */
test('parseAltiumArrayBuffer maps lyra-sheet top and bottom variant pin conglomerates', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
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
 * Verifies lyra-sheet power ports preserve Altium orientation metadata so the
 * renderer can honor explicit port direction before inferring from wires.
 */
test('parseAltiumArrayBuffer keeps lyra-sheet +3.3V power-port orientation', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()

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
 * Verifies lyra-sheet multipart unit designators keep the visible section suffix
 * derived from the active Altium part id instead of rendering as bare U2.
 */
test('parseAltiumArrayBuffer appends active multipart suffixes to lyra-sheet designators', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()

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
test('parseAltiumArrayBuffer decodes escaped lyra-sheet pin names like RST', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()

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
 * Verifies the lyra-sheet crystal Y2 keeps its four numbered passive pins rather
 * than dropping them because the symbol spans multiple sides.
 */
test('parseAltiumArrayBuffer keeps the lyra-sheet Y2 crystal pins as number-only labels', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
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
 * Verifies lyra-sheet record-14 package bodies are parsed as filled rectangles
 * instead of diagonal line segments.
 */
test('parseAltiumArrayBuffer keeps the lyra-sheet D12 body as a rectangle primitive', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()

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
 * Verifies lyra-sheet inductor body arcs survive normalization with their
 * fractional center coordinates instead of being dropped entirely.
 */
test('parseAltiumArrayBuffer keeps the lyra-sheet inductor coil arcs as record-12 primitives', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
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
 * Verifies recovered aether-sheet geometry occupies a reasonable share of
 * the parsed page size so the rendered sheet does not appear undersized.
 */
test('parseAltiumArrayBuffer infers a tight-enough aether sheet size', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    assert.equal(documentModel.schematic.sheet.paperSize, 'A4')
    assert.equal(documentModel.schematic.sheet.width, 1169)
    assert.equal(documentModel.schematic.sheet.height, 827)
})

/**
 * Verifies larger recovered pages snap to the next matching ISO paper size
 * instead of shrinking tightly to visible geometry.
 */
test('parseAltiumArrayBuffer resolves the sample solace sheet to A3', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
})

/**
 * Verifies solace-sheet off-sheet ports keep the same pointed side Altium uses
 * when explicit port style is omitted from the stored record.
 */
test('parseAltiumArrayBuffer infers solace-sheet port direction from connectivity', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()
    const resolveDirection = (name) =>
        documentModel.schematic.ports.find((port) => port.name === name)
            ?.direction

    assert.equal(resolveDirection('AURA_RST'), 'left')
    assert.equal(resolveDirection('SIGIL_SEL'), 'left')
    assert.equal(resolveDirection('EMBER_RST'), 'left')
    assert.equal(resolveDirection('EMBER_SENSE'), 'right')
})

/**
 * Verifies style-4 off-sheet ports preserve their vertical up/down direction
 * so the renderer can rotate the callout geometry instead of forcing a
 * horizontal left/right symbol.
 */
test('parseAltiumArrayBuffer infers vertical style-4 port direction from connectivity', async () => {
    const solaceDocument = await AltiumFixtureLoader.parseSolaceSheet()
    const bastionDocument = await AltiumFixtureLoader.parseBastionSheet()
    const mc1 = solaceDocument.schematic.ports.find(
        (port) => port.name === 'GLYPH_1' && port.x === 475 && port.y === 150
    )
    const mc0 = bastionDocument.schematic.ports.find(
        (port) => port.name === 'GLYPH_0' && port.x === 910 && port.y === 650
    )

    assert.deepEqual(
        {
            x: mc1?.x,
            y: mc1?.y,
            width: mc1?.width,
            height: mc1?.height,
            direction: mc1?.direction
        },
        {
            x: 475,
            y: 150,
            width: 30,
            height: 10,
            direction: 'down'
        }
    )
    assert.deepEqual(
        {
            x: mc0?.x,
            y: mc0?.y,
            width: mc0?.width,
            height: mc0?.height,
            direction: mc0?.direction
        },
        {
            x: 910,
            y: 650,
            width: 25,
            height: 10,
            direction: 'up'
        }
    )
})

/**
 * Verifies record-26 bus trunks on the solace sheet survive normalization so
 * grouped net routes render instead of disappearing entirely.
 */
test('parseAltiumArrayBuffer preserves solace-sheet bus trunks', async () => {
    const documentModel = await AltiumFixtureLoader.parseSolaceSheet()

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
 * Verifies the lyra sheet keeps only the active multipart U2 sections,
 * preserving one label per visible section and snapping back to A3.
 */
test('parseAltiumArrayBuffer restores active multipart sections on the lyra sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const u2Pins = documentModel.schematic.pins.filter((pin) =>
        ['1672', '2172', '3833'].includes(pin.ownerIndex)
    )
    const sectionLabels = documentModel.schematic.texts.filter((text) =>
        [
            'Rune Gate',
            'Cinder Well',
            'Lyra / Echo',
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
        ['Cinder Well', 'Lyra / Echo', 'Rune Gate']
    )
})

/**
 * Verifies aether-sheet component texts anchor according to their owner
 * geometry instead of using one blanket rule for every designator.
 */
test('parseAltiumArrayBuffer anchors aether-sheet component texts from owner geometry', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
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
 * Verifies bastion-sheet multipart designators keep side-aware anchors on the
 * reduced fake resistor sections.
 */
test('parseAltiumArrayBuffer keeps side-aware resistor designators aligned on the bastion sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseBastionSheet()
    const anchors = documentModel.schematic.texts
        .filter(
            (text) => ['Q51', 'Q56'].includes(text.text)
        )
        .map((text) => ({
            text: text.text,
            ownerIndex: String(text.ownerIndex || ''),
            anchor: text.anchor
        }))
        .sort(
            (left, right) =>
                left.ownerIndex.localeCompare(right.ownerIndex) ||
                left.text.localeCompare(right.text)
        )

    assert.deepEqual(anchors, [
        { text: 'Q51', ownerIndex: '2891', anchor: 'end' },
        { text: 'Q56', ownerIndex: '2953', anchor: 'start' }
    ])
})

/**
 * Verifies the multipart resistor stack keeps the active suffixes on the
 * repeated bastion-sheet sections while leaving the single connector
 * designator unsuffixed.
 */
test('parseAltiumArrayBuffer resolves multipart designators without suffixing the bastion-sheet connector', async () => {
    const documentModel = await AltiumFixtureLoader.parseBastionSheet()
    const designators = documentModel.schematic.texts
        .filter(
            (text) =>
                ['4010', '4050', '4088', '4126', '4164'].includes(
                    String(text.ownerIndex || '')
                ) && text.name === 'Designator'
        )
        .map((text) => ({
            ownerIndex: String(text.ownerIndex || ''),
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) => left.ownerIndex.localeCompare(right.ownerIndex))

    assert.deepEqual(designators, [
        { ownerIndex: '4010', text: 'Q92B', anchor: 'end' },
        { ownerIndex: '4050', text: 'Q92A', anchor: 'end' },
        { ownerIndex: '4088', text: 'Q92C', anchor: 'end' },
        { ownerIndex: '4126', text: 'Q92D', anchor: 'end' },
        { ownerIndex: '4164', text: 'P4', anchor: 'start' }
    ])
    assert.equal(
        documentModel.schematic.texts.some((text) => text.text === 'P4A'),
        false
    )
})

/**
 * Verifies each multipart bastion-sheet owner keeps only its active pin pair
 * instead of rendering all four overlapping owner-part variants.
 */
test('parseAltiumArrayBuffer keeps only active multipart resistor pin pairs on the bastion sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseBastionSheet()
    const pinGroups = ['4010', '4050', '4088', '4126'].map((ownerIndex) => ({
        ownerIndex,
        pins: documentModel.schematic.pins
            .filter((pin) => pin.ownerIndex === ownerIndex)
            .map((pin) => ({
                designator: pin.designator,
                labelMode: pin.labelMode
            }))
            .sort(
                (left, right) =>
                    Number(left.designator) - Number(right.designator)
            )
    }))

    assert.deepEqual(pinGroups, [
        {
            ownerIndex: '4010',
            pins: [
                { designator: '2', labelMode: 'number-only' },
                { designator: '7', labelMode: 'number-only' }
            ]
        },
        {
            ownerIndex: '4050',
            pins: [
                { designator: '1', labelMode: 'number-only' },
                { designator: '8', labelMode: 'number-only' }
            ]
        },
        {
            ownerIndex: '4088',
            pins: [
                { designator: '3', labelMode: 'number-only' },
                { designator: '6', labelMode: 'number-only' }
            ]
        },
        {
            ownerIndex: '4126',
            pins: [
                { designator: '4', labelMode: 'number-only' },
                { designator: '5', labelMode: 'number-only' }
            ]
        }
    ])
})

/**
 * Verifies the reduced lyra resistor designator keeps its left-side owner
 * anchor instead of flipping across the body.
 */
test('parseAltiumArrayBuffer keeps the lyra left-side resistor designator aligned', async () => {
    const documentModel = await AltiumFixtureLoader.parseLyraSheet()
    const anchors = documentModel.schematic.texts
        .filter(
            (text) => text.text === 'R11' && text.ownerIndex === '1461'
        )
        .map((text) => ({
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(anchors, [{ text: 'R11', anchor: 'end' }])
})

/**
 * Verifies gate designators on the aether sheet sit just above the symbol
 * body instead of touching its outline.
 */
test('parseAltiumArrayBuffer pads aether gate designators above the body', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const designators = documentModel.schematic.texts
        .filter((text) => ['K29', 'K31'].includes(text.text))
        .map((text) => ({
            text: text.text,
            y: text.y,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(designators, [
        { text: 'K29', y: 224, anchor: 'start' },
        { text: 'K31', y: 234, anchor: 'start' }
    ])
})

/**
 * Verifies bottom-side connector designators on the aether sheet keep their
 * original left-to-right anchor instead of being pulled left under the body.
 */
test('parseAltiumArrayBuffer keeps aether bottom connector designators left-to-right', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const designator = documentModel.schematic.texts.find(
        (text) => text.text === 'P5'
    )

    assert.deepEqual(
        {
            text: designator?.text,
            x: designator?.x,
            y: designator?.y,
            anchor: designator?.anchor
        },
        {
            text: 'P5',
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
test('parseAltiumArrayBuffer keeps component-connected wire labels readable on the aether sheet', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()
    const anchors = documentModel.schematic.texts
        .filter(
            (text) =>
                (text.text === 'VEIL_RST' &&
                    text.x === 245 &&
                    text.y === 545) ||
                (text.text === 'WYRN_SEND' && text.x === 630 && text.y === 475) ||
                (text.text === 'WYRN_ECHO' && text.x === 630 && text.y === 445) ||
                (text.text === 'WYRN_INIT' &&
                    text.x === 630 &&
                    text.y === 435) ||
                (text.text === 'NOVA_SEND' && text.x === 760 && text.y === 535)
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
        { text: 'VEIL_RST', x: 245, anchor: 'end' },
        { text: 'WYRN_ECHO', x: 630, anchor: 'start' },
        { text: 'WYRN_INIT', x: 630, anchor: 'start' },
        { text: 'WYRN_SEND', x: 630, anchor: 'start' },
        { text: 'NOVA_SEND', x: 760, anchor: 'start' }
    ])
})

/**
 * Verifies the aether sheet keeps the Q12 diode body polygon as drawable
 * line segments so the symbol triangle is visible.
 */
test('parseAltiumArrayBuffer preserves the aether-sheet Q12 diode triangle', async () => {
    const documentModel = await AltiumFixtureLoader.parseAetherSheet()

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
 * Verifies the boot-strap region keeps its centered note text, preserves
 * the visible same-row wire labels, and normalizes the mixed-direction
 * off-sheet port stack.
 */
test(
    'parseAltiumArrayBuffer normalizes the bastion-sheet dawn-sigil note and off-sheet ports',
    async () => {
        const documentModel = await AltiumFixtureLoader.parseBastionSheet()
        const bootNote = documentModel.schematic.texts.find(
            (text) => text.text === 'Needed for Dawn Sigil!'
        )
        const dashedFrameBounds = documentModel.schematic.lines
            .filter((line) => Number(line.lineStyle || 0) === 1)
            .reduce(
                (bounds, line) => ({
                    minX: Math.min(bounds.minX, line.x1, line.x2),
                    minY: Math.min(bounds.minY, line.y1, line.y2),
                    maxX: Math.max(bounds.maxX, line.x1, line.x2),
                    maxY: Math.max(bounds.maxY, line.y1, line.y2)
                }),
                {
                    minX: Number.POSITIVE_INFINITY,
                    minY: Number.POSITIVE_INFINITY,
                    maxX: Number.NEGATIVE_INFINITY,
                    maxY: Number.NEGATIVE_INFINITY
                }
            )
        const portStack = documentModel.schematic.ports
            .filter(
                (port) =>
                    ['AURA_IRQ', 'AURA_CS', 'GLYPH_CS'].includes(port.name) &&
                    port.x === 280
            )
            .sort((left, right) => left.y - right.y)
        const wireSidePortTexts = documentModel.schematic.texts.filter(
            (text) =>
                text.recordType === '25' &&
                ['AURA_IRQ', 'AURA_CS', 'GLYPH_CS'].includes(text.text) &&
                text.x === 340
        ).sort((left, right) => left.y - right.y)

        assert.deepEqual(
            {
                text: bootNote?.text,
                x: bootNote?.x,
                y: bootNote?.y,
                anchor: bootNote?.anchor
            },
            {
                text: 'Needed for Dawn Sigil!',
                x: 349,
                y: 576,
                anchor: 'middle'
            }
        )
        assert.deepEqual(dashedFrameBounds, {
            minX: 289,
            minY: 524,
            maxX: 409,
            maxY: 590
        })
        assert.deepEqual(
            portStack.map((port) => ({
                name: port.name,
                x: port.x,
                y: port.y,
                direction: port.direction
            })),
            [
                { name: 'AURA_IRQ', x: 280, y: 470, direction: 'right' },
                { name: 'AURA_CS', x: 280, y: 480, direction: 'right' },
                { name: 'GLYPH_CS', x: 280, y: 490, direction: 'left' }
            ]
        )
        assert.deepEqual(
            wireSidePortTexts.map((text) => ({
                text: text.text,
                x: text.x,
                y: text.y,
                anchor: text.anchor
            })),
            [
                { text: 'AURA_IRQ', x: 340, y: 470, anchor: 'start' },
                { text: 'AURA_CS', x: 340, y: 480, anchor: 'start' },
                { text: 'GLYPH_CS', x: 340, y: 490, anchor: 'start' }
            ]
        )
    }
)

/**
 * Verifies the reduced embedded PCB fixture still exposes outline, layers,
 * placement data, and a grouped BOM row.
 */
test('parseAltiumArrayBuffer parses an embedded fake PcbDoc sample', async () => {
    const documentModel = await AltiumFixtureLoader.parsePcb()

    assert.equal(documentModel.kind, 'pcb')
    assert.equal(documentModel.fileType, 'PcbDoc')
    assert.equal(documentModel.pcb.boardOutline.segments.length, 5)
    assert.equal(documentModel.pcb.layers.length, 4)
    assert.equal(documentModel.pcb.components.length, 1)
    assert.equal(documentModel.bom.length, 1)
    assert.deepEqual(documentModel.pcb.components[0], {
        designator: 'J1',
        x: 900,
        y: 500,
        layer: 'BOTTOM',
        pattern: 'HDR-6',
        rotation: 180,
        source: 'CON/FAKE/HDR-6',
        description: 'Oracle header',
        height: 40
    })
})
