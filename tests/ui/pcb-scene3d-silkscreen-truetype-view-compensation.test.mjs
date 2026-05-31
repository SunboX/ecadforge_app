import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'
import { PcbScene3dSilkscreenFactory } from '../../src/ui/PcbScene3dSilkscreenFactory.mjs'

/**
 * Builds the minimal Three-compatible doubles for label transform tests.
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

    return {
        Group: FakeGroup,
        Mesh: FakeMesh,
        MeshBasicMaterial: class {
            /** @param {object} options */
            constructor(options) {
                this.options = options
            }
        },
        CanvasTexture: class {
            /** @param {any} canvas */
            constructor(canvas) {
                this.type = 'CanvasTexture'
                this.image = canvas
            }
        },
        PlaneGeometry: class {
            /** @param {number} width @param {number} height */
            constructor(width, height) {
                this.width = width
                this.height = height
            }

            /** @returns {void} */
            translate() {}

            /** @returns {void} */
            scale() {}
        },
        DoubleSide: 'DoubleSide'
    }
}

/**
 * Runs a callback with a tiny canvas document installed.
 * @param {() => void} callback
 * @returns {void}
 */
function withFakeCanvas(callback) {
    const originalDocument = globalThis.document

    globalThis.document = {
        createElement() {
            const context = {
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
                fillRect() {},
                fillText() {}
            }

            return {
                width: 0,
                height: 0,
                getContext() {
                    return context
                }
            }
        }
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
 * Returns the first rendered TrueType text mesh.
 * @param {any} group
 * @returns {any}
 */
function findTrueTypeTextMesh(group) {
    return group.children[0].children.find(
        (child) => child.name === 'true-type-texts'
    ).children[0]
}

/**
 * Builds one rendered silkscreen text mesh on the requested board side.
 * @param {'top' | 'bottom'} side
 * @returns {any}
 */
function buildTextMesh(side) {
    const textSide = {
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
    }
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        createFakeThree(),
        {
            top: side === 'top' ? textSide : emptySilkscreenSide(),
            bottom: side === 'bottom' ? textSide : emptySilkscreenSide()
        },
        18,
        -18,
        (x, y) => ({ x, y })
    )

    return findTrueTypeTextMesh(group)
}

/**
 * Builds an empty side descriptor.
 * @returns {{ fills: any[], tracks: any[], arcs: any[], texts: any[] }}
 */
function emptySilkscreenSide() {
    return { fills: [], tracks: [], arcs: [], texts: [] }
}

test('PcbScene3dSilkscreenFactory compensates TrueType labels for mirrored top views', () => {
    withFakeCanvas(() => {
        const textMesh = buildTextMesh('top')

        PcbScene3dExternalModels.applyViewCompensation(textMesh, {
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

test('PcbScene3dSilkscreenFactory compensates top TrueType labels for mirrored bottom presets', () => {
    withFakeCanvas(() => {
        const textMesh = buildTextMesh('top')

        PcbScene3dExternalModels.applyViewCompensation(textMesh, {
            x: -1,
            y: 1,
            z: 1
        })

        assert.equal(textMesh.scale.x, 1)
        assert.equal(textMesh.scale.y, -1)
        assert.equal(textMesh.scale.z, 1)
    })
})

test('PcbScene3dSilkscreenFactory leaves bottom TrueType labels unflipped in bottom presets', () => {
    withFakeCanvas(() => {
        const textMesh = buildTextMesh('bottom')

        PcbScene3dExternalModels.applyViewCompensation(textMesh, {
            x: -1,
            y: 1,
            z: 1
        })

        assert.equal(textMesh.scale.x, 1)
        assert.equal(textMesh.scale.y, 1)
        assert.equal(textMesh.scale.z, 1)
    })
})

test('PcbScene3dSilkscreenFactory leaves bottom TrueType labels unflipped in isometric presets', () => {
    withFakeCanvas(() => {
        const textMesh = buildTextMesh('bottom')

        PcbScene3dExternalModels.applyViewCompensation(textMesh, {
            x: 1,
            y: -1,
            z: 1
        })

        assert.equal(textMesh.scale.x, 1)
        assert.equal(textMesh.scale.y, 1)
        assert.equal(textMesh.scale.z, 1)
    })
})
