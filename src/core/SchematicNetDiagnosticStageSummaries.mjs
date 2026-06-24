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

        return [
            {
                name: 'input-geometry',
                summary: {
                    netCount: data.netCount,
                    obstacleCount: data.obstacles.length
                }
            },
            {
                name: 'net-collection',
                summary: {
                    segmentCount: data.orthogonalSegments.length,
                    anchorCount: this.#anchorCount(data.netDebug),
                    labelCount: data.labels.length,
                    fallbackSegmentCount: data.fallbackSegments.length
                }
            },
            {
                name: 'path-quality',
                summary: {
                    pathShapeIssueCount,
                    pathCleanupSuggestionCount: data.pathCleanupSegments.length
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
                    guidelineCount: data.guidelineSegments.length,
                    guidelineSnappedElbowCount:
                        data.guidelineSnappedElbowSegments.length,
                    restrictedCenterlineCrossingCount:
                        data.restrictedCenterlineSegments.length,
                    supplementalConnectionCount:
                        data.supplementalConnectionSegments.length,
                    symbolBodyFitCandidateCount:
                        data.symbolBodyFitCandidateBounds.length,
                    symbolPinSnapCandidateCount:
                        data.symbolPinSnapSegments.length
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
                    labelObstacleGroupCount: data.labelObstacleGroups.length,
                    candidateRejectionCount: data.candidateRejections.length
                }
            },
            {
                name: 'candidate-budgets',
                summary: data.candidateBudgets
            },
            {
                name: 'final-issues',
                summary: {
                    issueCount: data.issues.length,
                    issueTypes
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
}
