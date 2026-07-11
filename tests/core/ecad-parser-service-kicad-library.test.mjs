import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'

/**
 * Verifies KiCad library files selected with a project reach the project
 * loader so it can build library indexes from the same local intake batch.
 */
test('EcadParserService passes KiCad library entries to project loader', async () => {
    const seenEntries = []
    const service = new EcadParserService({
        kicadProjectLoader: {
            loadAsync(entries) {
                seenEntries.push(...entries.map((entry) => entry.name))
                return {
                    documents: [
                        {
                            sourceFormat: 'kicad',
                            kind: 'pcb',
                            fileName: 'Project/main.kicad_pcb'
                        }
                    ],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    })

    await service.parseEntries([
        { name: 'Project/main.kicad_pro', buffer: new ArrayBuffer(1) },
        { name: 'Project/main.kicad_pcb', buffer: new ArrayBuffer(1) },
        {
            name: 'Project/symbols/logic.kicad_sym',
            buffer: new ArrayBuffer(1)
        },
        {
            name: 'Project/footprints/QFN.pretty/QFN.kicad_mod',
            buffer: new ArrayBuffer(1)
        }
    ])

    assert.deepEqual(seenEntries, [
        'Project/main.kicad_pro',
        'Project/main.kicad_pcb',
        'Project/symbols/logic.kicad_sym',
        'Project/footprints/QFN.pretty/QFN.kicad_mod'
    ])
})
