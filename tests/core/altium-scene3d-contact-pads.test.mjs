import assert from 'node:assert/strict'
import test from 'node:test'
import { AltiumScene3dExternalPlacementAdapter } from '../../src/core/ecad/AltiumScene3dExternalPlacementAdapter.mjs'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a fake Altium PCB document with a metadata-recovered mixed pad body.
 * @returns {object}
 */
function createMixedPadContactDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'mixed-pad-contact-fake.PcbDoc',
        pcb: {
            components: [
                {
                    designator: 'J4',
                    componentIndex: 7,
                    x: 460,
                    y: 250,
                    layer: 'TOP',
                    pattern: 'MIXED_EDGE_CONNECTOR',
                    source: 'TOKEN778899',
                    rotation: 270,
                    parameters: { 'Part Token': 'TOKEN778899' }
                }
            ],
            componentBodies: [
                {
                    identifier: 'TOKEN778899',
                    name: 'TOKEN778899.step',
                    positionMil: { x: -180, y: 250 },
                    modelRotationDeg: { x: 0, y: 0, z: 90 },
                    standoffHeightMil: -120,
                    overallHeightMil: 70
                }
            ],
            pads: [
                createSurfacePad(500, 220),
                createSurfacePad(500, 280),
                {
                    componentIndex: 7,
                    x: 420,
                    y: 250,
                    sizeTopX: 45,
                    sizeTopY: 45,
                    holeShape: 2,
                    layerCode: 74,
                    hasTopPasteMaskOpening: false
                }
            ]
        }
    }
}

/**
 * Builds one fake top-side SMT pad.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function createSurfacePad(x, y) {
    return {
        componentIndex: 7,
        x,
        y,
        sizeTopX: 30,
        sizeTopY: 70,
        layerCode: 1,
        hasTopPasteMaskOpening: true
    }
}

/**
 * Builds a model-anchor fallback scene for the mixed fake connector.
 * @returns {object}
 */
function createModelAnchorScene() {
    return {
        sourceFormat: 'altium',
        board: { centerX: 500, centerY: 250, thicknessMil: 80 },
        externalPlacements: [
            {
                designator: 'TOKEN778899',
                mountSide: 'top',
                rotationDeg: 0,
                positionMil: { x: -680, y: 0, z: 40 },
                bodyPositionMil: { x: -180, y: 250 },
                modelTransform: {
                    rotationDeg: { x: 0, y: 0, z: 0 },
                    dzMil: 0
                },
                projection: { source: 'model-anchor-fallback' },
                externalModel: {
                    origin: 'embedded',
                    name: 'TOKEN778899.step',
                    format: 'step'
                }
            }
        ]
    }
}

/**
 * Builds a fake Altium PCB document with bottom-side rectangular IC pads.
 * @returns {object}
 */
function createBottomPadAxisDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'bottom-pad-axis-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            components: [
                {
                    componentIndex: 3,
                    designator: 'X9',
                    x: 500,
                    y: 500,
                    layer: 'BOTTOM',
                    pattern: 'FAKE_BOTTOM_IC',
                    rotation: 45
                }
            ],
            pads: [
                createBottomSurfacePad(430, 570),
                createBottomSurfacePad(465, 535),
                createBottomSurfacePad(535, 465),
                createBottomSurfacePad(570, 430)
            ],
            tracks: [],
            vias: []
        },
        bom: []
    }
}

/**
 * Builds one fake bottom-side rectangular surface pad.
 * @param {number} x Pad X coordinate.
 * @param {number} y Pad Y coordinate.
 * @returns {object}
 */
function createBottomSurfacePad(x, y) {
    return {
        componentIndex: 3,
        x,
        y,
        rotation: 135,
        sizeTopX: 20,
        sizeTopY: 100,
        sizeBottomX: 20,
        sizeBottomY: 100,
        shapeTop: 1,
        shapeBottom: 1,
        layerId: 32,
        layerCode: 32,
        side: 'bottom'
    }
}

/**
 * Verifies metadata-recovered mixed connector bodies carry pad contact hints.
 */
test('ECAD 3D service marks mixed Altium connector pad contact planes', () => {
    const scene = AltiumScene3dExternalPlacementAdapter.apply(
        createModelAnchorScene(),
        createMixedPadContactDocument()
    )
    const placement = scene.externalPlacements[0]

    assert.equal(placement.designator, 'J4')
    assert.equal(placement.modelTransform.contactPadsMil.length, 2)
    assert.deepEqual(placement.modelTransform.contactPadsMil[0], {
        x: 0,
        y: -30,
        width: 30,
        depth: 70
    })
})

/**
 * Verifies bottom-side pad rotations are compensated for the 3D mirror path.
 */
test('ECAD 3D service mirrors Altium bottom pad rotations for rendering', () => {
    const scene = EcadScene3dService.build(createBottomPadAxisDocument())

    assert.equal(scene.detail.pads[0].rotation, 225)
})
