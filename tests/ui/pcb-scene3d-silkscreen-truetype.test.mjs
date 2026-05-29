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
                        fillText(text, x, y) {
                            this.canvas.__drawOps.push({
                                type: 'fillText',
                                composite: this.globalCompositeOperation,
                                style: this.fillStyle,
                                font: this.font,
                                text,
                                x,
                                y
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

test('PcbScene3dSilkscreenFactory keeps single-line inverted backgrounds to measured glyph height', () => {
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
        assert.equal(canvas.__drawOps[0].height, 68)
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
    })
})

test('PcbScene3dSilkscreenFactory honors margin border width for tight inverted text', () => {
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
        assert.equal(canvas.__drawOps[0].height, 80)
        assert.equal(canvas.__drawOps[1].composite, 'destination-out')
        assert.equal(canvas.__drawOps[1].x, 20)
    })
})

test('PcbScene3dSilkscreenFactory uses authored inverted rectangle dimensions when requested', () => {
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
                            height: 60,
                            isInverted: true,
                            marginBorderWidth: 10,
                            useInvertedRectangle: true,
                            textboxRectWidth: 240,
                            textboxRectHeight: 70,
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
        const mesh = findTrueTypeGroup(group).children[0]
        const canvas = mesh.material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].width, 240)
        assert.equal(canvas.__drawOps[0].height, 70)
        assert.equal(mesh.geometry.bounds.maxX - mesh.geometry.bounds.minX, 240)
        assert.equal(mesh.geometry.bounds.maxY - mesh.geometry.bounds.minY, 70)
    })
})

test('PcbScene3dSilkscreenFactory applies margin around compact implicit inverted boxes', () => {
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
                            text: 'Q',
                            x: 20,
                            y: 30,
                            height: 60,
                            isInverted: true,
                            marginBorderWidth: 7,
                            useInvertedRectangle: false,
                            textboxRectWidth: 110.331,
                            textboxRectHeight: 42.705,
                            textboxRectJustification: 5,
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
        const mesh = findTrueTypeGroup(group).children[0]
        const canvas = mesh.material.options.map.image
        const bounds = mesh.geometry.bounds

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].width, 124.331)
        assert.equal(canvas.__drawOps[0].height, 56.705)
        assert.equal(Number(canvas.__drawOps[1].x.toFixed(4)), 50.1655)
        assert.equal(Number((bounds.maxX - bounds.minX).toFixed(3)), 124.331)
        assert.equal(Number((bounds.maxY - bounds.minY).toFixed(3)), 56.705)
        assert.equal(Number(bounds.minX.toFixed(3)), -7)
        assert.equal(Number(bounds.maxX.toFixed(3)), 117.331)
        assert.equal(Number(bounds.minY.toFixed(4)), -16.3525)
        assert.equal(Number(bounds.maxY.toFixed(4)), 40.3525)
    })
})

test('PcbScene3dSilkscreenFactory keeps oversized implicit inverted boxes to natural text bounds', () => {
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
                            text: 'NODEMCU',
                            x: 20,
                            y: 30,
                            height: 200,
                            isInverted: true,
                            marginBorderWidth: 20,
                            useInvertedRectangle: false,
                            textboxRectWidth: 6639.5997,
                            textboxRectHeight: 1017.6846,
                            textboxRectJustification: 5,
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
        const mesh = findTrueTypeGroup(group).children[0]
        const canvas = mesh.material.options.map.image

        assert.equal(canvas.__drawOps[0].type, 'fillRect')
        assert.equal(canvas.__drawOps[0].width, 208)
        assert.equal(canvas.__drawOps[0].height, 80)
        assert.equal(mesh.geometry.bounds.maxX - mesh.geometry.bounds.minX, 208)
        assert.equal(mesh.geometry.bounds.maxY - mesh.geometry.bounds.minY, 80)
    })
})

test('PcbScene3dSilkscreenFactory keeps wide implicit authored boxes baseline anchored', () => {
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
                            text: 'NODEMCU',
                            height: 90,
                            isInverted: true,
                            marginBorderWidth: 20,
                            useInvertedRectangle: false,
                            textboxRectWidth: 385.259,
                            textboxRectHeight: 67.6838,
                            textboxRectJustification: 5,
                            fontTypeName: 'TrueType',
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
        const mesh = findTrueTypeGroup(group).children[0]
        const canvas = mesh.material.options.map.image

        assert.equal(Number(canvas.__drawOps[1].x.toFixed(4)), 108.6295)
        assert.equal(Number(mesh.geometry.bounds.minX.toFixed(4)), -108.6295)
        assert.equal(Number(mesh.geometry.bounds.maxX.toFixed(4)), 276.6295)
        assert.equal(Number(mesh.geometry.bounds.minY.toFixed(4)), -21.8419)
        assert.equal(Number(mesh.geometry.bounds.maxY.toFixed(4)), 45.8419)
    })
})

test('PcbScene3dSilkscreenFactory rotates authored implicit text boxes with their label', () => {
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
                            text: 'SPI',
                            x: 20,
                            y: 30,
                            height: 60,
                            rotation: 90,
                            isInverted: true,
                            marginBorderWidth: 7,
                            useInvertedRectangle: false,
                            textboxRectWidth: 109.2195,
                            textboxRectHeight: 33.813,
                            textboxRectJustification: 5,
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
        const mesh = findTrueTypeGroup(group).children[0]
        const canvas = mesh.material.options.map.image
        const bounds = mesh.geometry.bounds

        assert.equal(canvas.__drawOps[0].width, 123.2195)
        assert.equal(canvas.__drawOps[0].height, 47.813)
        assert.equal(Number(canvas.__drawOps[1].x.toFixed(4)), 25.6097)
        assert.equal(Number((bounds.maxX - bounds.minX).toFixed(4)), 123.2195)
        assert.equal(Number((bounds.maxY - bounds.minY).toFixed(4)), 47.813)
        assert.equal(Number(bounds.minX.toFixed(4)), -7)
        assert.equal(Number(bounds.maxX.toFixed(4)), 116.2195)
        assert.equal(Number(bounds.minY.toFixed(4)), -8.813)
        assert.equal(Number(bounds.maxY.toFixed(4)), 39)
        assert.equal(mesh.rotation.z, Math.PI / 2)
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
