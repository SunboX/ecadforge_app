import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicNetGeometryDiagnostics } from '../../src/core/SchematicNetGeometryDiagnostics.mjs'

test('SchematicNetGeometryDiagnostics suggests constrained label orientation fixes', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 0, x2: 8, y2: 0 }],
                labels: [
                    {
                        text: 'SENSE_A',
                        x: 4,
                        y: 0,
                        width: 2,
                        height: 1,
                        orientation: 'right',
                        orientations: ['up']
                    }
                ]
            }
        ]
    })

    assert.equal(result.summary.orientationLabelCandidateCount, 1)
    assert.deepEqual(result.orientationLabelCandidateBounds, [
        {
            kind: 'label-orientation-candidate',
            netName: 'SENSE_A',
            labelId: 'SENSE_A:label:0',
            labelIndex: 0,
            candidateIndex: 0,
            bounds: {
                minX: 3,
                minY: -1.5,
                maxX: 5,
                maxY: -0.5,
                width: 2,
                height: 1
            },
            debug: {
                currentOrientation: 'right',
                requiredOrientation: 'up',
                anchor: { x: 4, y: 0 },
                status: 'accepted'
            }
        }
    ])
    assert.deepEqual(result.orientationConnectorSegments, [
        {
            kind: 'label-orientation-connector-candidate',
            netName: 'SENSE_A',
            labelId: 'SENSE_A:label:0',
            points: [
                { x: 4, y: 0 },
                { x: 4, y: -0.5 }
            ],
            debug: {
                requiredOrientation: 'up',
                candidateIndex: 0
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics suggests power label corner placements', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'VCC',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 4, y: 0 },
                            { x: 4, y: 4 }
                        ]
                    }
                ],
                labels: [{ text: 'VCC', x: 2, y: 0, width: 2, height: 1 }]
            }
        ]
    })

    assert.equal(result.summary.powerLabelCornerCandidateCount, 1)
    assert.deepEqual(result.powerLabelCornerCandidateBounds, [
        {
            kind: 'power-label-corner-candidate',
            netName: 'VCC',
            labelId: 'VCC:label:0',
            labelIndex: 0,
            candidateIndex: 0,
            bounds: {
                minX: 3,
                minY: -1.5,
                maxX: 5,
                maxY: -0.5,
                width: 2,
                height: 1
            },
            debug: {
                corner: { x: 4, y: 0 },
                orientation: 'up',
                distance: 2,
                segmentKeys: ['VCC:0:0', 'VCC:0:1']
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics suggests stair-step and Z-shape cleanup paths', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'STAIR_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 2, y: 0 },
                            { x: 2, y: 1 },
                            { x: 4, y: 1 },
                            { x: 4, y: 2 },
                            { x: 6, y: 2 }
                        ]
                    }
                ]
            },
            {
                name: 'Z_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 1, y: 0 },
                            { x: 1, y: 4 },
                            { x: 8, y: 4 }
                        ]
                    }
                ]
            }
        ]
    })

    assert.deepEqual(
        result.pathCleanupSegments.map((row) => ({
            netName: row.netName,
            points: row.points,
            cleanupKinds: row.debug.cleanupKinds
        })),
        [
            {
                netName: 'STAIR_A',
                points: [
                    { x: 0, y: 0 },
                    { x: 6, y: 0 },
                    { x: 6, y: 2 }
                ],
                cleanupKinds: ['stair-step']
            },
            {
                netName: 'Z_A',
                points: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                    { x: 4, y: 4 },
                    { x: 8, y: 4 }
                ],
                cleanupKinds: ['balanced-z-shape']
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics reports rejected trace-anchored label candidates', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 0, y: -1, width: 20, height: 2 }],
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 0, x2: 8, y2: 0 }],
                labels: [{ text: 'SENSE_A', x: 4, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'RETURN_A',
                labels: [{ text: 'RETURN_A', x: 4, y: 0, width: 2, height: 1 }]
            }
        ]
    })

    assert.equal(result.summary.traceAnchoredLabelRejectedCandidateCount, 2)
    assert.deepEqual(result.traceAnchoredLabelRejectedCandidateBounds[0], {
        kind: 'trace-anchored-net-label-rejected-candidate',
        netName: 'SENSE_A',
        labelId: 'SENSE_A:label:0',
        labelIndex: 0,
        candidateIndex: 0,
        reason: 'body-collision',
        bounds: {
            minX: -1,
            minY: -1.5,
            maxX: 1,
            maxY: -0.5,
            width: 2,
            height: 1
        },
        debug: {
            anchor: { x: 0, y: 0 },
            orientation: 'up',
            segmentKey: 'SENSE_A:0:0',
            pathDistance: 0
        }
    })
})

test('SchematicNetGeometryDiagnostics suggests symbol body and pin-fit candidates', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 0, y: 0, width: 4, height: 4 }],
        nets: [
            {
                name: 'FIT_A',
                segments: [{ x1: 0, y1: 5, x2: 1, y2: 5 }],
                pins: [
                    { refdes: 'U1', pin: '1', x: 3, y: 0 },
                    { refdes: 'U1', pin: '2', x: 0, y: 0 }
                ]
            }
        ]
    })

    assert.equal(result.summary.symbolBodyFitCandidateCount, 1)
    assert.deepEqual(result.symbolBodyFitCandidateBounds, [
        {
            kind: 'symbol-body-fit-candidate',
            obstacleId: 'component:U1',
            bounds: {
                minX: -2,
                minY: -2,
                maxX: 3,
                maxY: 2,
                width: 5,
                height: 4
            },
            debug: {
                sourcePinIds: ['FIT_A:pin:U1:1:0'],
                expansion: { left: 0, right: 1, top: 0, bottom: 0 }
            }
        }
    ])
    assert.equal(result.summary.symbolPinSnapCandidateCount, 2)
    assert.deepEqual(result.symbolPinSnapSegments[0], {
        kind: 'symbol-pin-snap-candidate',
        obstacleId: 'component:U1',
        netName: 'FIT_A',
        anchorId: 'FIT_A:pin:U1:1:0',
        points: [
            { x: 3, y: 0 },
            { x: 2, y: 0 }
        ],
        debug: {
            snapSide: 'right',
            reason: 'pin-outside-symbol-body'
        }
    })
})

test('SchematicNetGeometryDiagnostics includes advisor candidate budgets', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 0, y: -1, width: 20, height: 2 }],
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 0, x2: 8, y2: 0 }],
                labels: [
                    {
                        text: 'SENSE_A',
                        x: 4,
                        y: 0,
                        width: 2,
                        height: 1,
                        orientation: 'right',
                        orientations: ['up']
                    }
                ]
            },
            {
                name: 'RETURN_A',
                labels: [{ text: 'RETURN_A', x: 4, y: 0, width: 2, height: 1 }]
            }
        ]
    })
    const budgetStage = result.debug.stages.find(
        (stage) => stage.name === 'candidate-budgets'
    )

    assert.equal(
        result.debug.candidateBudgets.orientationLabelCandidates.generated,
        1
    )
    assert.equal(
        result.debug.candidateBudgets.traceAnchoredLabelCandidates.rejected,
        2
    )
    assert.equal(
        budgetStage.summary.orientationLabelCandidates.accepted,
        result.orientationLabelCandidateBounds.length
    )
})
