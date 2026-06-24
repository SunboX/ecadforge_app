import assert from 'node:assert/strict'
import test from 'node:test'
import { CircuitJsonDocument } from 'circuitjson-toolkit'
import { unzipSync } from 'fflate'
import {
    PcbLibModelParser,
    PcbLibStreamExtractor,
    SchLibModelParser,
    SchLibStreamExtractor
} from 'altium-toolkit/parser'
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
 * Converts one byte view into an exact ArrayBuffer slice.
 * @param {Uint8Array} bytes Bytes to convert.
 * @returns {ArrayBuffer}
 */
function toArrayBuffer(bytes) {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    )
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
 * Builds a compact fake scene containing two stitched component candidates.
 * @returns {object}
 */
function createStitchedSceneDescription() {
    return {
        components: [
            { designator: 'XO2', pattern: 'Package:Stacked_A' },
            { designator: 'XO9', pattern: 'Package:Stacked_B' }
        ],
        staticBodyPlacements: [
            {
                designator: 'XO2',
                mountSide: 'top',
                positionMil: { x: 100, y: 200, z: 20 },
                coLocatedVariantGroupKey: 'stack:a',
                geometry: {
                    kind: 'extruded-polygon',
                    heightMil: 40,
                    verticesMil: [
                        { x: -20, y: -20 },
                        { x: 20, y: -20 },
                        { x: 20, y: 20 },
                        { x: -20, y: 20 }
                    ]
                }
            },
            {
                designator: 'XO9',
                mountSide: 'top',
                positionMil: { x: 300, y: 400, z: 20 },
                coLocatedVariantGroupKey: 'stack:b',
                geometry: {
                    kind: 'extruded-polygon',
                    heightMil: 40,
                    verticesMil: [
                        { x: -20, y: -20 },
                        { x: 20, y: -20 },
                        { x: 20, y: 20 },
                        { x: -20, y: 20 }
                    ]
                }
            }
        ],
        externalPlacements: [
            {
                designator: 'XO2',
                mountSide: 'top',
                positionMil: { x: 100, y: 200, z: 60 },
                coLocatedVariantGroupKey: 'stack:a',
                externalModel: {
                    origin: 'embedded',
                    name: 'selected-child.step',
                    format: 'step',
                    payloadText: 'ISO-10303-21;\nSELECTED',
                    sourceStream: 'Models/selected'
                }
            },
            {
                designator: 'XO9',
                mountSide: 'top',
                positionMil: { x: 300, y: 400, z: 60 },
                coLocatedVariantGroupKey: 'stack:b',
                externalModel: {
                    origin: 'embedded',
                    name: 'other-child.step',
                    format: 'step',
                    payloadText: 'ISO-10303-21;\nOTHER',
                    sourceStream: 'Models/other'
                }
            }
        ]
    }
}

/**
 * Builds a deterministic fake mesh loader for selected external sub-models.
 * @returns {(placement: object) => object}
 */
function createStitchedModelMeshLoader() {
    return (placement) => ({
        name: placement.externalModel.name,
        vertices: [
            [0, 0, 0],
            [10, 0, 0],
            [0, 10, 0],
            [0, 0, 10]
        ],
        faces: [
            [0, 2, 1],
            [0, 1, 3],
            [1, 2, 3],
            [2, 0, 3]
        ]
    })
}

/**
 * Builds fake sibling documents with owner-linked schematic and PCB primitives.
 * @returns {{ boardDocument: object, schematicDocument: object }}
 */
function createOwnerLinkedSelectedPartDocuments() {
    const designator = 'XK1'

    return {
        boardDocument: {
            fileName: 'fake-owner-board.PcbDoc',
            pcb: {
                components: [
                    {
                        componentIndex: 17,
                        designator,
                        pattern: 'FakeLib:Owner_Linked_Device',
                        x: 1000,
                        y: 2000,
                        rotation: 0
                    }
                ],
                componentPrimitiveGroups: [
                    {
                        componentIndex: 17,
                        designator,
                        pads: [
                            {
                                number: '1',
                                x: 990,
                                y: 1990,
                                sizeTopX: 20,
                                sizeTopY: 30,
                                shapeTopName: 'rectangular',
                                rotation: 90,
                                layerId: 1
                            },
                            {
                                number: '2',
                                x: 1010,
                                y: 2010,
                                sizeTopX: 20,
                                sizeTopY: 30,
                                shapeTopName: 'rectangular',
                                rotation: 90,
                                layerId: 1
                            }
                        ],
                        tracks: [
                            {
                                x1: 970,
                                y1: 1980,
                                x2: 1030,
                                y2: 1980,
                                width: 4,
                                layerId: 21
                            }
                        ],
                        arcs: [
                            {
                                x: 1000,
                                y: 2000,
                                radius: 15,
                                startAngle: 0,
                                endAngle: 90,
                                width: 3,
                                layerId: 21
                            }
                        ],
                        texts: [
                            {
                                text: 'XK1',
                                x: 980,
                                y: 1960,
                                height: 8,
                                rotation: 0,
                                layerId: 21,
                                visible: true
                            }
                        ]
                    }
                ]
            }
        },
        schematicDocument: {
            fileName: 'fake-owner-sheet.SchDoc',
            schematic: {
                components: [
                    {
                        x: 50,
                        y: 90,
                        libReference: 'OwnerSymbol',
                        designator,
                        value: 'Owner linked value'
                    }
                ],
                texts: [
                    {
                        x: 50,
                        y: 98,
                        text: designator,
                        name: 'Designator',
                        ownerIndex: '77',
                        hidden: false
                    }
                ],
                rectangles: [
                    {
                        x: 50,
                        y: 70,
                        width: 40,
                        height: 30,
                        ownerIndex: '77'
                    }
                ],
                pins: [
                    {
                        x: 50,
                        y: 80,
                        length: 10,
                        name: 'IN',
                        designator: '1',
                        orientation: 'left',
                        ownerIndex: '77'
                    },
                    {
                        x: 90,
                        y: 80,
                        length: 10,
                        name: 'OUT',
                        designator: '2',
                        orientation: 'right',
                        ownerIndex: '77'
                    }
                ]
            }
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

    const circuitJson = JSON.parse(
        textEntry(zip, 'circuitjson/QFN.circuit.json')
    )
    assert.deepEqual(CircuitJsonDocument.validateModel(circuitJson), [])
    const elementByType = new Map(
        circuitJson.map((element) => [element.type, element])
    )

    assert.deepEqual(
        elementByType.get('source_component').supplier_part_numbers,
        {}
    )
    assert.equal(elementByType.get('source_component').ftype, 'simple_chip')
    assert.deepEqual(elementByType.get('schematic_component').size, {
        width: 2.54,
        height: 2.54
    })
    assert.equal(elementByType.get('pcb_component').layer, 'top')
    assert.equal(elementByType.get('pcb_component').width, 1)
    assert.equal(elementByType.get('pcb_component').height, 1)
    assert.equal(elementByType.get('source_port').pin_number, 1)
    assert.equal(elementByType.get('pcb_smtpad').shape, 'rect')
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
    assert.ok(kicadZip['kicad/project/QFN.kicad_pro'])
    assert.ok(kicadZip['kicad/project/QFN.kicad_sch'])
    assert.ok(kicadZip['kicad/project/QFN.kicad_pcb'])
    assert.ok(kicadZip['kicad/project/fp-lib-table'])
    assert.ok(kicadZip['kicad/project/sym-lib-table'])
    assert.ok(kicadZip['kicad/project/QFN.kicad_sym'])
    assert.ok(kicadZip['kicad/project/QFN.pretty/QFN.kicad_mod'])
    assert.ok(altiumZip['altium/QFN.SchLib'])
    assert.ok(altiumZip['altium/QFN.PcbLib'])
    assert.ok(altiumZip['source/source.json'])
})

/**
 * Verifies KiCad selected-part export keeps owner-linked symbol and footprint
 * geometry from sibling schematic and PCB documents.
 */
test('SelectedPartExportService exports owner-linked KiCad symbol and footprint geometry', async () => {
    const service = new SelectedPartExportService()
    const { boardDocument, schematicDocument } =
        createOwnerLinkedSelectedPartDocuments()

    const result = await service.export({
        format: 'kicad',
        documentId: 'board',
        selectedComponentKey: 'XK1',
        documentModel: boardDocument,
        documents: [
            { id: 'board', documentModel: boardDocument },
            { id: 'sheet', documentModel: schematicDocument }
        ]
    })
    const zip = unzipSync(result.archiveBytes)
    const symbolText = textEntry(zip, 'kicad/Owner_Linked_Device.kicad_sym')
    const footprintText = textEntry(zip, 'kicad/Owner_Linked_Device.kicad_mod')

    assert.match(symbolText, /\(pin passive line/)
    assert.match(symbolText, /\(name "IN"/)
    assert.match(symbolText, /\(number "1"/)
    assert.match(symbolText, /\(name "OUT"/)
    assert.match(footprintText, /\(pad "1" smd rect/)
    assert.match(footprintText, /\(pad "2" smd rect/)
    assert.match(footprintText, /\(fp_line/)
    assert.match(footprintText, /\(fp_arc/)
    assert.match(footprintText, /\(fp_text user "XK1"/)
})

/**
 * Verifies Altium selected-part export keeps owner-linked symbol and footprint
 * geometry from sibling schematic and PCB documents.
 */
test('SelectedPartExportService exports owner-linked Altium symbol and footprint geometry', async () => {
    const service = new SelectedPartExportService()
    const { boardDocument, schematicDocument } =
        createOwnerLinkedSelectedPartDocuments()

    const result = await service.export({
        format: 'altium',
        documentId: 'board',
        selectedComponentKey: 'XK1',
        documentModel: boardDocument,
        documents: [
            { id: 'board', documentModel: boardDocument },
            { id: 'sheet', documentModel: schematicDocument }
        ]
    })
    const zip = unzipSync(result.archiveBytes)
    const schModel = SchLibModelParser.parse(
        'Owner_Linked_Device.SchLib',
        SchLibStreamExtractor.extractFromArrayBuffer(
            toArrayBuffer(zip['altium/Owner_Linked_Device.SchLib'])
        )
    )
    const pcbModel = PcbLibModelParser.parse(
        'Owner_Linked_Device.PcbLib',
        PcbLibStreamExtractor.extractFromArrayBuffer(
            toArrayBuffer(zip['altium/Owner_Linked_Device.PcbLib'])
        )
    )
    const symbol = schModel.schematicLibrary.symbols[0]
    const footprint = pcbModel.pcbLibrary.footprints[0]

    assert.equal(symbol.pins.length, 2)
    assert.equal(symbol.primitives.length, 1)
    assert.equal(footprint.pads.length, 2)
    assert.equal(footprint.tracks.length, 1)
    assert.equal(footprint.arcs.length, 1)
    assert.equal(footprint.texts.length, 1)
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
 * Verifies KiCad selected-part exports attach packaged 3D models to the
 * generated footprint.
 */
test('SelectedPartExportService references packaged 3D models from KiCad footprints', async () => {
    const service = new SelectedPartExportService()
    const documentModel = createDocumentModel('U3')
    documentModel.pcb.components[0].modelName = 'body.step'
    documentModel.pcb.components[0].modelPath = '${KIPRJMOD}/parts/body.step'

    const result = await service.export({
        format: 'kicad',
        documentModel,
        selectedComponentKey: 'U3',
        sessionAssets: [
            {
                name: 'body.step',
                relativePath: 'parts/body.step',
                format: 'step',
                file: new Uint8Array([1, 2, 3])
            }
        ]
    })
    const zip = unzipSync(result.archiveBytes)
    const footprintText = textEntry(zip, 'kicad/QFN.kicad_mod')

    assert.deepEqual([...zip['models/QFN.step']], [1, 2, 3])
    assert.deepEqual([...zip['kicad/project/models/QFN.step']], [1, 2, 3])
    assert.match(footprintText, /\(model "\.\.\/models\/QFN\.step"/)
    assert.match(
        textEntry(zip, 'kicad/project/QFN.pretty/QFN.kicad_mod'),
        /\(model "\$\{KIPRJMOD\}\/models\/QFN\.step"/
    )
    assert.match(footprintText, /\(offset \(xyz 0 0 0\)\)/)
    assert.match(footprintText, /\(scale \(xyz 1 1 1\)\)/)
    assert.match(footprintText, /\(rotate \(xyz 0 0 0\)\)/)
})

/**
 * Verifies selected-part exports include the generated stitched component
 * model for the selected designator, without adding unrelated stitched parts.
 */
test('SelectedPartExportService includes the selected stitched component STEP', async () => {
    const service = new SelectedPartExportService({
        modelMeshLoader: createStitchedModelMeshLoader()
    })
    const documentModel = createDocumentModel('XO2')
    documentModel.schematic.components[0].footprint = 'Package:Stacked_A'
    documentModel.pcb.components[0].pattern = 'Package:Stacked_A'

    for (const format of ['circuitjson', 'kicad', 'altium']) {
        const result = await service.export({
            format,
            documentModel,
            selectedComponentKey: 'XO2',
            sceneDescription: createStitchedSceneDescription()
        })
        const zip = unzipSync(result.archiveBytes)
        const manifest = JSON.parse(textEntry(zip, 'manifest.json'))
        const stitchedText = textEntry(zip, 'models/Stacked_A-stitched.step')

        assert.ok(zip['models/Stacked_A-stitched.step'], format)
        assert.equal(zip['models/Stacked_B-stitched.step'], undefined, format)
        assert.match(stitchedText, /ISO-10303-21/)
        assert.match(stitchedText, /static-XO2/)
        assert.match(stitchedText, /selected-child\.step/)
        assert.equal(manifest.status.model3d, 'exported', format)
        assert.ok(
            manifest.files.includes('models/Stacked_A-stitched.step'),
            format
        )
        if (format === 'kicad') {
            const footprintText = textEntry(zip, 'kicad/Stacked_A.kicad_mod')
            assert.match(
                footprintText,
                /\(model "\.\.\/models\/Stacked_A-stitched\.step"/
            )
            assert.match(footprintText, /\(rotate \(xyz -90 0 0\)\)/)
        }
    }
})

/**
 * Verifies generated stitched STEP files are rotated back into the selected
 * footprint's local KiCad coordinate frame.
 */
test('SelectedPartExportService rotates stitched KiCad models into footprint frame', async () => {
    const service = new SelectedPartExportService({
        modelMeshLoader: createStitchedModelMeshLoader()
    })
    const documentModel = createDocumentModel('XO2')
    documentModel.schematic.components[0].footprint = 'Package:Stacked_A'
    documentModel.pcb.components[0].pattern = 'Package:Stacked_A'
    documentModel.pcb.components[0].rotation = 270

    const result = await service.export({
        format: 'kicad',
        documentModel,
        selectedComponentKey: 'XO2',
        sceneDescription: createStitchedSceneDescription()
    })
    const zip = unzipSync(result.archiveBytes)
    const footprintText = textEntry(zip, 'kicad/Stacked_A.kicad_mod')

    assert.match(footprintText, /\(rotate \(xyz -90 0 90\)\)/)
})

/**
 * Verifies generated stitched STEP files are placed in Altium footprints using
 * the same local footprint-frame correction.
 */
test('SelectedPartExportService places stitched Altium models into footprint frame', async () => {
    const service = new SelectedPartExportService({
        modelMeshLoader: createStitchedModelMeshLoader()
    })
    const documentModel = createDocumentModel('XO2')
    documentModel.schematic.components[0].footprint = 'Package:Stacked_A'
    documentModel.pcb.components[0].pattern = 'Package:Stacked_A'
    documentModel.pcb.components[0].rotation = 270

    const result = await service.export({
        format: 'altium',
        documentModel,
        selectedComponentKey: 'XO2',
        sceneDescription: createStitchedSceneDescription()
    })
    const zip = unzipSync(result.archiveBytes)
    const pcbModel = PcbLibModelParser.parse(
        'Stacked_A.PcbLib',
        PcbLibStreamExtractor.extractFromArrayBuffer(
            toArrayBuffer(zip['altium/Stacked_A.PcbLib'])
        )
    )
    const body = pcbModel.pcbLibrary.componentBodies[0]

    assert.equal(body.name, 'Stacked_A-stitched.step')
    assert.deepEqual(body.modelRotationDeg, { x: -90, y: 0, z: 90 })
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
