/**
 * Builds compact health rows for diagnostic pipeline stages.
 */
export class SchematicDiagnosticStageHealth {
    /**
     * Builds stage health rows from analyzer output.
     * @param {object} data Diagnostic rows.
     * @returns {object[]}
     */
    static build(data) {
        const rows = [
            this.#row('input-geometry', {
                generated: data.netCount + data.obstacles.length,
                accepted: data.netCount + data.obstacles.length,
                rejected: 0,
                issueCount: 0,
                topRejectionReasons: []
            }),
            this.#row('net-collection', {
                generated:
                    data.orthogonalSegments.length +
                    data.fallbackSegments.length +
                    data.labels.length,
                accepted:
                    data.orthogonalSegments.length +
                    data.fallbackSegments.length +
                    data.labels.length,
                rejected: 0,
                issueCount: this.#issueCount(data.issues, [
                    'invalid-net-segment',
                    'ambiguous-net-segment',
                    'non-orthogonal-net-segment'
                ]),
                topRejectionReasons: []
            }),
            this.#row('path-quality', {
                generated: data.pathCleanupSegments.length,
                accepted: data.pathCleanupSegments.length,
                rejected: 0,
                issueCount: this.#issueCount(data.issues, [
                    'suspicious-net-path-shape'
                ]),
                topRejectionReasons: []
            }),
            this.#row('connectivity', {
                generated:
                    data.overlapSegments.length +
                    data.obstacleSegments.length +
                    data.anchorMarkers.length,
                accepted:
                    data.jogSuggestionSegments.length +
                    data.netIslandLaneShiftSegments.length +
                    data.segmentOverlapShiftSegments.length +
                    data.supplementalConnectionSegments.length +
                    data.anchorConnectionRouteSegments.length +
                    data.symbolBoundsExpansionCandidateBounds.length +
                    data.symbolAnchorCorrectionSegments.length,
                rejected: 0,
                issueCount: this.#issueCount(data.issues, [
                    'cross-net-segment-overlap',
                    'fallback-segment-crosses-obstacle',
                    'unconnected-net-anchor',
                    'schematic-anchor-preflight',
                    'disconnected-net-islands'
                ]),
                topRejectionReasons: []
            }),
            this.#row('collisions', {
                generated: data.collisionBounds.length,
                accepted:
                    data.labelCandidateBounds.length +
                    data.labelRelocationCandidateBounds.length +
                    data.traceAnchoredLabelCandidateBounds.length +
                    data.traceLabelResolutionCandidateBounds.length +
                    data.traceLabelResolutionSegments.length,
                rejected: data.traceAnchoredLabelRejectedCandidateBounds.length,
                issueCount: this.#issueCount(data.issues, [
                    'net-label-trace-overlap',
                    'net-label-net-label-overlap',
                    'net-label-symbol-overlap'
                ]),
                topRejectionReasons: this.#topRejectionReasons(
                    data.traceAnchoredLabelRejectedCandidateBounds
                )
            }),
            this.#budgetHealth('candidate-budgets', data.candidateBudgets),
            this.#candidateDecisionHealth(data.candidateDecisionRows),
            this.#row('final-issues', {
                generated: data.issues.length,
                accepted: data.issues.length,
                rejected: 0,
                issueCount: data.issues.length,
                topRejectionReasons: []
            })
        ]
        return rows.map((row, phaseIndex) =>
            this.#withStageMetadata(row, phaseIndex, data)
        )
    }

    /**
     * Builds one serializable health row.
     * @param {string} stageName Stage name.
     * @param {object} data Health values.
     * @returns {object}
     */
    static #row(stageName, data) {
        return {
            kind: 'diagnostic-stage-health',
            stageName,
            generated: data.generated,
            accepted: data.accepted,
            rejected: data.rejected,
            issueCount: data.issueCount,
            topRejectionReasons: data.topRejectionReasons
        }
    }

    /**
     * Adds stable status and snapshot metadata to one health row.
     * @param {object} row Base health row.
     * @param {number} phaseIndex Stage index.
     * @param {object} data Diagnostic rows.
     * @returns {object}
     */
    static #withStageMetadata(row, phaseIndex, data) {
        const status = this.#statusForRow(row)
        const snapshot = this.#snapshotForRow(row, phaseIndex, status, data)
        return {
            ...row,
            phaseIndex,
            status,
            snapshot
        }
    }

    /**
     * Resolves a compact stage status.
     * @param {object} row Health row.
     * @returns {string}
     */
    static #statusForRow(row) {
        return row.rejected > 0 || row.issueCount > 0 ? 'attention' : 'clean'
    }

    /**
     * Builds a compact serializable stage snapshot.
     * @param {object} row Health row.
     * @param {number} phaseIndex Stage index.
     * @param {string} status Stage status.
     * @param {object} data Diagnostic rows.
     * @returns {object}
     */
    static #snapshotForRow(row, phaseIndex, status, data) {
        const snapshot = {
            version: 1,
            stageName: row.stageName,
            phaseIndex,
            status,
            rowCounts: {
                generated: row.generated,
                accepted: row.accepted,
                rejected: row.rejected,
                issueCount: row.issueCount
            },
            topRejectionReasons: row.topRejectionReasons
        }
        if (row.stageName === 'candidate-decisions') {
            snapshot.candidateDecisionCounts = this.#candidateDecisionCounts(
                data.candidateDecisionRows
            )
        }
        if (row.stageName === 'candidate-budgets') {
            snapshot.candidateCountsByAdvisor = this.#candidateCountsByAdvisor(
                data.candidateBudgets
            )
            snapshot.finalAcceptanceByAdvisor = this.#finalAcceptanceByAdvisor(
                data.candidateBudgets
            )
            snapshot.finalAcceptanceCounts = this.#finalAcceptanceCounts(
                data.candidateBudgets
            )
        }
        const issueTypes = this.#issueTypesForStage(data.issues, row.stageName)
        if (issueTypes.length) snapshot.issueTypes = issueTypes
        return snapshot
    }

    /**
     * Builds accepted/rejected decision counts.
     * @param {object[]} rows Candidate decision rows.
     * @returns {{ accepted: number, rejected: number }}
     */
    static #candidateDecisionCounts(rows) {
        const decisions = Array.isArray(rows) ? rows : []
        return {
            accepted: decisions.filter((row) => row.status === 'accepted')
                .length,
            rejected: decisions.filter((row) => row.status === 'rejected')
                .length
        }
    }

    /**
     * Builds per-advisor candidate budget counts.
     * @param {object} budgets Candidate budgets.
     * @returns {object}
     */
    static #candidateCountsByAdvisor(budgets) {
        return Object.fromEntries(
            Object.entries(budgets || {}).map(([name, budget]) => [
                name,
                {
                    generated: Number(budget?.generated || 0),
                    accepted: Number(budget?.accepted || 0),
                    rejected: Number(budget?.rejected || 0)
                }
            ])
        )
    }

    /**
     * Builds final acceptance metadata by advisor.
     * @param {object} budgets Candidate budgets.
     * @returns {object}
     */
    static #finalAcceptanceByAdvisor(budgets) {
        return Object.fromEntries(
            Object.entries(budgets || {}).map(([name, budget]) => [
                name,
                {
                    finalStatus: budget?.finalStatus || 'empty',
                    finalAcceptanceReason: budget?.finalAcceptanceReason || ''
                }
            ])
        )
    }

    /**
     * Counts final acceptance statuses across advisor budgets.
     * @param {object} budgets Candidate budgets.
     * @returns {object}
     */
    static #finalAcceptanceCounts(budgets) {
        const counts = {
            accepted: 0,
            empty: 0,
            exhausted: 0,
            'partial-accepted': 0
        }
        for (const budget of Object.values(budgets || {})) {
            const status = budget?.finalStatus || 'empty'
            counts[status] = (counts[status] || 0) + 1
        }
        return counts
    }

    /**
     * Returns issue types relevant to one stage.
     * @param {object[]} issues Issue rows.
     * @param {string} stageName Stage name.
     * @returns {string[]}
     */
    static #issueTypesForStage(issues, stageName) {
        const stageTypes = {
            'net-collection': [
                'invalid-net-segment',
                'ambiguous-net-segment',
                'non-orthogonal-net-segment'
            ],
            'path-quality': ['suspicious-net-path-shape'],
            connectivity: [
                'cross-net-segment-overlap',
                'fallback-segment-crosses-obstacle',
                'unconnected-net-anchor',
                'schematic-anchor-preflight',
                'disconnected-net-islands'
            ],
            collisions: [
                'net-label-trace-overlap',
                'net-label-net-label-overlap',
                'net-label-symbol-overlap'
            ]
        }[stageName]
        if (!stageTypes && stageName !== 'final-issues') return []
        const targets =
            stageName === 'final-issues' ? null : new Set(stageTypes || [])
        return [
            ...new Set(
                (Array.isArray(issues) ? issues : [])
                    .filter((issue) => !targets || targets.has(issue.type))
                    .map((issue) => issue.type)
            )
        ].sort()
    }

    /**
     * Builds health for the candidate budget stage.
     * @param {string} stageName Stage name.
     * @param {object} budgets Candidate budgets by advisor.
     * @returns {object}
     */
    static #budgetHealth(stageName, budgets) {
        const values = Object.values(budgets || {})
        return this.#row(stageName, {
            generated: values.reduce(
                (count, budget) => count + Number(budget?.generated || 0),
                0
            ),
            accepted: values.reduce(
                (count, budget) => count + Number(budget?.accepted || 0),
                0
            ),
            rejected: values.reduce(
                (count, budget) => count + Number(budget?.rejected || 0),
                0
            ),
            issueCount: 0,
            topRejectionReasons: []
        })
    }

    /**
     * Builds health for the candidate decision stage.
     * @param {object[]} decisions Candidate decision rows.
     * @returns {object}
     */
    static #candidateDecisionHealth(decisions) {
        const rows = Array.isArray(decisions) ? decisions : []
        return this.#row('candidate-decisions', {
            generated: rows.length,
            accepted: rows.filter((row) => row.status === 'accepted').length,
            rejected: rows.filter((row) => row.status === 'rejected').length,
            issueCount: 0,
            topRejectionReasons: this.#topRejectionReasons(rows)
        })
    }

    /**
     * Counts issues whose type is in a target list.
     * @param {object[]} issues Issue rows.
     * @param {string[]} types Issue types.
     * @returns {number}
     */
    static #issueCount(issues, types) {
        const targets = new Set(types)
        return (Array.isArray(issues) ? issues : []).filter((issue) =>
            targets.has(issue.type)
        ).length
    }

    /**
     * Builds the top rejection reasons from rejected candidate rows.
     * @param {object[]} rows Candidate rows.
     * @returns {Array<{ reason: string, count: number }>}
     */
    static #topRejectionReasons(rows) {
        const counts = new Map()
        for (const row of Array.isArray(rows) ? rows : []) {
            if (row.status && row.status !== 'rejected') continue
            const reason = String(row.reason || '').trim()
            if (!reason) continue
            counts.set(reason, (counts.get(reason) || 0) + 1)
        }
        return [...counts.entries()]
            .sort(
                (left, right) =>
                    right[1] - left[1] || left[0].localeCompare(right[0])
            )
            .slice(0, 3)
            .map(([reason, count]) => ({ reason, count }))
    }
}
