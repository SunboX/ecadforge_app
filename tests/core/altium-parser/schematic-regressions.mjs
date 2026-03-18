import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumFixtureLoader } from '../../fixtures/AltiumFixtureLoader.mjs'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

const RECORD_11_ARC_RECORDS = [
    '|HEADER=Schematic Document',
    '|RECORD=31|CustomX=400|CustomY=250|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
    '|RECORD=11|OwnerIndex=800|OwnerPartId=1|IndexInSheet=1|Location.X=110|Location.Y=120|Radius=5|SecondaryRadius=5|LineWidth=1|StartAngle=90.000|EndAngle=180.000|Color=16711680',
    '|RECORD=11|OwnerIndex=800|OwnerPartId=1|IndexInSheet=2|Location.X=110|Location.Y=120|Radius=5|SecondaryRadius=5|LineWidth=1|EndAngle=90.000|Color=16711680',
    '|RECORD=11|OwnerIndex=800|OwnerPartId=1|IndexInSheet=3|Location.X=120|Location.Y=120|Radius=5|SecondaryRadius=5|LineWidth=1|StartAngle=90.000|EndAngle=180.000|Color=16711680',
    '|RECORD=11|OwnerIndex=800|OwnerPartId=1|IndexInSheet=4|Location.X=120|Location.Y=120|Radius=5|SecondaryRadius=5|LineWidth=1|EndAngle=90.000|Color=16711680',
    '|RECORD=2|OwnerIndex=800|OwnerPartId=1|PinConglomerate=58|PinLength=10|Location.X=105|Location.Y=120|Designator=1',
    '|RECORD=2|OwnerIndex=800|OwnerPartId=1|PinConglomerate=56|PinLength=10|Location.X=125|Location.Y=120|Designator=2',
    '|RECORD=34|OwnerIndex=800|Location.X=105|Location.Y=125|Color=8388608|FontID=1|Text=L1|Name=Designator',
    '|RECORD=41|OwnerIndex=800|Location.X=130|Location.Y=120|Color=8388608|FontID=1|Text=4.7uH|Name=Value',
    '|RECORD=11|OwnerIndex=820|OwnerPartId=1|IndexInSheet=5|Location.X=220|Location.Y=150|Radius=5|SecondaryRadius=4|LineWidth=1|StartAngle=180.000|Color=16711680',
    '|RECORD=11|OwnerIndex=820|OwnerPartId=1|IndexInSheet=6|Location.X=220|Location.Y=130|Radius=5|SecondaryRadius=4|LineWidth=1|EndAngle=180.000|Color=16711680'
]

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
 * Verifies vertical two-pin passives keep a left-side designator aligned with
 * the same owner-side value stack even when that value sits above the body.
 */
test('parseAltiumArrayBuffer keeps stacked vertical passive designators left-to-right', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=1000|CustomY=500|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=2|OwnerIndex=400|OwnerPartId=1|PinConglomerate=59|PinLength=10|Location.X=530|Location.Y=150|Designator=1',
        '|RECORD=2|OwnerIndex=400|OwnerPartId=1|PinConglomerate=57|PinLength=10|Location.X=530|Location.Y=190|Designator=2',
        '|RECORD=13|OwnerIndex=400|Location.X=530|Location.Y=152|Corner.X=530|Corner.Y=150|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=524|Location.Y=155|Corner.X=530|Corner.Y=152|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=536|Location.Y=161|Corner.X=524|Corner.Y=155|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=524|Location.Y=167|Corner.X=536|Corner.Y=161|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=536|Location.Y=173|Corner.X=524|Corner.Y=167|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=524|Location.Y=179|Corner.X=536|Corner.Y=173|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=536|Location.Y=185|Corner.X=524|Corner.Y=179|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=530|Location.Y=187|Corner.X=536|Corner.Y=185|Color=8388608|LineWidth=1',
        '|RECORD=13|OwnerIndex=400|Location.X=530|Location.Y=190|Corner.X=530|Corner.Y=187|Color=8388608|LineWidth=1',
        '|RECORD=34|OwnerIndex=400|Location.X=510|Location.Y=170|Color=8388608|FontID=1|Text=C7|Name=Designator|IsMirrored=T',
        '|RECORD=41|OwnerIndex=400|Location.X=510|Location.Y=130|Color=8388608|FontID=1|Text=100uF|Name=VALUE'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'stacked-vertical-passive-labels.SchDoc',
        arrayBuffer
    )
    const anchors = documentModel.schematic.texts
        .filter((text) => ['C7', '100uF'].includes(text.text))
        .map((text) => ({
            text: text.text,
            anchor: text.anchor
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(anchors, [
        { text: '100uF', anchor: 'start' },
        { text: 'C7', anchor: 'start' }
    ])
})

/**
 * Verifies op-amp style multipart owners keep only their active section when
 * the component placement sits inside the enclosing owner bounds rather than
 * on one of the current part-corner anchor candidates.
 */
test('parseAltiumArrayBuffer filters inactive op-amp multipart sections by owner bounds', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=350|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
        '|RECORD=1|LibReference=IC/AMP/QUAD-DEMO|PartCount=6|IndexInSheet=62|OwnerPartId=-1' +
            '|Location.X=215|Location.Y=265|IsMirrored=T|Orientation=2|CurrentPartId=3|UniqueID=DEMOOP03',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=48|PinLength=20|Location.X=275|Location.Y=255|Name=OUT1|Designator=1',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=58|PinLength=20|Location.X=215|Location.Y=245|Name=-|Designator=2',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=58|PinLength=20|Location.X=215|Location.Y=265|Name=+|Designator=3',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=1|LineWidth=1|Color=11796480|LocationCount=5' +
            '|X1=215|Y1=285|X2=215|Y2=225|X3=255|Y3=245|X4=275|Y4=255|X5=215|Y5=285',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=2|PinConglomerate=48|PinLength=20|Location.X=275|Location.Y=250|Name=OUT2|Designator=4',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=2|PinConglomerate=58|PinLength=20|Location.X=215|Location.Y=240|Name=-|Designator=5',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=2|PinConglomerate=58|PinLength=20|Location.X=215|Location.Y=260|Name=+|Designator=6',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=2|LineWidth=1|Color=11796480|LocationCount=5' +
            '|X1=215|Y1=280|X2=215|Y2=220|X3=255|Y3=240|X4=275|Y4=250|X5=215|Y5=280',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=3|PinConglomerate=48|PinLength=20|Location.X=270|Location.Y=250|Name=OUT3|Designator=8',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=3|PinConglomerate=58|PinLength=20|Location.X=210|Location.Y=240|Name=-|Designator=9',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=3|PinConglomerate=58|PinLength=20|Location.X=210|Location.Y=260|Name=+|Designator=10',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=3|LineWidth=1|Color=11796480|LocationCount=5' +
            '|X1=210|Y1=280|X2=210|Y2=220|X3=250|Y3=240|X4=270|Y4=250|X5=210|Y5=280',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=4|PinConglomerate=48|PinLength=20|Location.X=260|Location.Y=250|Name=OUT4|Designator=11',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=4|PinConglomerate=58|PinLength=20|Location.X=200|Location.Y=240|Name=-|Designator=12',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=4|PinConglomerate=58|PinLength=20|Location.X=200|Location.Y=260|Name=+|Designator=13',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=4|LineWidth=1|Color=11796480|LocationCount=5' +
            '|X1=200|Y1=280|X2=200|Y2=220|X3=240|Y3=240|X4=260|Y4=250|X5=200|Y5=280',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=5|PinConglomerate=49|PinLength=20|Location.X=255|Location.Y=255|Name=V-|Designator=14',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=5|PinConglomerate=51|PinLength=20|Location.X=255|Location.Y=215|Name=V+|Designator=7',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=5|LineWidth=1|Color=11796480|LocationCount=5' +
            '|X1=235|Y1=265|X2=235|Y2=205|X3=275|Y3=225|X4=295|Y4=235|X5=235|Y5=265',
        '|RECORD=4|OwnerIndex=700|OwnerPartId=5|Location.X=250|Location.Y=225|Orientation=2|Justification=2|Color=8388608|FontID=1|Text=V+|IsMirrored=T',
        '|RECORD=4|OwnerIndex=700|OwnerPartId=5|Location.X=250|Location.Y=255|Orientation=2|Justification=2|Color=8388608|FontID=1|Text=V-|IsMirrored=T',
        '|RECORD=34|OwnerIndex=700|OwnerPartId=-1|Location.X=214|Location.Y=286|Color=8388608|FontID=1|Text=Q7|Name=Designator|IsMirrored=T',
        '|RECORD=41|OwnerIndex=700|OwnerPartId=-1|Location.X=214|Location.Y=214|Color=8388608|FontID=1|Text=AMP-DEMO|Name=Value|IsMirrored=T'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'multipart-owner-bounds-opamp.SchDoc',
        arrayBuffer
    )
    const ownerPins = documentModel.schematic.pins
        .filter((pin) => pin.ownerIndex === '700')
        .map((pin) => ({
            designator: pin.designator,
            name: pin.name
        }))
        .sort((left, right) => Number(left.designator) - Number(right.designator))
    const leakedPowerTexts = documentModel.schematic.texts
        .filter(
            (text) =>
                text.ownerIndex === '700' &&
                ['V+', 'V-'].includes(text.text)
        )
        .map((text) => text.text)
        .sort((left, right) => left.localeCompare(right))

    assert.deepEqual(ownerPins, [
        { designator: '8', name: 'OUT3' },
        { designator: '9', name: '-' },
        { designator: '10', name: '+' }
    ])
    assert.equal(
        documentModel.schematic.lines.filter((line) => line.ownerIndex === '700')
            .length,
        4
    )
    assert.deepEqual(leakedPowerTexts, [])
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
            renderOrder: 0,
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
 * Verifies record-11 owner curves normalize into drawable arcs, including
 * quarter loops that omit StartAngle and ellipse segments that omit EndAngle.
 */
test('parseAltiumArrayBuffer preserves record-11 owner curves as schematic arcs', () => {
    const arrayBuffer = new TextEncoder().encode(
        RECORD_11_ARC_RECORDS.join('')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'record-11-owner-curves.SchDoc',
        arrayBuffer
    )

    assert.deepEqual(documentModel.schematic.arcs, [
        {
            x: 110,
            y: 120,
            radius: 5,
            radiusY: 5,
            startAngle: 90,
            endAngle: 180,
            color: '#0000ff',
            width: 1,
            renderOrder: 1,
            ownerIndex: '800'
        },
        {
            x: 110,
            y: 120,
            radius: 5,
            radiusY: 5,
            startAngle: 0,
            endAngle: 90,
            color: '#0000ff',
            width: 1,
            renderOrder: 2,
            ownerIndex: '800'
        },
        {
            x: 120,
            y: 120,
            radius: 5,
            radiusY: 5,
            startAngle: 90,
            endAngle: 180,
            color: '#0000ff',
            width: 1,
            renderOrder: 3,
            ownerIndex: '800'
        },
        {
            x: 120,
            y: 120,
            radius: 5,
            radiusY: 5,
            startAngle: 0,
            endAngle: 90,
            color: '#0000ff',
            width: 1,
            renderOrder: 4,
            ownerIndex: '800'
        },
        {
            x: 220,
            y: 150,
            radius: 5,
            radiusY: 4,
            startAngle: 180,
            endAngle: 360,
            color: '#0000ff',
            width: 1,
            renderOrder: 5,
            ownerIndex: '820'
        },
        {
            x: 220,
            y: 130,
            radius: 5,
            radiusY: 4,
            startAngle: 0,
            endAngle: 180,
            color: '#0000ff',
            width: 1,
            renderOrder: 6,
            ownerIndex: '820'
        }
    ])
})

/**
 * Verifies record-11 owner curves render with their ellipse radii instead of
 * disappearing or collapsing to circular arc paths.
 */
test('renderSchematicSvg renders record-11 owner curves as visible SVG arcs', () => {
    const arrayBuffer = new TextEncoder().encode(
        RECORD_11_ARC_RECORDS.join('')
    ).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'record-11-owner-curves.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)

    assert.equal((markup.match(/class="schematic-arc"/g) || []).length, 6)
    assert.match(
        markup,
        /<path class="schematic-arc" d="M 215 [0-9.]+ A 5 4 0 0 0 225 [0-9.]+" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" fill="none" \/>/
    )
    assert.match(
        markup,
        /<path class="schematic-arc" d="M 225 [0-9.]+ A 5 4 0 0 0 215 [0-9.]+" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" fill="none" \/>/
    )
})

/**
 * Verifies circle-bodied symbols keep their record-8 outline, preserve
 * mirrored owner-text metadata, and avoid duplicate synthetic pin-name
 * letters when explicit owner text already provides them.
 */
test('parseAltiumArrayBuffer keeps record-8 symbol circles and avoids duplicate explicit pin-name labels', () => {
    const records = [
        '|HEADER=Schematic Document',
        '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
            '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
            '|FontIdCount=2|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0' +
            '|Size2=10|FontName2=Times New Roman|Bold2=F|Rotation2=90',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=200|Location.Y=169|Corner.X=200|Corner.Y=175|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=200|Location.Y=175|Corner.X=225|Corner.Y=175|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=221|Location.Y=180|Corner.X=227|Corner.Y=180|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=214|Location.Y=180|Corner.X=214|Corner.Y=200|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=214|Location.Y=200|Corner.X=189|Corner.Y=200|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=203|Location.Y=180|Corner.X=203|Corner.Y=200|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=224|Location.Y=180|Corner.X=224|Corner.Y=200|LineWidth=1|Color=16711680',
        '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=224|Location.Y=200|Corner.X=241|Corner.Y=200|LineWidth=1|Color=16711680',
        '|RECORD=7|OwnerIndex=700|OwnerPartId=1|LineWidth=1|Color=16711680|AreaColor=16711680|IsSolid=T|LocationCount=3' +
            '|X1=214|Y1=200|X2=217|Y2=193|X3=211|Y3=193',
        '|RECORD=7|OwnerIndex=700|OwnerPartId=1|LineWidth=1|Color=16711680|AreaColor=16711680|IsSolid=T|LocationCount=3' +
            '|X1=217|Y1=205|X2=217|Y2=213|X3=210|Y3=209',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=1|LineWidth=1|Color=16711680|LocationCount=2|X1=210|Y1=213|X2=210|Y2=205',
        '|RECORD=6|OwnerIndex=700|OwnerPartId=1|LineWidth=1|Color=16711680|LocationCount=4|X1=227|Y1=200|X2=227|Y2=209|X3=200|Y3=209|X4=200|Y4=200',
        '|RECORD=8|OwnerIndex=700|OwnerPartId=1|Location.X=214|Location.Y=193|Radius=24|SecondaryRadius=24|LineWidth=1|Color=16711680|AreaColor=16777215|Transparent=T',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=51|PinLength=9|Location.X=200|Location.Y=169|Name=G|Designator=1',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=50|PinLength=9|Location.X=189|Location.Y=200|Name=S|Designator=2',
        '|RECORD=2|OwnerIndex=700|OwnerPartId=1|PinConglomerate=48|PinLength=9|Location.X=241|Location.Y=200|Name=D|Designator=3',
        '|RECORD=4|OwnerIndex=700|OwnerPartId=1|Location.X=191|Location.Y=173|Orientation=3|FontID=2|Text=G|IsMirrored=T',
        '|RECORD=4|OwnerIndex=700|OwnerPartId=1|Location.X=236|Location.Y=210|Orientation=3|FontID=2|Text=D|IsMirrored=T',
        '|RECORD=4|OwnerIndex=700|OwnerPartId=1|Location.X=181|Location.Y=207|Orientation=3|FontID=2|Text=S|IsMirrored=T',
        '|RECORD=34|OwnerIndex=700|Location.X=181|Location.Y=217|Color=8388608|FontID=1|Text=Q7|Name=Designator',
        '|RECORD=41|OwnerIndex=700|Location.X=205|Location.Y=160|Color=8388608|FontID=1|Text=PMOS-3|Name=Value'
    ]
    const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
    const documentModel = AltiumParser.parseArrayBuffer(
        'symbol-circle-owner-text.SchDoc',
        arrayBuffer
    )
    const markup = SchematicSvgRenderer.render(documentModel)
    const mirroredOwnerTexts = documentModel.schematic.texts
        .filter((text) => ['G', 'S', 'D'].includes(text.text))
        .map((text) => ({
            text: text.text,
            rotation: text.rotation,
            sourceOrientation: text.sourceOrientation,
            isMirrored: text.isMirrored
        }))
        .sort((left, right) => left.text.localeCompare(right.text))

    assert.deepEqual(documentModel.schematic.ellipses, [
        {
            x: 214,
            y: 193,
            radiusX: 24,
            radiusY: 24,
            color: '#0000ff',
            fill: '#ffffff',
            isSolid: false,
            transparent: true,
            lineWidth: 1,
            renderOrder: 0,
            ownerIndex: '700'
        }
    ])
    assert.deepEqual(mirroredOwnerTexts, [
        {
            text: 'D',
            rotation: 90,
            sourceOrientation: 3,
            isMirrored: true
        },
        {
            text: 'G',
            rotation: 90,
            sourceOrientation: 3,
            isMirrored: true
        },
        {
            text: 'S',
            rotation: 90,
            sourceOrientation: 3,
            isMirrored: true
        }
    ])
    assert.match(
        markup,
        /<ellipse class="schematic-ellipse" cx="214" cy="64" rx="24" ry="24" fill="none" stroke="var\(--schematic-accent-ink-color\)" stroke-width="1" \/>/
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="200" y="84" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 200 84\)">G</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="189" y="50" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 189 50\)">S</
    )
    assert.match(
        markup,
        /<text class="schematic-label" x="241" y="47" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 241 47\)">D</
    )
    assert.equal((markup.match(/class="schematic-pin-name"/g) || []).length, 0)
    assert.equal((markup.match(/>G<\/text>/g) || []).length, 1)
    assert.equal((markup.match(/>S<\/text>/g) || []).length, 1)
    assert.equal((markup.match(/>D<\/text>/g) || []).length, 1)
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="198" y="95" fill="var\(--schematic-text-color\)" text-anchor="middle" font-size="9" font-family="Times New Roman" font-weight="400" transform="rotate\(-90 198 95\)">1</
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="179" y="56" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">2</
    )
    assert.match(
        markup,
        /<text class="schematic-pin-number" x="248" y="56" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">3</
    )
    assert.equal((markup.match(/class="schematic-pin-number"/g) || []).length, 3)
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
 * Verifies free text strings decode Altium justification codes into the
 * correct horizontal text anchor instead of treating one code as a special
 * centered-only case.
 */
test(
    'parseAltiumArrayBuffer decodes mirrored free-text justification anchors generically',
    () => {
        const records = [
            '|HEADER=Schematic Document',
            '|RECORD=31|CustomX=500|CustomY=300|VisibleGridSize=10|SnapGridSize=5' +
                '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
                '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
            '|RECORD=4|Location.X=200|Location.Y=220|Justification=2|Color=255|FontID=1|Text=DC 12V IN|IsMirrored=T',
            '|RECORD=4|Location.X=120|Location.Y=140|Justification=6|Color=8388608|FontID=1|Text=StandBy|IsMirrored=T'
        ]
        const arrayBuffer = new TextEncoder().encode(records.join('')).buffer
        const documentModel = AltiumParser.parseArrayBuffer(
            'free-text-justification.SchDoc',
            arrayBuffer
        )
        const anchors = documentModel.schematic.texts
            .map((text) => ({
                text: text.text,
                anchor: text.anchor
            }))
            .sort((left, right) => left.text.localeCompare(right.text))

        assert.deepEqual(anchors, [
            { text: 'DC 12V IN', anchor: 'end' },
            { text: 'StandBy', anchor: 'start' }
        ])
    }
)
