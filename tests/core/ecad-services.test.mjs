import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadFormatRegistry } from '../../src/core/ecad/EcadFormatRegistry.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Verifies the format registry accepts the expanded ECAD intake surface.
 */
test('EcadFormatRegistry detects Altium, KiCad, ZIP, and companion assets', () => {
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('a.SchDoc').sourceFormat,
        'altium'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('b.kicad_sch').sourceFormat,
        'kicad'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('c.kicad_pcb').fileType,
        'kicad_pcb'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('project.zip').fileType,
        'zip'
    )
    assert.equal(EcadFormatRegistry.resolveCompanionFormat('Body.step'), 'step')
    assert.equal(
        EcadFormatRegistry.resolveCompanionFormat('symbols.kicad_sym'),
        'kicad-library'
    )
})

/**
 * Verifies parser dispatch keeps toolkit parsing behind the app facade.
 */
test('EcadParserService dispatches mixed Altium and KiCad batches', async () => {
    const service = new EcadParserService({
        altiumParser: {
            parseArrayBuffer(fileName) {
                return { sourceFormat: 'altium', kind: 'pcb', fileName }
            }
        },
        kicadProjectLoader: {
            loadEntries(entries) {
                return {
                    documents: entries.map((entry) => ({
                        sourceFormat: 'kicad',
                        kind: 'schematic',
                        fileName: entry.name
                    })),
                    assets: [{ name: 'model.step' }],
                    diagnostics: [{ severity: 'info', message: 'ok' }]
                }
            }
        }
    })
    const result = await service.parseEntries([
        { name: 'board.PcbDoc', buffer: new ArrayBuffer(1) },
        { name: 'demo.kicad_pro', buffer: new ArrayBuffer(1) },
        { name: 'demo.kicad_sch', buffer: new ArrayBuffer(1) }
    ])

    assert.deepEqual(
        result.documents.map((document) => document.sourceFormat),
        ['altium', 'kicad', 'kicad']
    )
    assert.equal(result.assets[0].name, 'model.step')
    assert.equal(result.diagnostics[0].message, 'ok')
})

/**
 * Verifies renderer and scene facades branch on sourceFormat.
 */
test('ECAD renderer and 3D services accept KiCad document models', () => {
    const kicadPcbDocument = {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'board.kicad_pcb',
        pcb: {
            boardOutline: { widthMil: 100, heightMil: 50, segments: [] },
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                title: 'KiCad Board',
                bounds: { minX: 0, minY: 0, width: 2.54, height: 1.27 },
                outlines: [],
                pads: [],
                drawings: [],
                texts: []
            }
        },
        bom: []
    }
    const scene = EcadScene3dService.build(kicadPcbDocument)
    const kicadPcbMarkup = EcadRendererService.renderPcb(kicadPcbDocument)

    assert.match(kicadPcbMarkup, /pcb-svg/)
    assert.match(kicadPcbMarkup, /pcb-svg--kicad/)
    assert.equal(scene.sourceFormat, 'kicad')
    assert.equal(scene.board.widthMil, 100)
})
