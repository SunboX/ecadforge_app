import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dExternalModels } from '../../src/ui/PcbScene3dExternalModels.mjs'

test('PcbScene3dExternalModels renders matching board assembly as the external scene model', async () => {
    const externalModelsGroup = new THREE.Group()
    const loadedModels = []
    const diagnostics = await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: {
            board: {
                widthMil: 1000,
                heightMil: 500,
                thicknessMil: 62,
                surfaceColor: 0x17396b
            },
            boardAssemblyModel: {
                origin: 'board-assembly',
                name: 'FixtureBoard.step',
                relativePath: '3D Bodies/FixtureBoard.step',
                format: 'step'
            },
            externalPlacements: [
                {
                    designator: 'R1',
                    mountSide: 'top',
                    rotationDeg: 0,
                    positionMil: { x: 10, y: 20, z: 30 },
                    modelTransform: {},
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
            async loadModel(model) {
                loadedModels.push(model)
                return {
                    meshPayloads: [
                        {
                            name: 'assembly substrate',
                            color: [0.0, 0.45, 0.0],
                            positions: [10, 5, -0.062, 11, 5, 0, 10, 5.5, 0],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        },
                        {
                            name: 'large assembly cover',
                            color: [0.21, 0.21, 0.21],
                            positions: [10.1, 5.1, 0.05, 10.9, 5.1, 0.05, 10.1, 5.45, 0.05],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        },
                        {
                            name: 'long assembly cover wall',
                            color: [0.21, 0.21, 0.21],
                            positions: [10.1, 5.1, 0.05, 10.9, 5.1, 0.05, 10.1, 5.12, 0.05],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        },
                        {
                            name: 'small neutral component',
                            color: [0.5, 0.5, 0.5],
                            positions: [10.2, 5.2, 0.05, 10.3, 5.2, 0.05, 10.2, 5.25, 0.05],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        },
                        {
                            name: 'external grey connector',
                            color: [0.5, 0.5, 0.5],
                            positions: [9.8, 5.1, 0.05, 9.9, 5.1, 0.05, 9.8, 5.2, 0.05],
                            normals: [],
                            indices: [0, 1, 2],
                            faceColors: []
                        },
                        {
                            name: 'gold connector',
                            color: [0.95, 0.63, 0.22],
                            positions: [11, 5.2, 0.05, 11.2, 5.2, 0.05, 11, 5.3, 0.05],
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
    assert.equal(loadedModels.length, 1)
    assert.equal(loadedModels[0].origin, 'board-assembly')

    const wrapperGroup = externalModelsGroup.children[0]
    const modelGroup = wrapperGroup.children[0]

    assert.equal(wrapperGroup.position.x, -500)
    assert.equal(wrapperGroup.position.y, -250)
    assert.equal(wrapperGroup.position.z, 0)
    assert.equal(wrapperGroup.userData.scene3dPlacementType, 'board-assembly')
    assert.ok(Math.abs(modelGroup.position.z - 31) < 0.001)
    assert.equal(
        modelGroup.userData.scene3dBoardAssemblySurfaceColor,
        new THREE.Color(0.0, 0.45, 0.0).getHex()
    )
    assert.equal(modelGroup.children[0].geometry.index.array.length, 3)
    assert.equal(modelGroup.children[0].visible, true)
    assert.equal(modelGroup.children[0].material.color.getHex(), 0x2a5f27)
    assert.equal(modelGroup.children[0].material.depthWrite, true)
    assert.equal(modelGroup.children[1].visible, false)
    assert.equal(modelGroup.children[2].visible, false)
    assert.equal(modelGroup.children[3].visible, true)
    assert.equal(modelGroup.children[4].visible, true)
    assert.equal(modelGroup.children[5].visible, true)
    assert.equal(modelGroup.children[4].material.transparent, false)
    assert.equal(modelGroup.children[5].material.transparent, false)
    assert.equal(modelGroup.children[4].material.opacity, 1)
    assert.equal(modelGroup.children[5].material.opacity, 1)
})
