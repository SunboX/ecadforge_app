/**
 * Builds a compact accepted/rejected candidate timeline for diagnostics.
 */
export class SchematicCandidateDecisionTimeline {
    /**
     * Builds candidate decision rows from advisor outputs.
     * @param {object} data Advisor output rows.
     * @returns {object[]}
     */
    static build(data) {
        const rows = []

        this.#appendAccepted(
            rows,
            'multi-label-detours',
            data.multiLabelTraceDetourSegments
        )
        this.#appendAccepted(
            rows,
            'trace-label-snip-reconnects',
            data.traceLabelSnipReconnectSegments
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'net-island-lane-shifts',
            data.netIslandLaneShiftSegments,
            data.netIslandLaneShiftCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'label-relocations',
            data.labelRelocationCandidateBounds,
            data.labelRelocationCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'label-orientations',
            data.orientationLabelCandidateBounds,
            data.orientationLabelCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'congested-l-turn-reroutes',
            data.congestedLTurnRerouteSegments,
            data.congestedLTurnRerouteCandidateDecisions
        )
        this.#appendAccepted(
            rows,
            'long-distance-connections',
            data.longDistanceConnectionSegments
        )
        this.#appendAccepted(
            rows,
            'section-boundary-connections',
            data.sectionBoundaryConnectionSegments
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'supplemental-connections',
            [],
            data.supplementalConnectionCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'anchor-connection-routes',
            data.anchorConnectionRouteSegments,
            data.anchorConnectionRouteCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'symbol-fit',
            [],
            data.symbolFitCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'symbol-normalization',
            [],
            data.symbolNormalizationCandidateDecisions
        )
        this.#appendAcceptedOrDecisions(
            rows,
            'trace-label-resolutions',
            [
                ...(Array.isArray(data.traceLabelResolutionCandidateBounds)
                    ? data.traceLabelResolutionCandidateBounds
                    : []),
                ...(Array.isArray(data.traceLabelResolutionSegments)
                    ? data.traceLabelResolutionSegments
                    : [])
            ],
            data.traceLabelResolutionCandidateDecisions
        )
        this.#appendRejected(
            rows,
            'trace-anchored-labels',
            data.traceAnchoredLabelRejectedCandidateBounds
        )

        return rows.map((row, decisionIndex) => ({
            ...row,
            decisionIndex
        }))
    }

    /**
     * Appends explicit decision rows when present, otherwise accepted rows.
     * @param {object[]} target Mutable decision rows.
     * @param {string} advisor Advisor name.
     * @param {object[]} candidates Candidate rows.
     * @param {object[]} decisions Explicit advisor decisions.
     * @returns {void}
     */
    static #appendAcceptedOrDecisions(target, advisor, candidates, decisions) {
        if (Array.isArray(decisions) && decisions.length) {
            this.#appendDecisions(target, advisor, decisions)
            return
        }
        this.#appendAccepted(target, advisor, candidates)
    }

    /**
     * Appends explicit generated candidate decision rows for one advisor.
     * @param {object[]} target Mutable decision rows.
     * @param {string} advisor Advisor name.
     * @param {object[]} decisions Candidate decision rows.
     * @returns {void}
     */
    static #appendDecisions(target, advisor, decisions) {
        for (const [rowIndex, decision] of decisions.entries()) {
            target.push({
                kind: 'diagnostic-candidate-decision',
                advisor,
                candidateKind:
                    decision.candidateKind || decision.kind || 'candidate',
                status: decision.status || 'generated',
                reason: decision.reason || '',
                selected: decision.selected === true,
                score: Number.isFinite(decision.score) ? decision.score : null,
                collisionSource: decision.collisionSource || '',
                netName: decision.netName || '',
                rowIndex,
                debug: this.#debugForCandidate(decision)
            })
        }
    }

    /**
     * Appends accepted rows for one advisor.
     * @param {object[]} target Mutable decision rows.
     * @param {string} advisor Advisor name.
     * @param {object[]} candidates Candidate rows.
     * @returns {void}
     */
    static #appendAccepted(target, advisor, candidates) {
        for (const [rowIndex, candidate] of (Array.isArray(candidates)
            ? candidates
            : []
        ).entries()) {
            target.push({
                kind: 'diagnostic-candidate-decision',
                advisor,
                candidateKind: candidate.kind,
                status: 'accepted',
                selected: true,
                score: this.#scoreForCandidate(candidate),
                collisionSource: candidate.debug?.collisionSource || '',
                netName: candidate.netName || '',
                rowIndex,
                debug: this.#debugForCandidate(candidate)
            })
        }
    }

    /**
     * Appends rejected rows for one advisor.
     * @param {object[]} target Mutable decision rows.
     * @param {string} advisor Advisor name.
     * @param {object[]} candidates Candidate rows.
     * @returns {void}
     */
    static #appendRejected(target, advisor, candidates) {
        for (const [rowIndex, candidate] of (Array.isArray(candidates)
            ? candidates
            : []
        ).entries()) {
            target.push({
                kind: 'diagnostic-candidate-decision',
                advisor,
                candidateKind: candidate.kind,
                status: 'rejected',
                reason: candidate.reason || '',
                selected: false,
                score: this.#scoreForCandidate(candidate),
                collisionSource: candidate.debug?.collisionSource || '',
                netName: candidate.netName || '',
                rowIndex,
                debug: this.#debugForCandidate(candidate)
            })
        }
    }

    /**
     * Builds stable debug metadata for one candidate.
     * @param {object} candidate Candidate row.
     * @returns {object}
     */
    static #debugForCandidate(candidate) {
        return {
            candidateIndex: candidate.candidateIndex ?? null,
            candidateId: candidate.candidateId || '',
            labelId: candidate.labelId || '',
            labelIds: Array.isArray(candidate.labelIds)
                ? candidate.labelIds
                : [],
            segmentKey: candidate.segmentKey || '',
            sourceKind:
                candidate.debug?.sourceKind || candidate.debug?.strategy || '',
            collisionIndex: candidate.debug?.collisionIndex ?? null,
            movedLabelId: candidate.debug?.movedLabelId || '',
            stationaryLabelId: candidate.debug?.stationaryLabelId || '',
            hostSegmentKey: candidate.debug?.hostSegmentKey || '',
            candidateStatus: candidate.debug?.candidateStatus || '',
            globalPass: candidate.debug?.globalPass === true,
            anchorIds: Array.isArray(candidate.anchorIds)
                ? candidate.anchorIds
                : [],
            lTurn: candidate.debug?.lTurn || null,
            blockerIntersections: Array.isArray(
                candidate.debug?.blockerIntersections
            )
                ? candidate.debug.blockerIntersections
                : [],
            rectangleCandidate: candidate.debug?.rectangleCandidate || null,
            offset: candidate.debug?.offset ?? null,
            strategy: candidate.debug?.strategy || '',
            collisionSourceId: candidate.debug?.collisionSourceId || '',
            routeStyle: candidate.debug?.routeStyle || '',
            directReason: candidate.debug?.directReason || '',
            normalizationKind: candidate.debug?.normalizationKind || '',
            sourceCandidateIndex: candidate.debug?.sourceCandidateIndex ?? null,
            blockedLabelReasons: Array.isArray(
                candidate.debug?.blockedLabelReasons
            )
                ? candidate.debug.blockedLabelReasons
                : []
        }
    }

    /**
     * Resolves a numeric candidate score.
     * @param {object} candidate Candidate row.
     * @returns {number | null}
     */
    static #scoreForCandidate(candidate) {
        const score = candidate.score ?? candidate.debug?.score
        return Number.isFinite(score) ? score : null
    }
}
