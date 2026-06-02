import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE_REAL from 'three'
import { PcbScene3dSilkscreenFactory } from '../../src/ui/PcbScene3dSilkscreenFactory.mjs'

/**
 * Builds minimal Three-compatible doubles for drill-cutout silkscreen tests.
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

        /**
         * @param {string} name
         * @returns {any}
         */
        getAttribute(name) {
            return this.attributes.get(name)
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
            this.count = array.length / itemSize
        }

        /**
         * @param {number} index
         * @returns {number}
         */
        getX(index) {
            return this.array[index * this.itemSize]
        }

        /**
         * @param {number} index
         * @returns {number}
         */
        getY(index) {
            return this.array[index * this.itemSize + 1]
        }

        /**
         * @param {number} index
         * @returns {number}
         */
        getZ(index) {
            return this.array[index * this.itemSize + 2]
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

    class FakeShape {
        constructor() {
            this.commands = []
            this.holes = []
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {void}
         */
        moveTo(x, y) {
            this.commands.push({ type: 'moveTo', x, y })
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {void}
         */
        lineTo(x, y) {
            this.commands.push({ type: 'lineTo', x, y })
        }

        /**
         * @returns {void}
         */
        closePath() {
            this.commands.push({ type: 'closePath' })
        }
    }

    class FakePath extends FakeShape {}

    class FakeShapeGeometry {
        /**
         * @param {FakeShape} shape
         */
        constructor(shape) {
            this.type = 'ShapeGeometry'
            this.shape = shape
        }
    }

    return {
        Group: FakeGroup,
        Mesh: FakeMesh,
        BufferGeometry: FakeBufferGeometry,
        Float32BufferAttribute: FakeFloat32BufferAttribute,
        MeshBasicMaterial: FakeMeshBasicMaterial,
        Shape: FakeShape,
        Path: FakePath,
        ShapeGeometry: FakeShapeGeometry,
        DoubleSide: 'DoubleSide'
    }
}

/**
 * Counts stroke triangles whose centroid sits inside one axis-aligned area.
 * @param {number[]} positions
 * @param {{ minX: number, maxX: number, minY: number, maxY: number }} bounds
 * @returns {number}
 */
function countTriangleCentroidsInsideBounds(positions, bounds) {
    let count = 0

    for (let index = 0; index < positions.length; index += 9) {
        const centroidX =
            (positions[index] + positions[index + 3] + positions[index + 6]) / 3
        const centroidY =
            (positions[index + 1] +
                positions[index + 4] +
                positions[index + 7]) /
            3

        if (
            centroidX > bounds.minX &&
            centroidX < bounds.maxX &&
            centroidY > bounds.minY &&
            centroidY < bounds.maxY
        ) {
            count += 1
        }
    }

    return count
}

/**
 * Returns true when one geometry has a triangle covering a local XY point.
 * @param {any} geometry
 * @param {{ x: number, y: number }} point
 * @returns {boolean}
 */
function geometryContainsPointTriangle(geometry, point) {
    const sourceGeometry = geometry.index ? geometry.toNonIndexed() : geometry
    const position = sourceGeometry.getAttribute('position')

    for (let index = 0; index < position.count; index += 3) {
        const triangle = [0, 1, 2].map((offset) => ({
            x: position.getX(index + offset),
            y: position.getY(index + offset)
        }))

        if (pointInsideTriangle(point, triangle)) {
            return true
        }
    }

    return false
}

/**
 * Returns true when a point is inside one triangle.
 * @param {{ x: number, y: number }} point
 * @param {{ x: number, y: number }[]} triangle
 * @returns {boolean}
 */
function pointInsideTriangle(point, triangle) {
    const signs = triangle.map((current, index) => {
        const next = triangle[(index + 1) % triangle.length]
        return (
            (point.x - next.x) * (current.y - next.y) -
            (current.x - next.x) * (point.y - next.y)
        )
    })
    const hasNegative = signs.some((sign) => sign < -0.001)
    const hasPositive = signs.some((sign) => sign > 0.001)

    return !(hasNegative && hasPositive)
}

test('PcbScene3dSilkscreenFactory cuts side drill cutouts from polygon fills', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 10, y: 20 },
                            { x: 80, y: 20 },
                            { x: 80, y: 90 },
                            { x: 10, y: 90 }
                        ]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 35, y: 40 },
                        { x: 55, y: 40 },
                        { x: 55, y: 60 },
                        { x: 35, y: 60 }
                    ]
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const fillMesh = group.children[0].children[0]

    assert.equal(fillMesh.geometry.type, 'ShapeGeometry')
    assert.equal(fillMesh.geometry.shape.holes.length, 1)
    assert.deepEqual(fillMesh.geometry.shape.holes[0].commands, [
        { type: 'moveTo', x: 30, y: 30 },
        { type: 'lineTo', x: 50, y: 30 },
        { type: 'lineTo', x: 50, y: 50 },
        { type: 'lineTo', x: 30, y: 50 },
        { type: 'closePath' }
    ])
})

test('PcbScene3dSilkscreenFactory cuts bottom drill cutouts from mirrored polygon fills', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: { fills: [], tracks: [], arcs: [], drillCutouts: [] },
            bottom: {
                fills: [
                    {
                        points: [
                            { x: 10, y: 20 },
                            { x: 80, y: 20 },
                            { x: 80, y: 90 },
                            { x: 10, y: 90 }
                        ]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 35, y: 40 },
                        { x: 55, y: 40 },
                        { x: 55, y: 60 },
                        { x: 35, y: 60 }
                    ]
                ]
            }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const bottomGroup = group.children[0]
    const fillMesh = bottomGroup.children[0]

    assert.equal(bottomGroup.rotation.x, Math.PI)
    assert.equal(fillMesh.geometry.type, 'ShapeGeometry')
    assert.equal(fillMesh.geometry.shape.holes.length, 1)
    assert.deepEqual(fillMesh.geometry.shape.holes[0].commands, [
        { type: 'moveTo', x: 30, y: -30 },
        { type: 'lineTo', x: 50, y: -30 },
        { type: 'lineTo', x: 50, y: -50 },
        { type: 'lineTo', x: 30, y: -50 },
        { type: 'closePath' }
    ])
})

test('PcbScene3dSilkscreenFactory clips stroke geometry away from drill cutouts', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks: [{ x1: 10, y1: 20, x2: 80, y2: 20, width: 8 }],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 25, y: 14 },
                        { x: 65, y: 14 },
                        { x: 65, y: 26 },
                        { x: 25, y: 26 }
                    ]
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const topGroup = group.children[0]

    assert.equal(topGroup.children.length, 1)
    assert.equal(
        topGroup.children.some(
            (child) => child.geometry?.type === 'ShapeGeometry'
        ),
        false
    )

    const positions =
        topGroup.children[0].geometry.attributes.get('position').array
    assert.equal(
        countTriangleCentroidsInsideBounds(positions, {
            minX: 20,
            maxX: 60,
            minY: 4,
            maxY: 16
        }),
        0
    )
})

test('PcbScene3dSilkscreenFactory clips mirrored bottom strokes away from drill cutouts', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: { fills: [], tracks: [], arcs: [], drillCutouts: [] },
            bottom: {
                fills: [],
                tracks: [{ x1: 10, y1: 20, x2: 80, y2: 20, width: 8 }],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 25, y: 14 },
                        { x: 65, y: 14 },
                        { x: 65, y: 26 },
                        { x: 25, y: 26 }
                    ]
                ]
            }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const bottomGroup = group.children[0]
    const positions =
        bottomGroup.children[0].geometry.attributes.get('position').array

    assert.equal(bottomGroup.rotation.x, Math.PI)
    assert.equal(
        countTriangleCentroidsInsideBounds(positions, {
            minX: 20,
            maxX: 60,
            minY: -16,
            maxY: -4
        }),
        0
    )
})

test('PcbScene3dSilkscreenFactory clips long stroke triangles crossing drill centers', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks: [{ x1: 0, y1: 0, x2: 100, y2: 0, width: 8 }],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 48, y: -2 },
                        { x: 52, y: -2 },
                        { x: 52, y: 2 },
                        { x: 48, y: 2 }
                    ]
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const positions =
        group.children[0].children[0].geometry.attributes.get('position').array

    for (let index = 0; index < positions.length; index += 9) {
        assert.equal(
            pointInsideTriangle({ x: 50, y: 0 }, [
                { x: positions[index], y: positions[index + 1] },
                { x: positions[index + 3], y: positions[index + 4] },
                { x: positions[index + 6], y: positions[index + 7] }
            ]),
            false
        )
    }
})

test('PcbScene3dSilkscreenFactory clips long hatch strokes locally around drills', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [],
                tracks: [{ x1: 50, y1: 0, x2: 50, y2: 100, width: 1.2 }],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 48, y: 48 },
                        { x: 52, y: 48 },
                        { x: 52, y: 52 },
                        { x: 48, y: 52 }
                    ]
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const geometry = group.children[0].children[0].geometry

    assert.equal(
        geometryContainsPointTriangle(geometry, { x: 50, y: 50 }),
        false
    )
    assert.equal(
        geometryContainsPointTriangle(geometry, { x: 50, y: 20 }),
        true
    )
    assert.equal(
        geometryContainsPointTriangle(geometry, { x: 50, y: 80 }),
        true
    )
})

test('PcbScene3dSilkscreenFactory clips vector text strokes away from drill cutouts', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [],
                tracks: [],
                arcs: [],
                texts: [
                    {
                        text: '-',
                        x: 50,
                        y: 50,
                        height: 30,
                        strokeWidth: 10,
                        hAlign: 'center',
                        vAlign: 'center'
                    }
                ],
                drillCutouts: [
                    [
                        { x: 52, y: 52 },
                        { x: 56, y: 52 },
                        { x: 56, y: 56 },
                        { x: 52, y: 56 }
                    ]
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const topGroup = group.children[0]
    const textGroup = topGroup.children.find(
        (child) => child.name === 'copper-texts'
    )
    const textMesh = textGroup?.children[0]

    assert.ok(textMesh)
    assert.equal(
        geometryContainsPointTriangle(textMesh.geometry, { x: 54, y: 54 }),
        false
    )
})

test('PcbScene3dSilkscreenFactory keeps authored fill holes when drill cutouts duplicate them', () => {
    const duplicateHoles = Array.from({ length: 50 }, (_, index) =>
        squareCutout(8 + (index % 10) * 12, 8 + Math.floor(index / 10) * 12, 2)
    )
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 140, y: 0 },
                            { x: 140, y: 260 },
                            { x: 0, y: 260 }
                        ],
                        holes: duplicateHoles
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: duplicateHoles
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const fillMesh = group.children[0].children[0]

    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 8, y: 8 }),
        false
    )
    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 130, y: 250 }),
        true
    )
})

test('PcbScene3dSilkscreenFactory keeps fill edges beside duplicate authored holes', () => {
    const verticalHole = [
        { x: 48, y: 10 },
        { x: 52, y: 10 },
        { x: 52, y: 90 },
        { x: 48, y: 90 }
    ]
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 100 },
                            { x: 0, y: 100 }
                        ],
                        holes: [verticalHole]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: [verticalHole]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const fillMesh = group.children[0].children[0]

    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 47, y: 50 }),
        true
    )
    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 53, y: 50 }),
        true
    )
})

test('PcbScene3dSilkscreenFactory clips drill-copy fill holes locally', () => {
    const drillHoles = Array.from({ length: 9 }, (_, index) =>
        squareCutout(50, 10 + index * 10, 2)
    )
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 100 },
                            { x: 0, y: 100 }
                        ],
                        holes: drillHoles
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: drillHoles
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const fillMesh = group.children[0].children[0]

    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 50, y: 50 }),
        false
    )
    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 50, y: 55 }),
        true
    )
})

test('PcbScene3dSilkscreenFactory removes slivers inside overlapping authored holes', () => {
    const leftHole = [
        { x: 20, y: 20 },
        { x: 70, y: 20 },
        { x: 70, y: 80 },
        { x: 20, y: 80 }
    ]
    const rightHole = [
        { x: 50, y: 30 },
        { x: 90, y: 30 },
        { x: 90, y: 70 },
        { x: 50, y: 70 }
    ]
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 100 },
                            { x: 0, y: 100 }
                        ],
                        holes: [leftHole, rightHole]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: []
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const fillMesh = group.children[0].children[0]

    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 80, y: 50 }),
        false
    )
    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 10, y: 50 }),
        true
    )
})

test('PcbScene3dSilkscreenFactory skips inverted vector text duplicates when native knockouts exist', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                nativeTextKnockouts: true,
                fills: [],
                tracks: [],
                arcs: [],
                drillCutouts: [],
                texts: [
                    {
                        text: 'CUTOUT',
                        x: 40,
                        y: 40,
                        height: 40,
                        strokeWidth: 4,
                        isInverted: true
                    }
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const textGroup = group.children
        .flatMap((child) => child.children || [])
        .find((child) => child.name === 'copper-texts')

    assert.equal(textGroup?.children.length || 0, 0)
})

test('PcbScene3dSilkscreenFactory removes bottom fill triangles overlapping drill cutouts', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: { fills: [], tracks: [], arcs: [], drillCutouts: [] },
            bottom: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 100 },
                            { x: 0, y: 100 }
                        ]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 45, y: -5 },
                        { x: 55, y: -5 },
                        { x: 55, y: 10 },
                        { x: 45, y: 10 }
                    ]
                ]
            }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const bottomGroup = group.children[0]
    const fillMesh = bottomGroup.children[0]

    assert.equal(bottomGroup.rotation.x, Math.PI)
    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 50, y: -2 }),
        false
    )
})

/**
 * Builds a square cutout polygon around one center.
 * @param {number} x
 * @param {number} y
 * @param {number} radius
 * @returns {{ x: number, y: number }[]}
 */
function squareCutout(x, y, radius) {
    return [
        { x: x - radius, y: y - radius },
        { x: x + radius, y: y - radius },
        { x: x + radius, y: y + radius },
        { x: x - radius, y: y + radius }
    ]
}

test('PcbScene3dSilkscreenFactory removes top fill triangles overlapping drill cutouts', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 100 },
                            { x: 0, y: 100 }
                        ]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: [
                    [
                        { x: 45, y: -5 },
                        { x: 55, y: -5 },
                        { x: 55, y: 10 },
                        { x: 45, y: 10 }
                    ]
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const topGroup = group.children[0]
    const fillMesh = topGroup.children[0]

    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 50, y: 2 }),
        false
    )
})

test('PcbScene3dSilkscreenFactory preserves authored fill area around non-drill holes', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE_REAL,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 100, y: 0 },
                            { x: 100, y: 100 },
                            { x: 0, y: 100 }
                        ],
                        holes: [
                            [
                                { x: 40, y: 40 },
                                { x: 60, y: 40 },
                                { x: 60, y: 60 },
                                { x: 40, y: 60 }
                            ]
                        ]
                    }
                ],
                tracks: [],
                arcs: [],
                drillCutouts: []
            },
            bottom: { fills: [], tracks: [], arcs: [], drillCutouts: [] }
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )
    const topGroup = group.children[0]
    const fillMesh = topGroup.children[0]

    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 30, y: 50 }),
        true
    )
    assert.equal(
        geometryContainsPointTriangle(fillMesh.geometry, { x: 50, y: 50 }),
        false
    )
})
