import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

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
 * Verifies standard-style sheets still snap to the footer-implied A3 page
 * even when the visible schematic content stops well left of the title block.
 */
test('parseAltiumArrayBuffer keeps footer-driven A3 sizing when content is narrower than the footer', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|SheetStyle=1|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=14|FontName2=Times New Roman|Bold2=T|Rotation2=0' +
            '|RECORD=4|Location.X=1262|Location.Y=1017|Color=8388608|FontID=1|Text=SIG_OUT' +
            '|RECORD=4|Location.X=1225|Location.Y=75|Color=8388608|FontID=2|Text=EMBER-UNIT Power' +
            '|RECORD=4|Location.X=1420|Location.Y=80|Color=255|FontID=2|Text=CORE-MOD' +
            '|RECORD=4|Location.X=1455|Location.Y=50|Color=8388608|FontID=1|Text=03' +
            '|RECORD=4|Location.X=1405|Location.Y=30|Color=8388608|FontID=1|Text=2' +
            '|RECORD=4|Location.X=1435|Location.Y=30|Color=8388608|FontID=1|Text=7'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'footer-width-bias.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.paperSize, 'A3')
    assert.equal(documentModel.schematic.sheet.width, 1654)
    assert.equal(documentModel.schematic.sheet.height, 1169)
    assert.equal(documentModel.schematic.sheet.xZones, 8)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1500)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 950)
})

/**
 * Verifies custom-style sheets keep their declared page size even when the
 * visible drawing occupies only one smaller region of the authored page.
 */
test('parseAltiumArrayBuffer keeps declared custom sheet size for non-standard style sheets', () => {
    const arrayBuffer = new TextEncoder().encode(
        '|HEADER=Schematic Document' +
            '|RECORD=31|CustomX=1500|CustomY=950|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=T|TitleBlockOn=T|CustomMarginWidth=20|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|RECORD=4|Location.X=760|Location.Y=511|Color=8388608|FontID=1|Text=USB_D_N' +
            '|RECORD=18|Location.X=816|Location.Y=511|Name=USB_D_N|Width=65|Height=10|Color=8388608|AreaColor=65535'
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'custom-sheet-size.SchDoc',
        arrayBuffer
    )

    assert.equal(documentModel.schematic.sheet.width, 1500)
    assert.equal(documentModel.schematic.sheet.height, 950)
    assert.equal(documentModel.schematic.sheet.sourceWidth, 1500)
    assert.equal(documentModel.schematic.sheet.sourceHeight, 950)
    assert.equal(documentModel.schematic.sheet.xZones, 4)
    assert.equal(documentModel.schematic.sheet.yZones, 4)
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
