import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dViaFactory } from '../../src/ui/PcbScene3dViaFactory.mjs'

test('PcbScene3dViaFactory extrudes annular vias around drilled holes', () => {
    const group = PcbScene3dViaFactory.buildGroup(
        THREE,
        [{ x: 20, y: 30, diameter: 24, holeDiameter: 10 }],
        63,
        (x, y) => ({ x, y })
    )

    assert.equal(group.children.length, 1)
    assert.equal(group.children[0].geometry.type, 'ExtrudeGeometry')
    assert.equal(group.children[0].geometry.parameters.shapes.holes.length, 1)
    assert.equal(group.children[0].position.x, 20)
    assert.equal(group.children[0].position.y, 30)
})

test('PcbScene3dViaFactory falls back to solid cylinders when no drill is present', () => {
    const group = PcbScene3dViaFactory.buildGroup(
        THREE,
        [{ x: 20, y: 30, diameter: 24, holeDiameter: 0 }],
        63,
        (x, y) => ({ x, y })
    )

    assert.equal(group.children[0].geometry.type, 'CylinderGeometry')
    assert.equal(group.children[0].rotation.x, Math.PI / 2)
})
