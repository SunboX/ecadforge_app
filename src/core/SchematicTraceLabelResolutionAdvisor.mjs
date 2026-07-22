/**
 * Chooses a preferred non-mutating resolution for label/trace collisions.
 */
export class SchematicTraceLabelResolutionAdvisor {
    /**
     * Builds label-first trace collision resolution telemetry.
     * @param {object} data Resolver inputs.
     * @returns {{ traceLabelResolutionCandidateBounds: object[], traceLabelResolutionSegments: object[], candidateDecisions: object[], budget: object }}
     */
    static analyze(data) {
        const labelsById = this.#labelsById(data.labels)
        const acceptedByLabel = this.#firstByLabel(
            data.traceAnchoredLabelCandidateBounds
        )
        const rejectedReasonsByLabel = this.#rejectedReasonsByLabel(
            data.traceAnchoredLabelRejectedCandidateBounds
        )
        const snipByLabel = this.#firstByLabel(
            data.traceLabelSnipReconnectSegments
        )
        const detourByLabel = this.#firstByLabel(data.traceLabelDetourSegments)
        const traceLabelResolutionCandidateBounds = []
        const traceLabelResolutionSegments = []
        const candidateDecisions = []

        for (const [collisionIndex, collision] of this.#traceCollisions(
            data.collisionBounds
        ).entries()) {
            const label = labelsById.get(collision.labelId)
            if (!label) continue

            const accepted = acceptedByLabel.get(label.id)
            if (accepted) {
                const row = this.#labelMoveRow({
                    collision,
                    label,
                    accepted,
                    collisionIndex,
                    candidateIndex: traceLabelResolutionCandidateBounds.length
                })
                traceLabelResolutionCandidateBounds.push(row)
                candidateDecisions.push(
                    this.#acceptedDecision(row, 'move-label')
                )
                continue
            }

            const traceCandidate =
                snipByLabel.get(label.id) || detourByLabel.get(label.id)
            if (traceCandidate) {
                const row = this.#traceMoveRow({
                    collision,
                    label,
                    traceCandidate,
                    collisionIndex,
                    candidateIndex: traceLabelResolutionSegments.length,
                    blockedReasons: rejectedReasonsByLabel.get(label.id) || []
                })
                traceLabelResolutionSegments.push(row)
                candidateDecisions.push(
                    this.#acceptedDecision(row, 'move-trace')
                )
                continue
            }

            candidateDecisions.push(
                this.#rejectedDecision({
                    collision,
                    label,
                    collisionIndex,
                    candidateIndex: candidateDecisions.length
                })
            )
        }

        return {
            traceLabelResolutionCandidateBounds,
            traceLabelResolutionSegments,
            candidateDecisions,
            budget: {
                generated: candidateDecisions.length,
                accepted:
                    traceLabelResolutionCandidateBounds.length +
                    traceLabelResolutionSegments.length,
                rejected: candidateDecisions.filter(
                    (row) => row.status === 'rejected'
                ).length
            }
        }
    }

    /**
     * Builds a label id map.
     * @param {object[]} labels Label rows.
     * @returns {Map<string, object>}
     */
    static #labelsById(labels) {
        return new Map(
            (Array.isArray(labels) ? labels : []).map((label) => [
                label.id,
                label
            ])
        )
    }

    /**
     * Returns trace collision rows.
     * @param {object[]} collisionBounds Collision rows.
     * @returns {object[]}
     */
    static #traceCollisions(collisionBounds) {
        return (Array.isArray(collisionBounds) ? collisionBounds : []).filter(
            (collision) => collision?.kind === 'net-label-trace-overlap'
        )
    }

    /**
     * Indexes the first candidate by label id.
     * @param {object[]} candidates Candidate rows.
     * @returns {Map<string, object>}
     */
    static #firstByLabel(candidates) {
        const map = new Map()
        for (const candidate of Array.isArray(candidates) ? candidates : []) {
            if (!candidate?.labelId || map.has(candidate.labelId)) continue
            map.set(candidate.labelId, candidate)
        }
        return map
    }

    /**
     * Groups rejected label candidate reasons by label id.
     * @param {object[]} candidates Rejected candidate rows.
     * @returns {Map<string, string[]>}
     */
    static #rejectedReasonsByLabel(candidates) {
        const map = new Map()
        for (const candidate of Array.isArray(candidates) ? candidates : []) {
            if (!candidate?.labelId || !candidate.reason) continue
            if (!map.has(candidate.labelId)) map.set(candidate.labelId, [])
            const reasons = map.get(candidate.labelId)
            if (!reasons.includes(candidate.reason)) {
                reasons.push(candidate.reason)
            }
        }
        return map
    }

    /**
     * Builds a preferred label movement row.
     * @param {object} data Label move data.
     * @returns {object}
     */
    static #labelMoveRow(data) {
        return {
            kind: 'trace-label-resolution-candidate',
            netName: data.label.netName,
            otherNetName: data.collision.otherNetName || '',
            labelId: data.label.id,
            candidateId:
                data.label.id +
                ':trace-label-resolution-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            bounds: data.accepted.bounds,
            debug: {
                collisionIndex: data.collisionIndex,
                strategy: 'move-label-before-trace-detour',
                sourceCandidateIndex: data.accepted.candidateIndex ?? null,
                sourceSegmentKey: data.accepted.debug?.segmentKey || '',
                status: 'accepted'
            }
        }
    }

    /**
     * Builds a preferred trace movement row.
     * @param {object} data Trace move data.
     * @returns {object}
     */
    static #traceMoveRow(data) {
        return {
            kind: 'trace-label-resolution-trace-candidate',
            netName: data.traceCandidate.netName || data.collision.otherNetName,
            labelNetName: data.label.netName,
            labelId: data.label.id,
            candidateId:
                data.label.id +
                ':trace-label-resolution-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            points: data.traceCandidate.points,
            debug: {
                collisionIndex: data.collisionIndex,
                strategy: 'move-trace-after-label-blocked',
                sourceCandidateIndex:
                    data.traceCandidate.candidateIndex ?? null,
                blockedLabelReasons: data.blockedReasons,
                status: 'accepted'
            }
        }
    }

    /**
     * Builds one accepted resolver decision row.
     * @param {object} row Accepted resolution row.
     * @param {string} strategy Resolution strategy.
     * @returns {object}
     */
    static #acceptedDecision(row, strategy) {
        return {
            kind: row.kind,
            candidateKind: row.kind,
            status: 'accepted',
            reason: strategy === 'move-trace' ? 'label-candidates-blocked' : '',
            selected: true,
            score: row.candidateIndex,
            collisionSource: 'trace-label',
            netName: row.netName,
            candidateId: row.candidateId,
            candidateIndex: row.candidateIndex,
            labelId: row.labelId,
            debug: {
                strategy,
                collisionIndex: row.debug.collisionIndex,
                sourceCandidateIndex: row.debug.sourceCandidateIndex,
                blockedLabelReasons: row.debug.blockedLabelReasons || []
            }
        }
    }

    /**
     * Builds one rejected resolver decision row.
     * @param {object} data Rejected decision data.
     * @returns {object}
     */
    static #rejectedDecision(data) {
        return {
            kind: 'trace-label-resolution-candidate',
            candidateKind: 'trace-label-resolution-candidate',
            status: 'rejected',
            reason: 'no-label-or-trace-resolution',
            selected: false,
            score: null,
            collisionSource: 'trace-label',
            netName: data.label.netName,
            candidateId:
                data.label.id +
                ':trace-label-resolution-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            labelId: data.label.id,
            debug: {
                strategy: 'blocked',
                collisionIndex: data.collisionIndex,
                sourceCandidateIndex: null,
                blockedLabelReasons: []
            }
        }
    }
}
