import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'

test('PcbScene3dExternalModels normalizes embedded model offsets before bottom-view board mirrors', async () => {
    const viewGroup = new THREE.Group()
    const externalModelsGroup = new THREE.Group()
    viewGroup.scale.set(-1, 1, 1)
    viewGroup.add(externalModelsGroup)

    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 40, y: 70, z: 30 },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        offsetMil: { x: 12, y: 5, z: 0 },
                        scale: { x: 1, y: 1, z: 1 }
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'offset-body.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/71'
                    }
                }
            ]
        },
        externalModelsGroup,
        modelViewScale: { x: -1, y: 1, z: 1 },
        stepLoader: {
            async loadModel() {
                return {
                    meshPayloads: [
                        {
                            name: 'body',
                            color: [0.2, 0.2, 0.2],
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

    const wrapperGroup = externalModelsGroup.children[0]
    const compensationGroup = wrapperGroup.children[0]
    const orientationGroup = compensationGroup.children[0]
    const sideGroup = orientationGroup.children[0]
    const faceGroup = sideGroup.children[0]
    const modelGroup = faceGroup.children[0]

    viewGroup.updateMatrixWorld(true)

    assert.equal(modelGroup.matrixWorld.elements[12], -52)
    assert.equal(modelGroup.matrixWorld.elements[13], 65)
    assert.equal(modelGroup.matrixWorld.elements[14], 30)
})

test('PcbScene3dExternalModels keeps embedded source-origin offsets stable in bottom views', async () => {
    const externalModelsGroup = new THREE.Group()

    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 0, y: 0, z: 0 },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        offsetMil: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 }
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'tilted-body.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/72'
                    }
                }
            ]
        },
        externalModelsGroup,
        modelViewScale: { x: -1, y: 1, z: 1 },
        stepLoader: {
            async loadModel() {
                return {
                    meshPayloads: [
                        {
                            name: 'body',
                            color: [0.2, 0.2, 0.2],
                            positions: [
                                -0.1, 0, -0.02, 0.1, 0, -0.02, 0.1, 0,
                                0.38, -0.1, 0, 0.38
                            ],
                            normals: [],
                            indices: [0, 1, 2, 0, 2, 3],
                            faceColors: []
                        }
                    ]
                }
            }
        }
    })

    assert.deepEqual(diagnostics, [])

    const wrapperGroup = externalModelsGroup.children[0]
    const compensationGroup = wrapperGroup.children[0]
    const orientationGroup = compensationGroup.children[0]
    const sideGroup = orientationGroup.children[0]
    const faceGroup = sideGroup.children[0]
    const modelGroup = faceGroup.children[0]

    assert.equal(modelGroup.position.x, 0)
    assert.equal(modelGroup.position.y, 360)
    assert.equal(modelGroup.position.z, 0)
    assert.equal(orientationGroup.rotation.z, Math.PI / 2)
})

test('PcbScene3dExternalModels keeps embedded source-origin offsets while switching views', async () => {
    const externalModelsGroup = new THREE.Group()

    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 90,
                    positionMil: { x: 0, y: 0, z: 0 },
                    modelTransform: {
                        rotationDeg: { x: -90, y: 0, z: 0 },
                        offsetMil: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 }
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'view-switch-body.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/73'
                    }
                }
            ]
        },
        externalModelsGroup,
        modelViewScale: { x: 1, y: -1, z: 1 },
        stepLoader: {
            async loadModel() {
                return {
                    meshPayloads: [
                        {
                            name: 'body',
                            color: [0.2, 0.2, 0.2],
                            positions: [
                                -0.1, 0, -0.02, 0.1, 0, -0.02, 0.1, 0,
                                0.38, -0.1, 0, 0.38
                            ],
                            normals: [],
                            indices: [0, 1, 2, 0, 2, 3],
                            faceColors: []
                        }
                    ]
                }
            }
        }
    })

    assert.deepEqual(diagnostics, [])

    const wrapperGroup = externalModelsGroup.children[0]
    const compensationGroup = wrapperGroup.children[0]
    const orientationGroup = compensationGroup.children[0]
    const sideGroup = orientationGroup.children[0]
    const faceGroup = sideGroup.children[0]
    const modelGroup = faceGroup.children[0]

    assert.equal(modelGroup.position.y, 360)

    PcbScene3dExternalModels.applyViewCompensation(externalModelsGroup, {
        x: -1,
        y: 1,
        z: 1
    })

    assert.equal(modelGroup.position.x, 0)
    assert.equal(modelGroup.position.y, 360)
    assert.equal(modelGroup.position.z, 0)
    assert.equal(orientationGroup.rotation.z, Math.PI / 2)
})

test('PcbScene3dExternalModels keeps embedded source Y frames stable in bottom views', async () => {
    const externalModelsGroup = new THREE.Group()

    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: {
            externalPlacements: [
                {
                    designator: 'U1',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: {
                        x: -316.9068,
                        y: -922.6884,
                        z: 31.5
                    },
                    modelTransform: {
                        rotationDeg: { x: 0, y: 0, z: 0 },
                        offsetMil: { x: 0, y: 0, z: 0 },
                        scale: { x: 1, y: 1, z: 1 }
                    },
                    externalModel: {
                        origin: 'embedded',
                        name: 'esp-module.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/16'
                    }
                }
            ]
        },
        externalModelsGroup,
        modelViewScale: { x: -1, y: 1, z: 1 },
        stepLoader: {
            async loadModel() {
                return {
                    meshPayloads: [
                        {
                            name: 'esp-module',
                            color: [0.1, 0.2, 0.4],
                            positions: [
                                0, -0.9448814, 0,
                                0.6299208, -0.9448814, 0,
                                0.6299208, 0, 0,
                                0, 0, 0
                            ],
                            normals: [],
                            indices: [0, 1, 2, 0, 2, 3],
                            faceColors: []
                        }
                    ]
                }
            }
        }
    })

    assert.deepEqual(diagnostics, [])

    externalModelsGroup.updateMatrixWorld(true)
    const placedBounds = new THREE.Box3().setFromObject(
        externalModelsGroup.children[0]
    )

    assert.ok(placedBounds.min.y > -930)
    assert.ok(placedBounds.max.y > 15)
})
