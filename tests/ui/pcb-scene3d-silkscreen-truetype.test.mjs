import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'
import { PcbScene3dSilkscreenFactory } from '../../src/ui/PcbScene3dSilkscreenFactory.mjs'
import { PcbScene3dTrueTypeTextFactory } from '../../src/ui/PcbScene3dTrueTypeTextFactory.mjs'

/**
 * Builds the small Three-compatible surface needed for TrueType text tests.
 * @returns {any}
 */
function createFakeThree() {
    class FakeVector3 {
        /** @returns {void} */
        set(x, y, z) {
            this.x = x
            this.y = y
            this.z = z
        }
    }
    class FakeGroup {
        constructor() {
            this.children = []
            this.rotation = {}
        }

        /** @param {...any} children */
        add(...children) {
            this.children.push(...children)
        }
    }
    class FakeMesh {
        /** @param {any} geometry @param {any} material */
        constructor(geometry, material) {
            this.geometry = geometry
            this.material = material
            this.position = new FakeVector3()
            this.scale = new FakeVector3()
            this.scale.set(1, 1, 1)
            this.rotation = {}
            this.userData = {}
        }
    }
    class FakePlaneGeometry {
        /** @param {number} width @param {number} height */
        constructor(width, height) {
            this.type = 'PlaneGeometry'
            this.bounds = {
                minX: -width / 2,
                maxX: width / 2,
                minY: -height / 2,
                maxY: height / 2
            }
        }

        /** @param {number} x @param {number} y */
        translate(x, y) {
            this.bounds.minX += x
            this.bounds.maxX += x
            this.bounds.minY += y
            this.bounds.maxY += y
        }

        /** @param {number} x @param {number} y */
        scale(x, y) {
            this.bounds = {
                minX: Math.min(this.bounds.minX * x, this.bounds.maxX * x),
                maxX: Math.max(this.bounds.minX * x, this.bounds.maxX * x),
                minY: Math.min(this.bounds.minY * y, this.bounds.maxY * y),
                maxY: Math.max(this.bounds.minY * y, this.bounds.maxY * y)
            }
        }
    }
    class FakeShape {
        constructor() {
            this.commands = []
            this.holes = []
        }

        moveTo() {}
        lineTo() {}
        closePath() {}
    }

    return {
        Group: FakeGroup,
        Mesh: FakeMesh,
        MeshBasicMaterial: class {
            constructor(options) {
                this.options = options
            }
        },
        MeshStandardMaterial: class {
            constructor(options) {
                this.options = options
            }
        },
        CanvasTexture: class {
            constructor(canvas) {
                this.type = 'CanvasTexture'
                this.image = canvas
            }
        },
        PlaneGeometry: FakePlaneGeometry,
        Shape: FakeShape,
        Path: FakeShape,
        ShapeGeometry: class {
            constructor(shape) {
                this.shape = shape
            }
        },
        DoubleSide: 'DoubleSide'
    }
}

/**
 * Runs a callback with a minimal canvas document installed.
 * @param {() => void} callback
 * @returns {void}
 */
function withFakeCanvas(callback) {
    const originalDocument = globalThis.document

    globalThis.document = {
        createElement() {
            return {
                width: 0,
                height: 0,
                __drawOps: [],
                getContext() {
                    return {
                        fillStyle: '',
                        font: '',
                        globalCompositeOperation: 'source-over',
                        textAlign: '',
                        textBaseline: '',
                        clearRect() {},
                        scale() {},
                        measureText(value) {
                            return {
                                width: String(value).length * 24,
                                actualBoundingBoxAscent: 32,
                                actualBoundingBoxDescent: 8
                            }
                        },
                        fillRect(x, y, width, height) {
                            this.canvas.__drawOps.push({
                                type: 'fillRect',
                                composite: this.globalCompositeOperation,
                                style: this.fillStyle,
                                x,
                                y,
                                width,
                                height
                            })
                        },
                        fillText(text) {
                            this.canvas.__drawOps.push({
                                type: 'fillText',
                                composite: this.globalCompositeOperation,
                                style: this.fillStyle,
                                font: this.font,
                                text
                            })
                        }
                    }
                }
            }
        }
    }

    const createElement = globalThis.document.createElement
    globalThis.document.createElement = (...args) => {
        const canvas = createElement(...args)
        const getContext = canvas.getContext
        canvas.getContext = (...contextArgs) => {
            const context = getContext.apply(canvas, contextArgs)
            context.canvas = canvas
            return context
        }
        return canvas
    }

    try {
        callback()
    } finally {
        if (originalDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
    }
}

/**
 * Returns the TrueType text group from a rendered silkscreen group.
 * @param {any} group
 * @returns {any}
 */
function findTrueTypeGroup(group) {
    return group.children[0].children.find(
        (child) => child.name === 'true-type-texts'
    )
}

test('PcbScene3dSilkscreenFactory renders inverted TrueType text as a knockout fill', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
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
                            isInverted: true,
                            useInvertedRectangle: true,
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
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].style, '#2f6a2c')
        assert.ok(canvas.__drawOps[0].width > 400)
        assert.equal(canvas.__drawOps[1].type, 'fillText')
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
        assert.equal(canvas.__drawOps[1].text, 'connect.theWorld()')
    })
})

test('PcbScene3dSilkscreenFactory renders tight inverted TrueType text as a knockout', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
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
                            isInverted: true,
                            useInvertedRectangle: false,
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
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].style, '#2f6a2c')
        assert.equal(canvas.__drawOps[1].type, 'fillText')
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
        assert.equal(canvas.__drawOps[1].text, 'NODEMCU')
    })
})

test('PcbScene3dSilkscreenFactory cuts non-rectangle inverted TrueType text out of dense overlay fill', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0xebebeb,
                    knockoutColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'NODEMCU',
                            x: 20,
                            y: 30,
                            height: 60,
                            isInverted: true,
                            useInvertedRectangle: false,
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
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].style, '#ebebeb')
        assert.equal(canvas.__drawOps[1].type, 'fillText')
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
        assert.equal(canvas.__drawOps[1].text, 'NODEMCU')
    })
})

test('PcbScene3dSilkscreenFactory uses the layer fill as the inverted TrueType background', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0xebebeb,
                    knockoutColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'NODEMCU',
                            x: 20,
                            y: 30,
                            height: 60,
                            isInverted: true,
                            useInvertedRectangle: true,
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
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].style, '#ebebeb')
        assert.equal(canvas.__drawOps[1].type, 'fillText')
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
        assert.equal(canvas.__drawOps[1].text, 'NODEMCU')
    })
})

test('PcbScene3dSilkscreenFactory keeps single-line inverted backgrounds to glyph height', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0xebebeb,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'LABEL',
                            x: 20,
                            y: 30,
                            height: 100,
                            isInverted: true,
                            fontTypeName: 'TrueType',
                            fontFamily: 'Consolas',
                            trueTypeFontScale: 1
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].height, 128)
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
    })
})

test('PcbScene3dSilkscreenFactory ignores rectangle margin for tight inverted text', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0xebebeb,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'LABEL',
                            x: 20,
                            y: 30,
                            height: 100,
                            isInverted: true,
                            marginBorderWidth: 20,
                            useInvertedRectangle: false,
                            fontTypeName: 'TrueType',
                            fontFamily: 'Consolas',
                            trueTypeFontScale: 1
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].height, 128)
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
    })
})

test('PcbScene3dSilkscreenFactory scales TrueType text from Altium cell height', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'WI-FI IOT PLATFORM',
                            x: 20,
                            y: 30,
                            height: 70,
                            fontType: 1,
                            fontFamily: 'Consolas',
                            fontWeight: 700
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image
        const draw = canvas.__drawOps.find((op) => op.type === 'fillText')

        assert.match(draw.font, /700 62\.65px/u)
    })
})

test('PcbScene3dSilkscreenFactory uses embedded TrueType font metrics for text scale', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fillColor: 0xebebeb,
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'WI-FI IOT PLATFORM',
                            x: 20,
                            y: 30,
                            height: 70,
                            fontType: 1,
                            fontFamily: 'Panel Mono',
                            fontWeight: 700,
                            fontMetrics: {
                                emScaleFromPcbHeight: 0.75
                            }
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image
        const draw = canvas.__drawOps.find((op) => op.type === 'fillText')

        assert.match(draw.font, /700 52\.5px/u)
    })
})

test('PcbScene3dSilkscreenFactory uses metric-compatible fallbacks for missing Altium fonts', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'NODEMCU',
                            height: 70,
                            fontTypeName: 'TrueType',
                            fontFamily: 'Consolas\u0000as'
                        }
                    ]
                },
                bottom: { fills: [], tracks: [], arcs: [], texts: [] }
            },
            18,
            -18,
            (x, y) => ({ x, y })
        )
        const canvas =
            findTrueTypeGroup(group).children[0].material.options.map.image
        const draw = canvas.__drawOps.find((op) => op.type === 'fillText')

        assert.match(
            draw.font,
            /"Consolas", "Menlo", "Monaco", "Liberation Mono", "Courier New", monospace/u
        )
        assert.equal(draw.font.includes('\u0000'), false)
    })
})

test('PcbScene3dTrueTypeTextFactory loads embedded Altium fonts before canvas rendering', async () => {
    const originalDocument = globalThis.document
    const originalFontFace = globalThis.FontFace
    const addedFaces = []
    const constructedFaces = []

    class FakeFontFace {
        /** @param {string} family @param {string} source @param {object} descriptors */
        constructor(family, source, descriptors) {
            this.family = family
            this.source = source
            this.descriptors = descriptors
            constructedFaces.push(this)
        }

        /** @returns {Promise<FakeFontFace>} */
        async load() {
            return this
        }
    }

    globalThis.FontFace = FakeFontFace
    globalThis.document = {
        fonts: {
            add(face) {
                addedFaces.push(face)
            }
        }
    }

    try {
        await PcbScene3dTrueTypeTextFactory.prepareEmbeddedFonts([
            {
                name: 'Panel Mono',
                style: 'Bold',
                mimeType: 'font/ttf',
                format: 'truetype',
                payloadBase64: 'AA==',
                metrics: {
                    weightClass: 700
                }
            }
        ])
    } finally {
        if (originalFontFace) {
            globalThis.FontFace = originalFontFace
        } else {
            delete globalThis.FontFace
        }
        if (originalDocument) {
            globalThis.document = originalDocument
        } else {
            delete globalThis.document
        }
    }

    assert.equal(constructedFaces[0].family, 'Panel Mono')
    assert.equal(
        constructedFaces[0].source,
        "url(data:font/ttf;base64,AA==) format('truetype')"
    )
    assert.deepEqual(constructedFaces[0].descriptors, {
        style: 'normal',
        weight: '700'
    })
    assert.equal(addedFaces[0], constructedFaces[0])
})

test('PcbScene3dSilkscreenFactory skips inverted TrueType duplicates when native knockouts exist', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    nativeTextKnockouts: true,
                    fillColor: 0xebebeb,
                    strokeColor: 0x2f6a2c,
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'CUTOUT',
                            height: 60,
                            isInverted: true,
                            fontTypeName: 'TrueType'
                        },
                        {
                            text: 'VISIBLE',
                            height: 60,
                            isInverted: false,
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
        const textGroup = findTrueTypeGroup(group)

        assert.equal(textGroup.children.length, 1)
        assert.deepEqual(
            textGroup.children[0].material.options.map.image.__drawOps
                .filter((op) => op.type === 'fillText')
                .map((op) => op.text),
            ['VISIBLE']
        )
    })
})

test('PcbScene3dSilkscreenFactory compensates TrueType labels for mirrored top views', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'LABEL',
                            x: 20,
                            y: 30,
                            height: 60,
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
        const textMesh = findTrueTypeGroup(group).children[0]

        PcbScene3dExternalModels.applyViewCompensation(group, {
            x: 1,
            y: -1,
            z: 1
        })

        assert.equal(textMesh.position.y, 30)
        assert.equal(textMesh.scale.x, 1)
        assert.equal(textMesh.scale.y, -1)
        assert.equal(textMesh.scale.z, 1)
    })
})

test('PcbScene3dSilkscreenFactory leaves TrueType labels unflipped in bottom views', () => {
    withFakeCanvas(() => {
        const group = PcbScene3dSilkscreenFactory.buildGroup(
            createFakeThree(),
            {
                top: {
                    fills: [],
                    tracks: [],
                    arcs: [],
                    texts: [
                        {
                            text: 'LABEL',
                            x: 20,
                            y: 30,
                            height: 60,
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
        const textMesh = findTrueTypeGroup(group).children[0]

        PcbScene3dExternalModels.applyViewCompensation(group, {
            x: -1,
            y: 1,
            z: 1
        })

        assert.equal(textMesh.scale.x, 1)
        assert.equal(textMesh.scale.y, 1)
        assert.equal(textMesh.scale.z, 1)
    })
})
