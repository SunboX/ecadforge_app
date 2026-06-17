import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbAssemblyExportService } from '../../src/core/PcbAssemblyExportService.mjs'

/**
 * Builds a compact scene description with board, fabrication details, and
 * mixed component model formats.
 * @returns {object}
 */
function createSceneDescription() {
    return {
        sourceFormat: 'kicad',
        board: {
            widthMil: 1000,
            heightMil: 500,
            thicknessMil: 62,
            centerX: 0,
            centerY: 0,
            segments: []
        },
        components: [
            { designator: 'U1', externalModel: { name: 'u1.step' } },
            { designator: 'J1', externalModel: { name: 'j1.wrl' } },
            { designator: 'R9', externalModel: null }
        ],
        externalPlacements: [
            {
                designator: 'U1',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: 80, y: 40, z: 38 },
                modelTransform: null,
                externalModel: {
                    format: 'step',
                    name: 'u1.step',
                    file: new Uint8Array([1, 2, 3])
                }
            },
            {
                designator: 'J1',
                mountSide: 'bottom',
                rotationDeg: 90,
                positionMil: { x: -120, y: -60, z: -38 },
                modelTransform: null,
                externalModel: {
                    format: 'wrl',
                    name: 'j1.wrl',
                    file: new TextEncoder().encode('#VRML V2.0 utf8')
                }
            }
        ],
        detail: {
            tracks: [
                {
                    layer: 'top',
                    x1: -200,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    width: 20
                }
            ],
            arcs: [],
            fills: [
                {
                    layer: 'bottom',
                    points: [
                        { x: -80, y: -80 },
                        { x: -20, y: -80 },
                        { x: -20, y: -20 },
                        { x: -80, y: -20 }
                    ]
                }
            ],
            polygons: [],
            pads: [
                {
                    x: 0,
                    y: 100,
                    rotation: 0,
                    shapeTop: 2,
                    shapeBottom: 2,
                    sizeTopX: 70,
                    sizeTopY: 40,
                    sizeBottomX: 60,
                    sizeBottomY: 36
                }
            ],
            vias: [{ x: 150, y: 90, diameter: 35, holeDiameter: 14 }],
            copperTexts: [
                {
                    x: -150,
                    y: 130,
                    side: 'front',
                    value: 'PWR',
                    sizeX: 60,
                    sizeY: 28
                }
            ],
            silkscreen: {
                top: {
                    tracks: [
                        {
                            x1: -100,
                            y1: 180,
                            x2: 100,
                            y2: 180,
                            width: 8
                        }
                    ],
                    arcs: [],
                    fills: [],
                    texts: [{ x: 0, y: 205, text: 'A1', height: 35 }]
                },
                bottom: {
                    tracks: [],
                    arcs: [],
                    fills: [],
                    texts: []
                }
            }
        }
    }
}

/**
 * Builds a deterministic fake mesh loader for external component models.
 * @returns {(placement: object) => Promise<object>}
 */
function createModelMeshLoader() {
    return async (placement) => ({
        name: placement.externalModel.name,
        sourceFormat: placement.externalModel.format,
        vertices: [
            [-10, -10, -5],
            [10, -10, -5],
            [10, 10, -5],
            [-10, 10, -5],
            [-10, -10, 5],
            [10, -10, 5],
            [10, 10, 5],
            [-10, 10, 5]
        ],
        faces: [
            [0, 1, 2, 3],
            [4, 7, 6, 5],
            [0, 4, 5, 1],
            [1, 5, 6, 2],
            [2, 6, 7, 3],
            [3, 7, 4, 0]
        ]
    })
}

test('PcbAssemblyExportService exports a full PCB assembly as STEP', async () => {
    const service = new PcbAssemblyExportService({
        modelMeshLoader: createModelMeshLoader()
    })

    const result = await service.export({
        format: 'step',
        documentModel: { fileName: 'fake-board.kicad_pcb' },
        sceneDescription: createSceneDescription()
    })
    const stepText = new TextDecoder().decode(result.bytes)

    assert.equal(result.fileName, 'fake-board-assembly.step')
    assert.equal(result.contentType, 'model/step')
    assert.match(stepText, /ISO-10303-21/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('board'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('copper-top-track-1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('pad-top-1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('pad-bottom-1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('via-1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('copper-top-text-1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('silkscreen-top-track-1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('component-U1'/)
    assert.match(stepText, /MANIFOLD_SOLID_BREP\('component-J1'/)
    assert.ok(
        result.diagnostics.some(
            (diagnostic) => diagnostic.code === 'component_wrl_faceted_step'
        )
    )
    assert.ok(
        result.diagnostics.some(
            (diagnostic) => diagnostic.code === 'component_model_missing'
        )
    )
})

test('PcbAssemblyExportService exports a full PCB assembly as WRL', async () => {
    const service = new PcbAssemblyExportService({
        modelMeshLoader: createModelMeshLoader()
    })

    const result = await service.export({
        format: 'wrl',
        documentModel: { fileName: 'fake-board.kicad_pcb' },
        sceneDescription: createSceneDescription()
    })
    const wrlText = new TextDecoder().decode(result.bytes)

    assert.equal(result.fileName, 'fake-board-assembly.wrl')
    assert.equal(result.contentType, 'model/vrml')
    assert.match(wrlText, /#VRML V2\.0 utf8/)
    assert.match(wrlText, /DEF board Shape/)
    assert.match(wrlText, /DEF copper_top_track_1 Shape/)
    assert.match(wrlText, /DEF copper_top_text_1 Shape/)
    assert.match(wrlText, /DEF pad_bottom_1 Shape/)
    assert.match(wrlText, /DEF silkscreen_top_track_1 Shape/)
    assert.match(wrlText, /DEF component_U1 Shape/)
    assert.match(wrlText, /DEF component_J1 Shape/)
})

test('PcbAssemblyExportService reports measured export progress steps', async () => {
    const progressEvents = []
    const service = new PcbAssemblyExportService({
        modelMeshLoader: createModelMeshLoader()
    })

    await service.export({
        format: 'step',
        documentModel: { fileName: 'fake-board.kicad_pcb' },
        sceneDescription: createSceneDescription(),
        onProgress(progress) {
            progressEvents.push(progress)
        }
    })

    assert.ok(progressEvents.length > 8)
    assert.deepEqual(progressEvents.at(0), {
        value: 5,
        message: 'Preparing 3D scene data'
    })
    assert.equal(progressEvents.at(-1).value, 100)
    assert.equal(progressEvents.at(-1).message, 'Export ready')
    assert.ok(
        progressEvents.every(
            (event, index) =>
                index === 0 || event.value >= progressEvents[index - 1].value
        )
    )
    assert.ok(
        progressEvents.some(
            (event) => event.message === 'Building board substrate'
        )
    )
    assert.ok(
        progressEvents.some((event) =>
            event.message.startsWith('Building copper tracks ')
        )
    )
    assert.ok(
        progressEvents.some((event) =>
            event.message.startsWith('Building pads ')
        )
    )
    assert.ok(
        progressEvents.some((event) =>
            event.message.startsWith('Loading component models ')
        )
    )
    assert.ok(
        progressEvents.some(
            (event) => event.message === 'Encoding STEP download'
        )
    )
})
