import assert from 'node:assert/strict'
import test from 'node:test'
import { unzipSync } from 'fflate'
import { SelectedPartExportService } from '../../src/core/SelectedPartExportService.mjs'

/**
 * Decodes one ZIP text entry.
 * @param {Record<string, Uint8Array>} zip Unzipped entries.
 * @param {string} path Entry path.
 * @returns {string}
 */
function textEntry(zip, path) {
    return new TextDecoder().decode(zip[path])
}

/**
 * Builds a compact fake document containing one selected part.
 * @param {string} designator Component designator.
 * @returns {object}
 */
function createDocumentModel(designator = 'U1') {
    return {
        fileName: 'fake-board.kicad_pcb',
        sourceFormat: 'kicad',
        schematic: {
            components: [
                {
                    ownerIndex: designator,
                    designator,
                    value: 'MCU',
                    footprint: 'Package:QFN'
                }
            ],
            pins: [
                {
                    ownerIndex: designator,
                    name: 'IO',
                    designator: '1'
                }
            ]
        },
        pcb: {
            components: [
                {
                    designator,
                    pattern: 'Package:QFN',
                    pads: [
                        {
                            designator: '1',
                            x: 0,
                            y: 0,
                            width: 1,
                            height: 1
                        }
                    ]
                }
            ]
        }
    }
}

/**
 * Verifies CircuitJSON selected-part ZIP export.
 */
test('SelectedPartExportService exports a selected part as CircuitJSON ZIP', async () => {
    const service = new SelectedPartExportService()
    const result = await service.export({
        format: 'circuitjson',
        documentId: 'doc-1',
        selectedComponentKey: 'U1',
        documentModel: createDocumentModel('U1')
    })

    const zip = unzipSync(result.archiveBytes)

    assert.equal(result.archiveName, 'QFN-circuitjson-part.zip')
    assert.ok(zip['manifest.json'])
    assert.ok(zip['circuitjson/QFN.circuit.json'])
    assert.match(textEntry(zip, 'manifest.json'), /"designator": "U1"/)
    assert.match(
        textEntry(zip, 'circuitjson/QFN.circuit.json'),
        /source_component/
    )
})

/**
 * Verifies native-format selected-part ZIP entries.
 */
test('SelectedPartExportService exports KiCad and Altium ZIP entries', async () => {
    const service = new SelectedPartExportService()
    const documentModel = createDocumentModel('R1')

    const kicadZip = unzipSync(
        (
            await service.export({
                format: 'kicad',
                documentModel,
                selectedComponentKey: 'R1'
            })
        ).archiveBytes
    )
    const altiumZip = unzipSync(
        (
            await service.export({
                format: 'altium',
                documentModel,
                selectedComponentKey: 'R1'
            })
        ).archiveBytes
    )

    assert.ok(kicadZip['kicad/QFN.kicad_sym'])
    assert.ok(kicadZip['kicad/QFN.kicad_mod'])
    assert.ok(altiumZip['altium/QFN.SchLib'])
    assert.ok(altiumZip['altium/QFN.PcbLib'])
    assert.ok(altiumZip['source/source.json'])
})

/**
 * Verifies selected-part exports include a matched 3D model asset.
 */
test('SelectedPartExportService includes the selected 3D model asset', async () => {
    const service = new SelectedPartExportService()
    const documentModel = createDocumentModel('U2')
    documentModel.pcb.components[0].modelName = 'body.step'
    documentModel.pcb.components[0].modelPath = '${KIPRJMOD}/parts/body.step'

    const result = await service.export({
        format: 'altium',
        documentModel,
        selectedComponentKey: 'U2',
        sessionAssets: [
            {
                name: 'body.step',
                relativePath: 'parts/body.step',
                format: 'step',
                file: {
                    async arrayBuffer() {
                        return new Uint8Array([9, 8, 7]).buffer
                    }
                }
            }
        ]
    })
    const zip = unzipSync(result.archiveBytes)
    const manifest = JSON.parse(textEntry(zip, 'manifest.json'))

    assert.deepEqual([...zip['models/QFN.step']], [9, 8, 7])
    assert.equal(manifest.status.model3d, 'exported')
    assert.ok(zip['source/manifest.json'])
})

/**
 * Verifies selected-part export artifacts use the component footprint name
 * instead of the reference designator.
 */
test('SelectedPartExportService names selected part artifacts from footprint name', async () => {
    const service = new SelectedPartExportService()
    const partName = 'USB_Micro-B_Amphenol_10103594-0001LF_Horizontal_modified'
    const documentModel = createDocumentModel('J3')
    documentModel.schematic.components[0].footprint =
        'RP2040_minimal:' + partName
    documentModel.pcb.components[0].pattern = 'RP2040_minimal:' + partName
    documentModel.pcb.components[0].modelName = '10103594.step'
    documentModel.pcb.components[0].modelPath =
        '${KIPRJMOD}/models/10103594.step'

    const result = await service.export({
        format: 'kicad',
        documentModel,
        selectedComponentKey: 'J3',
        sessionAssets: [
            {
                name: '10103594.step',
                relativePath: 'models/10103594.step',
                format: 'step',
                file: new Uint8Array([4, 5, 6])
            }
        ]
    })
    const zip = unzipSync(result.archiveBytes)
    const manifest = JSON.parse(textEntry(zip, 'manifest.json'))

    assert.equal(result.archiveName, partName + '-kicad-part.zip')
    assert.ok(zip['kicad/' + partName + '.kicad_sym'])
    assert.ok(zip['kicad/' + partName + '.kicad_mod'])
    assert.deepEqual([...zip['models/' + partName + '.step']], [4, 5, 6])
    assert.equal(manifest.selectedPart.designator, 'J3')
    assert.equal(manifest.selectedPart.name, partName)
    assert.equal(
        Object.keys(zip).some((path) => /(^|\/)J3[.-]/u.test(path)),
        false
    )
})

/**
 * Verifies selected PCB exports can use symbol data from a sibling schematic.
 */
test('SelectedPartExportService resolves selected symbol data from session documents', async () => {
    const service = new SelectedPartExportService()
    const boardDocument = {
        fileName: 'fake-board.kicad_pcb',
        sourceFormat: 'kicad',
        pcb: {
            components: [
                {
                    designator: 'U7',
                    pattern: 'Package:QFN',
                    pads: [{ designator: '1', x: 0, y: 0 }]
                }
            ]
        }
    }
    const schematicDocument = {
        fileName: 'fake-sheet.kicad_sch',
        sourceFormat: 'kicad',
        schematic: {
            components: [
                {
                    ownerIndex: 'U7',
                    designator: 'U7',
                    value: 'Session MCU',
                    footprint: 'Package:QFN'
                }
            ],
            pins: [{ ownerIndex: 'U7', name: 'IO', designator: '1' }]
        }
    }

    const result = await service.export({
        format: 'kicad',
        documentId: 'board',
        selectedComponentKey: 'U7',
        documentModel: boardDocument,
        documents: [
            { id: 'board', documentModel: boardDocument },
            { id: 'sheet', documentModel: schematicDocument }
        ]
    })
    const zip = unzipSync(result.archiveBytes)

    assert.match(textEntry(zip, 'kicad/QFN.kicad_sym'), /Session_MCU/)
    assert.match(textEntry(zip, 'manifest.json'), /"symbol": "exported"/)
})
