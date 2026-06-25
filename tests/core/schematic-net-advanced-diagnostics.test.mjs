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
                candidateIndex: 0,
                candidateStatus: 'accepted'
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

test('SchematicNetGeometryDiagnostics reports obstacle-aware anchor route variants', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 5, y: 0, width: 2, height: 2 }],
        nets: [
            {
                name: 'ROUTE_A',
                pins: [
                    { refdes: 'J1', pin: '1', x: 0, y: 0 },
                    { refdes: 'J2', pin: '1', x: 10, y: 0 }
                ]
            }
        ]
    })
    const routeDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'anchor-connection-routes'
    )
    const directDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'supplemental-connections' &&
            row.status === 'rejected'
    )

    assert.equal(result.summary.anchorConnectionRouteCount, 2)
    assert.deepEqual(result.anchorConnectionRouteSegments[0], {
        kind: 'anchor-connection-route-candidate',
        netName: 'ROUTE_A',
        anchorIds: ['ROUTE_A:pin:J1:1:0', 'ROUTE_A:pin:J2:1:1'],
        candidateId: 'ROUTE_A:anchor-route-0',
        candidateIndex: 0,
        points: [
            { x: 0, y: 0 },
            { x: 0, y: -2 },
            { x: 10, y: -2 },
            { x: 10, y: 0 }
        ],
        distance: 14,
        debug: {
            sourceKind: 'anchor-connection-route',
            strategy: 'orthogonal-route-variant',
            routeStyle: 'horizontal-offset',
            directReason: 'restricted-centerline',
            collisionSourceId: 'component:U1',
            status: 'accepted'
        }
    })
    assert.equal(directDecision.reason, 'restricted-centerline')
    assert.equal(routeDecisions.length, 2)
    assert.equal(routeDecisions[0].status, 'accepted')
    assert.equal(routeDecisions[0].debug.strategy, 'orthogonal-route-variant')
    assert.equal(
        result.debug.candidateBudgets.anchorConnectionRoutes.finalStatus,
        'accepted'
    )
})

test('SchematicNetGeometryDiagnostics emits explicit pin/body normalization telemetry', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 0, y: 0, width: 4, height: 4 }],
        nets: [
            {
                name: 'NORM_A',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0 },
                    { refdes: 'U1', pin: '2', x: 3, y: 0 },
                    { refdes: 'U1', pin: '3', x: 2, y: 0 }
                ]
            }
        ]
    })
    const normalizationDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'symbol-normalization'
    )

    assert.equal(result.summary.symbolAnchorCorrectionCount, 2)
    assert.equal(result.summary.symbolBoundsExpansionCandidateCount, 1)
    assert.deepEqual(
        result.symbolAnchorCorrectionSegments.map((row) => ({
            anchorId: row.anchorId,
            points: row.points,
            normalizationKind: row.debug.normalizationKind
        })),
        [
            {
                anchorId: 'NORM_A:pin:U1:1:0',
                points: [
                    { x: 0, y: 0 },
                    { x: 0, y: 2 }
                ],
                normalizationKind: 'inside-symbol-body'
            },
            {
                anchorId: 'NORM_A:pin:U1:2:1',
                points: [
                    { x: 3, y: 0 },
                    { x: 2, y: 0 }
                ],
                normalizationKind: 'outside-symbol-edge'
            }
        ]
    )
    assert.deepEqual(result.symbolBoundsExpansionCandidateBounds, [
        {
            kind: 'symbol-bounds-expansion-candidate',
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
                normalizationKind: 'expanded-symbol-bounds',
                sourcePinIds: ['NORM_A:pin:U1:2:1'],
                expansion: { left: 0, right: 1, top: 0, bottom: 0 }
            }
        }
    ])
    assert.equal(normalizationDecisions.length, 3)
    assert.equal(
        result.debug.candidateBudgets.symbolNormalizationCandidates
            .finalStatus,
        'accepted'
    )
})

test('SchematicNetGeometryDiagnostics prefers label motion before trace detours', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'MOVE_A',
                segments: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
                labels: [{ text: 'MOVE_A', x: 5, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'CROSS_A',
                segments: [{ x1: 5, y1: -4, x2: 5, y2: 4 }]
            }
        ]
    })
    const resolutionDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'trace-label-resolutions'
    )

    assert.equal(result.summary.traceLabelResolutionCandidateCount, 1)
    assert.equal(result.summary.traceLabelResolutionTraceCount, 0)
    assert.deepEqual(result.traceLabelResolutionCandidateBounds, [
        {
            kind: 'trace-label-resolution-candidate',
            netName: 'MOVE_A',
            otherNetName: 'CROSS_A',
            labelId: 'MOVE_A:label:0',
            candidateId: 'MOVE_A:label:0:trace-label-resolution-0',
            candidateIndex: 0,
            bounds: {
                minX: -1,
                minY: -1.5,
                maxX: 1,
                maxY: -0.5,
                width: 2,
                height: 1
            },
            debug: {
                collisionIndex: 0,
                strategy: 'move-label-before-trace-detour',
                sourceCandidateIndex: 0,
                sourceSegmentKey: 'MOVE_A:0:0',
                status: 'accepted'
            }
        }
    ])
    assert.equal(result.traceLabelResolutionSegments.length, 0)
    assert.equal(resolutionDecisions[0].status, 'accepted')
    assert.equal(resolutionDecisions[0].debug.strategy, 'move-label')
})

test('SchematicNetGeometryDiagnostics falls back to trace motion when label motion is blocked', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 5, y: 0, width: 12, height: 4 }],
        nets: [
            {
                name: 'MOVE_BLOCKED',
                segments: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
                labels: [
                    {
                        text: 'MOVE_BLOCKED',
                        x: 5,
                        y: 0,
                        width: 2,
                        height: 1
                    }
                ]
            },
            {
                name: 'CROSS_BLOCKED',
                segments: [{ x1: 5, y1: -4, x2: 5, y2: 4 }]
            }
        ]
    })
    const resolutionDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'trace-label-resolutions'
    )

    assert.equal(result.summary.traceLabelResolutionCandidateCount, 0)
    assert.equal(result.summary.traceLabelResolutionTraceCount, 1)
    assert.deepEqual(result.traceLabelResolutionSegments, [
        {
            kind: 'trace-label-resolution-trace-candidate',
            netName: 'CROSS_BLOCKED',
            labelNetName: 'MOVE_BLOCKED',
            labelId: 'MOVE_BLOCKED:label:0',
            candidateId: 'MOVE_BLOCKED:label:0:trace-label-resolution-0',
            candidateIndex: 0,
            points: [
                { x: 5, y: -4 },
                { x: 5, y: -1 },
                { x: 3.5, y: -1 },
                { x: 3.5, y: 1 },
                { x: 5, y: 1 },
                { x: 5, y: 4 }
            ],
            debug: {
                collisionIndex: 0,
                strategy: 'move-trace-after-label-blocked',
                sourceCandidateIndex: 0,
                blockedLabelReasons: ['body-collision'],
                status: 'accepted'
            }
        }
    ])
    assert.equal(resolutionDecisions[0].status, 'accepted')
    assert.equal(resolutionDecisions[0].reason, 'label-candidates-blocked')
    assert.equal(resolutionDecisions[0].debug.strategy, 'move-trace')
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
        6
    )
    assert.equal(
        result.debug.candidateBudgets.orientationLabelCandidates.rejected,
        6
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

test('SchematicNetGeometryDiagnostics suggests merged-label trace detours', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'TRACE_A',
                segments: [{ x1: 0, y1: 0, x2: 8, y2: 0 }]
            },
            {
                name: 'LABEL_A',
                labels: [{ text: 'LABEL_A', x: 3, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'LABEL_B',
                labels: [{ text: 'LABEL_B', x: 5, y: 0, width: 2, height: 1 }]
            }
        ]
    })

    assert.equal(result.summary.multiLabelTraceDetourCount, 1)
    assert.deepEqual(result.multiLabelTraceDetourSegments, [
        {
            kind: 'multi-label-trace-detour-candidate',
            netName: 'TRACE_A',
            labelNetNames: ['LABEL_A', 'LABEL_B'],
            labelIds: ['LABEL_A:label:0', 'LABEL_B:label:0'],
            candidateIndex: 0,
            points: [
                { x: 0, y: 0 },
                { x: 0, y: -1 },
                { x: 8, y: -1 },
                { x: 8, y: 0 }
            ],
            debug: {
                collisionIndex: 0,
                strategy: 'merged-label-four-point-detour',
                padding: 0.5,
                mergedBounds: {
                    minX: 2,
                    minY: -0.5,
                    maxX: 6,
                    maxY: 0.5,
                    width: 4,
                    height: 1
                },
                status: 'accepted'
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics suggests lane shifts for overlapping net islands', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SHIFT_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 4, y: 0 },
                            { x: 4, y: 2 }
                        ]
                    }
                ]
            },
            {
                name: 'OTHER_A',
                segments: [{ x1: 1, y1: 0, x2: 3, y2: 0 }]
            }
        ]
    })

    assert.equal(result.summary.netIslandLaneShiftSegmentCount, 2)
    assert.deepEqual(result.netIslandLaneShiftSegments, [
        {
            kind: 'net-island-lane-shift-candidate',
            netName: 'SHIFT_A',
            otherNetName: 'OTHER_A',
            candidateId: 'SHIFT_A:island-1:lane-shift-0',
            segmentKey: 'SHIFT_A:0:0',
            points: [
                { x: 0, y: -1 },
                { x: 4, y: -1 }
            ],
            debug: {
                overlapIndex: 0,
                islandId: 'SHIFT_A:island-1',
                offset: -1,
                axis: 'x',
                status: 'accepted'
            }
        },
        {
            kind: 'net-island-lane-shift-candidate',
            netName: 'SHIFT_A',
            otherNetName: 'OTHER_A',
            candidateId: 'SHIFT_A:island-1:lane-shift-0',
            segmentKey: 'SHIFT_A:0:1',
            points: [
                { x: 4, y: -1 },
                { x: 4, y: 1 }
            ],
            debug: {
                overlapIndex: 0,
                islandId: 'SHIFT_A:island-1',
                offset: -1,
                axis: 'x',
                status: 'accepted'
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics flags long-distance connection candidates', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'FAR_A',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0 },
                    { refdes: 'U2', pin: '1', x: 40, y: 0 }
                ]
            }
        ]
    })

    assert.equal(result.summary.longDistanceConnectionCount, 1)
    assert.deepEqual(result.longDistanceConnectionSegments, [
        {
            kind: 'long-distance-connection-candidate',
            netName: 'FAR_A',
            points: [
                { x: 0, y: 0 },
                { x: 40, y: 0 }
            ],
            distance: 40,
            debug: {
                sourceKind: 'fallback-connection',
                reason: 'prefer-label-or-port-style-connection',
                threshold: 20,
                status: 'accepted'
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics flags section-boundary connections', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SECTION_A',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0, sectionId: 'LEFT' },
                    { refdes: 'U2', pin: '1', x: 4, y: 0, sectionId: 'RIGHT' }
                ]
            }
        ]
    })

    assert.equal(result.summary.sectionBoundaryConnectionCount, 1)
    assert.deepEqual(result.sectionBoundaryConnectionSegments, [
        {
            kind: 'section-boundary-connection-candidate',
            netName: 'SECTION_A',
            points: [
                { x: 0, y: 0 },
                { x: 4, y: 0 }
            ],
            debug: {
                sourceKind: 'fallback-connection',
                sectionIds: ['LEFT', 'RIGHT'],
                anchorIds: ['SECTION_A:pin:U1:1:0', 'SECTION_A:pin:U2:1:1'],
                status: 'accepted'
            }
        }
    ])
    assert.equal(
        result.issues.filter(
            (issue) => issue.type === 'section-boundary-connection'
        ).length,
        1
    )
})

test('SchematicNetGeometryDiagnostics emits candidate decision rows', () => {
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
            },
            {
                name: 'FAR_A',
                pins: [
                    { refdes: 'U2', pin: '1', x: 0, y: 4 },
                    { refdes: 'U3', pin: '1', x: 40, y: 4 }
                ]
            }
        ]
    })
    const budgetStage = result.debug.stages.find(
        (stage) => stage.name === 'candidate-decisions'
    )

    assert.ok(
        result.candidateDecisionRows.some(
            (row) =>
                row.advisor === 'long-distance-connections' &&
                row.status === 'accepted' &&
                row.candidateKind === 'long-distance-connection-candidate'
        )
    )
    assert.ok(
        result.candidateDecisionRows.some(
            (row) =>
                row.advisor === 'trace-anchored-labels' &&
                row.status === 'rejected' &&
                row.reason === 'body-collision'
        )
    )
    assert.equal(
        budgetStage.summary.candidateDecisionCount,
        result.candidateDecisionRows.length
    )
    assert.equal(
        result.summary.candidateDecisionCount,
        result.candidateDecisionRows.length
    )
})

test('SchematicNetGeometryDiagnostics suggests label relocation candidates', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'LABEL_A',
                segments: [{ x1: 0, y1: 0, x2: 4, y2: 0 }],
                labels: [{ text: 'LABEL_A', x: 2.8, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'LABEL_B',
                segments: [{ x1: 4, y1: 0, x2: 8, y2: 0 }],
                labels: [{ text: 'LABEL_B', x: 3.2, y: 0, width: 2, height: 1 }]
            }
        ]
    })
    const acceptedDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'label-relocations' && row.status === 'accepted'
    )
    const rejectedDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'label-relocations' && row.status === 'rejected'
    )

    assert.equal(result.summary.labelRelocationCandidateCount, 1)
    assert.deepEqual(result.labelRelocationCandidateBounds, [
        {
            kind: 'net-label-relocation-candidate',
            netName: 'LABEL_B',
            labelId: 'LABEL_B:label:0',
            candidateId: 'LABEL_B:label:0:relocation-1',
            candidateIndex: 1,
            bounds: {
                minX: 4.7,
                minY: -0.5,
                maxX: 6.7,
                maxY: 0.5,
                width: 2,
                height: 1
            },
            anchor: { x: 5.7, y: 0 },
            debug: {
                collisionIndex: 0,
                movedLabelId: 'LABEL_B:label:0',
                stationaryLabelId: 'LABEL_A:label:0',
                hostSegmentKey: 'LABEL_B:0:0',
                strategy: 'host-trace-label-relocation',
                status: 'accepted',
                score: 2.5
            }
        }
    ])
    assert.equal(acceptedDecision.selected, true)
    assert.equal(acceptedDecision.score, 2.5)
    assert.equal(acceptedDecision.collisionSource, 'label-label')
    assert.equal(rejectedDecision.reason, 'label-collision')
    assert.equal(rejectedDecision.selected, false)
})

test('SchematicNetGeometryDiagnostics prefers obstacle-aware lane-shift offsets', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 3, y: -1, width: 6, height: 0.8 }],
        nets: [
            {
                name: 'SHIFT_OBS',
                segments: [{ x1: 0, y1: 0, x2: 6, y2: 0 }]
            },
            {
                name: 'OTHER_OBS',
                segments: [{ x1: 1, y1: 0, x2: 5, y2: 0 }]
            }
        ]
    })
    const acceptedDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'net-island-lane-shifts' &&
            row.status === 'accepted'
    )
    const rejectedDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'net-island-lane-shifts' &&
            row.status === 'rejected'
    )

    assert.deepEqual(result.netIslandLaneShiftSegments, [
        {
            kind: 'net-island-lane-shift-candidate',
            netName: 'SHIFT_OBS',
            otherNetName: 'OTHER_OBS',
            candidateId: 'SHIFT_OBS:island-1:lane-shift-1',
            segmentKey: 'SHIFT_OBS:0:0',
            points: [
                { x: 0, y: -1.6 },
                { x: 6, y: -1.6 }
            ],
            debug: {
                overlapIndex: 0,
                islandId: 'SHIFT_OBS:island-1',
                offset: -1.6,
                axis: 'x',
                status: 'accepted',
                strategy: 'obstacle-aware-offset',
                obstacleAware: true,
                score: 1.6
            }
        }
    ])
    assert.equal(acceptedDecision.selected, true)
    assert.equal(acceptedDecision.score, 1.6)
    assert.equal(acceptedDecision.collisionSource, 'cross-net-overlap')
    assert.equal(rejectedDecision.reason, 'body-collision')
    assert.equal(rejectedDecision.collisionSource, 'obstacle')
})

test('SchematicNetGeometryDiagnostics suggests congested L-turn reroutes', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 4, y: 2, width: 0.8, height: 2.5 }],
        nets: [
            {
                name: 'TURN_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 4, y: 0 },
                            { x: 4, y: 4 }
                        ]
                    }
                ]
            },
            {
                name: 'OTHER_A',
                segments: [{ x1: 1, y1: 0, x2: 3, y2: 0 }]
            }
        ]
    })
    const decision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'congested-l-turn-reroutes' &&
            row.status === 'accepted'
    )

    assert.equal(result.summary.congestedLTurnRerouteCount, 1)
    const [reroute] = result.congestedLTurnRerouteSegments
    assert.deepEqual(
        {
            ...reroute,
            debug: {
                corner: reroute.debug.corner,
                overlapCount: reroute.debug.overlapCount,
                obstacleCount: reroute.debug.obstacleCount,
                strategy: reroute.debug.strategy,
                status: reroute.debug.status,
                score: reroute.debug.score
            }
        },
        {
            kind: 'congested-l-turn-reroute-candidate',
            netName: 'TURN_A',
            segmentKey: 'TURN_A:0',
            candidateId: 'TURN_A:0:congested-l-turn-0',
            candidateIndex: 0,
            points: [
                { x: 0, y: 0 },
                { x: 0, y: -1 },
                { x: 5, y: -1 },
                { x: 5, y: 4 },
                { x: 4, y: 4 }
            ],
            debug: {
                corner: { x: 4, y: 0 },
                overlapCount: 1,
                obstacleCount: 1,
                strategy: 'rectangle-reroute',
                status: 'accepted',
                score: 2
            }
        }
    )
    assert.deepEqual(reroute.debug.lTurn, {
        start: { x: 0, y: 0 },
        corner: { x: 4, y: 0 },
        end: { x: 4, y: 4 },
        previousSegmentKey: 'TURN_A:0:0',
        nextSegmentKey: 'TURN_A:0:1'
    })
    assert.equal(reroute.debug.blockerIntersections.length, 2)
    assert.equal(reroute.debug.rectangleCandidates.length, 1)
    assert.equal(decision.selected, true)
    assert.equal(decision.score, 2)
    assert.equal(decision.collisionSource, 'congested-l-turn')
})
