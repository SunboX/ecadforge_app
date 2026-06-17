import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbAssemblyMeshUtils } from '../../src/core/assembly/PcbAssemblyMeshUtils.mjs'

test('PcbAssemblyMeshUtils applies model-local scale and offset before placement', () => {
    const mesh = {
        name: 'model',
        vertices: [[1, 2, 3]],
        faces: [[0, 0, 0]]
    }

    const transformed = PcbAssemblyMeshUtils.transformMesh(mesh, {
        positionMil: { x: 10, y: 20, z: 30 },
        rotationDeg: 0,
        modelTransform: {
            scale: { x: 2, y: 3, z: 4 },
            offsetMil: { x: 5, y: -1, z: 2 }
        }
    })

    assert.deepEqual(transformed.vertices, [[17, 25, 44]])
})
