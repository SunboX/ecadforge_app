/**
 * Builds compact stage summaries for schematic net diagnostics.
 */
export class SchematicNetDiagnosticStageSummaries {
    /**
     * Builds deterministic debug stage summaries.
     * @param {object} data Diagnostic working data.
     * @returns {object[]}
     */
    static build(data) {
        const pathShapeIssueCount = this.#issueCount(
            data.issues,
            'suspicious-net-path-shape'
        )
        const preflightIssueCount = this.#issueCount(
            data.issues,
            'schematic-anchor-preflight'
        )
        const issueTypes = [...new Set(data.issues.map((issue) => issue.type))]
        const healthRows = Array.isArray(data.stageHealthRows)
            ? data.stageHealthRows
            : []

        return [
            {
                name: 'input-geometry',
                summary: {
                    netCount: data.netCount,
                    obstacleCount: data.obstacles.length,
                    health: this.#healthForStage(healthRows, 'input-geometry')
                }
            },
            {
                name: 'net-collection',
                summary: {
                    segmentCount: data.orthogonalSegments.length,
                    anchorCount: this.#anchorCount(data.netDebug),
                    labelCount: data.labels.length,
                    fallbackSegmentCount: data.fallbackSegments.length,
                    health: this.#healthForStage(healthRows, 'net-collection')
                }
            },
            {
                name: 'path-quality',
                summary: {
                    pathShapeIssueCount,
                    pathCleanupSuggestionCount: data.pathCleanupSegments.length,
                    congestedLTurnRerouteCount:
                        data.congestedLTurnRerouteSegments.length,
                    health: this.#healthForStage(healthRows, 'path-quality')
                }
            },
            {
                name: 'connectivity',
                summary: {
                    overlapCount: data.overlapSegments.length,
                    obstacleCrossingCount: data.obstacleSegments.length,
                    unconnectedAnchorCount: data.anchorMarkers.length,
                    anchorPreflightIssueCount: preflightIssueCount,
                    jogSuggestionCount: data.jogSuggestionSegments.length,
                    netIslandLaneShiftSegmentCount:
                        data.netIslandLaneShiftSegments.length,
                    segmentOverlapShiftCount:
                        data.segmentOverlapShiftSegments.length,
                    guidelineCount: data.guidelineSegments.length,
                    guidelineSnappedElbowCount:
                        data.guidelineSnappedElbowSegments.length,
                    restrictedCenterlineCrossingCount:
                        data.restrictedCenterlineSegments.length,
                    supplementalConnectionCount:
                        data.supplementalConnectionSegments.length,
                    anchorConnectionRouteCount:
                        data.anchorConnectionRouteSegments.length,
                    longDistanceConnectionCount:
                        data.longDistanceConnectionSegments.length,
                    sectionBoundaryConnectionCount:
                        data.sectionBoundaryConnectionSegments.length,
                    symbolBodyFitCandidateCount:
                        data.symbolBodyFitCandidateBounds.length,
                    symbolPinSnapCandidateCount:
                        data.symbolPinSnapSegments.length,
                    symbolBoundsExpansionCandidateCount:
                        data.symbolBoundsExpansionCandidateBounds.length,
                    symbolAnchorCorrectionCount:
                        data.symbolAnchorCorrectionSegments.length,
                    health: this.#healthForStage(healthRows, 'connectivity')
                }
            },
            {
                name: 'collisions',
                summary: {
                    collisionCount: data.collisionBounds.length,
                    labelCandidateCount: data.labelCandidateBounds.length,
                    traceAnchoredLabelCandidateCount:
                        data.traceAnchoredLabelCandidateBounds.length,
                    traceAnchoredLabelRejectedCandidateCount:
                        data.traceAnchoredLabelRejectedCandidateBounds.length,
                    orientationLabelCandidateCount:
                        data.orientationLabelCandidateBounds.length,
                    powerLabelCornerCandidateCount:
                        data.powerLabelCornerCandidateBounds.length,
                    traceLabelDetourCount: data.traceLabelDetourSegments.length,
                    traceLabelSnipReconnectCount:
                        data.traceLabelSnipReconnectSegments.length,
                    traceLabelResolutionCandidateCount:
                        data.traceLabelResolutionCandidateBounds.length,
                    traceLabelResolutionTraceCount:
                        data.traceLabelResolutionSegments.length,
                    multiLabelTraceDetourCount:
                        data.multiLabelTraceDetourSegments.length,
                    labelRelocationCandidateCount:
                        data.labelRelocationCandidateBounds.length,
                    labelObstacleGroupCount: data.labelObstacleGroups.length,
                    candidateRejectionCount: data.candidateRejections.length,
                    health: this.#healthForStage(healthRows, 'collisions')
                }
            },
            {
                name: 'candidate-budgets',
                summary: {
                    ...data.candidateBudgets,
                    health: this.#healthForStage(
                        healthRows,
                        'candidate-budgets'
                    )
                }
            },
            {
                name: 'candidate-decisions',
                summary: {
                    candidateDecisionCount: data.candidateDecisionRows.length,
                    health: this.#healthForStage(
                        healthRows,
                        'candidate-decisions'
                    )
                }
            },
            {
                name: 'final-issues',
                summary: {
                    issueCount: data.issues.length,
                    issueTypes,
                    health: this.#healthForStage(healthRows, 'final-issues')
                }
            }
        ]
    }

    /**
     * Counts issues of a specific type.
     * @param {object[]} issues Issue rows.
     * @param {string} type Issue type.
     * @returns {number}
     */
    static #issueCount(issues, type) {
        return issues.filter((issue) => issue.type === type).length
    }

    /**
     * Counts anchors from per-net debug rows.
     * @param {object[]} netDebug Per-net debug rows.
     * @returns {number}
     */
    static #anchorCount(netDebug) {
        return netDebug.reduce(
            (count, net) =>
                count + (Array.isArray(net?.anchors) ? net.anchors.length : 0),
            0
        )
    }

    /**
     * Resolves compact health values for one stage.
     * @param {object[]} healthRows Stage health rows.
     * @param {string} stageName Stage name.
     * @returns {object}
     */
    static #healthForStage(healthRows, stageName) {
        const row = healthRows.find((entry) => entry.stageName === stageName)
        return {
            generated: row?.generated || 0,
            accepted: row?.accepted || 0,
            rejected: row?.rejected || 0,
            issueCount: row?.issueCount || 0,
            topRejectionReasons: Array.isArray(row?.topRejectionReasons)
                ? row.topRejectionReasons
                : []
        }
    }
}
