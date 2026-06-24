/**
 * Builds compact summary counts for schematic net diagnostics.
 */
export class SchematicNetDiagnosticsSummary {
    /**
     * Builds the public analyzer summary.
     * @param {object} data Diagnostic rows.
     * @returns {object}
     */
    static build(data) {
        return {
            netCount: data.netCount,
            issueCount: data.issues.length,
            fallbackSegmentCount: data.fallbackSegments.length,
            overlapCount: data.overlapSegments.length,
            collisionCount: data.collisionBounds.length,
            obstacleCrossingCount: data.obstacleSegments.length,
            unconnectedAnchorCount: data.anchorMarkers.length,
            anchorPreflightIssueCount: this.#issueCount(
                data.issues,
                'schematic-anchor-preflight'
            ),
            labelCandidateCount: data.labelCandidateBounds.length,
            traceAnchoredLabelCandidateCount:
                data.traceAnchoredLabelCandidateBounds.length,
            traceAnchoredLabelRejectedCandidateCount:
                data.traceAnchoredLabelRejectedCandidateBounds.length,
            orientationLabelCandidateCount:
                data.orientationLabelCandidateBounds.length,
            powerLabelCornerCandidateCount:
                data.powerLabelCornerCandidateBounds.length,
            labelObstacleGroupCount: data.labelObstacleGroups.length,
            jogSuggestionCount: data.jogSuggestionSegments.length,
            traceLabelDetourCount: data.traceLabelDetourSegments.length,
            pathCleanupSuggestionCount: data.pathCleanupSegments.length,
            guidelineCount: data.guidelineSegments.length,
            guidelineSnappedElbowCount:
                data.guidelineSnappedElbowSegments.length,
            restrictedCenterlineCrossingCount:
                data.restrictedCenterlineSegments.length,
            supplementalConnectionCount:
                data.supplementalConnectionSegments.length,
            symbolBodyFitCandidateCount:
                data.symbolBodyFitCandidateBounds.length,
            symbolPinSnapCandidateCount: data.symbolPinSnapSegments.length,
            candidateRejectionCount: data.candidateRejections.length,
            pathShapeIssueCount: this.#issueCount(
                data.issues,
                'suspicious-net-path-shape'
            )
        }
    }

    /**
     * Counts issues of one type.
     * @param {object[]} issues Issue rows.
     * @param {string} type Issue type.
     * @returns {number}
     */
    static #issueCount(issues, type) {
        return issues.filter((issue) => issue.type === type).length
    }
}
