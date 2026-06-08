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

test('PcbScene3dViaFactory keeps drilled via barrels without filling the aperture', () => {
    const group = PcbScene3dViaFactory.buildGroup(
        THREE,
        [{ x: 20, y: 30, diameter: 24, holeDiameter: 10 }],
        63,
        (x, y) => ({ x, y })
    )

    assert.equal(
        countCircularDrillFaceCapTriangles(group.children[0].geometry, 5),
        0,
        'Expected via hole center to stay uncapped'
    )
    assert.ok(
        countCircularDrillWallTriangles(group.children[0].geometry, 5),
        'Expected the drilled via to keep a visible copper barrel'
    )
    assert.equal(
        group.children[0].material.side,
        THREE.DoubleSide,
        'Expected the drilled via barrel to render from the underside'
    )
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

test('PcbScene3dViaFactory renders through-hole pad barrels as annular liners', () => {
    const group = PcbScene3dViaFactory.buildGroup(
        THREE,
        [{ x: 20, y: 30, holeDiameter: 40, barrelOnly: true }],
        63,
        (x, y) => ({ x, y })
    )

    assert.equal(group.children.length, 1)
    assert.equal(group.children[0].geometry.type, 'ExtrudeGeometry')
    assert.equal(group.children[0].geometry.parameters.shapes.holes.length, 1)
    assert.equal(
        countCircularDrillFaceCapTriangles(group.children[0].geometry, 16),
        0,
        'Expected through-hole pad center to stay round and open'
    )
    assert.ok(
        countCircularDrillWallTriangles(group.children[0].geometry, 16),
        'Expected through-hole pad to keep a visible copper liner wall'
    )
})

/**
 * Counts side-wall triangles that lie on a circular drill contour.
 * @param {any} geometry
 * @param {number} radius
 * @returns {number}
 */
function countCircularDrillWallTriangles(geometry, radius) {
    const position = geometry.getAttribute('position')
    let count = 0

    for (const group of geometry.groups) {
        if (Number(group.materialIndex) === 0) {
            continue
        }

        const end = Number(group.start || 0) + Number(group.count || 0)
        for (let index = Number(group.start || 0); index < end; index += 3) {
            if (triangleMatchesCircularContour(position, index, radius)) {
                count += 1
            }
        }
    }

    return count
}

/**
 * Counts face triangles whose centroid sits inside a circular drill.
 * @param {any} geometry
 * @param {number} radius
 * @returns {number}
 */
function countCircularDrillFaceCapTriangles(geometry, radius) {
    const position = geometry.getAttribute('position')
    let count = 0

    for (const group of geometry.groups) {
        if (Number(group.materialIndex) !== 0) {
            continue
        }

        const end = Number(group.start || 0) + Number(group.count || 0)
        for (let index = Number(group.start || 0); index < end; index += 3) {
            if (triangleCentroidRadius(position, index) < radius - 0.01) {
                count += 1
            }
        }
    }

    return count
}

/**
 * Resolves the XY radius of one triangle centroid.
 * @param {any} position
 * @param {number} vertexIndex
 * @returns {number}
 */
function triangleCentroidRadius(position, vertexIndex) {
    let x = 0
    let y = 0

    for (let offset = 0; offset < 3; offset += 1) {
        const index = vertexIndex + offset
        x += position.getX(index)
        y += position.getY(index)
    }

    return Math.hypot(x / 3, y / 3)
}

/**
 * Checks whether one triangle is part of a circular drill wall.
 * @param {any} position
 * @param {number} vertexIndex
 * @param {number} radius
 * @returns {boolean}
 */
function triangleMatchesCircularContour(position, vertexIndex, radius) {
    let matchedVertices = 0

    for (let offset = 0; offset < 3; offset += 1) {
        const index = vertexIndex + offset
        const vertexRadius = Math.hypot(
            position.getX(index),
            position.getY(index)
        )
        if (Math.abs(vertexRadius - radius) < 0.01) {
            matchedVertices += 1
        }
    }

    return matchedVertices >= 2
}
