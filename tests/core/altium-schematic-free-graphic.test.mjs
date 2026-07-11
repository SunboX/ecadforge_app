import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumExtensionResolver } from 'altium-toolkit/extensions'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Creates a neutral schematic with a free graphic made from line, arc, and pie
 * primitives.
 * @returns {ArrayBuffer}
 */
function createNeutralFreeGraphicSchematicBuffer() {
    const source = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|RECORD=31|CustomX=100|CustomY=100|VisibleGridSize=10|SnapGridSize=5' +
                '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=4|CustomYZones=4' +
                '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
            '|RECORD=6|IndexInSheet=1|OwnerPartID=-1|LineWidth=1|Color=255|LocationCount=4' +
                '|X1=53|Y1=40|X2=50|Y2=29|X3=47|Y3=40|X4=55|Y4=40',
            '|RECORD=6|IndexInSheet=2|OwnerPartID=-1|LineWidth=1|Color=255|LocationCount=2' +
                '|X1=47|Y1=40|X2=55|Y2=40',
            '|RECORD=12|IndexInSheet=3|OwnerPartID=-1|Location.X=50|Location.Y=40' +
                '|Radius=5|LineWidth=1|StartAngle=359.9|EndAngle=179.1|Color=255',
            '|RECORD=9|IndexInSheet=4|OwnerPartID=-1|Location.X=50|Location.Y=40' +
                '|Radius=5|LineWidth=1|StartAngle=0|EndAngle=180|Color=255|AreaColor=255|IsSolid=T'
        ].join('\u0000')
    )

    return source.buffer
}

/**
 * Creates a neutral schematic with one in-sheet free graphic and one
 * ownerless free graphic outside the declared source sheet bounds.
 * @returns {ArrayBuffer}
 */
function createNeutralOffSheetFreeGraphicSchematicBuffer() {
    const source = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|RECORD=31|CustomX=100|CustomY=80|VisibleGridSize=10|SnapGridSize=1' +
                '|BorderOn=T|TitleBlockOn=F|CustomMarginWidth=5|CustomXZones=2|CustomYZones=2' +
                '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
            '|RECORD=6|IndexInSheet=1|OwnerPartID=-1|LineWidth=1|Color=0|LocationCount=2' +
                '|X1=10|Y1=10|X2=90|Y2=10',
            '|RECORD=6|IndexInSheet=2|OwnerPartID=-1|LineWidth=2|Color=255|LocationCount=2' +
                '|X1=120|Y1=10|X2=180|Y2=50'
        ].join('\u0000')
    )

    return source.buffer
}

/**
 * Verifies free schematic graphics keep their arc and pie stack while using
 * the app schematic color tokens.
 */
test('EcadRendererService preserves Altium free graphic pie and lower arc', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'neutral-free-graphic.SchDoc',
        createNeutralFreeGraphicSchematicBuffer()
    )
    assert.equal(Object.hasOwn(documentModel, 'schematic'), false)
    assert.ok(AltiumExtensionResolver.nativeModel(documentModel)?.schematic)
    const markup = EcadRendererService.renderSchematic(documentModel)
    const pie = documentModel.model.find(
        (element) =>
            element.type === 'schematic_path' &&
            String(element.schematic_path_id || '').includes('_pie_')
    )
    const arcIndex = markup.indexOf(
        'class="schematic-shape schematic-shape--arc"'
    )
    const pieIndex = markup.indexOf(
        'class="schematic-shape schematic-shape--path"'
    )

    assert.ok(pie)
    assert.equal(pie.is_filled, true)
    assert.equal(pie.points.length, 26)
    assert.deepEqual(pie.points[0], { x: 50, y: 60 })
    assert.notEqual(arcIndex, -1)
    assert.notEqual(pieIndex, -1)
    assert.ok(arcIndex < pieIndex)
    assert.match(markup, /schematic-shape--arc"[^>]+A 5 5 0 0 0/)
    assert.doesNotMatch(markup, /schematic-shape--arc"[^>]+A 5 5 0 1 1/)
    assert.doesNotMatch(markup, /stroke-width="1"/)
    assert.match(markup, /stroke-width="0\.85"/)
    assert.match(markup, /schematic-shape--path"[^>]+stroke="#ff0000"/i)
    assert.match(markup, /schematic-shape--path"[^>]+fill="#ff0000"/i)
})

/**
 * Verifies ownerless free graphics outside the declared sheet do not stretch
 * the rendered sheet or appear as stray overlay artifacts.
 */
test('EcadParserService drops off-sheet ownerless Altium free graphic lines', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'neutral-off-sheet-free-graphic.SchDoc',
        createNeutralOffSheetFreeGraphicSchematicBuffer()
    )
    const nativeModel = AltiumExtensionResolver.nativeModel(documentModel)
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.deepEqual(
        nativeModel.schematic.lines.map((line) => [
            line.x1,
            line.y1,
            line.x2,
            line.y2
        ]),
        [[10, 10, 90, 10]]
    )
    assert.doesNotMatch(markup, /x2="180"/)
    assert.doesNotMatch(markup, /#ff0000/i)
    assert.match(
        markup,
        /<rect class="sheet-backdrop schematic-sheet" x="0" y="0" width="130" height="100"><\/rect>/
    )
})
