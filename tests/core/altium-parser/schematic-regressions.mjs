import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

/**
 * Verifies left-side designators on horizontal two-pin passives keep their
 * original left-to-right anchor when the same owner already exposes a visible
 * value on the opposite side.
 */
test('parseAltiumArrayBuffer keeps horizontal passive designators left-to-right beside visible values', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1000|CustomY=500|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=13|OwnerIndex=100|Location.X=202|Location.Y=200|Corner.X=200|Corner.Y=200|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=205|Location.Y=206|Corner.X=202|Corner.Y=200|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=211|Location.Y=194|Corner.X=205|Corner.Y=206|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=217|Location.Y=206|Corner.X=211|Corner.Y=194|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=223|Location.Y=194|Corner.X=217|Corner.Y=206|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=229|Location.Y=206|Corner.X=223|Corner.Y=194|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=235|Location.Y=194|Corner.X=229|Corner.Y=206|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=237|Location.Y=200|Corner.X=235|Corner.Y=194|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=100|Location.X=240|Location.Y=200|Corner.X=237|Corner.Y=200|Color=8388608|LineWidth=1',
        '|RECORD=2|OwnerIndex=100|OwnerPartId=1|PinConglomerate=58|PinLength=10|Location.X=200|Location.Y=200|Designator=1',
        '|RECORD=2|OwnerIndex=100|OwnerPartId=1|PinConglomerate=56|PinLength=10|Location.X=240|Location.Y=200|Designator=2',
        '|RECORD=34|OwnerIndex=100|Location.X=180|Location.Y=200|Color=8388608|FontID=1|Text=R1|Name=Designator',
        '|RECORD=41|OwnerIndex=100|Location.X=245|Location.Y=200|Color=8388608|FontID=1|Text=22R|Name=VALUE',
        '|RECORD=13|OwnerIndex=200|Location.X=302|Location.Y=200|Corner.X=300|Corner.Y=200|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=305|Location.Y=206|Corner.X=302|Corner.Y=200|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=311|Location.Y=194|Corner.X=305|Corner.Y=206|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=317|Location.Y=206|Corner.X=311|Corner.Y=194|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=323|Location.Y=194|Corner.X=317|Corner.Y=206|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=329|Location.Y=206|Corner.X=323|Corner.Y=194|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=335|Location.Y=194|Corner.X=329|Corner.Y=206|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=337|Location.Y=200|Corner.X=335|Corner.Y=194|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=200|Location.X=340|Location.Y=200|Corner.X=337|Corner.Y=200|Color=8388608|LineWidth=1',
        '|RECORD=2|OwnerIndex=200|OwnerPartId=1|PinConglomerate=58|PinLength=10|Location.X=300|Location.Y=200|Designator=1',
        '|RECORD=2|OwnerIndex=200|OwnerPartId=1|PinConglomerate=56|PinLength=10|Location.X=340|Location.Y=200|Designator=2',
        '|RECORD=34|OwnerIndex=200|Location.X=280|Location.Y=200|Color=8388608|FontID=1|Text=R2|Name=Designator',
        '|RECORD=2|OwnerIndex=300|OwnerPartId=1|PinConglomerate=59|PinLength=10|Location.X=430|Location.Y=150|Designator=1',
        '|RECORD=2|OwnerIndex=300|OwnerPartId=1|PinConglomerate=57|PinLength=10|Location.X=430|Location.Y=190|Designator=2',
        '|RECORD=13|OwnerIndex=300|Location.X=430|Location.Y=152|Corner.X=430|Corner.Y=150|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=424|Location.Y=155|Corner.X=430|Corner.Y=152|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=436|Location.Y=161|Corner.X=424|Corner.Y=155|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=424|Location.Y=167|Corner.X=436|Corner.Y=161|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=436|Location.Y=173|Corner.X=424|Corner.Y=167|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=424|Location.Y=179|Corner.X=436|Corner.Y=173|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=436|Location.Y=185|Corner.X=424|Corner.Y=179|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=430|Location.Y=187|Corner.X=436|Corner.Y=185|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=300|Location.X=430|Location.Y=190|Corner.X=430|Corner.Y=187|Color=8388608|LineWidth=1',
        '|RECORD=34|OwnerIndex=300|Location.X=410|Location.Y=170|Color=8388608|FontID=1|Text=R3|Name=Designator'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'owner-side-passive-labels.SchDoc',
        arrayBuffer
    )
    const anchors = documentModel.schematic.texts
        .filter((text) => ['R1', 'R2', 'R3'].includes(text.text))
        .map((text) => ({
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(anchors, [
        { text: 'R1', anchor: 'start' },
        { text: 'R2', anchor: 'end' },
        { text: 'R3', anchor: 'end' }
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
 * Verifies solid record-7 polygons stay available as polygon primitives while
 * preserving their closed outline segments for existing symbol logic.
 */
test('parseAltiumArrayBuffer preserves solid schematic polygons and outline lines', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=400|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=7|OwnerIndex=500|LocationCount=3|IsSolid=T|Transparent=F|Color=16711680' +
            '|AreaColor=128|LineWidth=1|X1=100|Y1=120|X2=116|Y2=120|X3=108|Y3=136'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'solid-polygon-fill.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.polygons, [
        {
            points: [
                { x: 100, y: 120 },
                { x: 116, y: 120 },
                { x: 108, y: 136 }
            ],
            color: '#0000ff',
            fill: '#800000',
            isSolid: true,
            transparent: false,
            lineWidth: 1,
            ownerIndex: '500'
        }
    ])
    assert.equal(
        documentModel.schematic.lines.filter((line) => line.ownerIndex === '500')
            .length,
        3
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
