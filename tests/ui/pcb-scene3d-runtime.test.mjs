import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dCameraRig } from '../../src/ui/PcbScene3dCameraRig.mjs'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'
import { PcbScene3dRuntime } from '../../src/ui/PcbScene3dRuntime.mjs'

/**
 * Resolves one preset pose into normalized screen-space basis vectors.
 * @param {{ position: { x: number, y: number, z: number }, target: { x: number, y: number, z: number }, up: { x: number, y: number, z: number } }} preset
 * @returns {{ right: { x: number, y: number, z: number }, up: { x: number, y: number, z: number } }}
 */
const resolveScreenBasis = (preset) => {
    const forwardX = preset.target.x - preset.position.x
    const forwardY = preset.target.y - preset.position.y
    const forwardZ = preset.target.z - preset.position.z
    const forwardLength = Math.hypot(forwardX, forwardY, forwardZ) || 1
    const normalizedForward = {
        x: forwardX / forwardLength,
        y: forwardY / forwardLength,
        z: forwardZ / forwardLength
    }
    const right = {
        x:
            normalizedForward.y * preset.up.z -
            normalizedForward.z * preset.up.y,
        y:
            normalizedForward.z * preset.up.x -
            normalizedForward.x * preset.up.z,
        z: normalizedForward.x * preset.up.y - normalizedForward.y * preset.up.x
    }
    const rightLength = Math.hypot(right.x, right.y, right.z) || 1

    return {
        right: {
            x: right.x / rightLength,
            y: right.y / rightLength,
            z: right.z / rightLength
        },
        up: {
            x: preset.up.x,
            y: preset.up.y,
            z: preset.up.z
        }
    }
}

/**
 * Projects one point onto the preset's screen basis.
 * @param {{ x: number, y: number, z: number }} point
 * @param {{ right: { x: number, y: number, z: number }, up: { x: number, y: number, z: number } }} basis
 * @returns {{ x: number, y: number }}
 */
const projectPointToScreen = (point, basis) => ({
    x:
        point.x * basis.right.x +
        point.y * basis.right.y +
        point.z * basis.right.z,
    y: point.x * basis.up.x + point.y * basis.up.y + point.z * basis.up.z
})

/**
 * Applies one resolved view scale to a representative board-space point.
 * @param {{ x: number, y: number, z: number }} point
 * @param {{ x: number, y: number, z: number }} scale
 * @returns {{ x: number, y: number, z: number }}
 */
const scalePoint = (point, scale) => ({
    x: point.x * scale.x,
    y: point.y * scale.y,
    z: point.z * scale.z
})

/**
 * Projects one board-space point through the preset basis and runtime scale.
 * @param {'top' | 'bottom' | 'isometric'} presetName
 * @param {{ x: number, y: number, z: number }} point
 * @returns {{ x: number, y: number }}
 */
const projectPresetPoint = (presetName, point) => {
    const preset = PcbScene3dCameraRig.resolvePreset(presetName, {
        board: {
            widthMil: 2200,
            heightMil: 1400
        }
    })
    const basis = resolveScreenBasis(preset)
    const scaledPoint = scalePoint(
        point,
        PcbScene3dRuntime.resolveViewScale(presetName)
    )

    return projectPointToScreen(scaledPoint, basis)
}

/** @type {FakeScene | null} */
let lastCreatedScene = null

/**
 * Minimal event target used by the runtime harness.
 */
class FakeEventTarget {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    constructor() {
        this.#listeners = new Map()
    }

    /**
     * @param {string} type
     * @param {(event: any) => void} listener
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }

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
 * Minimal mutable vector used by the fake Three graph.
 */
class FakeVector3 {
    /** @type {number} */
    x

    /** @type {number} */
    y

    /** @type {number} */
    z

    /**
     * @param {number} [x]
     * @param {number} [y]
     * @param {number} [z]
     */
    constructor(x = 0, y = 0, z = 0) {
        this.x = x
        this.y = y
        this.z = z
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {FakeVector3}
     */
    set(x, y, z) {
        this.x = x
        this.y = y
        this.z = z
        return this
    }

    /**
     * @param {number} scalar
     * @returns {FakeVector3}
     */
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
    /** @type {string} */
    className

    /** @type {Record<string, string>} */
    style

    /** @type {boolean} */
    removed

    constructor() {
        super()
        this.className = ''
        this.style = {}
        this.removed = false
    }

    /**
     * @returns {{ width: number, height: number, left: number, top: number }}
     */
    getBoundingClientRect() {
        return {
            width: 960,
            height: 560,
            left: 0,
            top: 0
        }
    }

    /**
     * @returns {void}
     */
    remove() {
        this.removed = true
    }
}

/**
 * Minimal fake Three group implementation.
 */
class FakeGroup {
    /** @type {any[]} */
    children

    /** @type {FakeVector3} */
    position

    /** @type {FakeVector3} */
    scale

    /** @type {{ x: number, y: number, z: number }} */
    rotation

    /** @type {Record<string, any>} */
    userData

    /** @type {boolean} */
    visible

    constructor() {
        this.children = []
        this.position = new FakeVector3()
        this.scale = new FakeVector3(1, 1, 1)
        this.rotation = { x: 0, y: 0, z: 0 }
        this.userData = {}
        this.visible = true
    }

    /**
     * @param {...any} children
     * @returns {void}
     */
    add(...children) {
        this.children.push(...children)
    }
}

/**
 * Minimal fake scene implementation.
 */
class FakeScene extends FakeGroup {
    constructor() {
        super()
        lastCreatedScene = this
    }
}

/**
 * Minimal fake shape implementation.
 */
class FakeShape {
    /** @type {Array<{ x: number, y: number }>} */
    #points

    /** @type {any[]} */
    holes

    constructor() {
        this.#points = []
        this.holes = []
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    moveTo(x, y) {
        this.#points.push({ x, y })
    }

    /**
     * @param {number} x
     * @param {number} y
     * @returns {void}
     */
    lineTo(x, y) {
        this.#points.push({ x, y })
    }

    /**
     * @returns {void}
     */
    closePath() {}

    /**
     * @returns {{ x: number, y: number }[]}
     */
    getPoints() {
        return [...this.#points]
    }
}

/**
 * Minimal fake geometry implementation.
 */
class FakeGeometry {
    /** @type {string} */
    type

    /** @type {Record<string, any> | undefined} */
    options

    /**
     * @param {string} type
     * @param {Record<string, any>} [options]
     */
    constructor(type, options) {
        this.type = type
        this.options = options
    }

    /**
     * @returns {void}
     */
    translate() {}
}

/**
 * Minimal fake buffer geometry.
 */
class FakeBufferGeometry extends FakeGeometry {
    /** @type {Map<string, any>} */
    attributes

    constructor() {
        super('BufferGeometry')
        this.attributes = new Map()
    }

    /**
     * @param {string} name
     * @param {any} attribute
     * @returns {void}
     */
    setAttribute(name, attribute) {
        this.attributes.set(name, attribute)
    }

    /**
     * @returns {void}
     */
    computeVertexNormals() {}
}

/**
 * Minimal float32 buffer attribute.
 */
class FakeFloat32BufferAttribute {
    /** @type {number[]} */
    array

    /** @type {number} */
    itemSize

    /**
     * @param {number[]} array
     * @param {number} itemSize
     */
    constructor(array, itemSize) {
        this.array = array
        this.itemSize = itemSize
    }
}

/**
 * Minimal material wrapper.
 */
class FakeMaterial {
    /** @type {Record<string, any>} */
    options

    /**
     * @param {Record<string, any>} options
     */
    constructor(options) {
        this.options = options
    }
}

/**
 * Minimal mesh implementation.
 */
class FakeMesh {
    /** @type {any} */
    geometry

    /** @type {any} */
    material

    /** @type {FakeVector3} */
    position

    /** @type {{ x: number, y: number, z: number }} */
    rotation

    /** @type {Record<string, any>} */
    userData

    /**
     * @param {any} geometry
     * @param {any} material
     */
    constructor(geometry, material) {
        this.geometry = geometry
        this.material = material
        this.position = new FakeVector3()
        this.rotation = { x: 0, y: 0, z: 0 }
        this.userData = {}
    }
}

/**
 * Minimal line implementation.
 */
class FakeLineLoop extends FakeMesh {}

/**
 * Minimal fake camera.
 */
class FakePerspectiveCamera {
    /** @type {FakeVector3} */
    position

    /** @type {FakeVector3} */
    up

    /** @type {number} */
    aspect

    /**
     * @param {number} _fov
     * @param {number} aspect
     * @returns {void}
     */
    constructor(_fov, aspect) {
        this.position = new FakeVector3()
        this.up = new FakeVector3(0, 0, 1)
        this.aspect = aspect
    }

    /**
     * @returns {void}
     */
    lookAt() {}

    /**
     * @returns {void}
     */
    updateProjectionMatrix() {}
}

/**
 * Minimal fake renderer.
 */
class FakeWebGLRenderer {
    /** @type {FakeDomNode} */
    domElement

    /** @type {number} */
    renderCount

    /**
     * @returns {void}
     */
    constructor() {
        this.domElement = new FakeDomNode()
        this.renderCount = 0
    }

    /**
     * @returns {void}
     */
    setPixelRatio() {}

    /**
     * @returns {void}
     */
    setSize() {}

    /**
     * @returns {void}
     */
    render() {
        this.renderCount += 1
    }

    /**
     * @returns {void}
     */
    dispose() {}
}

/**
 * Minimal fake raycaster.
 */
class FakeRaycaster {
    /**
     * @returns {void}
     */
    setFromCamera() {}

    /**
     * @returns {any[]}
     */
    intersectObjects() {
        return []
    }
}

/**
 * Minimal fake orbit controls.
 */
class FakeOrbitControls extends FakeEventTarget {
    /** @type {FakeVector3} */
    target

    constructor() {
        super()
        this.target = new FakeVector3()
    }

    /**
     * @returns {void}
     */
    update() {}

    /**
     * @returns {void}
     */
    dispose() {}
}

/**
 * Minimal viewport mount for the runtime harness.
 */
class FakeViewportNode {
    /** @type {any[]} */
    children

    constructor() {
        this.children = []
    }

    /**
     * @returns {{ width: number, height: number }}
     */
    getBoundingClientRect() {
        return {
            width: 960,
            height: 560
        }
    }

    /**
     * @param {...any} children
     * @returns {void}
     */
    replaceChildren(...children) {
        this.children = children
    }
}

/**
 * Builds the minimal fake runtime modules needed by the readiness test.
 * @returns {{ THREE: any, OrbitControls: typeof FakeOrbitControls }}
 */
function createFakeRuntimeModules() {
    return {
        THREE: {
            WebGLRenderer: FakeWebGLRenderer,
            Scene: FakeScene,
            PerspectiveCamera: FakePerspectiveCamera,
            Group: FakeGroup,
            AmbientLight: FakeGroup,
            DirectionalLight: class FakeDirectionalLight extends FakeGroup {},
            Fog: class FakeFog {},
            Mesh: FakeMesh,
            LineLoop: FakeLineLoop,
            MeshStandardMaterial: FakeMaterial,
            MeshBasicMaterial: FakeMaterial,
            LineBasicMaterial: FakeMaterial,
            BoxGeometry: class FakeBoxGeometry extends FakeGeometry {
                constructor(...args) {
                    super('BoxGeometry', { args })
                }
            },
            CylinderGeometry: class FakeCylinderGeometry extends FakeGeometry {
                constructor(...args) {
                    super('CylinderGeometry', { args })
                }
            },
            ExtrudeGeometry: class FakeExtrudeGeometry extends FakeGeometry {
                constructor(shape, options) {
                    super('ExtrudeGeometry', { shape, options })
                }
            },
            BufferGeometry: FakeBufferGeometry,
            Float32BufferAttribute: FakeFloat32BufferAttribute,
            Shape: FakeShape,
            Raycaster: FakeRaycaster,
            Vector2: class FakeVector2 {
                /** @type {number} */ x = 0
                /** @type {number} */ y = 0
            },
            DoubleSide: 'DoubleSide',
            MOUSE: {
                ROTATE: 'rotate',
                DOLLY: 'dolly',
                PAN: 'pan'
            }
        },
        OrbitControls: FakeOrbitControls
    }
}

/**
 * Resolves the fallback-bodies render group from the current fake scene tree.
 * @returns {FakeGroup | undefined}
 */
function resolveFallbackBodiesGroup() {
    const rootGroup = lastCreatedScene?.children?.[0]?.children?.[0]
    if (!rootGroup) {
        return undefined
    }

    return rootGroup.children.find(
        (group) =>
            Array.isArray(group?.children) &&
            group.children.some(
                (child) =>
                    child?.userData?.scene3dSelection?.designator === 'U1'
            )
    )
}

/**
 * Flushes a few promise turns so async runtime stages can advance.
 * @param {number} turns
 * @returns {Promise<void>}
 */
async function flushAsyncTurns(turns = 1) {
    for (let index = 0; index < turns; index += 1) {
        await Promise.resolve()
    }
}

test('PcbScene3dRuntime flips the top preset vertically into the reference top-right orientation', () => {
    const topScreenPoint = projectPresetPoint('top', { x: 1, y: -1, z: 0 })

    assert.deepEqual(PcbScene3dRuntime.resolveViewScale('top'), {
        x: 1,
        y: -1,
        z: 1
    })
    assert.ok(topScreenPoint.x > 0)
    assert.ok(topScreenPoint.y > 0)
})

test('PcbScene3dRuntime mirrors the bottom preset without rotating the board', () => {
    const bottomScreenPoint = projectPresetPoint('bottom', {
        x: 1,
        y: -1,
        z: 0
    })

    assert.deepEqual(PcbScene3dRuntime.resolveViewScale('bottom'), {
        x: -1,
        y: 1,
        z: 1
    })
    assert.ok(bottomScreenPoint.x < 0)
    assert.ok(bottomScreenPoint.y > 0)
})

test('PcbScene3dRuntime keeps the isometric preset unmirrored', () => {
    assert.deepEqual(PcbScene3dRuntime.resolveViewScale('isometric'), {
        x: 1,
        y: 1,
        z: 1
    })
})

test('PcbScene3dRuntime shows front-right KiCad anchors on the right in isometric view', () => {
    const screenPoint = projectPresetPoint('isometric', {
        x: 845,
        y: -278,
        z: 0
    })

    assert.ok(screenPoint.x > 0)
})

test('PcbScene3dRuntime keeps fallback bodies hidden by default and waits for deferred settlement before reporting ready', async () => {
    const originalWindow = globalThis.window
    const originalDocument = globalThis.document
    const originalLoadIntoScene = PcbScene3dExternalModels.loadIntoScene
    let resolveExternalModels = null

    globalThis.window = {
        devicePixelRatio: 1,
        requestAnimationFrame(callback) {
            callback()
        },
        addEventListener() {},
        removeEventListener() {}
    }
    globalThis.document = {}
    lastCreatedScene = null

    PcbScene3dExternalModels.loadIntoScene = async () => {
        await new Promise((resolve) => {
            resolveExternalModels = resolve
        })
        return []
    }

    const runtime = new PcbScene3dRuntime(
        new FakeViewportNode(),
        {
            board: {
                widthMil: 1200,
                heightMil: 800,
                centerX: 0,
                centerY: 0,
                thicknessMil: 62,
                segments: []
            },
            components: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 0, y: 0, z: 20 },
                    body: {
                        family: 'chip',
                        sizeMil: {
                            width: 80,
                            depth: 60,
                            height: 40
                        }
                    }
                }
            ],
            detail: {
                silkscreen: {},
                tracks: [],
                arcs: [],
                pads: [],
                vias: []
            },
            externalPlacements: [{}]
        },
        {
            loadRuntimeModules: async () => createFakeRuntimeModules()
        }
    )

    let readyResolved = false
    const readyPromise = runtime.whenReady().then(() => {
        readyResolved = true
    })

    await flushAsyncTurns(8)

    assert.ok(lastCreatedScene)
    assert.equal(resolveFallbackBodiesGroup()?.visible, false)
    assert.equal(readyResolved, false)

    resolveExternalModels?.()
    await readyPromise

    assert.equal(readyResolved, true)

    runtime.dispose()
    PcbScene3dExternalModels.loadIntoScene = originalLoadIntoScene
    globalThis.window = originalWindow
    globalThis.document = originalDocument
})
