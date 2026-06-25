import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicCandidateDecisionTimeline } from './SchematicCandidateDecisionTimeline.mjs'
import { SchematicCandidateRejectionAdvisor } from './SchematicCandidateRejectionAdvisor.mjs'
import { SchematicCongestedLTurnAdvisor } from './SchematicCongestedLTurnAdvisor.mjs'
import { SchematicGuidelineElbowVariantAdvisor } from './SchematicGuidelineElbowVariantAdvisor.mjs'
import { SchematicGuidelineDiagnosticAdvisor } from './SchematicGuidelineDiagnosticAdvisor.mjs'
import { SchematicLabelRelocationAdvisor } from './SchematicLabelRelocationAdvisor.mjs'
import { SchematicLabelOrientationAdvisor } from './SchematicLabelOrientationAdvisor.mjs'
import { SchematicLongDistanceConnectionAdvisor } from './SchematicLongDistanceConnectionAdvisor.mjs'
import { SchematicMultiLabelDetourAdvisor } from './SchematicMultiLabelDetourAdvisor.mjs'
import { SchematicNetIslandLaneShiftAdvisor } from './SchematicNetIslandLaneShiftAdvisor.mjs'
import { SchematicNetJogSuggestionAdvisor } from './SchematicNetJogSuggestionAdvisor.mjs'
import { SchematicNetLabelCandidateAdvisor } from './SchematicNetLabelCandidateAdvisor.mjs'
import { SchematicNetPathCleanupAdvisor } from './SchematicNetPathCleanupAdvisor.mjs'
import { SchematicPowerLabelCornerAdvisor } from './SchematicPowerLabelCornerAdvisor.mjs'
import { SchematicRestrictedCenterlineAdvisor } from './SchematicRestrictedCenterlineAdvisor.mjs'
import { SchematicSectionBoundaryAdvisor } from './SchematicSectionBoundaryAdvisor.mjs'
import { SchematicSegmentOverlapShiftAdvisor } from './SchematicSegmentOverlapShiftAdvisor.mjs'
import { SchematicSymbolFitAdvisor } from './SchematicSymbolFitAdvisor.mjs'
import { SchematicSupplementalConnectionAdvisor } from './SchematicSupplementalConnectionAdvisor.mjs'
import { SchematicTraceAnchoredLabelCandidateAdvisor } from './SchematicTraceAnchoredLabelCandidateAdvisor.mjs'
import { SchematicTraceLabelDetourAdvisor } from './SchematicTraceLabelDetourAdvisor.mjs'
import { SchematicTraceLabelResolutionAdvisor } from './SchematicTraceLabelResolutionAdvisor.mjs'

/**
 * Runs diagnostics that need full schematic net geometry context.
 */
export class SchematicNetDiagnosticPostProcessor {
    /**
     * Builds derived diagnostic rows and index metadata.
     * @param {{ labels: object[], orthogonalSegments: object[], fallbackSegments: object[], obstacles: object[], collisionBounds: object[], overlapSegments: object[], netDebug: object[], sheet?: object }} data Diagnostic data.
     * @returns {object} Derived diagnostic rows and index metadata.
     */
    static analyze(data) {
        const bodyObstacleIndex = new SchematicBoundsSpatialIndex(
            data.obstacles
        )
        const labelObstacleGroups =
            SchematicNetLabelCandidateAdvisor.buildLabelObstacleGroups(
                data.labels,
                data.obstacles
            )
        const labelObstacleGroupIndex = new SchematicBoundsSpatialIndex(
            labelObstacleGroups
        )
        const labelCandidateBounds = SchematicNetLabelCandidateAdvisor.suggest(
            data.labels,
            data.orthogonalSegments,
            data.obstacles,
            data.collisionBounds,
            {
                bodyObstacleIndex,
                labelObstacleGroups,
                labelObstacleGroupIndex
            }
        )
        const traceAnchored =
            SchematicTraceAnchoredLabelCandidateAdvisor.analyze(
                data.labels,
                data.orthogonalSegments,
                data.obstacles,
                data.collisionBounds
            )
        const orientationLabels = SchematicLabelOrientationAdvisor.suggest(
            data.labels,
            data.orthogonalSegments,
            data.obstacles
        )
        const powerLabelCorners = SchematicPowerLabelCornerAdvisor.suggest(
            data.labels,
            data.orthogonalSegments,
            data.obstacles
        )
        const jogSuggestionSegments = SchematicNetJogSuggestionAdvisor.suggest(
            data.overlapSegments,
            data.orthogonalSegments,
            data.obstacles,
            data.labels,
            { bodyObstacleIndex }
        )
        const netIslandLaneShift = SchematicNetIslandLaneShiftAdvisor.analyze(
            data.overlapSegments,
            data.orthogonalSegments,
            data.obstacles,
            data.labels
        )
        const segmentOverlapShift = SchematicSegmentOverlapShiftAdvisor.analyze(
            data.overlapSegments,
            data.orthogonalSegments,
            data.obstacles,
            data.labels
        )
        const traceLabelDetourSegments =
            SchematicTraceLabelDetourAdvisor.suggest(
                data.collisionBounds,
                data.labels,
                data.orthogonalSegments
            )
        const traceLabelSnipReconnectSegments =
            SchematicTraceLabelDetourAdvisor.suggestSnipReconnect(
                data.collisionBounds,
                data.labels,
                data.orthogonalSegments
            )
        const traceLabelResolution =
            SchematicTraceLabelResolutionAdvisor.analyze({
                collisionBounds: data.collisionBounds,
                labels: data.labels,
                traceAnchoredLabelCandidateBounds:
                    traceAnchored.traceAnchoredLabelCandidateBounds,
                traceAnchoredLabelRejectedCandidateBounds:
                    traceAnchored.traceAnchoredLabelRejectedCandidateBounds,
                traceLabelDetourSegments,
                traceLabelSnipReconnectSegments
            })
        const multiLabelDetour = SchematicMultiLabelDetourAdvisor.analyze(
            data.collisionBounds,
            data.labels,
            data.orthogonalSegments
        )
        const labelRelocation = SchematicLabelRelocationAdvisor.analyze(
            data.collisionBounds,
            data.labels,
            data.orthogonalSegments,
            data.obstacles
        )
        const pathCleanupSegments = SchematicNetPathCleanupAdvisor.suggest(
            data.orthogonalSegments,
            data.obstacles,
            data.labels
        )
        const congestedLTurn = SchematicCongestedLTurnAdvisor.analyze(
            data.overlapSegments,
            data.orthogonalSegments,
            data.obstacles
        )
        const guidelineSegments = SchematicGuidelineDiagnosticAdvisor.suggest(
            data.obstacles,
            data.sheet
        )
        const guidelineSnappedElbowSegments =
            SchematicGuidelineElbowVariantAdvisor.suggest(
                data.orthogonalSegments,
                guidelineSegments
            )
        const restrictedCenterline =
            SchematicRestrictedCenterlineAdvisor.analyze({
                orthogonalSegments: data.orthogonalSegments,
                fallbackSegments: data.fallbackSegments,
                obstacles: data.obstacles
            })
        const supplementalConnection =
            SchematicSupplementalConnectionAdvisor.analyze(data.netDebug, {
                obstacles: data.obstacles
            })
        const supplementalConnectionSegments =
            supplementalConnection.supplementalConnectionSegments
        const longDistanceConnection =
            SchematicLongDistanceConnectionAdvisor.analyze({
                fallbackSegments: data.fallbackSegments,
                supplementalConnectionSegments
            })
        const sectionBoundary = SchematicSectionBoundaryAdvisor.analyze({
            fallbackSegments: data.fallbackSegments,
            supplementalConnectionSegments,
            netDebug: data.netDebug
        })
        const symbolFit = SchematicSymbolFitAdvisor.suggest(
            data.netDebug,
            data.obstacles
        )
        const candidateRejections = SchematicCandidateRejectionAdvisor.suggest({
            collisionBounds: data.collisionBounds,
            labels: data.labels,
            restrictedCenterlineSegments:
                restrictedCenterline.restrictedCenterlineSegments,
            sheet: data.sheet
        })
        const candidateBudgets = this.#candidateBudgets({
            labelCandidateBounds,
            traceAnchored,
            orientationLabels,
            powerLabelCorners,
            labelObstacleGroups,
            jogSuggestionSegments,
            netIslandLaneShift,
            segmentOverlapShift,
            traceLabelDetourSegments,
            traceLabelSnipReconnectSegments,
            multiLabelDetour,
            labelRelocation,
            pathCleanupSegments,
            congestedLTurn,
            guidelineSegments,
            guidelineSnappedElbowSegments,
            restrictedCenterline,
            supplementalConnectionSegments,
            anchorConnectionRouteSegments:
                supplementalConnection.anchorConnectionRouteSegments,
            supplementalConnection,
            longDistanceConnection,
            sectionBoundary,
            symbolFit,
            traceLabelResolution,
            candidateRejections
        })
        const candidateDecisionRows = SchematicCandidateDecisionTimeline.build({
            multiLabelTraceDetourSegments:
                multiLabelDetour.multiLabelTraceDetourSegments,
            netIslandLaneShiftSegments:
                netIslandLaneShift.netIslandLaneShiftSegments,
            netIslandLaneShiftCandidateDecisions:
                netIslandLaneShift.candidateDecisions,
            segmentOverlapShiftSegments:
                segmentOverlapShift.segmentOverlapShiftSegments,
            labelRelocationCandidateBounds:
                labelRelocation.labelRelocationCandidateBounds,
            labelRelocationCandidateDecisions:
                labelRelocation.candidateDecisions,
            orientationLabelCandidateBounds:
                orientationLabels.orientationLabelCandidateBounds,
            orientationLabelCandidateDecisions:
                orientationLabels.candidateDecisions,
            congestedLTurnRerouteSegments:
                congestedLTurn.congestedLTurnRerouteSegments,
            congestedLTurnRerouteCandidateDecisions:
                congestedLTurn.candidateDecisions,
            longDistanceConnectionSegments:
                longDistanceConnection.longDistanceConnectionSegments,
            sectionBoundaryConnectionSegments:
                sectionBoundary.sectionBoundaryConnectionSegments,
            supplementalConnectionSegments,
            supplementalConnectionCandidateDecisions:
                supplementalConnection.candidateDecisions,
            anchorConnectionRouteSegments:
                supplementalConnection.anchorConnectionRouteSegments,
            anchorConnectionRouteCandidateDecisions:
                supplementalConnection.anchorConnectionRouteCandidateDecisions,
            traceLabelSnipReconnectSegments,
            symbolFitCandidateDecisions: symbolFit.candidateDecisions,
            symbolNormalizationCandidateDecisions:
                symbolFit.normalizationCandidateDecisions,
            traceLabelResolutionCandidateBounds:
                traceLabelResolution.traceLabelResolutionCandidateBounds,
            traceLabelResolutionSegments:
                traceLabelResolution.traceLabelResolutionSegments,
            traceLabelResolutionCandidateDecisions:
                traceLabelResolution.candidateDecisions,
            traceAnchoredLabelRejectedCandidateBounds:
                traceAnchored.traceAnchoredLabelRejectedCandidateBounds
        })
        candidateBudgets.candidateDecisions = this.#decisionBudget(
            candidateDecisionRows
        )

        return {
            labelCandidateBounds,
            traceAnchoredLabelCandidateBounds:
                traceAnchored.traceAnchoredLabelCandidateBounds,
            traceAnchoredLabelRejectedCandidateBounds:
                traceAnchored.traceAnchoredLabelRejectedCandidateBounds,
            orientationLabelCandidateBounds:
                orientationLabels.orientationLabelCandidateBounds,
            orientationConnectorSegments:
                orientationLabels.orientationConnectorSegments,
            powerLabelCornerCandidateBounds:
                powerLabelCorners.powerLabelCornerCandidateBounds,
            labelObstacleGroups,
            jogSuggestionSegments,
            netIslandLaneShiftSegments:
                netIslandLaneShift.netIslandLaneShiftSegments,
            segmentOverlapShiftSegments:
                segmentOverlapShift.segmentOverlapShiftSegments,
            traceLabelDetourSegments,
            traceLabelSnipReconnectSegments,
            multiLabelTraceDetourSegments:
                multiLabelDetour.multiLabelTraceDetourSegments,
            labelRelocationCandidateBounds:
                labelRelocation.labelRelocationCandidateBounds,
            pathCleanupSegments,
            congestedLTurnRerouteSegments:
                congestedLTurn.congestedLTurnRerouteSegments,
            guidelineSegments,
            guidelineSnappedElbowSegments,
            restrictedCenterlineSegments:
                restrictedCenterline.restrictedCenterlineSegments,
            supplementalConnectionSegments,
            anchorConnectionRouteSegments:
                supplementalConnection.anchorConnectionRouteSegments,
            longDistanceConnectionSegments:
                longDistanceConnection.longDistanceConnectionSegments,
            sectionBoundaryConnectionSegments:
                sectionBoundary.sectionBoundaryConnectionSegments,
            symbolBodyFitCandidateBounds:
                symbolFit.symbolBodyFitCandidateBounds,
            symbolPinSnapSegments: symbolFit.symbolPinSnapSegments,
            symbolBoundsExpansionCandidateBounds:
                symbolFit.symbolBoundsExpansionCandidateBounds,
            symbolAnchorCorrectionSegments:
                symbolFit.symbolAnchorCorrectionSegments,
            traceLabelResolutionCandidateBounds:
                traceLabelResolution.traceLabelResolutionCandidateBounds,
            traceLabelResolutionSegments:
                traceLabelResolution.traceLabelResolutionSegments,
            candidateRejections,
            candidateDecisionRows,
            candidateBudgets,
            issues: [...restrictedCenterline.issues, ...sectionBoundary.issues],
            indexes: {
                bodyObstacles: bodyObstacleIndex.stats,
                labelObstacleGroups: labelObstacleGroupIndex.stats
            }
        }
    }

    /**
     * Builds per-advisor candidate budget summaries.
     * @param {object} rows Derived advisor rows.
     * @returns {object}
     */
    static #candidateBudgets(rows) {
        const budgets = {
            labelCandidates: this.#acceptedOnly(rows.labelCandidateBounds),
            traceAnchoredLabelCandidates: rows.traceAnchored.budget,
            orientationLabelCandidates: rows.orientationLabels.budget,
            powerLabelCornerCandidates: rows.powerLabelCorners.budget,
            labelObstacleGroups: this.#acceptedOnly(rows.labelObstacleGroups),
            jogSuggestions: this.#acceptedOnly(rows.jogSuggestionSegments),
            netIslandLaneShifts: rows.netIslandLaneShift.budget,
            segmentOverlapShifts: rows.segmentOverlapShift.budget,
            traceLabelDetours: this.#acceptedOnly(
                rows.traceLabelDetourSegments
            ),
            traceLabelSnipReconnects: this.#acceptedOnly(
                rows.traceLabelSnipReconnectSegments
            ),
            multiLabelTraceDetours: rows.multiLabelDetour.budget,
            labelRelocations: rows.labelRelocation.budget,
            pathCleanupCandidates: this.#acceptedOnly(rows.pathCleanupSegments),
            congestedLTurnReroutes: rows.congestedLTurn.budget,
            guidelines: this.#acceptedOnly(rows.guidelineSegments),
            guidelineSnappedElbows: this.#acceptedOnly(
                rows.guidelineSnappedElbowSegments
            ),
            restrictedCenterlines: {
                generated:
                    rows.restrictedCenterline.restrictedCenterlineSegments
                        .length,
                accepted:
                    rows.restrictedCenterline.restrictedCenterlineSegments
                        .length,
                rejected: 0
            },
            supplementalConnections: rows.supplementalConnection.budget,
            anchorConnectionRoutes:
                rows.supplementalConnection.routeBudget,
            longDistanceConnections: rows.longDistanceConnection.budget,
            sectionBoundaryConnections: rows.sectionBoundary.budget,
            symbolFitCandidates: rows.symbolFit.budget,
            symbolNormalizationCandidates:
                rows.symbolFit.normalizationBudget,
            traceLabelResolutions: rows.traceLabelResolution.budget,
            candidateRejections: this.#acceptedOnly(rows.candidateRejections)
        }
        return Object.fromEntries(
            Object.entries(budgets).map(([name, budget]) => [
                name,
                this.#withFinalAcceptance(budget)
            ])
        )
    }

    /**
     * Builds a generated-equals-accepted budget.
     * @param {object[]} rows Accepted rows.
     * @returns {{ generated: number, accepted: number, rejected: number }}
     */
    static #acceptedOnly(rows) {
        const count = Array.isArray(rows) ? rows.length : 0
        return this.#withFinalAcceptance({
            generated: count,
            accepted: count,
            rejected: 0
        })
    }

    /**
     * Builds candidate decision budget counts from decision rows.
     * @param {object[]} rows Candidate decision rows.
     * @returns {{ generated: number, accepted: number, rejected: number }}
     */
    static #decisionBudget(rows) {
        const decisions = Array.isArray(rows) ? rows : []
        return this.#withFinalAcceptance({
            generated: decisions.length,
            accepted: decisions.filter((row) => row.status === 'accepted')
                .length,
            rejected: decisions.filter((row) => row.status === 'rejected')
                .length
        })
    }

    /**
     * Adds final candidate status metadata to one budget row.
     * @param {object} budget Candidate budget counts.
     * @returns {object}
     */
    static #withFinalAcceptance(budget) {
        const generated = Number(budget?.generated || 0)
        const accepted = Number(budget?.accepted || 0)
        const rejected = Number(budget?.rejected || 0)
        const finalStatus = this.#finalStatus({
            generated,
            accepted,
            rejected
        })
        return {
            ...budget,
            generated,
            accepted,
            rejected,
            finalStatus,
            finalAcceptanceReason:
                finalStatus === 'partial-accepted'
                    ? 'accepted-after-rejections'
                    : finalStatus === 'exhausted'
                      ? 'all-candidates-rejected'
                      : ''
        }
    }

    /**
     * Resolves the final status for one advisor budget.
     * @param {{ generated: number, accepted: number, rejected: number }} budget Candidate budget counts.
     * @returns {string}
     */
    static #finalStatus(budget) {
        if (!budget.generated) return 'empty'
        if (budget.accepted > 0 && budget.rejected > 0) {
            return 'partial-accepted'
        }
        if (budget.accepted > 0) return 'accepted'
        return 'exhausted'
    }
}
