import assert from 'node:assert/strict'
import test from 'node:test'
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
 * Verifies free schematic graphics keep their arc and pie stack while using
 * the app schematic color tokens.
 */
test('EcadRendererService preserves Altium free graphic pie and lower arc', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'neutral-free-graphic.SchDoc',
        createNeutralFreeGraphicSchematicBuffer()
    )
    const markup = EcadRendererService.renderSchematic(documentModel)
    const arcIndex = markup.indexOf('class="schematic-arc"')
    const pieIndex = markup.indexOf('class="schematic-pie"')

    assert.notEqual(arcIndex, -1)
    assert.notEqual(pieIndex, -1)
    assert.ok(arcIndex < pieIndex)
    assert.match(markup, /<path class="schematic-arc"[^>]+A 5 5 0 0 0/)
    assert.doesNotMatch(markup, /<path class="schematic-arc"[^>]+A 5 5 0 1 1/)
    assert.doesNotMatch(markup, /stroke-width="1"/)
    assert.match(markup, /stroke-width="0\.85"/)
    assert.match(
        markup,
        /<path class="schematic-pie"[^>]+fill="var\(--schematic-alert-color\)"/
    )
    assert.doesNotMatch(markup, /#ff0000/i)
})
