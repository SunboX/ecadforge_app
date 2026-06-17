import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbAssemblyModelMeshLoader } from '../../src/core/assembly/PcbAssemblyModelMeshLoader.mjs'

/**
 * Builds a prepared STEP payload with one default-colored triangle and one
 * explicitly colored triangle.
 * @returns {object}
 */
function createFaceColoredStepPayload() {
    return {
        name: 'colored-body',
        color: [0.12, 0.14, 0.16],
        positions: new Float32Array([
            0, 0, 0, 0.1, 0, 0, 0.1, 0.1, 0, 0, 0.1, 0
        ]),
        normals: new Float32Array(),
        indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
        faceColors: [{ first: 0, last: 0, color: [0.82, 0.1, 0.05] }]
    }
}

test('PcbAssemblyModelMeshLoader preserves STEP face colors as export meshes', async () => {
    const loader = new PcbAssemblyModelMeshLoader()
    const meshes = await loader.loadPlacement({
        externalModel: {
            format: 'step',
            name: 'colored.step',
            preparedMeshPayloads: [createFaceColoredStepPayload()]
        }
    })

    assert.equal(meshes.length, 2)
    assert.deepEqual(meshes[0].color, [0.82, 0.1, 0.05])
    assert.deepEqual(meshes[1].color, [0.12, 0.14, 0.16])
    assert.equal(meshes[0].faces.length, 1)
    assert.equal(meshes[1].faces.length, 1)
})

test('PcbAssemblyModelMeshLoader preserves WRL material diffuse colors', async () => {
    const loader = new PcbAssemblyModelMeshLoader()
    const meshes = await loader.loadPlacement({
        externalModel: {
            format: 'wrl',
            name: 'colored.wrl',
            payloadText: `
#VRML V2.0 utf8
Shape {
  appearance Appearance {
    material Material { diffuseColor 0.05 0.07 0.09 }
  }
  geometry IndexedFaceSet {
    coord Coordinate {
      point [ 0 0 0, 1 0 0, 0 1 0 ]
    }
    coordIndex [ 0, 1, 2, -1 ]
  }
}`
        }
    })

    assert.equal(meshes.length, 1)
    assert.deepEqual(meshes[0].color, [0.05, 0.07, 0.09])
})
