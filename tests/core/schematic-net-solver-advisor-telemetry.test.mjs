import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicNetGeometryDiagnostics } from '../../src/core/SchematicNetGeometryDiagnostics.mjs'

test('SchematicNetGeometryDiagnostics skips stale label collisions after accepted moves', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'CHAIN_A',
                segments: [{ x1: -0.2, y1: 0, x2: 0, y2: 0 }],
                labels: [
                    { text: 'CHAIN_A', x: 0, y: 0, width: 0.5, height: 0.4 }
                ]
            },
            {
                name: 'CHAIN_B',
                segments: [{ x1: 0.35, y1: 0, x2: 0.45, y2: 0 }],
                labels: [
                    { text: 'CHAIN_B', x: 0.4, y: 0, width: 0.5, height: 0.4 }
                ]
            },
            {
                name: 'CHAIN_C',
                segments: [{ x1: 0.8, y1: 0, x2: 0.9, y2: 0 }],
                labels: [
                    { text: 'CHAIN_C', x: 0.8, y: 0, width: 0.5, height: 0.4 }
                ]
            }
        ]
    })
    const relocationDecisions = result.candidateDecisionRows.filter(
        (row) => row.advisor === 'label-relocations'
    )

    assert.equal(
        result.collisionBounds.filter(
            (row) => row.kind === 'net-label-net-label-overlap'
        ).length,
        2
    )
    assert.equal(result.summary.labelRelocationCandidateCount, 1)
    assert.equal(
        result.labelRelocationCandidateBounds[0].labelId,
        'CHAIN_B:label:0'
    )
    assert.deepEqual(result.labelRelocationCandidateBounds[0].anchor, {
        x: 1.4,
        y: 0
    })
    assert.deepEqual(
        relocationDecisions.map((row) => row.status),
        ['rejected', 'accepted']
    )
    assert.equal(relocationDecisions.at(-1).debug.globalPass, true)
})

test('SchematicNetGeometryDiagnostics reports connector collision statuses for orientation candidates', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'ORIENT_A',
                segments: [{ x1: 0, y1: 0, x2: 6, y2: 0 }],
                labels: [
                    {
                        text: 'ORIENT_A',
                        x: 3,
                        y: 0,
                        width: 1,
                        height: 0.4,
                        orientation: 'right',
                        orientations: ['up']
                    }
                ]
            },
            {
                name: 'ORIENT_B',
                segments: [{ x1: 3, y1: -0.4, x2: 3, y2: -0.1 }]
            }
        ]
    })
    const rejected = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'label-orientations' &&
            row.reason === 'connector-trace-collision'
    )
    const accepted = result.candidateDecisionRows.find(
        (row) =>
            row.advisor === 'label-orientations' && row.status === 'accepted'
    )

    assert.ok(rejected)
    assert.equal(rejected.collisionSource, 'connector-trace')
    assert.equal(rejected.debug.candidateStatus, 'connector-trace-collision')
    assert.equal(accepted.debug.candidateStatus, 'accepted')
    assert.equal(
        result.orientationConnectorSegments[0].debug.candidateStatus,
        'accepted'
    )
})

test('SchematicNetGeometryDiagnostics exposes L-turn intersection rectangle telemetry', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            { designator: 'U1', x: 4, y: 2, width: 0.8, height: 2.5 },
            { designator: 'U2', x: 2.5, y: -1, width: 5, height: 0.4 }
        ],
        nets: [
            {
                name: 'TURN_META',
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
                name: 'OTHER_META',
                segments: [{ x1: 1, y1: 0, x2: 3, y2: 0 }]
            }
        ]
    })
    const row = result.congestedLTurnRerouteSegments[0]
    const acceptedDecision = result.candidateDecisionRows.find(
        (decision) =>
            decision.advisor === 'congested-l-turn-reroutes' &&
            decision.status === 'accepted'
    )

    assert.deepEqual(row.debug.lTurn, {
        start: { x: 0, y: 0 },
        corner: { x: 4, y: 0 },
        end: { x: 4, y: 4 },
        previousSegmentKey: 'TURN_META:0:0',
        nextSegmentKey: 'TURN_META:0:1'
    })
    assert.equal(row.debug.blockerIntersections.length, 2)
    assert.equal(row.debug.rectangleCandidates.length, 2)
    assert.deepEqual(acceptedDecision.debug.lTurn, row.debug.lTurn)
    assert.equal(acceptedDecision.debug.candidateStatus, 'accepted')
})

test('SchematicNetGeometryDiagnostics summarizes partial advisor acceptance in budget health', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            { designator: 'U1', x: 4, y: 2, width: 0.8, height: 2.5 },
            { designator: 'U2', x: 2.5, y: -1, width: 5, height: 0.4 }
        ],
        nets: [
            {
                name: 'TURN_BUDGET',
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
                name: 'OTHER_BUDGET',
                segments: [{ x1: 1, y1: 0, x2: 3, y2: 0 }]
            }
        ]
    })
    const budget = result.debug.candidateBudgets.congestedLTurnReroutes
    const budgetHealth = result.debug.stageHealthRows.find(
        (row) => row.stageName === 'candidate-budgets'
    )

    assert.equal(budget.finalStatus, 'partial-accepted')
    assert.equal(budget.finalAcceptanceReason, 'accepted-after-rejections')
    assert.equal(
        budgetHealth.snapshot.finalAcceptanceByAdvisor.congestedLTurnReroutes
            .finalStatus,
        'partial-accepted'
    )
    assert.equal(
        Object.values(budgetHealth.snapshot.finalAcceptanceCounts).reduce(
            (total, count) => total + count,
            0
        ),
        Object.keys(result.debug.candidateBudgets).length
    )
    assert.ok(
        budgetHealth.snapshot.finalAcceptanceCounts['partial-accepted'] > 0
    )
})
