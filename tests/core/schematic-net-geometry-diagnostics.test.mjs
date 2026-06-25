import assert from 'node:assert/strict'
import test from 'node:test'
import { SchematicNetGeometryDiagnostics } from '../../src/core/SchematicNetGeometryDiagnostics.mjs'

/**
 * Returns simplified diagnostic segment points for assertions.
 * @param {object[]} segments Diagnostic segments.
 * @returns {Array<Array<{ x: number, y: number }>>}
 */
function segmentPoints(segments) {
    return segments.map((segment) => segment.points)
}

test('SchematicNetGeometryDiagnostics builds fallback segments for anchor-only nets', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0 },
                    { refdes: 'U2', pin: '2', x: 10, y: 0 },
                    { refdes: 'U3', pin: '3', x: 10, y: 8 }
                ]
            }
        ]
    })

    assert.equal(result.summary.netCount, 1)
    assert.equal(result.summary.fallbackSegmentCount, 2)
    assert.deepEqual(segmentPoints(result.fallbackSegments), [
        [
            { x: 0, y: 0 },
            { x: 10, y: 0 }
        ],
        [
            { x: 10, y: 0 },
            { x: 10, y: 8 }
        ]
    ])
    assert.deepEqual(
        result.issues
            .filter((issue) => issue.type === 'missing-authored-net-geometry')
            .map((issue) => ({
                netName: issue.netName,
                anchorCount: issue.anchorCount
            })),
        [{ netName: 'SENSE_A', anchorCount: 3 }]
    )
})

test('SchematicNetGeometryDiagnostics reports ambiguous and invalid segments', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'BUS_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 10, y: 0 }
                        ],
                        x1: 0,
                        y1: 4,
                        x2: 10,
                        y2: 4
                    }
                ]
            },
            {
                name: 'BROKEN_A',
                segments: [{ x1: 0, y1: 0, x2: 'not-a-number', y2: 6 }]
            }
        ]
    })

    assert.deepEqual(
        result.issues.map((issue) => ({
            type: issue.type,
            netName: issue.netName,
            segmentIndex: issue.segmentIndex
        })),
        [
            {
                type: 'ambiguous-net-segment',
                netName: 'BUS_A',
                segmentIndex: 0
            },
            {
                type: 'invalid-net-segment',
                netName: 'BROKEN_A',
                segmentIndex: 0
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics reports cross-net wire overlaps', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 4, x2: 10, y2: 4 }]
            },
            {
                name: 'RETURN_A',
                segments: [{ x1: 6, y1: 4, x2: 14, y2: 4 }]
            }
        ]
    })

    assert.equal(result.summary.overlapCount, 1)
    assert.deepEqual(result.overlapSegments, [
        {
            kind: 'cross-net-overlap',
            netNames: ['SENSE_A', 'RETURN_A'],
            points: [
                { x: 6, y: 4 },
                { x: 10, y: 4 }
            ],
            axis: 'x'
        }
    ])
    assert.deepEqual(
        result.issues
            .filter((issue) => issue.type === 'cross-net-segment-overlap')
            .map((issue) => [issue.netName, issue.otherNetName]),
        [['SENSE_A', 'RETURN_A']]
    )
})

test('SchematicNetGeometryDiagnostics reports disconnected net islands and anchors', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                segments: [
                    { x1: 0, y1: 0, x2: 4, y2: 0 },
                    { x1: 20, y1: 0, x2: 24, y2: 0 }
                ],
                pins: [
                    { refdes: 'U1', pin: '1', x: 0, y: 0 },
                    { refdes: 'U2', pin: '2', x: 24, y: 0 },
                    { refdes: 'U3', pin: '3', x: 12, y: 5 }
                ]
            }
        ]
    })

    const islandIssue = result.issues.find(
        (issue) => issue.type === 'disconnected-net-islands'
    )
    const anchorIssue = result.issues.find(
        (issue) => issue.type === 'unconnected-net-anchor'
    )

    assert.equal(islandIssue.netName, 'SENSE_A')
    assert.equal(islandIssue.islandCount, 2)
    assert.deepEqual(
        islandIssue.debug.islands.map((island) => island.segmentKeys),
        [['SENSE_A:0:0'], ['SENSE_A:1:0']]
    )
    assert.equal(anchorIssue.netName, 'SENSE_A')
    assert.equal(anchorIssue.anchorKind, 'pin')
    assert.deepEqual(anchorIssue.debug.anchor.point, { x: 12, y: 5 })
})

test('SchematicNetGeometryDiagnostics reports label collisions', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            {
                designator: 'U1',
                x: 4,
                y: 0,
                width: 2,
                height: 2
            }
        ],
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: -3, x2: 10, y2: -3 }],
                labels: [{ text: 'SENSE_A', x: 4, y: 0, width: 4, height: 2 }]
            },
            {
                name: 'RETURN_A',
                segments: [{ x1: 5, y1: -4, x2: 5, y2: 4 }],
                labels: [{ text: 'RETURN_A', x: 5, y: 0, width: 4, height: 2 }]
            }
        ]
    })

    assert.deepEqual(
        result.issues
            .filter((issue) =>
                [
                    'net-label-trace-overlap',
                    'net-label-net-label-overlap',
                    'net-label-symbol-overlap'
                ].includes(issue.type)
            )
            .map((issue) => issue.type)
            .sort(),
        [
            'net-label-net-label-overlap',
            'net-label-symbol-overlap',
            'net-label-symbol-overlap',
            'net-label-trace-overlap'
        ]
    )
    assert.equal(result.collisionBounds.length, 4)
    assert.equal(
        result.issues.find((issue) => issue.type === 'net-label-trace-overlap')
            .otherNetName,
        'RETURN_A'
    )
})

test('SchematicNetGeometryDiagnostics reports fallback obstacle crossings', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            {
                designator: 'U1',
                x: 5,
                y: 0,
                width: 2,
                height: 4
            }
        ],
        nets: [
            {
                name: 'PWR_A',
                pins: [
                    { refdes: 'J1', pin: '1', x: 0, y: 0 },
                    { refdes: 'J2', pin: '1', x: 10, y: 0 }
                ]
            }
        ]
    })

    const issue = result.issues.find(
        (entry) => entry.type === 'fallback-segment-crosses-obstacle'
    )

    assert.equal(issue.netName, 'PWR_A')
    assert.equal(issue.obstacleId, 'component:U1')
    assert.deepEqual(issue.debug.fallbackSegment.points, [
        { x: 0, y: 0 },
        { x: 10, y: 0 }
    ])
    assert.equal(result.obstacleSegments.length, 1)
})

test('SchematicNetGeometryDiagnostics flags restricted centerline crossings', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            {
                designator: 'U1',
                x: 5,
                y: 0,
                width: 4,
                height: 4
            }
        ],
        nets: [
            {
                name: 'PWR_A',
                pins: [
                    { refdes: 'J1', pin: '1', x: 0, y: 0 },
                    { refdes: 'J2', pin: '1', x: 10, y: 0 }
                ]
            }
        ]
    })

    assert.equal(result.summary.restrictedCenterlineCrossingCount, 1)
    assert.deepEqual(result.restrictedCenterlineSegments, [
        {
            kind: 'schematic-routing-restricted-centerline-crossing',
            netName: 'PWR_A',
            obstacleId: 'component:U1',
            axis: 'x',
            points: [
                { x: 3, y: 0 },
                { x: 7, y: 0 }
            ],
            debug: {
                sourceKind: 'fallback-connection',
                centerline: 'horizontal',
                sourceSegmentKey: ''
            }
        }
    ])
    assert.equal(
        result.issues.find(
            (issue) =>
                issue.type ===
                'schematic-routing-restricted-centerline-crossing'
        ).obstacleId,
        'component:U1'
    )
})

test('SchematicNetGeometryDiagnostics exports focused issue repro data', () => {
    const schematic = {
        components: [
            {
                designator: 'U1',
                x: 5,
                y: 0,
                width: 2,
                height: 4
            }
        ],
        nets: [
            {
                name: 'PWR_A',
                pins: [
                    { refdes: 'J1', pin: '1', x: 0, y: 0 },
                    { refdes: 'J2', pin: '1', x: 10, y: 0 }
                ]
            },
            {
                name: 'OTHER_A',
                segments: [{ x1: 20, y1: 0, x2: 30, y2: 0 }]
            }
        ]
    }
    const result = SchematicNetGeometryDiagnostics.analyze(schematic)
    const issue = result.issues.find(
        (entry) => entry.type === 'fallback-segment-crosses-obstacle'
    )
    const repro = SchematicNetGeometryDiagnostics.exportIssueRepro(
        schematic,
        issue
    )

    assert.equal(repro.version, 1)
    assert.equal(repro.issue.type, 'fallback-segment-crosses-obstacle')
    assert.deepEqual(
        repro.nets.map((net) => net.name),
        ['PWR_A']
    )
    assert.equal(repro.obstacles[0].id, 'component:U1')
    assert.equal(repro.diagnostics.summary.netCount, 1)
})

test('SchematicNetGeometryDiagnostics exports staged debug metadata', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 5, y: 0, width: 2, height: 2 }],
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
                labels: [{ text: 'SENSE_A', x: 5, y: 0, width: 4, height: 2 }]
            }
        ]
    })

    assert.deepEqual(
        result.debug.stages.map((stage) => stage.name),
        [
            'input-geometry',
            'net-collection',
            'path-quality',
            'connectivity',
            'collisions',
            'candidate-budgets',
            'candidate-decisions',
            'final-issues'
        ]
    )
    assert.equal(result.debug.stages[0].summary.netCount, 1)
    assert.equal(result.debug.stages[0].summary.obstacleCount, 1)
    assert.deepEqual(result.debug.stages[0].summary.health, {
        generated: 2,
        accepted: 2,
        rejected: 0,
        issueCount: 0,
        topRejectionReasons: []
    })
    assert.equal(result.debug.stageHealthRows.length, 8)
    assert.equal(result.debug.stages[1].summary.segmentCount, 1)
    assert.equal(result.debug.stages[4].summary.collisionCount, 1)
    assert.equal(
        result.debug.stages[7].summary.issueCount,
        result.issues.length
    )
})

test('SchematicNetGeometryDiagnostics suggests safe label candidate bounds', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            {
                designator: 'U1',
                x: 4,
                y: 0,
                width: 2,
                height: 2
            }
        ],
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: -3, x2: 10, y2: -3 }],
                labels: [{ text: 'SENSE_A', x: 4, y: 0, width: 4, height: 2 }]
            },
            {
                name: 'RETURN_A',
                segments: [{ x1: 5, y1: -4, x2: 5, y2: 4 }],
                labels: [{ text: 'RETURN_A', x: 5, y: 0, width: 4, height: 2 }]
            }
        ]
    })

    assert.equal(result.summary.labelCandidateCount, 6)
    assert.equal(result.labelCandidateBounds.length, 6)
    assert.deepEqual(
        result.labelCandidateBounds
            .filter((candidate) => candidate.netName === 'SENSE_A')
            .map((candidate) => candidate.kind),
        ['net-label-candidate', 'net-label-candidate', 'net-label-candidate']
    )
    assert.deepEqual(result.labelCandidateBounds[0].bounds, {
        minX: -2.5,
        minY: -1,
        maxX: 1.5,
        maxY: 1,
        width: 4,
        height: 2
    })
})

test('SchematicNetGeometryDiagnostics groups touching label obstacles', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'LABEL_A',
                labels: [{ text: 'LABEL_A', x: 0, y: 0, width: 4, height: 2 }]
            },
            {
                name: 'LABEL_B',
                labels: [{ text: 'LABEL_B', x: 2, y: 0, width: 4, height: 2 }]
            },
            {
                name: 'LABEL_C',
                labels: [{ text: 'LABEL_C', x: 4, y: 0, width: 4, height: 2 }]
            }
        ]
    })

    assert.equal(result.summary.labelObstacleGroupCount, 1)
    assert.equal(result.labelObstacleGroups.length, 1)
    assert.deepEqual(result.labelObstacleGroups[0], {
        id: 'label-obstacle-group:1',
        kind: 'net-label-obstacle-group',
        labelIds: ['LABEL_A:label:0', 'LABEL_B:label:0', 'LABEL_C:label:0'],
        netNames: ['LABEL_A', 'LABEL_B', 'LABEL_C'],
        bounds: {
            minX: -2,
            minY: -1,
            maxX: 6,
            maxY: 1,
            width: 8,
            height: 2
        }
    })
    assert.equal(
        result.labelCandidateBounds[0].debug.sourceLabelGroupId,
        'label-obstacle-group:1'
    )
})

test('SchematicNetGeometryDiagnostics groups labels on the same symbol side', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [{ designator: 'U1', x: 0, y: 0, width: 4, height: 4 }],
        nets: [
            {
                name: 'SIDE_A',
                labels: [{ text: 'SIDE_A', x: 4, y: -1, width: 1, height: 0.5 }]
            },
            {
                name: 'SIDE_B',
                labels: [{ text: 'SIDE_B', x: 4, y: 1, width: 1, height: 0.5 }]
            }
        ]
    })

    assert.equal(result.summary.labelObstacleGroupCount, 1)
    assert.deepEqual(result.labelObstacleGroups[0], {
        id: 'label-obstacle-group:1',
        kind: 'net-label-obstacle-group',
        labelIds: ['SIDE_A:label:0', 'SIDE_B:label:0'],
        netNames: ['SIDE_A', 'SIDE_B'],
        bounds: {
            minX: 3.5,
            minY: -1.25,
            maxX: 4.5,
            maxY: 1.25,
            width: 1,
            height: 2.5
        },
        debug: {
            groupingKind: 'same-symbol-side',
            obstacleId: 'component:U1',
            side: 'right'
        }
    })
})

test('SchematicNetGeometryDiagnostics reports anchor preflight issues', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        sheet: { width: 20, height: 10 },
        components: [
            {
                designator: 'U1',
                x: 5,
                y: 5,
                width: 4,
                height: 4
            }
        ],
        nets: [
            {
                name: 'PIN_A',
                segments: [{ x1: 0, y1: 0, x2: 1, y2: 0 }],
                pins: [
                    { refdes: 'U1', pin: '1', x: 5, y: 5 },
                    { refdes: 'U1', pin: '2', x: 8, y: 5 },
                    { refdes: 'U2', pin: '1', x: 24, y: 12 }
                ]
            }
        ]
    })
    const preflightIssues = result.issues.filter(
        (issue) => issue.type === 'schematic-anchor-preflight'
    )

    assert.equal(result.summary.anchorPreflightIssueCount, 3)
    assert.deepEqual(
        preflightIssues
            .map((issue) => ({
                preflightKind: issue.preflightKind,
                anchorKind: issue.anchorKind
            }))
            .sort((a, b) => a.preflightKind.localeCompare(b.preflightKind)),
        [
            {
                preflightKind: 'anchor-inside-symbol-body',
                anchorKind: 'pin'
            },
            {
                preflightKind: 'anchor-off-symbol-edge',
                anchorKind: 'pin'
            },
            {
                preflightKind: 'anchor-outside-sheet',
                anchorKind: 'pin'
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics suggests jogs for cross-net overlaps', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 4, x2: 10, y2: 4 }]
            },
            {
                name: 'RETURN_A',
                segments: [{ x1: 6, y1: 4, x2: 14, y2: 4 }]
            }
        ]
    })

    assert.equal(result.summary.jogSuggestionCount, 1)
    assert.deepEqual(result.jogSuggestionSegments, [
        {
            kind: 'cross-net-overlap-jog-candidate',
            netName: 'SENSE_A',
            otherNetName: 'RETURN_A',
            axis: 'x',
            points: [
                { x: 0, y: 4 },
                { x: 6, y: 4 },
                { x: 6, y: 3 },
                { x: 10, y: 3 },
                { x: 10, y: 4 }
            ],
            debug: {
                overlapIndex: 0,
                offset: -1,
                endpointPreserving: true,
                preservedEndpoints: [
                    { x: 0, y: 4 },
                    { x: 10, y: 4 }
                ]
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics suggests guideline snapped elbow variants', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        sheet: { width: 20, height: 12 },
        components: [
            { designator: 'U1', x: 0, y: 0, width: 2, height: 2 },
            { designator: 'U2', x: 10, y: 0, width: 2, height: 2 }
        ],
        nets: [
            {
                name: 'BUS_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 4, y: 0 },
                            { x: 4, y: 8 },
                            { x: 10, y: 8 }
                        ]
                    }
                ]
            }
        ]
    })

    assert.equal(result.summary.guidelineSnappedElbowCount, 1)
    assert.deepEqual(result.guidelineSnappedElbowSegments, [
        {
            kind: 'guideline-snapped-elbow-candidate',
            netName: 'BUS_A',
            segmentIndex: 0,
            points: [
                { x: 0, y: 0 },
                { x: 5, y: 0 },
                { x: 5, y: 8 },
                { x: 10, y: 8 }
            ],
            debug: {
                sourceGuidelineIndex: 1,
                movedPartIndex: 1,
                axis: 'x',
                originalCoordinate: 4,
                snappedCoordinate: 5
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics suggests supplemental island connections', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                segments: [
                    { x1: 0, y1: 0, x2: 4, y2: 0 },
                    { x1: 20, y1: 0, x2: 24, y2: 0 }
                ]
            }
        ]
    })

    assert.equal(result.summary.supplementalConnectionCount, 1)
    assert.deepEqual(result.supplementalConnectionSegments, [
        {
            kind: 'supplemental-connection-candidate',
            netName: 'SENSE_A',
            points: [
                { x: 4, y: 0 },
                { x: 20, y: 0 }
            ],
            distance: 16,
            debug: {
                sourceIslandIds: ['SENSE_A:island-1', 'SENSE_A:island-2'],
                reason: 'nearest-disconnected-islands'
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics reports candidate rejection reasons', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        sheet: { x: 0, y: -5, width: 20, height: 10 },
        components: [{ designator: 'U1', x: 5, y: 0, width: 4, height: 4 }],
        nets: [
            {
                name: 'LABEL_A',
                segments: [{ x1: 0, y1: -4, x2: 1, y2: -4 }],
                labels: [
                    { text: 'LABEL_A', x: 5, y: 0, width: 2, height: 2 },
                    { text: 'OUT_A', x: 24, y: 0, width: 2, height: 2 }
                ]
            },
            {
                name: 'LABEL_B',
                segments: [{ x1: 4.5, y1: -4, x2: 4.5, y2: 4 }],
                labels: [{ text: 'LABEL_B', x: 5.5, y: 0, width: 2, height: 2 }]
            }
        ]
    })

    assert.equal(result.summary.candidateRejectionCount, 6)
    assert.deepEqual(
        result.candidateRejections.map((row) => ({
            candidateKind: row.candidateKind,
            labelId: row.labelId,
            reason: row.reason
        })),
        [
            {
                candidateKind: 'net-label-candidate',
                labelId: 'LABEL_A:label:0',
                reason: 'trace-collision'
            },
            {
                candidateKind: 'net-label-candidate',
                labelId: 'LABEL_A:label:0',
                reason: 'label-collision'
            },
            {
                candidateKind: 'net-label-candidate',
                labelId: 'LABEL_B:label:0',
                reason: 'label-collision'
            },
            {
                candidateKind: 'net-label-candidate',
                labelId: 'LABEL_A:label:0',
                reason: 'body-collision'
            },
            {
                candidateKind: 'net-label-candidate',
                labelId: 'LABEL_B:label:0',
                reason: 'body-collision'
            },
            {
                candidateKind: 'net-label-candidate',
                labelId: 'LABEL_A:label:1',
                reason: 'outside-sheet'
            }
        ]
    )
})

test('SchematicNetGeometryDiagnostics suggests trace detours around labels', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                labels: [{ text: 'SENSE_A', x: 5, y: 0, width: 2, height: 2 }]
            },
            {
                name: 'RETURN_A',
                segments: [{ x1: 5, y1: -4, x2: 5, y2: 4 }]
            }
        ]
    })

    assert.equal(result.summary.traceLabelDetourCount, 1)
    assert.deepEqual(result.traceLabelDetourSegments, [
        {
            kind: 'net-label-trace-detour-candidate',
            netName: 'RETURN_A',
            labelNetName: 'SENSE_A',
            labelId: 'SENSE_A:label:0',
            points: [
                { x: 5, y: -4 },
                { x: 3.5, y: -4 },
                { x: 3.5, y: 4 },
                { x: 5, y: 4 }
            ],
            debug: {
                collisionIndex: 0,
                strategy: 'four-point-detour',
                padding: 0.5
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics suggests trace-anchored label candidates', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'SENSE_A',
                segments: [{ x1: 0, y1: 0, x2: 10, y2: 0 }],
                labels: [{ text: 'SENSE_A', x: 5, y: 0, width: 2, height: 1 }]
            },
            {
                name: 'RETURN_A',
                labels: [{ text: 'RETURN_A', x: 5, y: 0, width: 2, height: 1 }]
            }
        ]
    })

    assert.equal(result.summary.traceAnchoredLabelCandidateCount, 3)
    assert.deepEqual(result.traceAnchoredLabelCandidateBounds[0], {
        kind: 'trace-anchored-net-label-candidate',
        netName: 'SENSE_A',
        labelId: 'SENSE_A:label:0',
        labelIndex: 0,
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
            anchor: { x: 0, y: 0 },
            orientation: 'up',
            segmentKey: 'SENSE_A:0:0',
            pathDistance: 0
        }
    })
})

test('SchematicNetGeometryDiagnostics suggests cleaned net paths', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'BUS_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 2, y: 0 },
                            { x: 4, y: 0 },
                            { x: 4, y: 2 },
                            { x: 4, y: 4 }
                        ]
                    }
                ]
            }
        ]
    })

    assert.equal(result.summary.pathCleanupSuggestionCount, 1)
    assert.deepEqual(result.pathCleanupSegments, [
        {
            kind: 'net-path-cleanup-candidate',
            netName: 'BUS_A',
            segmentIndex: 0,
            points: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 4 }
            ],
            debug: {
                originalPointCount: 5,
                cleanedPointCount: 3,
                removedPointCount: 2,
                cleanupKinds: ['colinear-points']
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics emits routing guidelines', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        sheet: { width: 20, height: 10 },
        components: [
            { designator: 'U1', x: 2, y: 5, width: 2, height: 2 },
            { designator: 'U2', x: 12, y: 5, width: 2, height: 2 }
        ],
        nets: []
    })

    assert.equal(result.summary.guidelineCount, 2)
    assert.deepEqual(result.guidelineSegments, [
        {
            kind: 'schematic-routing-guideline',
            orientation: 'horizontal',
            points: [
                { x: 0, y: 5 },
                { x: 20, y: 5 }
            ],
            debug: {
                sourceObstacleIds: ['component:U1', 'component:U2']
            }
        },
        {
            kind: 'schematic-routing-guideline',
            orientation: 'vertical',
            points: [
                { x: 7, y: 0 },
                { x: 7, y: 10 }
            ],
            debug: {
                sourceObstacleIds: ['component:U1', 'component:U2']
            }
        }
    ])
})

test('SchematicNetGeometryDiagnostics exports spatial index metadata', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        components: [
            { designator: 'U1', x: 0, y: 0, width: 2, height: 2 },
            { designator: 'U2', x: 30, y: 30, width: 2, height: 2 }
        ],
        nets: [
            {
                name: 'LABEL_A',
                labels: [{ text: 'LABEL_A', x: 0, y: 0, width: 4, height: 2 }]
            },
            {
                name: 'LABEL_B',
                labels: [{ text: 'LABEL_B', x: 2, y: 0, width: 4, height: 2 }]
            }
        ]
    })

    assert.ok(result.debug.indexes)
    assert.equal(result.debug.indexes.bodyObstacles.indexedItemCount, 2)
    assert.equal(result.debug.indexes.labelObstacleGroups.indexedItemCount, 1)
    assert.ok(result.debug.indexes.bodyObstacles.bucketCount >= 2)
    assert.ok(result.debug.indexes.labelObstacleGroups.bucketCount >= 1)
})

test('SchematicNetGeometryDiagnostics reports suspicious path shapes', () => {
    const result = SchematicNetGeometryDiagnostics.analyze({
        nets: [
            {
                name: 'BUS_A',
                segments: [
                    {
                        points: [
                            { x: 0, y: 0 },
                            { x: 0, y: 0 },
                            { x: 1, y: 0 },
                            { x: 0, y: 0 },
                            { x: 0, y: 0.05 },
                            { x: 1, y: 0.05 },
                            { x: 1, y: 1 },
                            { x: 2, y: 1 },
                            { x: 2, y: 2 }
                        ]
                    }
                ]
            }
        ]
    })

    assert.deepEqual(
        result.issues
            .filter((issue) => issue.type === 'suspicious-net-path-shape')
            .map((issue) => issue.shapeKind)
            .sort(),
        [
            'excessive-turns',
            'immediate-backtrack',
            'tiny-segment-part',
            'zero-length-part'
        ]
    )
    assert.equal(result.summary.pathShapeIssueCount, 4)
})
