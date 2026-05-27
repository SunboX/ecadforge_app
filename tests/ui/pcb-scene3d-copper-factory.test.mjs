import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dCopperFactory } from '../../src/ui/PcbScene3dCopperFactory.mjs'

/**
 * Resolves axis-aligned bounds from one position attribute array.
 * @param {ArrayLike<number>} positions
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number }}
 */
function resolveBounds(positions) {
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
        minZ: Infinity,
        maxZ: -Infinity
    }

    for (let index = 0; index < positions.length; index += 3) {
        bounds.minX = Math.min(bounds.minX, positions[index])
        bounds.maxX = Math.max(bounds.maxX, positions[index])
        bounds.minY = Math.min(bounds.minY, positions[index + 1])
        bounds.maxY = Math.max(bounds.maxY, positions[index + 1])
        bounds.minZ = Math.min(bounds.minZ, positions[index + 2])
        bounds.maxZ = Math.max(bounds.maxZ, positions[index + 2])
    }

    return bounds
}

/**
 * Finds a nested Three object by name.
 * @param {any} object Root object.
 * @param {string} name Object name.
 * @returns {any | null}
 */
function findObjectByName(object, name) {
    if (object?.name === name) {
        return object
    }

    for (const child of object?.children || []) {
        const match = findObjectByName(child, name)
        if (match) {
            return match
        }
    }

    return null
}

test('PcbScene3dCopperFactory separates top and bottom copper detail', () => {
    const group = PcbScene3dCopperFactory.buildGroup(
        THREE,
        {
            tracks: [
                { x1: 10, y1: 20, x2: 70, y2: 20, width: 8, layerId: 1 },
                { x1: 15, y1: 220, x2: 35, y2: 250, width: 6, layerId: 32 }
            ],
            arcs: [
                {
                    x: 150,
                    y: 160,
                    radius: 10,
                    startAngle: 0,
                    endAngle: 180,
                    width: 6,
                    layerId: 1
                },
                {
                    x: 180,
                    y: 260,
                    radius: 12,
                    startAngle: 90,
                    endAngle: 180,
                    width: 6,
                    layerId: 32
                }
            ],
            pads: [
                {
                    x: 100,
                    y: 120,
                    sizeTopX: 60,
                    sizeTopY: 60,
                    sizeBottomX: 90,
                    sizeBottomY: 50,
                    shapeTop: 1,
                    shapeBottom: 2,
                    rotation: 90
                }
            ]
        },
        32.1,
        -32.1,
        (x, y) => ({ x: x - 50, y: y - 75 })
    )

    assert.equal(group.children.length, 2)

    const topGroup = group.children[0]
    const bottomGroup = group.children[1]
    const topTrackMesh = topGroup.children[0]
    const topArcMesh = topGroup.children[1]
    const topPadGroup = topGroup.children[2]
    const bottomTrackMesh = bottomGroup.children[0]
    const bottomArcMesh = bottomGroup.children[1]
    const bottomPadGroup = bottomGroup.children[2]
    const topTrackBounds = resolveBounds(
        topTrackMesh.geometry.attributes.position.array
    )
    const bottomTrackBounds = resolveBounds(
        bottomTrackMesh.geometry.attributes.position.array
    )
    const bottomArcBounds = resolveBounds(
        bottomArcMesh.geometry.attributes.position.array
    )
    const topPadRoot = topPadGroup.children[0]
    const bottomPadRoot = bottomPadGroup.children[0]

    assert.equal(topGroup.rotation.x, 0)
    assert.equal(bottomGroup.rotation.x, Math.PI)
    assert.equal(topTrackBounds.minX, -44)
    assert.equal(topTrackBounds.maxX, 24)
    assert.equal(topTrackBounds.minY, -59)
    assert.equal(topTrackBounds.maxY, -51)
    assert.ok(Math.abs(topTrackBounds.minZ - 32.1) < 0.001)
    assert.ok(Math.abs(topTrackBounds.maxZ - 32.1) < 0.001)
    assert.ok(bottomTrackBounds.maxX - bottomTrackBounds.minX > 20)
    assert.ok(bottomTrackBounds.maxY - bottomTrackBounds.minY > 30)
    assert.ok(bottomTrackBounds.maxY <= -142)
    assert.ok(bottomArcBounds.minZ > 32.09)
    assert.equal(topPadRoot.position.x, 50)
    assert.equal(topPadRoot.position.y, 45)
    assert.equal(topPadRoot.children[0].position.z, 32.1)
    assert.equal(bottomPadRoot.position.x, 50)
    assert.equal(bottomPadRoot.position.y, -45)
    assert.equal(bottomPadRoot.children[0].position.z, 32.1)
    assert.equal(topPadRoot.rotation.z, Math.PI / 2)
    assert.equal(bottomPadRoot.rotation.z, Math.PI / 2)
})

test('PcbScene3dCopperFactory rounds track endpoints like KiCad copper', () => {
    const group = PcbScene3dCopperFactory.buildGroup(
        THREE,
        {
            tracks: [{ x1: 0, y1: 0, x2: 100, y2: 0, width: 20, layerId: 1 }],
            arcs: [],
            pads: [],
            vias: []
        },
        5,
        -5,
        (x, y) => ({ x, y })
    )

    const trackMesh = group.children[0].children[0]
    const bounds = resolveBounds(trackMesh.geometry.attributes.position.array)

    assert.ok(bounds.minX <= -9.99)
    assert.ok(bounds.maxX >= 109.99)
    assert.equal(bounds.minY, -10)
    assert.equal(bounds.maxY, 10)
})

test('PcbScene3dCopperFactory masks drilled openings above extruded pad copper', () => {
    const group = PcbScene3dCopperFactory.buildGroup(
        THREE,
        {
            tracks: [{ x1: 0, y1: 0, x2: 100, y2: 0, width: 12, layerId: 1 }],
            arcs: [],
            pads: [
                {
                    x: 100,
                    y: 0,
                    sizeTopX: 60,
                    sizeTopY: 36,
                    shapeTop: 2,
                    holeDiameter: 20,
                    holeShape: 2,
                    holeSlotLength: 42,
                    rotation: 90
                },
                {
                    x: 100,
                    y: 0,
                    sizeTopX: 80,
                    sizeTopY: 44,
                    shapeTop: 2,
                    holeDiameter: null,
                    holeShape: null,
                    holeSlotLength: null,
                    rotation: 0
                }
            ],
            vias: [{ x: 50, y: 0, diameter: 30, holeDiameter: 16 }]
        },
        5,
        -5,
        (x, y) => ({ x, y })
    )

    const topGroup = group.children[0]
    const maskGroup = topGroup.children.find(
        (child) => child.name === 'copper-drill-masks'
    )
    const maskPositions = maskGroup.children
        .flatMap((mesh) => Array.from(mesh.geometry.attributes.position.array))
        .filter((_, index) => index % 3 === 2)

    assert.equal(maskGroup.children.length, 2)
    assert.ok(maskPositions.every((z) => z > 6.09))
})

test('PcbScene3dCopperFactory renders KiCad front copper text as stroke copper', () => {
    const group = PcbScene3dCopperFactory.buildGroup(
        THREE,
        {
            tracks: [],
            arcs: [],
            pads: [],
            vias: [],
            copperTexts: [
                {
                    x: 100,
                    y: 120,
                    value: 'OK',
                    layer: 'F.Cu',
                    side: 'front',
                    sizeX: 30,
                    sizeY: 30,
                    thickness: 6,
                    hAlign: 'left',
                    vAlign: 'bottom',
                    rotation: 0
                }
            ]
        },
        7,
        -7,
        (x, y) => ({ x: x - 50, y: y - 60 })
    )
    const textMesh = findObjectByName(group, 'copper-text')

    assert.ok(textMesh)
    const bounds = resolveBounds(textMesh.geometry.attributes.position.array)

    assert.ok(bounds.minX >= 45)
    assert.ok(bounds.maxX > bounds.minX)
    assert.ok(bounds.minY < 60)
    assert.ok(bounds.maxZ > 6.99)
})
