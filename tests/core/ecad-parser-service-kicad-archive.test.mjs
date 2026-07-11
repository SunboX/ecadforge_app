import assert from 'node:assert/strict'
import test from 'node:test'
import { zipSync } from 'fflate'
import { PcbScene3dCircuitJsonAdapter } from 'pcb-scene3d-viewer/scene3d'
import { EcadParserService } from '../../src/core/ecad/EcadParserService.mjs'

const ENCODER = new TextEncoder()

/**
 * Builds a minimal KiCad board that references one project-relative model.
 * @returns {string} KiCad board source.
 */
function modelBoardSource(modelPath = 'parts/body.step') {
    return `(kicad_pcb
        (version 20241229)
        (gr_poly
            (pts (xy 0 0) (xy 30 0) (xy 30 20) (xy 0 20))
            (stroke (width 0.15) (type solid))
            (fill no)
            (layer "Edge.Cuts")
        )
        (footprint "Fixture:Body"
            (layer "F.Cu")
            (at 10 10 30)
            (property "Reference" "U1"
                (at 0 -3 0)
                (layer "F.SilkS")
                (effects (font (size 1 1)))
            )
            (property "Value" "Body"
                (at 0 3 0)
                (layer "F.Fab")
                (effects (font (size 1 1)))
            )
            (model "\${KIPRJMOD}/${modelPath}"
                (offset (xyz 1 2 3))
                (scale (xyz 1 2 0.5))
                (rotate (xyz 4 5 6))
            )
        )
    )`
}

/**
 * Returns one exact ArrayBuffer around a byte view.
 * @param {Uint8Array} bytes Source bytes.
 * @returns {ArrayBuffer} Exact buffer.
 */
function exactBuffer(bytes) {
    return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
    )
}

/**
 * Verifies one full canonical model asset survives app parsing.
 * @param {object} result App parser result.
 * @param {Uint8Array} expectedBytes Expected model bytes.
 * @returns {void}
 */
function assertFullModelAsset(result, expectedBytes) {
    const asset = result.assets.find((candidate) =>
        candidate.name.endsWith('parts/body.step')
    )
    const document = result.documents.find(
        (candidate) => candidate.source?.format === 'kicad'
    )
    const cadComponent = document?.model?.find(
        (element) => element.type === 'cad_component'
    )
    const pcbComponent = document?.model?.find(
        (element) => element.type === 'pcb_component'
    )

    assert.ok(document)
    assert.ok(cadComponent)
    assert.ok(pcbComponent)
    assert.ok(asset)
    assert.ok(asset.data instanceof Uint8Array)
    assert.deepEqual([...asset.data], [...expectedBytes])
    assert.equal(cadComponent.model_asset?.project_relative_path, asset.name)
    assert.equal(cadComponent.model_asset?.url, asset.name)
    assert.deepEqual(cadComponent.position, {
        x: pcbComponent.center.x,
        y: pcbComponent.center.y,
        z: 0.8
    })
    assert.deepEqual(cadComponent.rotation, {
        x: 0,
        y: 0,
        z: pcbComponent.rotation
    })
    assert.deepEqual(cadComponent.model_rotation, { x: 4, y: 5, z: 6 })
    assert.deepEqual(cadComponent.model_scale, { x: 1, y: 2, z: 0.5 })
    assert.deepEqual(cadComponent.model_offset, { x: 1, y: 2, z: 3 })

    const scene = PcbScene3dCircuitJsonAdapter.build(document, {
        sessionAssets: result.assets
    })
    const placement = scene.externalPlacements[0]

    assert.ok(placement)
    assert.deepEqual([...placement.externalModel.data], [...expectedBytes])
    assert.equal(placement.rotationDeg, pcbComponent.rotation)
    assert.equal(Math.round(placement.positionMil.z * 1e6), 31_496_063)
    assert.deepEqual(placement.modelTransform.rotationDeg, {
        x: 4,
        y: 5,
        z: 6
    })
    assert.deepEqual(placement.modelTransform.scale, { x: 1, y: 2, z: 0.5 })
    assert.deepEqual(
        Object.values(placement.modelTransform.offsetMil).map((value) =>
            Math.round(value * 1e6)
        ),
        [39_370_079, 78_740_157, 118_110_236]
    )
}

test('EcadParserService delegates intact KiCad archives to the common project loader', async () => {
    const loadedEntryNames = []
    const service = new EcadParserService({
        gerberProjectLoader: {
            supports() {
                return false
            }
        },
        kicadProjectLoader: {
            loadAsync(entries) {
                loadedEntryNames.push(...entries.map((entry) => entry.name))
                return {
                    documents: [
                        {
                            sourceFormat: 'kicad',
                            kind: 'pcb',
                            fileName: 'active-board.kicad_pcb',
                            pcb: {}
                        }
                    ],
                    assets: [],
                    diagnostics: []
                }
            }
        }
    })

    await service.parseEntries([
        {
            name: 'source-bundle.zip',
            buffer: new ArrayBuffer(8)
        }
    ])

    assert.deepEqual(loadedEntryNames, ['source-bundle.zip'])
})

test('EcadParserService routes a real KiCad ZIP only through KiCad with full model bytes', async () => {
    const board = ENCODER.encode(modelBoardSource())
    const model = Uint8Array.from([0x53, 0x54, 0x45, 0x50, 1, 2, 3, 4])
    const archive = zipSync({
        'project/demo.kicad_pro': ENCODER.encode('{}'),
        'project/boards/active-board.kicad_pcb': board,
        'project/parts/body.step': model
    })
    const result = await EcadParserService.parseEntries([
        {
            name: 'source-bundle.zip',
            buffer: exactBuffer(archive)
        }
    ])

    assertFullModelAsset(result, model)
    assert.equal(
        result.documents.some(
            (document) => document.source?.format === 'gerber'
        ),
        false
    )
})

test('EcadParserService keeps directory-upload KiCad model companions as full assets', async () => {
    const board = ENCODER.encode(modelBoardSource())
    const model = Uint8Array.from([0x53, 0x54, 0x45, 0x50, 5, 6, 7, 8])
    const result = await EcadParserService.parseEntries([
        {
            name: 'project/demo.kicad_pro',
            buffer: exactBuffer(ENCODER.encode('{}'))
        },
        {
            name: 'project/boards/active-board.kicad_pcb',
            buffer: exactBuffer(board)
        },
        {
            name: 'project/parts/body.step',
            buffer: exactBuffer(model)
        }
    ])

    assertFullModelAsset(result, model)
})

test('EcadParserService preserves VRML companions from archives and directories', async () => {
    const board = ENCODER.encode(modelBoardSource('parts/body.vrml'))
    const model = ENCODER.encode('#VRML V2.0 utf8\nShape {}')
    const cases = [
        [
            {
                name: 'source-bundle.zip',
                buffer: exactBuffer(
                    zipSync({
                        'project/demo.kicad_pro': ENCODER.encode('{}'),
                        'project/boards/active-board.kicad_pcb': board,
                        'project/parts/body.vrml': model
                    })
                )
            }
        ],
        [
            {
                name: 'project/demo.kicad_pro',
                buffer: exactBuffer(ENCODER.encode('{}'))
            },
            {
                name: 'project/boards/active-board.kicad_pcb',
                buffer: exactBuffer(board)
            },
            {
                name: 'project/parts/body.vrml',
                buffer: exactBuffer(model)
            }
        ]
    ]

    for (const entries of cases) {
        const result = await EcadParserService.parseEntries(entries)
        const document = result.documents.find(
            (candidate) => candidate.source?.format === 'kicad'
        )
        const cadComponent = document?.model?.find(
            (element) => element.type === 'cad_component'
        )
        const asset = result.assets.find((candidate) =>
            candidate.name.endsWith('parts/body.vrml')
        )
        const scene = PcbScene3dCircuitJsonAdapter.build(document, {
            sessionAssets: result.assets
        })

        assert.ok(cadComponent)
        assert.ok(asset)
        assert.deepEqual([...asset.data], [...model])
        assert.equal(asset.mediaType, 'model/vrml')
        assert.equal(
            cadComponent.model_asset?.project_relative_path,
            asset.name
        )
        assert.equal(cadComponent.model_wrl_url, asset.name)
        assert.deepEqual(
            [...scene.externalPlacements[0].externalModel.data],
            [...model]
        )
    }
})
