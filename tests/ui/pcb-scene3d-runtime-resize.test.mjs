import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'
import { PcbScene3dRuntime } from '../../src/ui/PcbScene3dRuntime.mjs'

/** @type {FakeWebGLRenderer | null} */
let lastRenderer = null
/** @type {FakePerspectiveCamera | null} */
let lastCamera = null
/** @type {FakeResizeObserver | null} */
let lastResizeObserver = null

/**
 * Minimal event target used by the runtime harness.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners = new Map()

    /**
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) this.#listeners.set(type, new Set())
        this.#listeners.get(type)?.add(listener)
    }

    /**
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }
}

/**
 * Minimal mutable vector.
 */
class FakeVector3 {
    /** @param {number} [x] @param {number} [y] @param {number} [z] */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x
        this.y = y
        this.z = z
    }

    /** @param {number} x @param {number} y @param {number} z @returns {this} */
    set(x, y, z) {
        this.x = x
        this.y = y
        this.z = z
        return this
    }

    /** @param {number} scalar @returns {this} */
    multiplyScalar(scalar) {
        this.x *= scalar
        this.y *= scalar
        this.z *= scalar
        return this
    }
}

/**
 * Minimal DOM node for fake renderer mounts.
 */
class FakeDomNode extends FakeEventTarget {
    constructor() {
        super()
        this.className = ''
        this.style = {}
        this.removed = false
    }

    /** @returns {{ width: number, height: number, left: number, top: number }} */
    getBoundingClientRect() {
        return { width: 960, height: 560, left: 0, top: 0 }
    }

    /** @returns {void} */
    remove() {
        this.removed = true
    }
}

/**
 * Minimal fake Three group.
 */
class FakeGroup {
    constructor() {
        this.children = []
        this.position = new FakeVector3()
        this.scale = new FakeVector3(1, 1, 1)
        this.rotation = { x: 0, y: 0, z: 0 }
        this.userData = {}
        this.visible = true
    }

    /** @param {...any} children @returns {void} */
    add(...children) {
        this.children.push(...children)
    }
}

/**
 * Minimal fake shape.
 */
class FakeShape {
    constructor() {
        this.points = []
        this.holes = []
    }

    /** @param {number} x @param {number} y @returns {void} */
    moveTo(x, y) {
        this.points.push({ x, y })
    }

    /** @param {number} x @param {number} y @returns {void} */
    lineTo(x, y) {
        this.points.push({ x, y })
    }

    /** @returns {void} */
    closePath() {}

    /** @returns {{ x: number, y: number }[]} */
    getPoints() {
        return [...this.points]
    }
}

/**
 * Minimal fake geometry.
 */
class FakeGeometry {
    constructor() {
        this.groups = []
    }

    /** @returns {void} */
    translate() {}
}

/**
 * Minimal fake buffer geometry.
 */
class FakeBufferGeometry extends FakeGeometry {
    constructor() {
        super()
        this.attributes = new Map()
    }

    /** @param {string} name @param {any} attribute @returns {void} */
    setAttribute(name, attribute) {
        this.attributes.set(name, attribute)
    }
}

/**
 * Minimal fake renderer.
 */
class FakeWebGLRenderer {
    constructor() {
        this.domElement = new FakeDomNode()
        this.setSizeCalls = []
        this.renderCount = 0
        lastRenderer = this
    }

    /** @returns {void} */
    setPixelRatio() {}

    /** @param {number} width @param {number} height @returns {void} */
    setSize(width, height) {
        this.setSizeCalls.push({ width, height })
    }

    /** @returns {void} */
    render() {
        this.renderCount += 1
    }

    /** @returns {void} */
    dispose() {}
}

/**
 * Minimal fake camera.
 */
class FakePerspectiveCamera {
    /** @param {number} _fov @param {number} aspect */
    constructor(_fov, aspect) {
        this.position = new FakeVector3()
        this.up = new FakeVector3(0, 0, 1)
        this.aspect = aspect
        this.projectionUpdates = 0
        lastCamera = this
    }

    /** @returns {void} */
    lookAt() {}

    /** @returns {void} */
    updateProjectionMatrix() {
        this.projectionUpdates += 1
    }
}

/**
 * Minimal fake orbit controls.
 */
class FakeOrbitControls extends FakeEventTarget {
    constructor() {
        super()
        this.target = new FakeVector3()
        this.updateCount = 0
    }

    /** @returns {void} */
    update() {
        this.updateCount += 1
    }

    /** @returns {void} */
    dispose() {}
}

/**
 * Minimal fake viewport.
 */
class FakeViewportNode {
    constructor() {
        this.children = []
        this.width = 960
        this.height = 560
    }

    /** @returns {{ width: number, height: number }} */
    getBoundingClientRect() {
        return { width: this.width, height: this.height }
    }

    /** @param {...any} children @returns {void} */
    replaceChildren(...children) {
        this.children = children
    }
}

/**
 * Minimal fake ResizeObserver.
 */
class FakeResizeObserver {
    /** @param {() => void} callback */
    constructor(callback) {
        this.callback = callback
        this.observedNode = null
        this.disconnected = false
        lastResizeObserver = this
    }

    /** @param {any} node @returns {void} */
    observe(node) {
        this.observedNode = node
    }

    /** @returns {void} */
    disconnect() {
        this.disconnected = true
    }

    /** @returns {void} */
    trigger() {
        this.callback()
    }
}

/**
 * Builds the fake Three module needed by the resize test.
 * @returns {{ THREE: any, OrbitControls: typeof FakeOrbitControls }}
 */
function createFakeRuntimeModules() {
    return {
        THREE: {
            WebGLRenderer: FakeWebGLRenderer,
            Scene: FakeGroup,
            PerspectiveCamera: FakePerspectiveCamera,
            Group: FakeGroup,
            AmbientLight: FakeGroup,
            DirectionalLight: class FakeDirectionalLight extends FakeGroup {},
            Fog: class FakeFog {},
            Mesh: class FakeMesh extends FakeGroup {
                constructor(geometry, material) {
                    super()
                    this.geometry = geometry
                    this.material = material
                }
            },
            LineLoop: class FakeLineLoop extends FakeGroup {},
            MeshStandardMaterial: class FakeMaterial {
                constructor(options) {
                    this.options = options
                }
            },
            MeshBasicMaterial: class FakeMaterial {},
            LineBasicMaterial: class FakeMaterial {},
            BoxGeometry: FakeGeometry,
            CylinderGeometry: FakeGeometry,
            ExtrudeGeometry: FakeGeometry,
            BufferGeometry: FakeBufferGeometry,
            Float32BufferAttribute: class FakeFloat32BufferAttribute {
                constructor(array, itemSize) {
                    this.array = array
                    this.itemSize = itemSize
                }
            },
            Shape: FakeShape,
            Raycaster: class FakeRaycaster {},
            Vector2: class FakeVector2 {},
            DoubleSide: 'DoubleSide',
            MOUSE: { ROTATE: 'rotate', DOLLY: 'dolly', PAN: 'pan' }
        },
        OrbitControls: FakeOrbitControls
    }
}

/**
 * Builds the minimal scene description required by the runtime.
 * @returns {any}
 */
function createSceneDescription() {
    return {
        board: {
            widthMil: 1200,
            heightMil: 800,
            centerX: 0,
            centerY: 0,
            thicknessMil: 62,
            segments: []
        },
        components: [],
        detail: { silkscreen: {}, tracks: [], arcs: [], pads: [], vias: [] },
        externalPlacements: []
    }
}

test('PcbScene3dRuntime resizes when the viewport element changes size', async () => {
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document
    const originalResizeObserver = globalThis.ResizeObserver
    const originalLoadIntoScene = PcbScene3dExternalModels.loadIntoScene

    globalThis.window = {
        devicePixelRatio: 1,
        requestAnimationFrame(callback) {
            callback()
        },
        addEventListener() {},
        removeEventListener() {}
    }
    globalThis.document = {}
    globalThis.ResizeObserver = FakeResizeObserver
    PcbScene3dExternalModels.loadIntoScene = async () => []
    lastRenderer = null
    lastCamera = null
    lastResizeObserver = null

    const viewportNode = new FakeViewportNode()
    const runtime = new PcbScene3dRuntime(
        viewportNode,
        createSceneDescription(),
        {
            loadRuntimeModules: async () => createFakeRuntimeModules()
        }
    )

    try {
        await runtime.whenReady()

        assert.ok(lastResizeObserver)
        assert.equal(lastResizeObserver.observedNode, viewportNode)
        assert.deepEqual(lastRenderer?.setSizeCalls.at(-1), {
            width: 960,
            height: 560
        })

        viewportNode.width = 720
        viewportNode.height = 540
        lastResizeObserver.trigger()

        assert.deepEqual(lastRenderer?.setSizeCalls.at(-1), {
            width: 720,
            height: 540
        })
        assert.equal(lastCamera?.aspect, 720 / 540)
        assert.ok(Number(lastCamera?.projectionUpdates || 0) > 0)

        runtime.dispose()
        assert.equal(lastResizeObserver.disconnected, true)
    } finally {
        runtime.dispose()
        globalThis.window = originalWindow
        globalThis.document = originalDocument
        globalThis.ResizeObserver = originalResizeObserver
        PcbScene3dExternalModels.loadIntoScene = originalLoadIntoScene
    }
})
