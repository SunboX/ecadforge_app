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

    class FakePlaneGeometry {
        /**
         * @param {number} width
         * @param {number} height
         */
        constructor(width, height) {
            this.type = 'PlaneGeometry'
            this.parameters = { width, height }
            this.bounds = {
                minX: -width / 2,
                maxX: width / 2,
                minY: -height / 2,
                maxY: height / 2
            }
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {void}
         */
        translate(x, y) {
            this.bounds.minX += x
            this.bounds.maxX += x
            this.bounds.minY += y
            this.bounds.maxY += y
        }

        /**
         * @param {number} x
         * @param {number} y
         * @returns {void}
         */
        scale(x, y) {
            const scaledX = [this.bounds.minX * x, this.bounds.maxX * x]
            const scaledY = [this.bounds.minY * y, this.bounds.maxY * y]

            this.bounds.minX = Math.min(...scaledX)
            this.bounds.maxX = Math.max(...scaledX)
            this.bounds.minY = Math.min(...scaledY)
            this.bounds.maxY = Math.max(...scaledY)
        }
    }

    class FakeCanvasTexture {
        /**
         * @param {any} canvas
         */
        constructor(canvas) {
            this.type = 'CanvasTexture'
            this.image = canvas
            this.needsUpdate = false
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
        LineSegments: FakeLineSegments,
        LineBasicMaterial: FakeLineBasicMaterial,
        MeshBasicMaterial: FakeMeshBasicMaterial,
        MeshStandardMaterial: FakeMeshStandardMaterial,
        BoxGeometry: FakeBoxGeometry,
        PlaneGeometry: FakePlaneGeometry,
        CanvasTexture: FakeCanvasTexture,
        Shape: FakeShape,
        Path: FakePath,
        ShapeGeometry: FakeShapeGeometry,
        DoubleSide: 'DoubleSide'
    }
}

/**
 * Installs a minimal document/canvas double while one test renders canvas text.
 * @param {() => void} callback
 * @returns {void}
 */
function withFakeCanvas(callback) {
    const hadDocument = Object.hasOwn(globalThis, 'document')
    const originalDocument = globalThis.document

    globalThis.document = {
        /**
         * @param {string} tagName
         * @returns {any}
         */
        createElement(tagName) {
            assert.equal(tagName, 'canvas')

            const canvas = {
                width: 0,
                height: 0,
                __drawOps: [],
                __fillStyles: [],
                /**
                 * @param {string} type
                 * @returns {any}
                 */
                getContext(type) {
                    assert.equal(type, '2d')

                    return {
                        fillStyle: '',
                        font: '',
                        globalCompositeOperation: 'source-over',
                        textAlign: '',
                        textBaseline: '',
                        /**
                         * @returns {void}
                         */
                        clearRect() {},
                        /**
                         * @param {number} x
                         * @param {number} y
                         * @param {number} width
                         * @param {number} height
                         * @returns {void}
                         */
                        fillRect(x, y, width, height) {
                            canvas.__drawOps.push({
                                type: 'fillRect',
                                composite: this.globalCompositeOperation,
                                style: this.fillStyle,
                                x,
                                y,
                                width,
                                height
                            })
                        },
                        /**
                         * @param {string} value
                         * @returns {{ width: number, actualBoundingBoxAscent: number, actualBoundingBoxDescent: number }}
                         */
                        measureText(value) {
                            return {
                                width: String(value).length * 24,
                                actualBoundingBoxAscent: 32,
                                actualBoundingBoxDescent: 8
                            }
                        },
                        /**
                         * @param {string} value
                         * @returns {void}
                         */
                        fillText(value) {
                            canvas.__fillStyles.push(this.fillStyle)
                            canvas.__drawOps.push({
                                type: 'fillText',
                                composite: this.globalCompositeOperation,
                                style: this.fillStyle,
                                text: value
                            })
                        }
                    }
                }
            }

            return canvas
        }
    }

    try {
        callback()
    } finally {
        if (hadDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
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
    assert.equal(topTrackBounds.minX, -44)
    assert.equal(topTrackBounds.maxX, 24)
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
    assert.ok(bottomTrackBounds.maxY <= -142)
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

test('PcbScene3dSilkscreenFactory preserves authored sub-mil track widths', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks: [{ x1: 10, y1: 20, x2: 10, y2: 80, width: 0.57 }],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        12,
        -12,
        (x, y) => ({ x, y })
    )

    const trackMesh = group.children[0].children[0]
    const bounds = resolveBounds(
        trackMesh.geometry.attributes.get('position').array
    )

    assert.equal(Number((bounds.maxX - bounds.minX).toFixed(2)), 0.57)
    assert.equal(Number(bounds.minY.toFixed(3)), 19.715)
    assert.equal(Number(bounds.maxY.toFixed(3)), 80.285)
})

test('PcbScene3dSilkscreenFactory preserves polygon fill outlines', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [
                    {
                        points: [
                            { x: 10, y: 20 },
                            { x: 50, y: 20 },
                            { x: 30, y: 70 }
                        ]
                    }
                ],
                tracks: [],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const fillMesh = group.children[0].children[0]

    assert.equal(fillMesh.geometry.type, 'ShapeGeometry')
    assert.deepEqual(fillMesh.geometry.shape.commands, [
        { type: 'moveTo', x: 5, y: 10 },
        { type: 'lineTo', x: 45, y: 10 },
        { type: 'lineTo', x: 25, y: 60 },
        { type: 'closePath' }
    ])
    assert.equal(fillMesh.position.z, 18)
})

test('PcbScene3dSilkscreenFactory cuts polygon fill holes from shape fills', () => {
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
                        ],
                        holes: [
                            [
                                { x: 35, y: 40 },
                                { x: 55, y: 40 },
                                { x: 55, y: 60 },
                                { x: 35, y: 60 }
                            ]
                        ]
                    }
                ],
                tracks: [],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
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

test('PcbScene3dSilkscreenFactory ignores holes that cross polygon outlines', () => {
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
                        ],
                        holes: [
                            [
                                { x: 35, y: 40 },
                                { x: 55, y: 40 },
                                { x: 55, y: 60 },
                                { x: 35, y: 60 }
                            ],
                            [
                                { x: 70, y: 80 },
                                { x: 95, y: 80 },
                                { x: 95, y: 105 },
                                { x: 70, y: 105 }
                            ]
                        ]
                    }
                ],
                tracks: [],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
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

test('PcbScene3dSilkscreenFactory cuts holes from rectangular fills', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [
                    {
                        x1: 10,
                        y1: 20,
                        x2: 80,
                        y2: 90,
                        holes: [
                            [
                                { x: 35, y: 40 },
                                { x: 55, y: 40 },
                                { x: 55, y: 60 },
                                { x: 35, y: 60 }
                            ]
                        ]
                    }
                ],
                tracks: [],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const fillMesh = group.children[0].children[0]

    assert.equal(fillMesh.geometry.type, 'ShapeGeometry')
    assert.deepEqual(fillMesh.geometry.shape.commands, [
        { type: 'moveTo', x: 5, y: 10 },
        { type: 'lineTo', x: 75, y: 10 },
        { type: 'lineTo', x: 75, y: 80 },
        { type: 'lineTo', x: 5, y: 80 },
        { type: 'closePath' }
    ])
    assert.equal(fillMesh.geometry.shape.holes.length, 1)
})

test('PcbScene3dSilkscreenFactory masks stroke silkscreen at drill cutouts', () => {
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
                        { x: 35, y: 14 },
                        { x: 47, y: 14 },
                        { x: 47, y: 26 },
                        { x: 35, y: 26 }
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
    const cutoutMesh = topGroup.children[1]

    assert.equal(topGroup.children.length, 2)
    assert.equal(cutoutMesh.geometry.type, 'ShapeGeometry')
    assert.equal(cutoutMesh.material.options.color, 0xc9ca78)
    assert.deepEqual(cutoutMesh.geometry.shape.commands, [
        { type: 'moveTo', x: 30, y: 4 },
        { type: 'lineTo', x: 42, y: 4 },
        { type: 'lineTo', x: 42, y: 16 },
        { type: 'lineTo', x: 30, y: 16 },
        { type: 'closePath' }
    ])
    assert.ok(cutoutMesh.position.z > 18)
})

test('PcbScene3dSilkscreenFactory honors side-specific stroke and fill colors', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fillColor: 0xf8f6ef,
                strokeColor: 0x1f477d,
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
                tracks: [{ x1: 10, y1: 20, x2: 80, y2: 20, width: 8 }],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const topGroup = group.children[0]
    const trackMesh = topGroup.children[0]
    const fillMesh = topGroup.children[1]
    const trackZ = trackMesh.geometry.attributes.get('position').array[2]

    assert.equal(trackMesh.material.options.color, 0x1f477d)
    assert.equal(fillMesh.material.options.color, 0xf8f6ef)
    assert.equal(trackMesh.material.options.transparent, false)
    assert.equal(trackMesh.material.options.opacity, 1)
    assert.equal(fillMesh.material.options.transparent, false)
    assert.equal(fillMesh.material.options.opacity, 1)
    assert.ok(trackZ > fillMesh.position.z)
})

test('PcbScene3dSilkscreenFactory renders silkscreen text with the stroke color', () => {
    const THREE = createFakeThree()
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                strokeColor: 0x2f6a2c,
                fills: [],
                tracks: [],
                arcs: [],
                texts: [
                    {
                        text: 'A1',
                        x: 20,
                        y: 30,
                        height: 24,
                        strokeWidth: 4
                    }
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], texts: [] }
        },
        18,
        -18,
        (x, y) => ({ x: x - 5, y: y - 10 })
    )

    const topGroup = group.children[0]
    const textGroup = topGroup.children[0]
    const textMesh = textGroup.children[0]
    const positions = textMesh.geometry.attributes.get('position').array

    assert.equal(textGroup.name, 'copper-texts')
    assert.equal(textMesh.material.options.color, 0x2f6a2c)
    assert.ok(positions.length > 0)
    assert.ok(positions[2] > 18)
})

test('PcbScene3dSilkscreenFactory renders TrueType silkscreen as textured text', () => {
    withFakeCanvas(() => {
        const THREE = createFakeThree()
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            THREE,
            {
                top: {
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'NODEMCU',
                            x: 20,
                            y: 30,
                            height: 60,
                            rotation: 90,
                            mirrored: true,
                            fontType: 1,
                            fontTypeName: 'TrueType',
                            fontFamily: 'Consolas'
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x: x - 5, y: y - 10 })
        )

        const topGroup = group.children[0]
        const textGroup = topGroup.children.find(
            (child) => child.name === 'true-type-texts'
        )
        const textMesh = textGroup?.children[0]

        assert.ok(textGroup)
        assert.equal(textMesh.name, 'true-type-text')
        assert.equal(textMesh.geometry.type, 'PlaneGeometry')
        assert.equal(textMesh.material.options.map.type, 'CanvasTexture')
        assert.equal(textMesh.material.options.transparent, true)
        assert.equal(textMesh.material.options.depthWrite, false)
        assert.equal(textMesh.position.x, 15)
        assert.equal(textMesh.position.y, 20)
        assert.ok(textMesh.position.z > 18)
        assert.equal(textMesh.rotation.z, Math.PI / 2)
        assert.deepEqual(textMesh.material.options.map.image.__fillStyles, [
            '#2f6a2c'
        ])
        assert.equal(
            topGroup.children.some((child) => child.name === 'copper-texts'),
            false
        )
    })
})

test('PcbScene3dSilkscreenFactory paints normal TrueType text with the stroke color', () => {
    withFakeCanvas(() => {
        const THREE = createFakeThree()
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            THREE,
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'connect.theWorld()',
                            x: 20,
                            y: 30,
                            height: 60,
                            mirrored: false,
                            isInverted: false,
                            fontType: 1,
                            fontTypeName: 'TrueType',
                            fontFamily: 'Consolas'
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )

        const topGroup = group.children[0]
        const textGroup = topGroup.children.find(
            (child) => child.name === 'true-type-texts'
        )
        const textMesh = textGroup?.children[0]

        assert.deepEqual(textMesh.material.options.map.image.__fillStyles, [
            '#2f6a2c'
        ])
    })
})

test('PcbScene3dSilkscreenFactory mirrors TrueType planes across the local text axis', () => {
    withFakeCanvas(() => {
        const THREE = createFakeThree()
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            THREE,
            {
                top: {
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'EDGE',
                            x: 100,
                            y: 20,
                            height: 50,
                            rotation: 0,
                            mirrored: true,
                            fontTypeName: 'TrueType'
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )

        const topGroup = group.children[0]
        const textGroup = topGroup.children.find(
            (child) => child.name === 'true-type-texts'
        )
        const textMesh = textGroup?.children[0]
        const bounds = textMesh.geometry.bounds

        assert.equal(textMesh.position.x, 100)
        assert.ok(bounds.minX < 0)
        assert.ok(bounds.maxX > 0)
        assert.ok(bounds.minY < 0)
        assert.ok(bounds.maxY > 0)
    })
})
