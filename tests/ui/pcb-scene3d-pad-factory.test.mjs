import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dPadFactory } from '../../src/ui/PcbScene3dPadFactory.mjs'

/**
 * Builds a minimal Three-compatible test double set for pad mesh assertions.
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

    class FakeCylinderGeometry {
        /**
         * @param {number} radiusTop
         * @param {number} radiusBottom
         * @param {number} height
         * @param {number} segments
         */
        constructor(radiusTop, radiusBottom, height, segments) {
            this.type = 'CylinderGeometry'
            this.parameters = {
                radiusTop,
                radiusBottom,
                height,
                segments
            }
        }
    }

    class FakeShape {
        constructor() {
            this.commands = []
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {void}
         */
        moveTo(x, y) {
            this.commands.push(['moveTo', x, y])
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {void}
         */
        lineTo(x, y) {
            this.commands.push(['lineTo', x, y])
        }

        /**
         * @param {number} x
         * @param {number} y
         * @param {number} radius
         * @param {number} startAngle
         * @param {number} endAngle
         * @param {boolean} clockwise
         * @returns {void}
         */
        absarc(x, y, radius, startAngle, endAngle, clockwise) {
            this.commands.push([
                'absarc',
                x,
                y,
                radius,
                startAngle,
                endAngle,
                clockwise
            ])
        }

        /**
         * @returns {void}
         */
        closePath() {
            this.commands.push(['closePath'])
        }
    }

    class FakeExtrudeGeometry {
        /**
         * @param {any} shape
         * @param {Record<string, unknown>} options
         */
        constructor(shape, options) {
            this.type = 'ExtrudeGeometry'
            this.shape = shape
            this.options = options
        }
    }

    return {
        Group: FakeGroup,
        Mesh: FakeMesh,
        MeshStandardMaterial: FakeMeshStandardMaterial,
        BoxGeometry: FakeBoxGeometry,
        CylinderGeometry: FakeCylinderGeometry,
        Shape: FakeShape,
        ExtrudeGeometry: FakeExtrudeGeometry
    }
}

test('resolvePadSurfaceSpec keeps circular and rounded-rect pad detail', () => {
    const circular = PcbScene3dPadFactory.resolvePadSurfaceSpec({
        sizeTopX: 64,
        sizeTopY: 64,
        shapeTop: 1
    })
    const roundedRect = PcbScene3dPadFactory.resolvePadSurfaceSpec({
        sizeTopX: 80,
        sizeTopY: 40,
        shapeTop: 2,
        hasRoundedRect: true,
        roundedRectShapeTop: 2,
        cornerRadiusTop: 25,
        offsetTopX: 6,
        offsetTopY: -4
    })

    assert.deepEqual(circular, {
        width: 64,
        height: 64,
        kind: 'circle',
        radius: 32,
        cornerRadius: 32,
        offsetX: 0,
        offsetY: 0,
        hasHole: false,
        holeDiameter: 0,
        holeSlotLength: null,
        holeRotation: 0
    })
    assert.deepEqual(roundedRect, {
        width: 80,
        height: 40,
        kind: 'rounded-rect',
        radius: 40,
        cornerRadius: 10,
        offsetX: 6,
        offsetY: -4,
        hasHole: false,
        holeDiameter: 0,
        holeSlotLength: null,
        holeRotation: 0
    })
})

test('buildGroup preserves pad-specific geometry kinds and local offsets', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dPadFactory.buildGroup(
        THREE,
        [
            {
                x: 110,
                y: 210,
                sizeTopX: 60,
                sizeTopY: 60,
                shapeTop: 1,
                rotation: 90
            },
            {
                x: 220,
                y: 320,
                sizeTopX: 100,
                sizeTopY: 40,
                shapeTop: 1,
                rotation: 45,
                offsetTopX: 8,
                offsetTopY: -5
            }
        ],
        14.2,
        (x, y) => ({ x: x - 10, y: y - 20 })
    )

    assert.equal(group.children.length, 2)

    const circularRoot = group.children[0]
    const circularMesh = circularRoot.children[0]
    assert.equal(circularRoot.position.x, 100)
    assert.equal(circularRoot.position.y, 190)
    assert.equal(circularRoot.rotation.z, Math.PI / 2)
    assert.equal(circularMesh.geometry.type, 'CylinderGeometry')
    assert.equal(circularMesh.rotation.x, Math.PI / 2)
    assert.equal(circularMesh.position.z, 14.2)

    const roundedRoot = group.children[1]
    const roundedMesh = roundedRoot.children[0]
    assert.equal(roundedRoot.position.x, 210)
    assert.equal(roundedRoot.position.y, 300)
    assert.equal(roundedRoot.rotation.z, Math.PI / 4)
    assert.equal(roundedMesh.geometry.type, 'ExtrudeGeometry')
    assert.equal(roundedMesh.position.x, 8)
    assert.equal(roundedMesh.position.y, -5)
    assert.equal(roundedMesh.position.z, 14.2)
    assert.equal(
        roundedMesh.geometry.shape.commands.filter(
            (command) => command[0] === 'absarc'
        ).length,
        4
    )
})

test('buildGroup respects explicit side solder-mask openings', () => {
    const THREE = createFakeThree()
    const pads = [
        {
            x: 100,
            y: 100,
            sizeTopX: 60,
            sizeTopY: 40,
            sizeBottomX: 60,
            sizeBottomY: 40,
            shapeTop: 2,
            shapeBottom: 2,
            hasTopSolderMaskOpening: true,
            hasBottomSolderMaskOpening: false
        },
        {
            x: 200,
            y: 100,
            sizeTopX: 50,
            sizeTopY: 50,
            sizeBottomX: 50,
            sizeBottomY: 50,
            shapeTop: 1,
            shapeBottom: 1,
            hasTopSolderMaskOpening: true,
            hasBottomSolderMaskOpening: true
        }
    ]
    const topGroup = PcbScene3dPadFactory.buildGroup(
        THREE,
        pads,
        14.2,
        (x, y) => ({ x, y }),
        { side: 'top' }
    )
    const bottomGroup = PcbScene3dPadFactory.buildGroup(
        THREE,
        pads,
        14.2,
        (x, y) => ({ x, y }),
        { side: 'bottom' }
    )

    assert.equal(topGroup.children.length, 2)
    assert.equal(bottomGroup.children.length, 1)
    assert.equal(bottomGroup.children[0].position.x, 200)
})

test('buildGroup extrudes drilled pads as annular rings', () => {
    const group = PcbScene3dPadFactory.buildGroup(
        THREE,
        [
            {
                x: 110,
                y: 210,
                sizeTopX: 60,
                sizeTopY: 60,
                shapeTop: 1,
                holeDiameter: 28,
                rotation: 90
            }
        ],
        14.2,
        (x, y) => ({ x: x - 10, y: y - 20 })
    )

    assert.equal(group.children.length, 1)

    const root = group.children[0]
    const mesh = root.children[0]

    assert.equal(root.position.x, 100)
    assert.equal(root.position.y, 190)
    assert.equal(root.rotation.z, Math.PI / 2)
    assert.equal(mesh.geometry.type, 'ExtrudeGeometry')
    assert.equal(mesh.geometry.parameters.shapes.holes.length, 1)
    assert.equal(mesh.position.z, 14.2)
    assert.equal(mesh.rotation.x, 0)
})
