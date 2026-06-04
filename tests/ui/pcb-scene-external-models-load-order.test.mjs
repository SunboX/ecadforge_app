import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'

/**
 * Creates one external STEP placement with a controlled payload size.
 * @param {string} designator Component designator.
 * @param {string} modelName Model file name.
 * @param {number} payloadLength Embedded STEP text length.
 * @returns {object}
 */
function createPlacement(designator, modelName, payloadLength) {
    return {
        designator,
        mountSide: 'top',
        rotationDeg: 0,
        positionMil: { x: 0, y: 0, z: 0 },
        modelTransform: {
            rotationDeg: { x: 0, y: 0, z: 0 },
            offsetMil: { x: 0, y: 0, z: 0 }
        },
        externalModel: {
            origin: 'embedded',
            name: modelName,
            format: 'step',
            payloadText: 'ISO-10303-21;'.padEnd(payloadLength, 'X'),
            sourceStream: 'Models/' + designator
        }
    }
}

/**
 * Creates one minimal imported STEP mesh payload.
 * @returns {{ meshPayloads: object[] }}
 */
function createImportedModel() {
    return {
        meshPayloads: [
            {
                name: 'body',
                color: [0.2, 0.2, 0.2],
                positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
                normals: [],
                indices: [0, 1, 2],
                faceColors: []
            }
        ]
    }
}

test('PcbScene3dExternalModels loads small embedded STEP payloads before large payloads', async () => {
    const loadOrder = []
    const externalModelsGroup = new THREE.Group()

    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: {
            externalPlacements: [
                createPlacement('U1', 'large-module.step', 5000),
                createPlacement('R1', 'small-resistor.step', 200)
            ]
        },
        externalModelsGroup,
        stepLoader: {
            async loadModel(model) {
                loadOrder.push(model.name)
                return createImportedModel()
            }
        }
    })

    assert.deepEqual(diagnostics, [])
    assert.deepEqual(loadOrder, ['small-resistor.step', 'large-module.step'])
    assert.equal(externalModelsGroup.children.length, 2)
})
