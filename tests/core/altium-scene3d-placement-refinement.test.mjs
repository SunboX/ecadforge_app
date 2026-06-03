import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../node_modules/altium-toolkit/src/scene3d.mjs'

/**
 * Creates a synthetic stair-step outline that represents a rasterized rounded
 * board edge before a smoother board region refines it.
 * @returns {{ type: string, x1: number, y1: number, x2: number, y2: number }[]}
 */
function createStairStepSegments() {
    const segments = []
    const points = [
        { x: 0, y: 100 },
        { x: 72, y: 100 },
        { x: 72, y: 96 },
        { x: 80, y: 96 },
        { x: 80, y: 92 },
        { x: 84, y: 92 },
        { x: 84, y: 88 },
        { x: 88, y: 88 },
        { x: 88, y: 84 },
        { x: 92, y: 84 },
        { x: 92, y: 80 },
        { x: 96, y: 80 },
        { x: 96, y: 72 },
        { x: 100, y: 72 },
        { x: 100, y: 0 },
        { x: 0, y: 0 }
    ]

    for (let index = 0; index < points.length; index += 1) {
        const current = points[index]
        const next = points[(index + 1) % points.length]
        segments.push({
            type: 'line',
            x1: current.x,
            y1: current.y,
            x2: next.x,
            y2: next.y
        })
    }

    return segments
}

/**
 * Verifies unresolved Altium 3D bodies use board-proportional overhang
 * filtering so valid connector bodies can protrude from the long axis while
 * orphaned bodies beyond the short axis do not render as detached parts.
 */
test('altium-toolkit filters unresolved bodies by board-proportional margins', () => {
    const scene = PcbScene3dBuilder.build(
        {
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 2000,
                    heightMil: 1000,
                    segments: []
                },
                primitiveLayers: [],
                pads: [],
                componentBodies: [
                    {
                        identifier: 'Fixture Connector',
                        name: 'Fixture-Connector.step',
                        layer: 'MECHANICAL13',
                        modelId: 'connector-body',
                        positionMil: { x: -420, y: 500 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 90 }
                    },
                    {
                        identifier: 'Fixture Orphan',
                        name: 'Fixture-Orphan.step',
                        layer: 'MECHANICAL13',
                        modelId: 'orphan-body',
                        positionMil: { x: 1000, y: 1520 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 0 }
                    }
                ],
                components: []
            }
        },
        {
            modelRegistry: {
                resolveComponentModel() {
                    return null
                },
                resolveComponentBodyModel(componentBody) {
                    return {
                        origin: 'embedded',
                        name: componentBody.name,
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/' + componentBody.modelId
                    }
                }
            }
        }
    )

    assert.deepEqual(
        scene.externalPlacements.map((placement) => placement.designator),
        ['Fixture Connector']
    )
})

/**
 * Verifies refined Altium board outlines keep precomputed local component and
 * external-model placement coordinates aligned to the refined board center.
 */
test('altium-toolkit realigns placements after board outline refinement', () => {
    const scene = PcbScene3dBuilder.build(
        {
            pcb: {
                boardOutline: {
                    minX: 0,
                    minY: 0,
                    widthMil: 100,
                    heightMil: 100,
                    segments: createStairStepSegments()
                },
                primitiveLayers: [],
                boardRegions: [
                    {
                        objectKind: 'BoardRegion',
                        points: [
                            { x: 10, y: 100 },
                            { x: 10, y: 0 },
                            { x: 110, y: 0 },
                            { x: 110, y: 76 },
                            { x: 106, y: 88 },
                            { x: 98, y: 96 },
                            { x: 86, y: 100 }
                        ]
                    }
                ],
                pads: [],
                componentBodies: [
                    {
                        identifier: 'Fixture Body',
                        name: 'Fixture-Body.step',
                        layer: 'MECHANICAL13',
                        modelId: 'matched-body',
                        positionMil: { x: 50, y: 50 },
                        rotationDeg: 0,
                        modelRotationDeg: { x: 0, y: 0, z: 180 }
                    }
                ],
                components: [
                    {
                        designator: 'U1',
                        x: 50,
                        y: 50,
                        layer: 'TOP',
                        pattern: 'Fixture Body',
                        source: 'Fixture Body',
                        rotation: 0
                    }
                ]
            }
        },
        {
            modelRegistry: {
                resolveComponentModel() {
                    return null
                },
                resolveComponentBodyModel() {
                    return {
                        origin: 'embedded',
                        name: 'Fixture-Body.step',
                        format: 'step',
                        payloadText: 'ISO-10303-21;',
                        sourceStream: 'Models/0'
                    }
                }
            }
        }
    )

    assert.equal(scene.board.centerX, 60)
    assert.equal(scene.components[0].positionMil.x, -10)
    assert.equal(scene.externalPlacements[0].positionMil.x, -10)
})
