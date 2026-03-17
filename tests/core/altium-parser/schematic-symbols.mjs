import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

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
