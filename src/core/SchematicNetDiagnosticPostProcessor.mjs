import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicCandidateRejectionAdvisor } from './SchematicCandidateRejectionAdvisor.mjs'
import { SchematicGuidelineElbowVariantAdvisor } from './SchematicGuidelineElbowVariantAdvisor.mjs'
import { SchematicGuidelineDiagnosticAdvisor } from './SchematicGuidelineDiagnosticAdvisor.mjs'
import { SchematicLabelOrientationAdvisor } from './SchematicLabelOrientationAdvisor.mjs'
import { SchematicNetJogSuggestionAdvisor } from './SchematicNetJogSuggestionAdvisor.mjs'
import { SchematicNetLabelCandidateAdvisor } from './SchematicNetLabelCandidateAdvisor.mjs'
import { SchematicNetPathCleanupAdvisor } from './SchematicNetPathCleanupAdvisor.mjs'
import { SchematicPowerLabelCornerAdvisor } from './SchematicPowerLabelCornerAdvisor.mjs'
import { SchematicRestrictedCenterlineAdvisor } from './SchematicRestrictedCenterlineAdvisor.mjs'
import { SchematicSymbolFitAdvisor } from './SchematicSymbolFitAdvisor.mjs'
import { SchematicSupplementalConnectionAdvisor } from './SchematicSupplementalConnectionAdvisor.mjs'
import { SchematicTraceAnchoredLabelCandidateAdvisor } from './SchematicTraceAnchoredLabelCandidateAdvisor.mjs'
import { SchematicTraceLabelDetourAdvisor } from './SchematicTraceLabelDetourAdvisor.mjs'

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
        const traceLabelDetourSegments =
            SchematicTraceLabelDetourAdvisor.suggest(
                data.collisionBounds,
                data.labels,
                data.orthogonalSegments
            )
        const pathCleanupSegments = SchematicNetPathCleanupAdvisor.suggest(
            data.orthogonalSegments,
            data.obstacles,
            data.labels
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
        const supplementalConnectionSegments =
            SchematicSupplementalConnectionAdvisor.suggest(data.netDebug)
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
            traceLabelDetourSegments,
            pathCleanupSegments,
            guidelineSegments,
            guidelineSnappedElbowSegments,
            restrictedCenterline,
            supplementalConnectionSegments,
            symbolFit,
            candidateRejections
        })

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
            traceLabelDetourSegments,
            pathCleanupSegments,
            guidelineSegments,
            guidelineSnappedElbowSegments,
            restrictedCenterlineSegments:
                restrictedCenterline.restrictedCenterlineSegments,
            supplementalConnectionSegments,
            symbolBodyFitCandidateBounds:
                symbolFit.symbolBodyFitCandidateBounds,
            symbolPinSnapSegments: symbolFit.symbolPinSnapSegments,
            candidateRejections,
            candidateBudgets,
            issues: restrictedCenterline.issues,
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
        return {
            labelCandidates: this.#acceptedOnly(rows.labelCandidateBounds),
            traceAnchoredLabelCandidates: rows.traceAnchored.budget,
            orientationLabelCandidates: rows.orientationLabels.budget,
            powerLabelCornerCandidates: rows.powerLabelCorners.budget,
            labelObstacleGroups: this.#acceptedOnly(rows.labelObstacleGroups),
            jogSuggestions: this.#acceptedOnly(rows.jogSuggestionSegments),
            traceLabelDetours: this.#acceptedOnly(
                rows.traceLabelDetourSegments
            ),
            pathCleanupCandidates: this.#acceptedOnly(rows.pathCleanupSegments),
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
            supplementalConnections: this.#acceptedOnly(
                rows.supplementalConnectionSegments
            ),
            symbolFitCandidates: rows.symbolFit.budget,
            candidateRejections: this.#acceptedOnly(rows.candidateRejections)
        }
    }

    /**
     * Builds a generated-equals-accepted budget.
     * @param {object[]} rows Accepted rows.
     * @returns {{ generated: number, accepted: number, rejected: number }}
     */
    static #acceptedOnly(rows) {
        const count = Array.isArray(rows) ? rows.length : 0
        return { generated: count, accepted: count, rejected: 0 }
    }
}
