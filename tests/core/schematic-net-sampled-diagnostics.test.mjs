import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicNetGeometryDiagnostics } from '../../src/core/SchematicNetGeometryDiagnostics.mjs'

test('SchematicNetGeometryDiagnostics samples lateral label orientation fixes', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 5, y: -2, width: 3, height: 4 }],
        nets: [
            {
                name: 'SENSE_B',
                segments: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
                labels: [
                    {
                        text: 'SENSE_B',
                        x: 5,
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
    const rejectedDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'label-orientations' && row.status === 'rejected'
    )
    const acceptedDecision = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'label-orientations' && row.status === 'accepted'
    )

    assert.equal(result.summary.orientationLabelCandidateCount, 1)
    assert.deepEqual(result.orientationLabelCandidateBounds, [
        {
            kind: 'label-orientation-candidate',
            netName: 'SENSE_B',
            labelId: 'SENSE_B:label:0',
            labelIndex: 0,
            candidateIndex: 2,
            bounds: {
                minX: 1,
                minY: -1.5,
                maxX: 3,
                maxY: -0.5,
                width: 2,
                height: 1
            },
            debug: {
                currentOrientation: 'right',
                requiredOrientation: 'up',
                anchor: { x: 2, y: 0 },
                searchPhase: 'lateral',
                status: 'accepted'
            }
        }
    ])
    assert.deepEqual(result.orientationConnectorSegments, [
        {
            kind: 'label-orientation-connector-candidate',
            netName: 'SENSE_B',
            labelId: 'SENSE_B:label:0',
            points: [
                { x: 2, y: 0 },
                { x: 2, y: -0.5 }
            ],
            debug: {
                requiredOrientation: 'up',
                candidateIndex: 2,
                candidateStatus: 'accepted',
                searchPhase: 'lateral'
            }
        }
    ])
    assert.equal(rejectedDecision.reason, 'body-collision')
    assert.equal(rejectedDecision.selected, false)
    assert.equal(acceptedDecision.selected, true)
    assert.equal(acceptedDecision.debug.strategy, 'sampled-label-orientation')
})

test('SchematicNetGeometryDiagnostics samples host trace label relocations', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 5.7, y: 0, width: 2, height: 0.8 }],
        nets: [
            {
                name: 'LABEL_C',
                segments: [{ x1: 0, y1: 0, x2: 4, y2: 0 }],
                labels: [{ text: 'LABEL_C', x: 2.8, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'LABEL_D',
                segments: [{ x1: 4, y1: 0, x2: 8, y2: 0 }],
                labels: [{ text: 'LABEL_D', x: 3.2, y: 0, width: 2, height: 1 }]
            }
        ]
    })
    const relocationDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'label-relocations'
    )

    assert.equal(result.summary.labelRelocationCandidateCount, 1)
    assert.deepEqual(result.labelRelocationCandidateBounds, [
        {
            kind: 'net-label-relocation-candidate',
            netName: 'LABEL_D',
            labelId: 'LABEL_D:label:0',
            candidateId: 'LABEL_D:label:0:relocation-2',
            candidateIndex: 2,
            bounds: {
                minX: 3,
                minY: -1.5,
                maxX: 5,
                maxY: -0.5,
                width: 2,
                height: 1
            },
            anchor: { x: 4, y: -1 },
            debug: {
                collisionIndex: 0,
                movedLabelId: 'LABEL_D:label:0',
                stationaryLabelId: 'LABEL_C:label:0',
                hostSegmentKey: 'LABEL_D:0:0',
                strategy: 'sampled-host-trace-relocation',
                status: 'accepted',
                score: 1.8,
                traceAnchor: { x: 4, y: 0 },
                orientation: 'up',
                sampleIndex: 0
            }
        }
    ])
    assert.deepEqual(
        relocationDecisions.map((row) => ({
            status: row.status,
            reason: row.reason,
            strategy: row.debug.strategy
        })),
        [
            {
                status: 'rejected',
                reason: 'label-collision',
                strategy: 'host-trace-label-relocation'
            },
            {
                status: 'rejected',
                reason: 'body-collision',
                strategy: 'host-trace-label-relocation'
            },
            {
                status: 'accepted',
                reason: '',
                strategy: 'sampled-host-trace-relocation'
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics evaluates alternate congested L-turn reroutes', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            { designator: 'U1', x: 4, y: 2, width: 0.8, height: 2.5 },
            { designator: 'U2', x: 2.5, y: -1, width: 5, height: 0.4 }
        ],
        nets: [
            {
                name: 'TURN_B',
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
                name: 'OTHER_B',
                segments: [{ x1: 1, y1: 0, x2: 3, y2: 0 }]
            }
        ]
    })
    const turnDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'congested-l-turn-reroutes'
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
                score: reroute.debug.score,
                rejectedCandidateCount: reroute.debug.rejectedCandidateCount
            }
        },
        {
            kind: 'congested-l-turn-reroute-candidate',
            netName: 'TURN_B',
            segmentKey: 'TURN_B:0',
            candidateId: 'TURN_B:0:congested-l-turn-1',
            candidateIndex: 1,
            points: [
                { x: 0, y: 0 },
                { x: 0, y: 0.15 },
                { x: 5, y: 0.15 },
                { x: 5, y: 4 },
                { x: 4, y: 4 }
            ],
            debug: {
                corner: { x: 4, y: 0 },
                overlapCount: 1,
                obstacleCount: 1,
                strategy: 'intersection-driven-rectangle-reroute',
                status: 'accepted',
                score: 3,
                rejectedCandidateCount: 1
            }
        }
    )
    assert.deepEqual(reroute.debug.lTurn, {
        start: { x: 0, y: 0 },
        corner: { x: 4, y: 0 },
        end: { x: 4, y: 4 },
        previousSegmentKey: 'TURN_B:0:0',
        nextSegmentKey: 'TURN_B:0:1'
    })
    assert.equal(reroute.debug.blockerIntersections.length, 2)
    assert.equal(reroute.debug.rectangleCandidates.length, 2)
    assert.deepEqual(
        turnDecisions.map((row) => ({
            status: row.status,
            reason: row.reason,
            selected: row.selected,
            score: row.score
        })),
        [
            {
                status: 'rejected',
                reason: 'body-collision',
                selected: false,
                score: 2
            },
            {
                status: 'accepted',
                reason: '',
                selected: true,
                score: 3
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics exports diagnostic stage snapshots', () => {
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
    const health = result.debug.stageHealthRows.find(
        (row) => row.stageName === 'candidate-decisions'
    )
    const stage = result.debug.stages.find(
        (row) => row.name === 'candidate-decisions'
    )

    assert.equal(result.summary.stageHealthRowCount, 8)
    assert.equal(result.debug.stageHealthRows.length, 8)
    assert.equal(health.generated, result.candidateDecisionRows.length)
    assert.equal(health.accepted, 1)
    assert.equal(health.rejected, 1)
    assert.deepEqual(health.topRejectionReasons, [
        { reason: 'body-collision', count: 1 }
    ])
    assert.deepEqual(stage.summary.health, {
        generated: health.generated,
        accepted: health.accepted,
        rejected: health.rejected,
        issueCount: health.issueCount,
        topRejectionReasons: health.topRejectionReasons
    })
    assert.equal(health.phaseIndex, 6)
    assert.equal(health.status, 'attention')
    assert.deepEqual(result.debug.stageSnapshots[6], health.snapshot)
    assert.deepEqual(health.snapshot, {
        version: 1,
        stageName: 'candidate-decisions',
        phaseIndex: 6,
        status: 'attention',
        rowCounts: {
            generated: health.generated,
            accepted: health.accepted,
            rejected: health.rejected,
            issueCount: health.issueCount
        },
        topRejectionReasons: [{ reason: 'body-collision', count: 1 }],
        candidateDecisionCounts: {
            accepted: 1,
            rejected: 1
        }
    })
    assert.deepEqual(
        result.debug.stageHealthRows.find(
            (row) => row.stageName === 'candidate-budgets'
        ).snapshot.candidateCountsByAdvisor.netIslandLaneShifts,
        {
            generated: 2,
            accepted: 1,
            rejected: 1
        }
    )
})

test('SchematicNetGeometryDiagnostics minimizes turns without crossing labels', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'CLEAN_TURNS',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 0, y: 4 },
                            { x: 2, y: 4 },
                            { x: 2, y: 0 },
                            { x: 8, y: 0 }
                        ]
                    }
                ]
            },
            {
                name: 'BLOCKED_TURNS',
                segments: [
                    {
                        points: [
                            { x: 0, y: 8 },
                            { x: 0, y: 10 },
                            { x: 8, y: 10 },
                            { x: 8, y: 8 }
                        ]
                    }
                ]
            },
            {
                name: 'LABEL_BLOCKER',
                labels: [
                    { text: 'LABEL_BLOCKER', x: 4, y: 8, width: 1, height: 1 }
                ]
            }
        ]
    })

    assert.deepEqual(
        result.pathCleanupSegments.map((row) => ({
            netName: row.netName,
            points: row.points,
            cleanupKinds: row.debug.cleanupKinds,
            collisionChecked: row.debug.collisionChecked
        })),
        [
            {
                netName: 'CLEAN_TURNS',
                points: [
                    { x: 0, y: 0 },
                    { x: 8, y: 0 }
                ],
                cleanupKinds: ['turn-minimization'],
                collisionChecked: true
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics suggests snip reconnect trace-label detours', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'LABEL_SNIP',
                labels: [
                    { text: 'LABEL_SNIP', x: 4, y: 2, width: 1, height: 1 }
                ]
            },
            {
                name: 'TRACE_SNIP',
                segments: [{ x1: 4, y1: 0, x2: 4, y2: 4 }]
            }
        ]
    })

    assert.equal(result.summary.traceLabelSnipReconnectCount, 1)
    assert.deepEqual(result.traceLabelSnipReconnectSegments, [
        {
            kind: 'net-label-trace-snip-reconnect-candidate',
            netName: 'TRACE_SNIP',
            labelNetName: 'LABEL_SNIP',
            labelId: 'LABEL_SNIP:label:0',
            candidateIndex: 0,
            points: [
                { x: 4, y: 0 },
                { x: 4, y: 1 },
                { x: 3, y: 1 },
                { x: 3, y: 3 },
                { x: 4, y: 3 },
                { x: 4, y: 4 }
            ],
            debug: {
                collisionIndex: 0,
                strategy: 'snip-and-reconnect-label-detour',
                padding: 0.5,
                entryPoint: { x: 4, y: 1 },
                exitPoint: { x: 4, y: 3 },
                side: 'left'
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics emits symbol fit decision telemetry', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 0, y: 0, width: 4, height: 4 }],
        nets: [
            {
                name: 'FIT_DECISIONS',
                segments: [{ x1: 0, y1: 5, x2: 1, y2: 5 }],
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0 },
                    { refdes: 'U1', pin: '2', x: 3, y: 0 }
                ]
            }
        ]
    })
    const decisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'symbol-fit'
    )

    assert.equal(result.summary.symbolBodyFitCandidateCount, 1)
    assert.equal(result.summary.symbolPinSnapCandidateCount, 2)
    assert.deepEqual(
        decisions.map((row) => ({
            candidateKind: row.candidateKind,
            status: row.status,
            reason: row.reason,
            selected: row.selected,
            collisionSource: row.collisionSource
        })),
        [
            {
                candidateKind: 'symbol-body-fit-candidate',
                status: 'accepted',
                reason: 'body-expansion-fits-pins',
                selected: true,
                collisionSource: 'symbol-fit'
            },
            {
                candidateKind: 'symbol-pin-snap-candidate',
                status: 'accepted',
                reason: 'pin-inside-symbol-body',
                selected: true,
                collisionSource: 'symbol-fit'
            },
            {
                candidateKind: 'symbol-pin-snap-candidate',
                status: 'accepted',
                reason: 'pin-outside-symbol-body',
                selected: true,
                collisionSource: 'symbol-fit'
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics emits anchor-aware connection pair decisions', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            { designator: 'U_RESTRICT', x: 5, y: 20, width: 2, height: 2 },
            { designator: 'U_OBSTACLE', x: 5, y: 30.5, width: 2, height: 2 }
        ],
        nets: [
            {
                name: 'PAIR_OK',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0 },
                    { refdes: 'U2', pin: '1', x: 4, y: 0 }
                ]
            },
            {
                name: 'PAIR_SECTION',
                pins: [
                    {
                        refdes: 'U1',
                        pin: '1',
                        x: 0,
                        y: 10,
                        sectionId: 'LEFT'
                    },
                    {
                        refdes: 'U2',
                        pin: '1',
                        x: 4,
                        y: 10,
                        sectionId: 'RIGHT'
                    }
                ]
            },
            {
                name: 'PAIR_RESTRICTED',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 20 },
                    { refdes: 'U2', pin: '1', x: 10, y: 20 }
                ]
            },
            {
                name: 'PAIR_OBSTACLE',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 30 },
                    { refdes: 'U2', pin: '1', x: 10, y: 30 }
                ]
            },
            {
                name: 'PAIR_FAR',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 40 },
                    { refdes: 'U2', pin: '1', x: 80, y: 40 }
                ]
            }
        ]
    })
    const decisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'supplemental-connections'
    )

    assert.deepEqual(result.supplementalConnectionSegments, [
        {
            kind: 'supplemental-connection-candidate',
            netName: 'PAIR_OK',
            points: [
                { x: 0, y: 0 },
                { x: 4, y: 0 }
            ],
            anchorIds: ['PAIR_OK:pin:U1:1:0', 'PAIR_OK:pin:U2:1:1'],
            distance: 4,
            debug: {
                sourceKind: 'anchor-connection-pair',
                reason: 'minimum-same-net-pair',
                status: 'accepted'
            }
        }
    ])
    assert.deepEqual(
        decisions.map((row) => ({
            netName: row.netName,
            status: row.status,
            reason: row.reason,
            selected: row.selected,
            collisionSource: row.collisionSource
        })),
        [
            {
                netName: 'PAIR_OK',
                status: 'accepted',
                reason: '',
                selected: true,
                collisionSource: 'same-net-anchor-pair'
            },
            {
                netName: 'PAIR_SECTION',
                status: 'rejected',
                reason: 'section-boundary',
                selected: false,
                collisionSource: 'section-boundary'
            },
            {
                netName: 'PAIR_RESTRICTED',
                status: 'rejected',
                reason: 'restricted-centerline',
                selected: false,
                collisionSource: 'component-centerline'
            },
            {
                netName: 'PAIR_OBSTACLE',
                status: 'rejected',
                reason: 'obstacle-risk',
                selected: false,
                collisionSource: 'component-obstacle'
            },
            {
                netName: 'PAIR_FAR',
                status: 'rejected',
                reason: 'too-far',
                selected: false,
                collisionSource: 'distance-limit'
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics suggests segment-level overlap shifts', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'PIN_STRAIGHT',
                segments: [{ x1: 0, y1: 0, x2: 6, y2: 0 }]
            },
            {
                name: 'SHIFT_TRACE',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 6, y: 0 },
                            { x: 6, y: 4 }
                        ]
                    }
                ]
            }
        ]
    })

    assert.equal(result.summary.segmentOverlapShiftCount, 1)
    assert.deepEqual(result.segmentOverlapShiftSegments, [
        {
            kind: 'segment-overlap-shift-candidate',
            netName: 'SHIFT_TRACE',
            segmentKey: 'SHIFT_TRACE:0',
            candidateId: 'SHIFT_TRACE:0:segment-overlap-shift-0',
            candidateIndex: 0,
            points: [
                { x: 0, y: 0 },
                { x: 0, y: -0.5 },
                { x: 6, y: -0.5 },
                { x: 6, y: 4 }
            ],
            debug: {
                overlapIndex: 0,
                shiftedPartIndex: 0,
                offset: -0.5,
                strategy: 'terminal-jog-segment-overlap-shift',
                keptStraightTraceNetName: 'PIN_STRAIGHT',
                status: 'accepted'
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics relocates port-only label collisions with statuses', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            { designator: 'U_BLOCK', x: 3, y: -1, width: 2, height: 1 }
        ],
        nets: [
            {
                name: 'PORT_A',
                labels: [{ text: 'PORT_A', x: 3, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'PORT_B',
                labels: [{ text: 'PORT_B', x: 3.2, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'TRACE_BLOCKER',
                segments: [{ x1: 2, y1: 1, x2: 4, y2: 1 }]
            }
        ]
    })
    const decisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'label-relocations'
    )

    assert.equal(result.summary.labelRelocationCandidateCount, 1)
    assert.deepEqual(result.labelRelocationCandidateBounds, [
        {
            kind: 'net-label-relocation-candidate',
            netName: 'PORT_B',
            labelId: 'PORT_B:label:0',
            candidateId: 'PORT_B:label:0:relocation-3',
            candidateIndex: 3,
            bounds: {
                minX: 2.2,
                minY: 1,
                maxX: 4.2,
                maxY: 2,
                width: 2,
                height: 1
            },
            anchor: { x: 3.2, y: 1.5 },
            debug: {
                collisionIndex: 0,
                movedLabelId: 'PORT_B:label:0',
                stationaryLabelId: 'PORT_A:label:0',
                hostSegmentKey: '',
                strategy: 'port-only-label-relocation',
                status: 'accepted',
                score: 1.5,
                candidateStatus: 'accepted',
                orientation: 'down'
            }
        }
    ])
    assert.deepEqual(
        decisions.map((row) => ({
            status: row.status,
            reason: row.reason,
            candidateStatus: row.debug.candidateStatus,
            strategy: row.debug.strategy
        })),
        [
            {
                status: 'rejected',
                reason: 'label-collision',
                candidateStatus: 'label-collision',
                strategy: 'port-only-label-relocation'
            },
            {
                status: 'rejected',
                reason: 'chip-collision',
                candidateStatus: 'chip-collision',
                strategy: 'port-only-label-relocation'
            },
            {
                status: 'rejected',
                reason: 'trace-collision',
                candidateStatus: 'trace-collision',
                strategy: 'port-only-label-relocation'
            },
            {
                status: 'accepted',
                reason: '',
                candidateStatus: 'accepted',
                strategy: 'port-only-label-relocation'
            }
        ]
    )
})
