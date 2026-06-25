import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const LABEL_RELOCATION_PADDING = 0.5
const LABEL_RELOCATION_SAMPLE_RINGS = 2

/**
 * Suggests read-only label moves for label-label collisions.
 */
export class SchematicLabelRelocationAdvisor {
    /**
     * Builds label relocation candidates and decision telemetry.
     * @param {object[]} collisionBounds Collision rows.
     * @param {object[]} labels Label bounds.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ labelRelocationCandidateBounds: object[], candidateDecisions: object[], budget: object }}
     */
    static analyze(collisionBounds, labels, segments, obstacles) {
        const rows = []
        const candidateDecisions = []
        let generated = 0
        const workingLabels = this.#workingLabels(labels)
        const labelMap = this.#labelMap(workingLabels)

        let labelCollisionIndex = 0
        for (const collision of Array.isArray(collisionBounds)
            ? collisionBounds
            : []) {
            if (collision?.kind !== 'net-label-net-label-overlap') continue
            const collisionIndex = labelCollisionIndex
            labelCollisionIndex += 1
            if (!this.#collisionStillActive(collision, labelMap)) continue

            const pairs = this.#collisionLabelPairs(
                collision,
                labelMap,
                segments
            )
            let accepted = false
            for (const pair of pairs) {
                const candidates = this.#candidatePlacements(
                    pair.moving,
                    pair.stationary
                )
                for (const candidate of candidates) {
                    generated += 1
                    const collisionDetail = this.#candidateCollision(
                        candidate,
                        pair.moving,
                        workingLabels,
                        obstacles,
                        segments
                    )
                    if (collisionDetail) {
                        candidateDecisions.push(
                            this.#decisionRow({
                                candidate,
                                pair,
                                collisionIndex,
                                status: 'rejected',
                                reason: collisionDetail.reason,
                                collisionSource: collisionDetail.source,
                                collisionSourceId: collisionDetail.sourceId,
                                candidateStatus: collisionDetail.status
                            })
                        )
                        continue
                    }

                    const row = this.#candidateRow({
                        candidate,
                        pair,
                        collisionIndex
                    })
                    rows.push(row)
                    candidateDecisions.push(
                        this.#decisionRow({
                            candidate: row,
                            pair,
                            collisionIndex,
                            status: 'accepted',
                            reason: '',
                            collisionSource: 'label-label',
                            collisionSourceId: pair.stationary.id,
                            candidateStatus: 'accepted'
                        })
                    )
                    this.#applyAcceptedMove(
                        workingLabels,
                        labelMap,
                        pair.moving.id,
                        row
                    )
                    accepted = true
                    break
                }
                if (accepted) break
            }
        }

        return {
            labelRelocationCandidateBounds: rows,
            candidateDecisions,
            budget: {
                generated,
                accepted: rows.length,
                rejected: Math.max(generated - rows.length, 0)
            }
        }
    }

    /**
     * Builds mutable working label rows for one advisor pass.
     * @param {object[]} labels Source label rows.
     * @returns {object[]}
     */
    static #workingLabels(labels) {
        return (Array.isArray(labels) ? labels : []).map((label) => ({
            ...label,
            center: label.center ? { ...label.center } : label.center,
            bounds: label.bounds ? { ...label.bounds } : label.bounds
        }))
    }

    /**
     * Builds a mutable lookup by label id.
     * @param {object[]} labels Working label rows.
     * @returns {Map<string, object>}
     */
    static #labelMap(labels) {
        return new Map(labels.map((label) => [label.id, label]))
    }

    /**
     * Returns true when a source collision is still active after earlier moves.
     * @param {object} collision Source collision row.
     * @param {Map<string, object>} labelMap Working labels by id.
     * @returns {boolean}
     */
    static #collisionStillActive(collision, labelMap) {
        const left = labelMap.get(collision?.labelId)
        const right = labelMap.get(collision?.otherLabelId)
        return Boolean(
            left && right && Geometry.boundsOverlap(left.bounds, right.bounds)
        )
    }

    /**
     * Applies one accepted candidate to the working labels.
     * @param {object[]} workingLabels Mutable working labels.
     * @param {Map<string, object>} labelMap Working labels by id.
     * @param {string} labelId Moved label id.
     * @param {object} row Accepted candidate row.
     * @returns {void}
     */
    static #applyAcceptedMove(workingLabels, labelMap, labelId, row) {
        const index = workingLabels.findIndex((label) => label.id === labelId)
        if (index === -1) return

        workingLabels[index] = {
            ...workingLabels[index],
            center: { ...row.anchor },
            bounds: { ...row.bounds }
        }
        labelMap.set(labelId, workingLabels[index])
    }

    /**
     * Resolves the movable and stationary labels for one collision.
     * @param {object} collision Collision row.
     * @param {Map<string, object>} labelMap Labels by id.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {Array<{ moving: object, stationary: object }>}
     */
    static #collisionLabelPairs(collision, labelMap, segments) {
        const left = labelMap.get(collision?.labelId)
        const right = labelMap.get(collision?.otherLabelId)
        if (!left || !right) return []

        const pairs = []
        const rightHost = this.#hostSegmentForLabel(right, segments)
        if (rightHost) {
            pairs.push({
                moving: { ...right, hostSegment: rightHost },
                stationary: left
            })
        }

        const leftHost = this.#hostSegmentForLabel(left, segments)
        if (leftHost) {
            pairs.push({
                moving: { ...left, hostSegment: leftHost },
                stationary: right
            })
        }

        if (!rightHost) {
            pairs.push({
                moving: { ...right, hostSegment: null, portOnly: true },
                stationary: left
            })
        }
        if (!leftHost) {
            pairs.push({
                moving: { ...left, hostSegment: null, portOnly: true },
                stationary: right
            })
        }

        return pairs
    }

    /**
     * Finds a same-net segment under or near one label.
     * @param {object} label Label row.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object | null}
     */
    static #hostSegmentForLabel(label, segments) {
        return (
            (Array.isArray(segments) ? segments : []).find(
                (segment) =>
                    segment.netName === label.netName &&
                    Geometry.segmentIntersectsBounds(
                        segment.points,
                        label.bounds
                    )
            ) || null
        )
    }

    /**
     * Builds deterministic candidate label placements.
     * @param {object} moving Moving label with a host segment.
     * @param {object} stationary Stationary collision label.
     * @returns {object[]}
     */
    static #candidatePlacements(moving, stationary) {
        if (!moving.hostSegment) {
            return this.#portOnlyCandidatePlacements(moving)
        }

        const width = moving.bounds.width
        const height = moving.bounds.height
        const shift = this.#relocationShift(moving, stationary)
        const candidates = [
            this.#candidatePlacement(moving, moving.center, 0),
            this.#candidatePlacement(
                moving,
                {
                    x: moving.center.x + shift.x,
                    y: moving.center.y + shift.y
                },
                1
            )
        ].map((candidate) => ({
            ...candidate,
            bounds: Geometry.centerBounds(candidate.anchor, width, height),
            score: this.#roundScore(
                Geometry.manhattan(moving.center, candidate.anchor)
            )
        }))
        return [
            ...candidates,
            ...this.#sampledHostPlacements(
                moving,
                candidates.length,
                new Set(
                    candidates.map((candidate) =>
                        Geometry.pointKey(candidate.anchor)
                    )
                )
            )
        ]
    }

    /**
     * Builds one candidate placement shell.
     * @param {object} moving Moving label.
     * @param {{ x: number, y: number }} anchor Candidate anchor.
     * @param {number} candidateIndex Candidate index.
     * @param {string} [strategy] Candidate strategy.
     * @param {object} [debug] Extra debug metadata.
     * @returns {object}
     */
    static #candidatePlacement(
        moving,
        anchor,
        candidateIndex,
        strategy = 'host-trace-label-relocation',
        debug = {}
    ) {
        return {
            kind: 'net-label-relocation-candidate',
            netName: moving.netName,
            labelId: moving.id,
            candidateId: moving.id + ':relocation-' + String(candidateIndex),
            candidateIndex,
            anchor,
            debug: {
                hostSegmentKey: moving.hostSegment?.key || '',
                strategy,
                ...debug
            }
        }
    }

    /**
     * Builds deterministic label placements when no same-net host trace exists.
     * @param {object} moving Moving label.
     * @returns {object[]}
     */
    static #portOnlyCandidatePlacements(moving) {
        const width = moving.bounds.width
        const height = moving.bounds.height
        const anchors = [
            {
                anchor: moving.center,
                orientation: 'current',
                candidateStatus: 'label-collision'
            },
            {
                anchor: {
                    x: moving.center.x,
                    y: moving.center.y - (height + LABEL_RELOCATION_PADDING)
                },
                orientation: 'up',
                candidateStatus: 'chip-collision'
            },
            {
                anchor: {
                    x: moving.center.x,
                    y: moving.center.y + height
                },
                orientation: 'down',
                candidateStatus: 'trace-collision'
            },
            {
                anchor: {
                    x: moving.center.x,
                    y: moving.center.y + height + LABEL_RELOCATION_PADDING
                },
                orientation: 'down',
                candidateStatus: 'accepted'
            }
        ]

        return anchors.map((entry, candidateIndex) => {
            const candidate = this.#candidatePlacement(
                moving,
                entry.anchor,
                candidateIndex,
                'port-only-label-relocation',
                {
                    orientation: entry.orientation,
                    candidateStatus: entry.candidateStatus
                }
            )
            return {
                ...candidate,
                bounds: Geometry.centerBounds(entry.anchor, width, height),
                score: this.#roundScore(
                    Geometry.manhattan(moving.center, entry.anchor)
                )
            }
        })
    }

    /**
     * Builds sampled placements along the host trace.
     * @param {object} moving Moving label with a host segment.
     * @param {number} startIndex First candidate index.
     * @param {Set<string>} seenAnchors Already generated label-center keys.
     * @returns {object[]}
     */
    static #sampledHostPlacements(moving, startIndex, seenAnchors) {
        const placements = []
        for (const [sampleIndex, traceAnchor] of this.#sampledTraceAnchors(
            moving
        ).entries()) {
            for (const orientation of this.#perpendicularOrientations(
                moving.hostSegment
            )) {
                const anchor = this.#labelCenterForTraceAnchor(
                    moving.bounds,
                    traceAnchor,
                    orientation
                )
                const anchorKey = Geometry.pointKey(anchor)
                if (seenAnchors.has(anchorKey)) continue
                seenAnchors.add(anchorKey)
                const candidateIndex = startIndex + placements.length
                const candidate = this.#candidatePlacement(
                    moving,
                    anchor,
                    candidateIndex,
                    'sampled-host-trace-relocation',
                    {
                        traceAnchor,
                        orientation,
                        sampleIndex
                    }
                )
                placements.push({
                    ...candidate,
                    bounds: Geometry.centerBounds(
                        anchor,
                        moving.bounds.width,
                        moving.bounds.height
                    ),
                    score: this.#roundScore(
                        Geometry.manhattan(moving.center, anchor)
                    )
                })
            }
        }
        return placements
    }

    /**
     * Rounds public scores to stable decimal values.
     * @param {number} value Source score.
     * @returns {number}
     */
    static #roundScore(value) {
        return Number(value.toFixed(6))
    }

    /**
     * Samples deterministic anchors around the label's projected host point.
     * @param {object} moving Moving label with a host segment.
     * @returns {object[]}
     */
    static #sampledTraceAnchors(moving) {
        const host = moving.hostSegment
        const projected = this.#projectPointToSegment(moving.center, host)
        const step =
            (host.axis === 'x' ? moving.bounds.width : moving.bounds.height) +
            LABEL_RELOCATION_PADDING * 2
        const anchors = [projected]
        for (let ring = 1; ring <= LABEL_RELOCATION_SAMPLE_RINGS; ring++) {
            for (const sign of [-1, 1]) {
                anchors.push(
                    this.#shiftAnchorOnSegment(
                        projected,
                        host,
                        sign * step * ring
                    )
                )
            }
        }
        return this.#uniquePoints(anchors)
    }

    /**
     * Finds the closest point on an orthogonal segment.
     * @param {object} point Source point.
     * @param {object} segment Host segment.
     * @returns {object}
     */
    static #projectPointToSegment(point, segment) {
        const [start, end] = segment.points
        if (segment.axis === 'x') {
            return {
                x: this.#clamp(point.x, start.x, end.x),
                y: start.y
            }
        }
        return {
            x: start.x,
            y: this.#clamp(point.y, start.y, end.y)
        }
    }

    /**
     * Shifts an anchor along a segment.
     * @param {object} point Source anchor.
     * @param {object} segment Host segment.
     * @param {number} offset Lateral offset.
     * @returns {object}
     */
    static #shiftAnchorOnSegment(point, segment, offset) {
        const [start, end] = segment.points
        if (segment.axis === 'x') {
            return {
                x: this.#clamp(point.x + offset, start.x, end.x),
                y: point.y
            }
        }
        return {
            x: point.x,
            y: this.#clamp(point.y + offset, start.y, end.y)
        }
    }

    /**
     * Returns candidate label orientations perpendicular to the host segment.
     * @param {object} segment Host segment.
     * @returns {string[]}
     */
    static #perpendicularOrientations(segment) {
        return segment.axis === 'x' ? ['up', 'down'] : ['left', 'right']
    }

    /**
     * Resolves the label center for a trace anchor and side orientation.
     * @param {object} bounds Source label bounds.
     * @param {object} traceAnchor Trace anchor.
     * @param {string} orientation Candidate orientation.
     * @returns {object}
     */
    static #labelCenterForTraceAnchor(bounds, traceAnchor, orientation) {
        const offsetX =
            orientation === 'left'
                ? -(bounds.width / 2 + LABEL_RELOCATION_PADDING)
                : orientation === 'right'
                  ? bounds.width / 2 + LABEL_RELOCATION_PADDING
                  : 0
        const offsetY =
            orientation === 'up'
                ? -(bounds.height / 2 + LABEL_RELOCATION_PADDING)
                : orientation === 'down'
                  ? bounds.height / 2 + LABEL_RELOCATION_PADDING
                  : 0
        return {
            x: traceAnchor.x + offsetX,
            y: traceAnchor.y + offsetY
        }
    }

    /**
     * Deduplicates points while preserving order.
     * @param {object[]} points Point rows.
     * @returns {object[]}
     */
    static #uniquePoints(points) {
        const seen = new Set()
        const unique = []
        for (const point of points) {
            const key = Geometry.pointKey(point)
            if (seen.has(key)) continue
            seen.add(key)
            unique.push(point)
        }
        return unique
    }

    /**
     * Clamps a value between unordered extents.
     * @param {number} value Source value.
     * @param {number} first First extent.
     * @param {number} second Second extent.
     * @returns {number}
     */
    static #clamp(value, first, second) {
        return Math.min(
            Math.max(value, Math.min(first, second)),
            Math.max(first, second)
        )
    }

    /**
     * Resolves the preferred movement vector along the host segment axis.
     * @param {object} moving Moving label with host segment.
     * @param {object} stationary Stationary collision label.
     * @returns {{ x: number, y: number }}
     */
    static #relocationShift(moving, stationary) {
        const host = moving.hostSegment
        const magnitude =
            (host.axis === 'x' ? moving.bounds.width : moving.bounds.height) +
            LABEL_RELOCATION_PADDING
        const sign =
            host.axis === 'x'
                ? this.#direction(moving.center.x, stationary.center.x)
                : this.#direction(moving.center.y, stationary.center.y)
        return host.axis === 'x'
            ? { x: magnitude * sign, y: 0 }
            : { x: 0, y: magnitude * sign }
    }

    /**
     * Returns a deterministic direction away from a reference coordinate.
     * @param {number} value Candidate value.
     * @param {number} reference Reference value.
     * @returns {number}
     */
    static #direction(value, reference) {
        return value >= reference ? 1 : -1
    }

    /**
     * Finds the first collision for a candidate label placement.
     * @param {object} candidate Candidate placement.
     * @param {object} moving Moving label.
     * @param {object[]} labels Label bounds.
     * @param {object[]} obstacles Body obstacles.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {{ reason: string, source: string, sourceId: string, status: string } | null}
     */
    static #candidateCollision(candidate, moving, labels, obstacles, segments) {
        for (const label of Array.isArray(labels) ? labels : []) {
            if (label.id === moving.id) continue
            if (!Geometry.boundsOverlap(candidate.bounds, label.bounds)) {
                continue
            }
            return {
                reason: 'label-collision',
                source: 'label',
                sourceId: label.id,
                status: 'label-collision'
            }
        }

        for (const obstacle of Array.isArray(obstacles) ? obstacles : []) {
            if (
                !Geometry.boundsTouchOrOverlap(
                    candidate.bounds,
                    obstacle.bounds
                )
            ) {
                continue
            }
            const reason = moving.portOnly ? 'chip-collision' : 'body-collision'
            return {
                reason,
                source: 'obstacle',
                sourceId: obstacle.id,
                status: reason
            }
        }

        for (const segment of Array.isArray(segments) ? segments : []) {
            if (segment.netName === moving.netName) continue
            if (!this.#traceIntersectsCandidate(segment, candidate)) continue
            return {
                reason: 'trace-collision',
                source: 'trace',
                sourceId: segment.key,
                status: 'trace-collision'
            }
        }

        return null
    }

    /**
     * Returns whether a foreign trace intersects a candidate placement.
     * @param {object} segment Foreign trace segment.
     * @param {object} candidate Candidate placement.
     * @returns {boolean}
     */
    static #traceIntersectsCandidate(segment, candidate) {
        if (candidate.debug?.strategy !== 'port-only-label-relocation') {
            return Geometry.segmentIntersectsBounds(
                segment.points,
                candidate.bounds
            )
        }
        return this.#segmentIntersectsBoundsInterior(
            segment.points,
            candidate.bounds
        )
    }

    /**
     * Returns whether a segment crosses the strict interior of bounds.
     * @param {object[]} points Segment points.
     * @param {object} bounds Candidate bounds.
     * @returns {boolean}
     */
    static #segmentIntersectsBoundsInterior(points, bounds) {
        const [start, end] = points
        if (Math.abs(start.y - end.y) <= 1e-6) {
            const y = start.y
            if (y <= bounds.minY + 1e-6 || y >= bounds.maxY - 1e-6) {
                return false
            }
            return Boolean(
                Geometry.rangeOverlap(start.x, end.x, bounds.minX, bounds.maxX)
            )
        }
        if (Math.abs(start.x - end.x) <= 1e-6) {
            const x = start.x
            if (x <= bounds.minX + 1e-6 || x >= bounds.maxX - 1e-6) {
                return false
            }
            return Boolean(
                Geometry.rangeOverlap(start.y, end.y, bounds.minY, bounds.maxY)
            )
        }
        return false
    }

    /**
     * Builds a public candidate row.
     * @param {object} data Candidate data.
     * @returns {object}
     */
    static #candidateRow(data) {
        const { score, ...candidate } = data.candidate
        return {
            ...candidate,
            debug: {
                collisionIndex: data.collisionIndex,
                movedLabelId: data.pair.moving.id,
                stationaryLabelId: data.pair.stationary.id,
                hostSegmentKey: data.pair.moving.hostSegment?.key || '',
                strategy: candidate.debug.strategy,
                status: 'accepted',
                score,
                ...this.#sampleDebug(candidate)
            }
        }
    }

    /**
     * Builds a candidate decision row for timeline normalization.
     * @param {object} data Decision data.
     * @returns {object}
     */
    static #decisionRow(data) {
        return {
            kind: 'net-label-relocation-candidate',
            candidateKind: 'net-label-relocation-candidate',
            status: data.status,
            reason: data.reason,
            selected: data.status === 'accepted',
            score: data.candidate.score ?? data.candidate.debug?.score,
            collisionSource: data.collisionSource,
            netName: data.pair.moving.netName,
            labelId: data.pair.moving.id,
            candidateId: data.candidate.candidateId,
            candidateIndex: data.candidate.candidateIndex,
            debug: {
                collisionIndex: data.collisionIndex,
                movedLabelId: data.pair.moving.id,
                stationaryLabelId: data.pair.stationary.id,
                hostSegmentKey: data.pair.moving.hostSegment?.key || '',
                strategy: data.candidate.debug?.strategy,
                globalPass: true,
                ...this.#sampleDebug(data.candidate),
                candidateStatus: data.candidateStatus,
                collisionSourceId: data.collisionSourceId
            }
        }
    }

    /**
     * Returns optional sampled-placement debug metadata.
     * @param {object} candidate Candidate placement.
     * @returns {object}
     */
    static #sampleDebug(candidate) {
        const debug = {}
        if (candidate.debug?.traceAnchor) {
            debug.traceAnchor = candidate.debug.traceAnchor
        }
        if (candidate.debug?.orientation) {
            debug.orientation = candidate.debug.orientation
        }
        if (candidate.debug?.candidateStatus) {
            debug.candidateStatus = candidate.debug.candidateStatus
        }
        if (Number.isInteger(candidate.debug?.sampleIndex)) {
            debug.sampleIndex = candidate.debug.sampleIndex
        }
        return debug
    }
}
