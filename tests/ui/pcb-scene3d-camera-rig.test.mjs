import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dCameraRig } from '../../src/ui/PcbScene3dCameraRig.mjs'

/**
 * Resolves one preset pose into normalized screen-space basis vectors.
 * @param {{ position: { x: number, y: number, z: number }, target: { x: number, y: number, z: number }, up: { x: number, y: number, z: number } }} preset
 * @returns {{ right: { x: number, y: number, z: number }, up: { x: number, y: number, z: number } }}
 */
const resolveScreenBasis = (preset) => {
    const forwardX = preset.target.x - preset.position.x
    const forwardY = preset.target.y - preset.position.y
    const forwardZ = preset.target.z - preset.position.z
    const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1
    const normalizedForward = {
        x: forwardX / forwardLength,
        y: forwardY / forwardLength,
        z: forwardZ / forwardLength
    }
    const right = {
        x:
            normalizedForward.y * preset.up.z -
            normalizedForward.z * preset.up.y,
        y:
            normalizedForward.z * preset.up.x -
            normalizedForward.x * preset.up.z,
        z: normalizedForward.x * preset.up.y - normalizedForward.y * preset.up.x
    }
    const rightLength = Math.hypot(right.x, right.y, right.z) || 1

    return {
        right: {
            x: right.x / rightLength,
            y: right.y / rightLength,
            z: right.z / rightLength
        },
        up: {
            x: preset.up.x,
            y: preset.up.y,
            z: preset.up.z
        }
    }
}

/**
 * Projects one point onto the preset's screen basis.
 * @param {{ x: number, y: number, z: number }} point
 * @param {{ right: { x: number, y: number, z: number }, up: { x: number, y: number, z: number } }} basis
 * @returns {{ x: number, y: number }}
 */
const projectPointToScreen = (point, basis) => ({
    x:
        point.x * basis.right.x +
        point.y * basis.right.y +
        point.z * basis.right.z,
    y: point.x * basis.up.x + point.y * basis.up.y + point.z * basis.up.z
})

/**
 * Verifies the 3D camera rig uses a z-up basis for PCB scenes so interaction
 * controls align with the board's XY plane and Z height axis.
 */
test('PcbScene3dCameraRig resolves presets with a z-up camera basis', () => {
    const preset = PcbScene3dCameraRig.resolvePreset('isometric', {
        board: {
            widthMil: 1000,
            heightMil: 500
        }
    })

    assert.deepEqual(preset.target, { x: 0, y: 0, z: 0 })
    assert.deepEqual(preset.up, { x: 0, y: 0, z: 1 })
    assert.equal(preset.radius, 1900)
    assert.ok(preset.position.x > 0)
    assert.ok(preset.position.y < 0)
    assert.ok(preset.position.z > 0)
})

/**
 * Verifies top and bottom presets are flat orthogonal portrait views along the
 * board normal with stable screen-up vectors.
 */
test('PcbScene3dCameraRig keeps top and bottom presets flat to the board', () => {
    const topPreset = PcbScene3dCameraRig.resolvePreset('top', {
        board: {
            widthMil: 2200,
            heightMil: 1400
        }
    })
    const bottomPreset = PcbScene3dCameraRig.resolvePreset('bottom', {
        board: {
            widthMil: 2200,
            heightMil: 1400
        }
    })
    const topBasis = resolveScreenBasis(topPreset)
    const bottomBasis = resolveScreenBasis(bottomPreset)
    assert.deepEqual(topPreset.up, { x: 0, y: 1, z: 0 })
    assert.deepEqual(bottomPreset.up, { x: 0, y: -1, z: 0 })
    assert.equal(topPreset.position.x, 0)
    assert.equal(topPreset.position.y, 0)
    assert.equal(bottomPreset.position.x, 0)
    assert.equal(bottomPreset.position.y, 0)
    assert.ok(topPreset.position.z > 0)
    assert.ok(bottomPreset.position.z < 0)
    assert.ok(topBasis.right.x > 0.99)
    assert.ok(Math.abs(topBasis.right.y) < 0.01)
    assert.ok(bottomBasis.right.x > 0.99)
    assert.ok(Math.abs(bottomBasis.right.y) < 0.01)
    assert.ok(bottomBasis.up.y < -0.99)
})
