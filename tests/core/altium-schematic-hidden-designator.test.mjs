import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumExtensionResolver } from 'altium-toolkit/extensions'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Creates a schematic with one hidden and one visible component designator.
 * @returns {ArrayBuffer}
 */
function createHiddenDesignatorSchematicBuffer() {
    const source = new TextEncoder().encode(
        [
            '|HEADER=Schematic Document',
            '|RECORD=31|CustomX=220|CustomY=140|VisibleGridSize=10|SnapGridSize=5' +
                '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
                '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
            '|RECORD=1|IndexInSheet=10|Location.X=50|Location.Y=60|LibReference=NEUTRAL_HIDE|UniqueID=CMP-H',
            '|RECORD=6|OwnerIndex=710|OwnerPartID=1|LocationCount=2|X1=45|Y1=55|X2=55|Y2=55',
            '|RECORD=34|OwnerIndex=710|OwnerPartID=-1|Location.X=50|Location.Y=70|FontID=1|IsHidden=T|Text=HID1|Name=Designator',
            '|RECORD=41|OwnerIndex=710|OwnerPartID=-1|Location.X=50|Location.Y=50|FontID=1|IsHidden=T|Text=Hidden value|Name=Comment',
            '|RECORD=1|IndexInSheet=20|Location.X=140|Location.Y=60|LibReference=NEUTRAL_SHOW|UniqueID=CMP-V',
            '|RECORD=6|OwnerIndex=720|OwnerPartID=1|LocationCount=2|X1=135|Y1=55|X2=145|Y2=55',
            '|RECORD=34|OwnerIndex=720|OwnerPartID=-1|Location.X=140|Location.Y=70|FontID=1|Text=VIS1|Name=Designator'
        ].join('\u0000')
    )

    return source.buffer
}

/**
 * Verifies hidden owner designators remain available as component metadata
 * without being synthesized as visible schematic fallback labels.
 */
test('EcadRendererService suppresses hidden Altium fallback designators', () => {
    const documentModel = EcadParserService.parseArrayBuffer(
        'hidden-fallback-labels.SchDoc',
        createHiddenDesignatorSchematicBuffer()
    )
    const nativeModel = AltiumExtensionResolver.nativeModel(documentModel)
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.equal(Object.hasOwn(documentModel, 'schematic'), false)
    assert.equal(nativeModel.schematic.components[0].designator, 'HID1')
    assert.doesNotMatch(markup, />HID1</)
    assert.match(markup, />VIS1</)
})
