import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'

/**
 * Minimal vector holder for fake Three groups.
 */
class FakeVector3 {
    /** @type {number} */
    x

    /** @type {number} */
    y

    /** @type {number} */
    z

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

/**
 * Minimal scalar holder for fake Three groups.
 */
class FakeScalar {
    /** @type {number} */
    value

    constructor() {
        this.value = 1
    }

    /**
     * @param {number} value
     * @returns {void}
     */
    setScalar(value) {
        this.value = value
    }
}

/**
 * Minimal group implementation for the external-model tests.
 */
class FakeGroup {
    /** @type {any[]} */
    children

    /** @type {FakeVector3} */
    position

    /** @type {{ x: number, y: number, z: number }} */
    rotation

    /** @type {FakeScalar} */
    scale

    /** @type {Record<string, any>} */
    userData

    constructor() {
        this.children = []
        this.position = new FakeVector3()
        this.rotation = { x: 0, y: 0, z: 0 }
        this.scale = new FakeScalar()
        this.userData = {}
    }

    /**
     * @param {any} child
     * @returns {void}
     */
    add(child) {
        this.children.push(child)
    }

    /**
     * @returns {FakeGroup}
     */
    clone() {
        const clonedGroup = new FakeGroup()
        clonedGroup.position.x = this.position.x
        clonedGroup.position.y = this.position.y
        clonedGroup.position.z = this.position.z
        clonedGroup.rotation.x = this.rotation.x
        clonedGroup.rotation.y = this.rotation.y
        clonedGroup.rotation.z = this.rotation.z
        clonedGroup.scale.value = this.scale.value
        clonedGroup.userData = { ...this.userData }
        this.children.forEach((child) => {
            clonedGroup.add(child?.clone ? child.clone() : child)
        })

        return clonedGroup
    }
}

/**
 * Minimal buffer attribute.
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
 * Minimal buffer geometry implementation.
 */
class FakeBufferGeometry {
    /** @type {Map<string, FakeFloat32BufferAttribute>} */
    attributes

    /** @type {number[] | null} */
    index

    /** @type {{ start: number, count: number, materialIndex: number }[]} */
    groups

    /** @type {boolean} */
    vertexNormalsComputed

    constructor() {
        this.attributes = new Map()
        this.index = null
        this.groups = []
        this.vertexNormalsComputed = false
    }

    /**
     * @param {string} name
     * @param {FakeFloat32BufferAttribute} attribute
     * @returns {void}
     */
    setAttribute(name, attribute) {
        this.attributes.set(name, attribute)
    }

    /**
     * @param {number[]} index
     * @returns {void}
     */
    setIndex(index) {
        this.index = index
    }

    /**
     * @param {number} start
     * @param {number} count
     * @param {number} materialIndex
     * @returns {void}
     */
    addGroup(start, count, materialIndex) {
        this.groups.push({ start, count, materialIndex })
    }

    /**
     * @returns {void}
     */
    computeVertexNormals() {
        this.vertexNormalsComputed = true
    }

    /**
     * @returns {void}
     */
    computeBoundingSphere() {}
}

/**
 * Minimal color implementation.
 */
class FakeColor {
    /** @type {number} */
    r

    /** @type {number} */
    g

    /** @type {number} */
    b

    /**
     * @param {number} r
     * @param {number} g
     * @param {number} b
     */
    constructor(r, g, b) {
        this.r = r
        this.g = g
        this.b = b
    }
}

/**
 * Minimal material implementation.
 */
class FakeMeshStandardMaterial {
    /** @type {Record<string, any>} */
    options

    /** @type {any} */
    color

    /**
     * @param {Record<string, any>} options
     */
    constructor(options) {
        this.options = options
        this.color = options.color
    }
}

/**
 * Minimal mesh implementation.
 */
class FakeMesh {
    /** @type {FakeBufferGeometry} */
    geometry

    /** @type {FakeMeshStandardMaterial | FakeMeshStandardMaterial[]} */
    material

    /**
     * @param {FakeBufferGeometry} geometry
     * @param {FakeMeshStandardMaterial | FakeMeshStandardMaterial[]} material
     */
    constructor(geometry, material) {
        this.geometry = geometry
        this.material = material
    }

    /**
     * @returns {FakeMesh}
     */
    clone() {
        return new FakeMesh(this.geometry, this.material)
    }
}

/**
 * Verifies STEP face-color ranges are translated into grouped Three materials.
 */
test('PcbScene3dExternalModels renders STEP face colors as grouped materials', async () => {
    const externalModelsGroup = new FakeGroup()
    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: {
            Group: FakeGroup,
            BufferGeometry: FakeBufferGeometry,
            Float32BufferAttribute: FakeFloat32BufferAttribute,
            MeshStandardMaterial: FakeMeshStandardMaterial,
            Mesh: FakeMesh,
            Color: FakeColor
        },
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'R1',
                    mountSide: 'top',
                    rotationDeg: 180,
                    positionMil: { x: 10, y: 20, z: 30 },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 90 },
                        dzMil: 12
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'chip.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            ]
        },
        externalModelsGroup,
        stepLoader: {
            async loadModel() {
                return {
                    meshPayloads: [
                        {
                            name: 'body',
                            color: [0.2, 0.2, 0.2],
                            positions: [
                                0, 0, 0,
                                1, 0, 0,
                                0, 1, 0,
                                0, 0, 1
                            ],
                            normals: [],
                            indices: [0, 1, 2, 0, 2, 3, 0, 1, 3],
                            faceColors: [
                                {
                                    first: 1,
                                    last: 1,
                                    color: [0.9, 0.8, 0.7]
                                }
                            ]
                        }
                    ]
                }
            }
        }
    })

    assert.deepEqual(diagnostics, [])
    assert.equal(externalModelsGroup.children.length, 1)

    const wrapperGroup = externalModelsGroup.children[0]
    const sideGroup = wrapperGroup.children[0]
    const faceGroup = sideGroup.children[0]
    const modelGroup = faceGroup.children[0]
    const mesh = modelGroup.children[0]

    assert.equal(modelGroup.scale.value, 1000)
    assert.equal(wrapperGroup.userData.scene3dSelection.designator, 'R1')
    assert.equal(wrapperGroup.userData.scene3dSelection.sourceType, 'external-model')
    assert.equal(wrapperGroup.position.x, 10)
    assert.equal(wrapperGroup.position.y, 20)
    assert.equal(wrapperGroup.position.z, 0)
    assert.equal(sideGroup.rotation.x, 0)
    assert.equal(faceGroup.position.z, 30)
    assert.equal(faceGroup.rotation.z, Math.PI)
    assert.equal(Array.isArray(mesh.material), true)
    assert.equal(mesh.material.length, 2)
    assert.deepEqual(mesh.geometry.groups, [
        { start: 0, count: 3, materialIndex: 0 },
        { start: 3, count: 3, materialIndex: 1 },
        { start: 6, count: 3, materialIndex: 0 }
    ])
})

/**
 * Verifies bottom-side model placements invert authored dz offsets when the
 * underside mount rig already flips the local Z axis around the board face.
 */
test('PcbScene3dExternalModels keeps bottom-side dz offsets below the board face', async () => {
    const externalModelsGroup = new FakeGroup()
    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: {
            Group: FakeGroup,
            BufferGeometry: FakeBufferGeometry,
            Float32BufferAttribute: FakeFloat32BufferAttribute,
            MeshStandardMaterial: FakeMeshStandardMaterial,
            Mesh: FakeMesh,
            Color: FakeColor
        },
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'J6',
                    mountSide: 'bottom',
                    rotationDeg: 90,
                    positionMil: { x: -10, y: 25, z: -31.5 },
                    modelTransform: {
                        rotationDeg: { x: 90, y: 0, z: 270 },
                        dzMil: -12
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'jack.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/48'
                    }
                }
            ]
        },
        externalModelsGroup,
        stepLoader: {
            async loadModel() {
                return {
                    meshPayloads: [
                        {
                            name: 'body',
                            color: [0.8, 0.8, 0.8],
                            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        }
                    ]
                }
            }
        }
    })

    assert.deepEqual(diagnostics, [])
    assert.equal(externalModelsGroup.children.length, 1)

    const wrapperGroup = externalModelsGroup.children[0]
    const sideGroup = wrapperGroup.children[0]
    const faceGroup = sideGroup.children[0]
    const modelGroup = faceGroup.children[0]

    assert.equal(wrapperGroup.position.x, -10)
    assert.equal(wrapperGroup.position.y, 25)
    assert.equal(wrapperGroup.position.z, 0)
    assert.equal(sideGroup.rotation.x, Math.PI)
    assert.equal(faceGroup.position.z, 31.5)
    assert.equal(faceGroup.rotation.z, Math.PI / 2)
    assert.equal(modelGroup.position.z, 12)
    assert.equal(modelGroup.rotation.x, Math.PI / 2)
    assert.equal(modelGroup.rotation.z, (270 * Math.PI) / 180)
})

/**
 * Verifies repeated placements with the same resolved STEP identity reuse one
 * loaded model template instead of rebuilding geometry for every instance.
 */
test('PcbScene3dExternalModels reuses one loaded STEP model for repeated placements', async () => {
    const externalModelsGroup = new FakeGroup()
    let loadCount = 0

    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: {
            Group: FakeGroup,
            BufferGeometry: FakeBufferGeometry,
            Float32BufferAttribute: FakeFloat32BufferAttribute,
            MeshStandardMaterial: FakeMeshStandardMaterial,
            Mesh: FakeMesh,
            Color: FakeColor
        },
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'J15',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 10, y: 20, z: 30 },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'jack.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/48'
                    }
                },
                {
                    designator: 'J16',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 40, y: 50, z: 30 },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 90 },
                        dzMil: 0
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'jack.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/48'
                    }
                }
            ]
        },
        externalModelsGroup,
        stepLoader: {
            async loadModel() {
                loadCount += 1

                return {
                    meshPayloads: [
                        {
                            name: 'body',
                            color: [0.8, 0.8, 0.8],
                            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        }
                    ]
                }
            }
        }
    })

    assert.deepEqual(diagnostics, [])
    assert.equal(loadCount, 1)
    assert.equal(externalModelsGroup.children.length, 2)
    assert.notEqual(
        externalModelsGroup.children[0].children[0].children[0].children[0],
        externalModelsGroup.children[1].children[0].children[0].children[0]
    )
})
