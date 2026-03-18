import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumParser } from '../../../src/core/altium/AltiumParser.mjs'
import { SchematicSvgRenderer } from '../../../src/ui/SchematicSvgRenderer.mjs'

const DIRECTIVE_RECORDS = [
    '|HEADER=Schematic Document',
    '|RECORD=31|CustomX=400|CustomY=240|VisibleGridSize=10|SnapGridSize=5' +
        '|BorderOn=F|TitleBlockOn=F|CustomMarginWidth=10|CustomXZones=6|CustomYZones=4' +
        '|FontIdCount=1|Size1=10|FontName1=Times New Roman|Bold1=F|Rotation1=0',
    '|RECORD=43|Location.X=120|Location.Y=160|Color=255|Orientation=1|Name=DiffPairRouting',
    '|RECORD=43|Location.X=128|Location.Y=160|Color=255|Name=DIFFPAIR',
    '|RECORD=18|Location.X=210|Location.Y=160|Width=60|Height=10|IOType=3|Alignment=1' +
        '|Color=128|TextColor=128|AreaColor=8454143|Name=PAIR_A_N',
    '|RECORD=18|Location.X=210|Location.Y=140|Width=60|Height=10|IOType=3|Alignment=2' +
        '|Color=128|TextColor=128|AreaColor=8454143|Name=PAIR_A_P',
    '|RECORD=18|Location.X=150|Location.Y=190|Width=70|Height=10|Color=128' +
        '|TextColor=128|AreaColor=8454143|Name=CORE_5V',
    '|RECORD=13|OwnerIndex=700|OwnerPartId=1|Location.X=80|Location.Y=140|Corner.X=140|Corner.Y=140' +
        '|LineWidth=1|Color=16711680',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=1|PinConglomerate=58' +
        '|PinLength=20|Location.X=80|Location.Y=140|Name=SIG_A|Designator=1',
    '|RECORD=2|OwnerIndex=700|OwnerPartId=1|FormalType=1|Electrical=1|PinConglomerate=56' +
        '|PinLength=20|Location.X=140|Location.Y=140|Name=SIG_B|Designator=2'
]

/**
 * Verifies directive glyphs, double-ended ports, plain ports, and electrical
 * pin arrows all stay visible in the final schematic SVG.
 */
test(
    'renderSchematicSvg draws directive glyphs, double-tip ports, and electrical pin arrows',
    () => {
        const arrayBuffer = new TextEncoder().encode(
            DIRECTIVE_RECORDS.join('')
        ).buffer
        const documentModel = AltiumParser.parseArrayBuffer(
            'directive-port-shapes.SchDoc',
            arrayBuffer
        )
        const markup = SchematicSvgRenderer.render(documentModel)

        assert.match(markup, /schematic-directive schematic-directive--route/)
        assert.match(markup, /schematic-directive schematic-directive--pair/)
        assert.match(markup, />DiffPairRouting</)
        assert.match(
            markup,
            /<polygon points="218,75 262,75 270,80 262,85 218,85 210,80" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
        )
        assert.match(
            markup,
            /<polygon points="150,45 220,45 220,55 150,55" fill="var\(--schematic-fill-color\)" stroke="var\(--schematic-power-color\)" \/>/
        )
        assert.match(
            markup,
            /<g class="schematic-pin-marker"><polygon points="75,97 75,103 80,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><polygon points="72,97 72,103 67,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g><text class="schematic-pin-number" x="78" y="99" fill="var\(--schematic-text-color\)" text-anchor="end" font-size="9" font-family="Times New Roman" font-weight="400">1<\/text>/
        )
        assert.match(
            markup,
            /<g class="schematic-pin-marker"><polygon points="145,97 145,103 140,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><polygon points="148,97 148,103 153,100" fill="var\(--schematic-pin-marker-fill\)" stroke="var\(--schematic-text-color\)" stroke-width="0\.75" vector-effect="non-scaling-stroke" \/><\/g><text class="schematic-pin-number" x="142" y="99" fill="var\(--schematic-text-color\)" text-anchor="start" font-size="9" font-family="Times New Roman" font-weight="400">2<\/text>/
        )
        assert.equal(
            (markup.match(/class="schematic-pin-marker"/g) || []).length,
            2
        )
    }
)
