import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dExternalModels } from 'pcb-scene3d-viewer/scene3d'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a minimal prepared STEP box mesh payload.
 * @param {number} minZ Lower source Z in inches.
 * @param {number} maxZ Upper source Z in inches.
 * @returns {{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, faceColors: object[] }}
 */
function createPreparedBoxPayload(minZ, maxZ) {
    return {
        positions: new Float32Array([
            -0.05,
            -0.05,
            minZ,
            0.05,
            -0.05,
            minZ,
            0.05,
            0.05,
            minZ,
            -0.05,
            0.05,
            minZ,
            -0.05,
            -0.05,
            maxZ,
            0.05,
            -0.05,
            maxZ,
            0.05,
            0.05,
            maxZ,
            -0.05,
            0.05,
            maxZ
        ]),
        normals: new Float32Array(),
        indices: new Uint32Array([
            0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6,
            2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0
        ]),
        faceColors: []
    }
}

/**
 * Builds a prepared model payload whose pins extend below the package body.
 * @returns {object[]}
 */
function createPreparedThroughHolePayloads() {
    return [
        createPreparedBoxPayload(0, 0.1),
        createPreparedBoxPayload(-0.08, 0)
    ]
}

/**
 * Builds a prepared model whose package body starts at source Z zero while
 * dense lower tabs extend below that origin.
 * @returns {object[]}
 */
function createPreparedBodyWithLowerTabsPayloads() {
    return [
        createPreparedDensePlanePayload(0, 0.1, 100),
        createPreparedDensePlanePayload(-0.035, -0.025, 28)
    ]
}

/**
 * Builds a prepared model whose SMT contacts are above lower shell geometry.
 * @returns {object[]}
 */
function createPreparedFloatingContactPayloads() {
    return [
        createPreparedBoxAtPayload(-0.015, -0.015, 0.057, 0.015, 0.015, 0.067),
        createPreparedBoxAtPayload(-0.24, -0.08, -0.047, -0.12, 0.08, 0.13)
    ]
}

/**
 * Builds a prepared box at an explicit source-space position.
 * @param {number} minX Lower source X in inches.
 * @param {number} minY Lower source Y in inches.
 * @param {number} minZ Lower source Z in inches.
 * @param {number} maxX Upper source X in inches.
 * @param {number} maxY Upper source Y in inches.
 * @param {number} maxZ Upper source Z in inches.
 * @returns {{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, faceColors: object[] }}
 */
function createPreparedBoxAtPayload(minX, minY, minZ, maxX, maxY, maxZ) {
    return {
        positions: new Float32Array([
            minX,
            minY,
            minZ,
            maxX,
            minY,
            minZ,
            maxX,
            maxY,
            minZ,
            minX,
            maxY,
            minZ,
            minX,
            minY,
            maxZ,
            maxX,
            minY,
            maxZ,
            maxX,
            maxY,
            maxZ,
            minX,
            maxY,
            maxZ
        ]),
        normals: new Float32Array(),
        indices: new Uint32Array([
            0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1, 1, 5, 6, 1, 6,
            2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0
        ]),
        faceColors: []
    }
}

/**
 * Builds a synthetic mesh payload with many lower-plane vertices.
 * @param {number} minZ Lower source Z in inches.
 * @param {number} maxZ Upper source Z in inches.
 * @param {number} count Number of lower-plane samples.
 * @returns {{ positions: Float32Array, normals: Float32Array, indices: Uint32Array, faceColors: object[] }}
 */
function createPreparedDensePlanePayload(minZ, maxZ, count) {
    const positions = []

    for (let index = 0; index < count; index += 1) {
        const x = -0.05 + (index % 10) * 0.01
        const y = -0.05 + Math.floor(index / 10) * 0.01
        positions.push(x, y, minZ)
    }
    positions.push(-0.05, -0.05, maxZ, 0.05, -0.05, maxZ, 0.05, 0.05, maxZ)

    return {
        positions: new Float32Array(positions),
        normals: new Float32Array(),
        indices: new Uint32Array([
            0,
            count,
            count + 1,
            0,
            count + 1,
            count + 2
        ]),
        faceColors: []
    }
}

/**
 * Builds a fake KiCad PCB document with one top and one bottom external model.
 * @param {number} [offsetZMil] Authored KiCad model Z offset.
 * @returns {object}
 */
function createOffsetModelDocument(offsetZMil = 0) {
    const modelTransform = {
        rotationDeg: { x: 0, y: 0, z: 0 },
        offsetMil: { x: 12, y: -8, z: offsetZMil },
        dxMil: 12,
        dyMil: -8,
        dzMil: offsetZMil,
        scale: { x: 1, y: 1, z: 1 }
    }

    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'surface-anchor-fake.kicad_pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 800,
                heightMil: 600,
                segments: []
            },
            components: [
                {
                    designator: 'A1',
                    x: 300,
                    y: 280,
                    layer: 'TOP',
                    pattern: 'Fake:Body',
                    modelName: 'body.step',
                    modelPath: 'models/body.step',
                    modelTransform
                },
                {
                    designator: 'A2',
                    x: 500,
                    y: 280,
                    layer: 'BOTTOM',
                    pattern: 'Fake:Body',
                    modelName: 'body.step',
                    modelPath: 'models/body.step',
                    modelTransform
                }
            ],
            pads: [],
            tracks: [],
            vias: [],
            kicadBoard: {
                drawings: [],
                texts: []
            }
        }
    }
}

/**
 * Measures loaded KiCad model placement records.
 * @param {object[]} sessionAssets Resolved model assets.
 * @param {number} [offsetZMil] Authored KiCad model Z offset.
 * @returns {Promise<Map<string, { bodyFaceGap: number, modelGroupZ: number }>>}
 */
async function measureKiCadPlacementRecords(sessionAssets, offsetZMil = 0) {
    const scene = EcadScene3dService.build(
        createOffsetModelDocument(offsetZMil),
        {
            boardThicknessMil: 80,
            sessionAssets
        }
    )
    const root = new THREE.Group()
    const records = new Map()

    await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: scene,
        externalModelsGroup: root,
        modelViewScale: { x: 1, y: 1, z: 1 },
        onPlacementGroup: (placement, group) => {
            root.updateMatrixWorld(true)
            group.updateMatrixWorld(true)
            const modelGroup = findAdjustmentModelGroup(group)
            const bodyMesh = findFirstMesh(group)
            const bounds = new THREE.Box3().setFromObject(bodyMesh)
            const faceZ = Number(placement?.positionMil?.z || 0)
            const isBottom =
                String(placement?.mountSide || 'top').toLowerCase() === 'bottom'
            const gap = isBottom ? faceZ - bounds.max.z : bounds.min.z - faceZ

            records.set(String(placement?.designator || ''), {
                bodyFaceGap: gap,
                modelGroupZ: Number(modelGroup?.position?.z || 0)
            })
        }
    })

    return records
}

/**
 * Measures the full-model lower face gap for a non-KiCad external scene.
 * @param {object[]} preparedMeshPayloads Prepared STEP payloads.
 * @returns {Promise<{ fullFaceGap: number, modelGroupZ: number }>}
 */
async function measureGenericPlacementRecord(preparedMeshPayloads) {
    const faceZ = 40
    const scene = EcadScene3dService.build({
        sourceFormat: 'circuitjson',
        board: { widthMil: 800, heightMil: 600, thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'X1',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: 300, y: 280, z: faceZ },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    offsetMil: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                },
                externalModel: {
                    format: 'step',
                    preparedMeshPayloads
                }
            }
        ]
    })
    const root = new THREE.Group()
    let record = null

    await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: scene,
        externalModelsGroup: root,
        modelViewScale: { x: 1, y: 1, z: 1 },
        onPlacementGroup: (_placement, group) => {
            root.updateMatrixWorld(true)
            group.updateMatrixWorld(true)
            const modelGroup = findAdjustmentModelGroup(group)
            const bounds = new THREE.Box3().setFromObject(modelGroup)

            record = {
                fullFaceGap: bounds.min.z - faceZ,
                modelGroupZ: Number(modelGroup?.position?.z || 0)
            }
        }
    })

    return record
}

/**
 * Measures the package body gap for an Altium model with lower protrusions.
 * @returns {Promise<{ bodyFaceGap: number, lowerFaceGap: number, modelGroupZ: number }>}
 */
async function measureAltiumLowerTabPlacementRecord() {
    const faceZ = 40
    const scene = {
        sourceFormat: 'altium',
        board: { widthMil: 800, heightMil: 600, thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'X1',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: 300, y: 280, z: faceZ },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    offsetMil: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                },
                externalModel: {
                    origin: 'embedded',
                    format: 'step',
                    preparedMeshPayloads:
                        createPreparedBodyWithLowerTabsPayloads()
                }
            }
        ]
    }
    const root = new THREE.Group()
    let record = null

    await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: scene,
        externalModelsGroup: root,
        modelViewScale: { x: 1, y: 1, z: 1 },
        onPlacementGroup: (_placement, group) => {
            root.updateMatrixWorld(true)
            group.updateMatrixWorld(true)
            const modelGroup = findAdjustmentModelGroup(group)
            const bodyMesh = findFirstMesh(group)
            const modelBounds = new THREE.Box3().setFromObject(modelGroup)
            const bodyBounds = new THREE.Box3().setFromObject(bodyMesh)

            record = {
                bodyFaceGap: bodyBounds.min.z - faceZ,
                lowerFaceGap: modelBounds.min.z - faceZ,
                modelGroupZ: Number(modelGroup?.position?.z || 0)
            }
        }
    })

    return record
}

/**
 * Measures an Altium placement that carries explicit SMT contact pad hints.
 * @returns {Promise<{ contactFaceGap: number, lowerFaceGap: number, modelGroupZ: number }>}
 */
async function measureAltiumContactPadPlacementRecord() {
    const faceZ = 40
    const scene = {
        sourceFormat: 'altium',
        board: { widthMil: 800, heightMil: 600, thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'X2',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: 0, y: 0, z: faceZ },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    offsetMil: { x: 0, y: 0, z: 0 },
                    contactPadsMil: [{ x: 0, y: 0, width: 60, depth: 60 }],
                    scale: { x: 1, y: 1, z: 1 }
                },
                externalModel: {
                    origin: 'embedded',
                    format: 'step',
                    preparedMeshPayloads:
                        createPreparedFloatingContactPayloads()
                }
            }
        ]
    }
    const root = new THREE.Group()
    let record = null

    await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: scene,
        externalModelsGroup: root,
        modelViewScale: { x: 1, y: 1, z: 1 },
        onPlacementGroup: (_placement, group) => {
            root.updateMatrixWorld(true)
            group.updateMatrixWorld(true)
            const modelGroup = findAdjustmentModelGroup(group)
            const contactMesh = findFirstMesh(group)
            const modelBounds = new THREE.Box3().setFromObject(modelGroup)
            const contactBounds = new THREE.Box3().setFromObject(contactMesh)

            record = {
                contactFaceGap: contactBounds.min.z - faceZ,
                lowerFaceGap: modelBounds.min.z - faceZ,
                modelGroupZ: Number(modelGroup?.position?.z || 0)
            }
        }
    })

    return record
}

/**
 * Measures a below-origin Altium placement that still requires generic
 * mount-plane seating.
 * @returns {Promise<{ fullFaceGap: number, modelGroupZ: number }>}
 */
async function measureAltiumBelowOriginPlacementRecord() {
    const faceZ = 40
    const scene = {
        sourceFormat: 'altium',
        board: { widthMil: 800, heightMil: 600, thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'L1',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: 300, y: 280, z: faceZ },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    offsetMil: { x: 0, y: 0, z: 0 },
                    scale: { x: 1, y: 1, z: 1 }
                },
                externalModel: {
                    origin: 'embedded',
                    format: 'step',
                    preparedMeshPayloads: [
                        createPreparedBoxPayload(-0.04, 0.06)
                    ]
                }
            }
        ]
    }
    const root = new THREE.Group()
    let record = null

    await PcbScene3dExternalModels.loadIntoScene({
        three: THREE,
        sceneDescription: scene,
        externalModelsGroup: root,
        modelViewScale: { x: 1, y: 1, z: 1 },
        onPlacementGroup: (_placement, group) => {
            root.updateMatrixWorld(true)
            group.updateMatrixWorld(true)
            const modelGroup = findAdjustmentModelGroup(group)
            const bounds = new THREE.Box3().setFromObject(modelGroup)

            record = {
                fullFaceGap: bounds.min.z - faceZ,
                modelGroupZ: Number(modelGroup?.position?.z || 0)
            }
        }
    })

    return record
}

/**
 * Finds the model group under the placement adjustment node.
 * @param {object} group Placement group.
 * @returns {object | null}
 */
function findAdjustmentModelGroup(group) {
    let adjustmentGroup = null
    group.traverse((object) => {
        if (object?.userData?.scene3dAdjustmentTarget) {
            adjustmentGroup = object
        }
    })

    return adjustmentGroup?.children?.[0] || null
}

/**
 * Finds the first mesh created from the prepared package body payload.
 * @param {object} group Placement group.
 * @returns {object}
 */
function findFirstMesh(group) {
    let firstMesh = null
    group.traverse((object) => {
        if (!firstMesh && object?.isMesh) {
            firstMesh = object
        }
    })

    return firstMesh
}

/**
 * Verifies KiCad through-hole pins do not lift package bodies away from the
 * board surfaces.
 */
test('ECAD 3D service keeps KiCad through-hole bodies seated on board faces', async () => {
    const records = await measureKiCadPlacementRecords([
        {
            name: 'body.step',
            relativePath: 'models/body.step',
            format: 'step',
            preparedMeshPayloads: createPreparedThroughHolePayloads()
        }
    ])

    assert.ok(Math.abs(records.get('A1').bodyFaceGap) < 0.001)
    assert.ok(Math.abs(records.get('A2').bodyFaceGap) < 0.001)
})

/**
 * Verifies authored KiCad Z offsets survive external model loading.
 */
test('ECAD 3D service preserves KiCad model Z offsets during external loading', async () => {
    const offsetZMil = 25
    const records = await measureKiCadPlacementRecords(
        [
            {
                name: 'body.step',
                relativePath: 'models/body.step',
                format: 'step',
                preparedMeshPayloads: createPreparedThroughHolePayloads()
            }
        ],
        offsetZMil
    )

    assert.ok(Math.abs(records.get('A1').bodyFaceGap - offsetZMil) < 0.001)
    assert.ok(Math.abs(records.get('A2').bodyFaceGap - offsetZMil) < 0.001)
    assert.equal(records.get('A1').modelGroupZ, offsetZMil)
    assert.equal(records.get('A2').modelGroupZ, offsetZMil)
})

/**
 * Verifies Altium embedded models with below-origin geometry still use the
 * shared mount-plane seating path.
 */
test('ECAD 3D service seats below-origin Altium embedded models', async () => {
    const record = await measureAltiumBelowOriginPlacementRecord()

    assert.ok(Math.abs(record.fullFaceGap) < 0.001)
    assert.ok(Math.abs(record.modelGroupZ - 40) < 0.001)
})

/**
 * Verifies dense package bodies at source Z zero do not float above the board
 * when smaller lower tabs extend through the mount plane.
 */
test('ECAD 3D service seats Altium embedded body planes above lower tabs', async () => {
    const record = await measureAltiumLowerTabPlacementRecord()

    assert.ok(Math.abs(record.bodyFaceGap) < 0.001)
    assert.ok(record.lowerFaceGap < -20)
    assert.ok(Math.abs(record.modelGroupZ) < 0.001)
})

/**
 * Verifies mixed connector contact hints seat SMT tails on the board surface.
 */
test('ECAD 3D service seats Altium mixed connector contacts on pads', async () => {
    const record = await measureAltiumContactPadPlacementRecord()

    assert.ok(Math.abs(record.contactFaceGap) < 0.001)
    assert.ok(record.lowerFaceGap < -90)
    assert.ok(Math.abs(record.modelGroupZ + 57) < 0.001)
})

/**
 * Verifies the KiCad exception does not disable generic model seating globally.
 */
test('ECAD 3D service keeps generic external model seating for non-KiCad scenes', async () => {
    const record = await measureGenericPlacementRecord(
        createPreparedThroughHolePayloads()
    )

    assert.ok(Math.abs(record.fullFaceGap) < 0.001)
    assert.ok(Math.abs(record.modelGroupZ - 80) < 0.001)
})
