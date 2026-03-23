import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dCameraRig } from '../../src/ui/PcbScene3dCameraRig.mjs'
import { PcbScene3dRuntime } from '../../src/ui/PcbScene3dRuntime.mjs'

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
        z:
            normalizedForward.x * preset.up.y -
            normalizedForward.y * preset.up.x
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
    y:
        point.x * basis.up.x +
        point.y * basis.up.y +
        point.z * basis.up.z
})

/**
 * Applies one resolved view scale to a representative board-space point.
 * @param {{ x: number, y: number, z: number }} point
 * @param {{ x: number, y: number, z: number }} scale
 * @returns {{ x: number, y: number, z: number }}
 */
const scalePoint = (point, scale) => ({
    x: point.x * scale.x,
    y: point.y * scale.y,
    z: point.z * scale.z
})

/**
 * Projects one board-space point through the preset basis and runtime scale.
 * @param {'top' | 'bottom' | 'isometric'} presetName
 * @param {{ x: number, y: number, z: number }} point
 * @returns {{ x: number, y: number }}
 */
const projectPresetPoint = (presetName, point) => {
    const preset = PcbScene3dCameraRig.resolvePreset(presetName, {
        board: {
            widthMil: 2200,
            heightMil: 1400
        }
    })
    const basis = resolveScreenBasis(preset)
    const scaledPoint = scalePoint(
        point,
        PcbScene3dRuntime.resolveViewScale(presetName)
    )

    return projectPointToScreen(scaledPoint, basis)
}

test('PcbScene3dRuntime flips the top preset vertically into the reference top-right orientation', () => {
    const topScreenPoint = projectPresetPoint('top', { x: 1, y: -1, z: 0 })

    assert.deepEqual(PcbScene3dRuntime.resolveViewScale('top'), {
        x: 1,
        y: -1,
        z: 1
    })
    assert.ok(topScreenPoint.x > 0)
    assert.ok(topScreenPoint.y > 0)
})

test('PcbScene3dRuntime mirrors the bottom preset without rotating the board', () => {
    const bottomScreenPoint = projectPresetPoint('bottom', {
        x: 1,
        y: -1,
        z: 0
    })

    assert.deepEqual(PcbScene3dRuntime.resolveViewScale('bottom'), {
        x: -1,
        y: 1,
        z: 1
    })
    assert.ok(bottomScreenPoint.x < 0)
    assert.ok(bottomScreenPoint.y > 0)
})

test('PcbScene3dRuntime keeps the isometric preset unmirrored', () => {
    assert.deepEqual(PcbScene3dRuntime.resolveViewScale('isometric'), {
        x: 1,
        y: 1,
        z: 1
    })
})
