import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dSilkscreenFactory } from '../../src/ui/PcbScene3dSilkscreenFactory.mjs'

/**
 * Builds minimal Three-compatible doubles for silkscreen factory tests.
 * @returns {any}
 */
function createFakeThree() {
    class FakeVector3 {
        constructor() {
            this.x = 0
            this.y = 0
            this.z = 0
        }

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} z
         * @returns {void}
         */
        set(x, y, z) {
            this.x = x
            this.y = y
            this.z = z
        }
    }

    class FakeEuler {
        constructor() {
            this.x = 0
            this.y = 0
            this.z = 0
        }
    }

    class FakeGroup {
        constructor() {
            this.children = []
            this.position = new FakeVector3()
            this.rotation = new FakeEuler()
        }

        /**
         * @param {...any} children
         * @returns {void}
         */
        add(...children) {
            this.children.push(...children)
        }
    }

    class FakeMesh {
        /**
         * @param {any} geometry
         * @param {any} material
         */
        constructor(geometry, material) {
            this.geometry = geometry
            this.material = material
            this.position = new FakeVector3()
            this.rotation = new FakeEuler()
        }
    }

    class FakeBufferGeometry {
        constructor() {
            this.attributes = new Map()
        }

        /**
         * @param {string} name
         * @param {any} value
         * @returns {void}
         */
        setAttribute(name, value) {
            this.attributes.set(name, value)
        }
    }

    class FakeFloat32BufferAttribute {
        /**
         * @param {number[]} array
         * @param {number} itemSize
         */
        constructor(array, itemSize) {
            this.array = array
            this.itemSize = itemSize
        }
    }

    class FakeLineSegments {
        /**
         * @param {any} geometry
         * @param {any} material
         */
        constructor(geometry, material) {
            this.geometry = geometry
            this.material = material
            this.position = new FakeVector3()
            this.rotation = new FakeEuler()
        }
    }

    class FakeLineBasicMaterial {
        /**
         * @param {Record<string, unknown>} options
         */
        constructor(options) {
            this.options = options
        }
    }

    class FakeMeshBasicMaterial {
        /**
         * @param {Record<string, unknown>} options
         */
        constructor(options) {
            this.options = options
        }
    }

    class FakeMeshStandardMaterial {
        /**
         * @param {Record<string, unknown>} options
         */
        constructor(options) {
            this.options = options
        }
    }

    class FakeBoxGeometry {
        /**
         * @param {number} width
         * @param {number} height
         * @param {number} depth
         */
        constructor(width, height, depth) {
            this.type = 'BoxGeometry'
            this.parameters = { width, height, depth }
        }
    }

    return {
        Group: FakeGroup,
        Mesh: FakeMesh,
        BufferGeometry: FakeBufferGeometry,
        Float32BufferAttribute: FakeFloat32BufferAttribute,
        LineSegments: FakeLineSegments,
        LineBasicMaterial: FakeLineBasicMaterial,
        MeshBasicMaterial: FakeMeshBasicMaterial,
        MeshStandardMaterial: FakeMeshStandardMaterial,
        BoxGeometry: FakeBoxGeometry,
        DoubleSide: 'DoubleSide'
    }
}

/**
 * Builds axis-aligned bounds from one flattened position buffer.
 * @param {number[]} positions
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

test('PcbScene3dSilkscreenFactory builds top and bottom overlay groups', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [{ x1: 100, y1: 120, x2: 130, y2: 140 }],
                tracks: [{ x1: 10, y1: 20, x2: 70, y2: 20, width: 8 }],
                arcs: [
                    {
                        x: 150,
                        y: 160,
                        radius: 10,
                        startAngle: 0,
                        endAngle: 180,
                        width: 6
                    }
                ]
            },
            bottom: {
                fills: [],
                tracks: [{ x1: 15, y1: 220, x2: 35, y2: 250, width: 6 }],
                arcs: []
            }
        },
        32.1,
        -32.1,
        (x, y) => ({ x: x - 50, y: y - 75 })
    )

    assert.equal(group.children.length, 2)

    const topGroup = group.children[0]
    const bottomGroup = group.children[1]

    assert.equal(topGroup.children.length, 3)
    assert.equal(bottomGroup.children.length, 1)

    const topTrackMesh = topGroup.children[0]
    const topArcMesh = topGroup.children[1]
    const topFillMesh = topGroup.children[2]
    const bottomTrackMesh = bottomGroup.children[0]
    const topTrackBounds = resolveBounds(
        topTrackMesh.geometry.attributes.get('position').array
    )
    const topArcBounds = resolveBounds(
        topArcMesh.geometry.attributes.get('position').array
    )
    const bottomTrackBounds = resolveBounds(
        bottomTrackMesh.geometry.attributes.get('position').array
    )

    assert.equal(topTrackMesh.material.options.side, 'DoubleSide')
    assert.equal(topTrackBounds.minX, -40)
    assert.equal(topTrackBounds.maxX, 20)
    assert.equal(topTrackBounds.minY, -59)
    assert.equal(topTrackBounds.maxY, -51)
    assert.equal(topTrackBounds.minZ, 32.1)
    assert.equal(topTrackBounds.maxZ, 32.1)
    assert.ok(topArcBounds.maxX - topArcBounds.minX > 18)
    assert.ok(topArcBounds.maxY - topArcBounds.minY > 4)
    assert.equal(topFillMesh.geometry.type, 'BoxGeometry')
    assert.equal(topFillMesh.position.x, 65)
    assert.equal(topFillMesh.position.y, 55)
    assert.equal(topFillMesh.position.z, 32.1)
    assert.equal(bottomGroup.rotation.x, Math.PI)
    assert.ok(bottomTrackBounds.maxX - bottomTrackBounds.minX > 20)
    assert.ok(bottomTrackBounds.maxY - bottomTrackBounds.minY > 30)
    assert.ok(bottomTrackBounds.minY < -176)
    assert.ok(bottomTrackBounds.maxY < -143)
    assert.ok(bottomTrackBounds.maxY > -144)
    assert.equal(bottomTrackBounds.minZ, 32.1)
    assert.equal(bottomTrackBounds.maxZ, 32.1)
})

test('PcbScene3dSilkscreenFactory renders start-equals-end arcs as full circles', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks: [],
                arcs: [
                    {
                        x: 40,
                        y: 60,
                        radius: 20,
                        startAngle: 0,
                        endAngle: 0,
                        width: 8
                    }
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        12,
        -12,
        (x, y) => ({ x, y })
    )

    assert.equal(group.children.length, 1)

    const arcMesh = group.children[0].children[0]
    const bounds = resolveBounds(
        arcMesh.geometry.attributes.get('position').array
    )

    assert.ok(bounds.maxX - bounds.minX > 45)
    assert.ok(bounds.maxY - bounds.minY > 45)
    assert.equal(bounds.minZ, 12)
    assert.equal(bounds.maxZ, 12)
})
