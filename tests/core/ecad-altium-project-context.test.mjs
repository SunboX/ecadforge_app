import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Verifies the app preserves canonical schematic text resolved by the Altium
 * project loader instead of rebuilding project context itself.
 */
test('EcadParserService preserves Altium project-resolved canonical text', async () => {
    const service = new EcadParserService({
        altiumProjectLoader: {
            loadAsync() {
                return {
                    documents: [
                        {
                            schema: 'ecad-toolkit.document.v1',
                            id: 'document-neutral-schematic',
                            modelSchema: {
                                name: 'circuit-json',
                                version: '0.0.446'
                            },
                            model: [
                                {
                                    type: 'schematic_text',
                                    schematic_text_id: 'project-name',
                                    text: 'Neutral_Project.PrjPcb',
                                    position: { x: 20, y: 100 }
                                }
                            ],
                            source: {
                                format: 'altium',
                                fileName: 'Sheets/01_Neutral.SchDoc',
                                fileType: 'schdoc'
                            },
                            extensions: {},
                            assets: [],
                            diagnostics: [],
                            statistics: { elementCount: 1 }
                        }
                    ],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'Neutral_Project.PrjPcb', buffer: new ArrayBuffer(1) },
        { name: 'Sheets/01_Neutral.SchDoc', buffer: new ArrayBuffer(1) }
    ])
    assert.equal(result.documents[0].model[0].text, 'Neutral_Project.PrjPcb')
})

/**
 * Verifies Altium schematic rendering forwards project parameters so visible
 * template special strings resolve through the toolkit renderer.
 */
test('EcadRendererService renders Altium schematic project parameters', () => {
    const markup = EcadRendererService.renderSchematic({
        sourceFormat: 'altium',
        kind: 'schematic',
        fileName: 'Sheets/01_Neutral.SchDoc',
        summary: { title: 'Neutral schematic' },
        projectParameters: {
            ProjectName: 'Neutral_Project.PrjPcb'
        },
        schematic: {
            sheet: {
                width: 300,
                height: 180,
                sourceWidth: 300,
                sourceHeight: 180,
                marginWidth: 10,
                borderOn: false,
                titleBlockOn: false,
                xZones: 4,
                yZones: 4
            },
            lines: [],
            texts: [
                {
                    x: 20,
                    y: 100,
                    text: '=ProjectName',
                    color: '#000080',
                    fontSize: 12,
                    fontFamily: 'Times New Roman',
                    fontWeight: 400
                }
            ],
            components: [],
            pins: [],
            ports: [],
            crosses: []
        }
    })

    assert.match(markup, /Neutral_Project\.PrjPcb/u)
    assert.doesNotMatch(markup, /=ProjectName/u)
})

/**
 * Verifies the real project loader keeps retained native rendering consistent
 * with the already-resolved canonical CircuitJSON model.
 */
test('EcadRendererService renders project strings from retained native Altium extensions', async () => {
    const encoder = new TextEncoder()
    const result = await EcadParserService.parseEntries([
        {
            name: 'Neutral_Project.PrjPcb',
            buffer: encoder.encode(`[Design]
Version=1.0

[Document1]
DocumentPath=Sheets/01_Neutral.SchDoc

[Parameter1]
Name=Organization
Value=NEUTRAL LAB
`).buffer
        },
        {
            name: 'Sheets/01_Neutral.SchDoc',
            buffer: encoder.encode(
                '|HEADER=Schematic Document' +
                    '|RECORD=31|CUSTOMX=300|CUSTOMY=180|VISIBLEGRIDSIZE=10|SNAPGRIDSIZE=5' +
                    '|BORDERON=T|CUSTOMMARGINWIDTH=10|CUSTOMXZONES=6|CUSTOMYZONES=4' +
                    '|FONTIDCOUNT=1|SIZE1=10|FONTNAME1=Times New Roman|BOLD1=F|ROTATION1=0' +
                    '|RECORD=4|LOCATION.X=20|LOCATION.Y=150|COLOR=8388608|FONTID=1|TEXT==ProjectName' +
                    '|RECORD=4|LOCATION.X=20|LOCATION.Y=130|COLOR=8388608|FONTID=1|TEXT==DocumentName' +
                    '|RECORD=4|LOCATION.X=20|LOCATION.Y=110|COLOR=8388608|FONTID=1|TEXT==Organization'
            ).buffer
        }
    ])
    const documentModel = result.documents.find(
        (document) => document.source?.fileType === 'schdoc'
    )
    const markup = EcadRendererService.renderSchematic(documentModel)

    assert.match(markup, /Neutral_Project\.PrjPcb/u)
    assert.match(markup, /01_Neutral\.SchDoc/u)
    assert.match(markup, /NEUTRAL LAB/u)
})
