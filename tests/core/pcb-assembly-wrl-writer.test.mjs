import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbAssemblyMeshUtils } from '../../src/core/assembly/PcbAssemblyMeshUtils.mjs'
import { PcbAssemblyWrlWriter } from '../../src/core/assembly/PcbAssemblyWrlWriter.mjs'

/**
 * Builds a rectangular PCB body mesh.
 * @returns {object}
 */
function createBoardMesh() {
    return PcbAssemblyMeshUtils.box('board', {
        width: 100,
        depth: 80,
        height: 10
    })
}

test('PcbAssemblyWrlWriter exports PCB thickness on the top-bottom axis', () => {
    const wrlText = PcbAssemblyWrlWriter.write({
        name: 'fake-board',
        meshes: [createBoardMesh()]
    })
    const points = [
        ...wrlText.matchAll(/^\s*([-+0-9.]+) ([-+0-9.]+) ([-+0-9.]+),$/gmu)
    ].map((match) => [Number(match[1]), Number(match[2]), Number(match[3])])
    const spans = [0, 1, 2].map((axis) => {
        const values = points.map((point) => point[axis])
        return Math.max(...values) - Math.min(...values)
    })

    assert.equal(Number(spans[0].toFixed(3)), 2.54)
    assert.equal(Number(spans[1].toFixed(3)), 0.254)
    assert.equal(Number(spans[2].toFixed(3)), 2.032)
})
