import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Verifies Altium project batches provide project and document special-string
 * context to schematic documents parsed from the same source set.
 */
test('EcadParserService attaches Altium project context to schematics', async () => {
    const service = new EcadParserService({
        altiumParser: {
            parseArrayBuffer(fileName) {
                if (fileName.endsWith('.PrjPcb')) {
                    return {
                        sourceFormat: 'altium',
                        kind: 'project',
                        fileType: 'PrjPcb',
                        fileName,
                        project: {
                            parameters: {
                                map: {
                                    Organization: 'NEUTRAL LAB'
                                }
                            },
                            documents: [
                                {
                                    fileName: 'Sheets/01_Neutral.SchDoc'
                                }
                            ]
                        }
                    }
                }

                return {
                    sourceFormat: 'altium',
                    kind: 'schematic',
                    fileType: 'SchDoc',
                    fileName,
                    schematic: {
                        sheet: {},
                        texts: []
                    }
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'Neutral_Project.PrjPcb', buffer: new ArrayBuffer(1) },
        { name: 'Sheets/01_Neutral.SchDoc', buffer: new ArrayBuffer(1) }
    ])
    const schematic = result.documents.find(
        (document) => document.kind === 'schematic'
    )

    assert.equal(
        schematic.projectParameters.ProjectName,
        'Neutral_Project.PrjPcb'
    )
    assert.equal(schematic.projectParameters.DocumentName, '01_Neutral.SchDoc')
    assert.equal(schematic.projectParameters.Organization, 'NEUTRAL LAB')
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
