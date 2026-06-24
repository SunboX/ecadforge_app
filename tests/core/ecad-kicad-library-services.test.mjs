import assert from 'node:assert/strict'
import test from 'node:test'
import { DocumentPreferredViewResolver } from '../../src/DocumentPreferredViewResolver.mjs'
import { EcadFormatRegistry } from '../../src/core/ecad/EcadFormatRegistry.mjs'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'

/**
 * Verifies the format registry accepts standalone KiCad library files.
 */
test('EcadFormatRegistry detects standalone KiCad library files', () => {
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('d.kicad_mod').fileType,
        'kicad_mod'
    )
    assert.equal(
        EcadFormatRegistry.resolveNativeRole('e.kicad_sym').fileType,
        'kicad_sym'
    )
    assert.equal(
        EcadFormatRegistry.resolveCompanionFormat('symbols.kicad_sym'),
        'kicad-library'
    )
})

/**
 * Verifies standalone KiCad library files dispatch through the parser facade.
 */
test('EcadParserService parses standalone KiCad library files', async () => {
    const parsedFileNames = []
    const service = new EcadParserService({
        kicadParser: {
            parseArrayBuffer(fileName) {
                parsedFileNames.push(fileName)
                return {
                    sourceFormat: 'kicad',
                    kind: fileName.endsWith('.kicad_mod')
                        ? 'footprint-library'
                        : 'symbol-library',
                    fileName,
                    diagnostics: []
                }
            }
        }
    })
    const footprintDocument = service.parseArrayBuffer(
        'lib/R_0603.kicad_mod',
        new ArrayBuffer(1)
    )
    const result = await service.parseEntries([
        { name: 'lib/Device.kicad_sym', buffer: new ArrayBuffer(1) }
    ])

    assert.equal(footprintDocument.kind, 'footprint-library')
    assert.equal(result.documents[0].kind, 'symbol-library')
    assert.deepEqual(parsedFileNames, [
        'lib/R_0603.kicad_mod',
        'lib/Device.kicad_sym'
    ])
    assert.equal(
        DocumentPreferredViewResolver.resolve(footprintDocument),
        'diagnostics'
    )
})
