import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a board with a CAD component that points at a model asset.
 * @returns {object[]}
 */
function createCadAssetDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 10,
            height: 6
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1',
            ftype: 'simple_chip'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 1, y: 1 },
            layer: 'top',
            width: 2,
            height: 1
        },
        {
            type: 'cad_component',
            cad_component_id: 'cad_u1',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            position: { x: 1, y: 1, z: 0.8 },
            model_asset: {
                project_relative_path: 'models/U1.step',
                url: 'https://assets.invalid/models/U1.step',
                mimetype: 'model/step'
            },
            model_unit_to_mm_scale_factor: 25.4,
            model_board_normal_direction: 'z+',
            model_origin_alignment: 'bottom_center_of_component',
            model_object_fit: 'fill_bounds',
            show_as_translucent_model: true
        }
    ]
    Object.assign(documentModel, {
        sourceFormat: 'circuitjson',
        kind: 'pcb',
        fileName: 'cad-board.json'
    })
    return documentModel
}

/**
 * Verifies CAD component model assets become reusable scene external models.
 */
test('EcadScene3dService resolves CircuitJSON CAD model assets from session assets', async () => {
    const modelFile = new Uint8Array([1, 2, 3])
    const scene = await EcadScene3dService.prepare(createCadAssetDocument(), {
        sessionAssets: [
            {
                name: 'U1.step',
                relativePath: 'models/U1.step',
                file: modelFile,
                format: 'step'
            }
        ]
    })

    assert.equal(scene.externalPlacements.length, 1)
    assert.equal(scene.externalPlacements[0].externalModel.name, 'U1.step')
    assert.equal(scene.externalPlacements[0].externalModel.format, 'step')
    assert.equal(scene.externalPlacements[0].externalModel.file, modelFile)
    assert.equal(
        scene.externalPlacements[0].modelTransform.boardNormalDirection,
        'z+'
    )
    assert.equal(scene.externalPlacements[0].modelTransform.scale.x, 25.4)
    assert.equal(
        scene.externalPlacements[0].modelTransform.objectFit,
        'fill_bounds'
    )
    assert.equal(scene.externalPlacements[0].bodyOpacity, 0.5)
})

/**
 * Verifies 3MF model assets and CAD display flags flow into scene placements.
 */
test('EcadScene3dService resolves CircuitJSON 3MF CAD model assets', async () => {
    const modelFile = new Uint8Array([4, 5, 6])
    const documentModel = createCadAssetDocument()
    const cadComponent = documentModel.find(
        (element) => element.type === 'cad_component'
    )
    cadComponent.model_asset = {
        project_relative_path: 'models/U1.3mf',
        mimetype: 'model/3mf'
    }
    cadComponent.model_unit_to_mm_scale_factor = 1
    cadComponent.show_as_bounding_box = true
    cadComponent.size = { x: 3, y: 2, z: 1 }

    const scene = await EcadScene3dService.prepare(documentModel, {
        sessionAssets: [
            {
                name: 'U1.3mf',
                relativePath: 'models/U1.3mf',
                file: modelFile,
                format: '3mf'
            }
        ]
    })

    const placement = scene.externalPlacements[0]
    assert.equal(placement.externalModel.name, 'U1.3mf')
    assert.equal(placement.externalModel.format, '3mf')
    assert.equal(placement.externalModel.file, modelFile)
    assert.equal(placement.bodyOpacity, 0.5)
    assert.equal(placement.renderAsBoundingBox, true)
    assert.equal(Math.round(placement.boundingBoxSizeMil.x), 118)
})
