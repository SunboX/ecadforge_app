import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const LABEL_ORIENTATION_CLEARANCE = 0.5
const LABEL_ORIENTATION_LATERAL_RINGS = 2

/**
 * Suggests non-mutating label placements that satisfy source orientation rules.
 */
export class SchematicLabelOrientationAdvisor {
    /**
     * Builds label orientation candidates and connector segments.
     * @param {object[]} labels Label rows.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ orientationLabelCandidateBounds: object[], orientationConnectorSegments: object[], candidateDecisions: object[], budget: object }}
     */
    static suggest(labels, segments, obstacles = []) {
        const labelIndex = new SchematicBoundsSpatialIndex(labels)
        const obstacleIndex = new SchematicBoundsSpatialIndex(obstacles)
        const orientationLabelCandidateBounds = []
        const orientationConnectorSegments = []
        const candidateDecisions = []
        let generated = 0
        let rejected = 0

        for (const label of Array.isArray(labels) ? labels : []) {
            const currentOrientation = this.#currentOrientation(label)
            const requiredOrientations = this.#requiredOrientations(label)
            if (
                !currentOrientation ||
                !requiredOrientations.length ||
                requiredOrientations.includes(currentOrientation)
            ) {
                continue
            }

            for (const requiredOrientation of requiredOrientations) {
                const anchor = this.#nearestTraceAnchor(label, segments)
                if (!anchor?.point) {
                    generated += 1
                    rejected += 1
                    continue
                }

                const candidates = this.#candidatePlacements(
                    label,
                    anchor,
                    requiredOrientation
                )
                for (const candidate of candidates) {
                    generated += 1
                    const collision = this.#candidateCollision(
                        label,
                        candidate,
                        labelIndex,
                        obstacleIndex,
                        segments
                    )
                    if (collision) {
                        rejected += 1
                        candidateDecisions.push(
                            this.#decisionRow({
                                candidate,
                                label,
                                currentOrientation,
                                requiredOrientation,
                                status: 'rejected',
                                reason: collision.reason,
                                collisionSource: collision.source,
                                collisionSourceId: collision.sourceId,
                                candidateStatus: collision.status
                            })
                        )
                        continue
                    }

                    orientationLabelCandidateBounds.push(
                        this.#candidateRow({
                            candidate,
                            label,
                            currentOrientation,
                            requiredOrientation
                        })
                    )
                    orientationConnectorSegments.push(
                        this.#connectorRow({
                            candidate,
                            label,
                            requiredOrientation
                        })
                    )
                    candidateDecisions.push(
                        this.#decisionRow({
                            candidate,
                            label,
                            currentOrientation,
                            requiredOrientation,
                            status: 'accepted',
                            reason: '',
                            collisionSource: 'label-orientation',
                            collisionSourceId: label.id,
                            candidateStatus: 'accepted'
                        })
                    )
                    break
                }
                if (
                    candidateDecisions.at(-1)?.status === 'accepted' &&
                    candidateDecisions.at(-1)?.labelId === label.id
                ) {
                    break
                }
            }
        }

        return {
            orientationLabelCandidateBounds,
            orientationConnectorSegments,
            candidateDecisions,
            budget: {
                generated,
                accepted: orientationLabelCandidateBounds.length,
                rejected
            }
        }
    }

    /**
     * Resolves the current source orientation.
     * @param {object} label Label row.
     * @returns {string}
     */
    static #currentOrientation(label) {
        return this.#normalizeOrientation(
            label?.source?.orientation ||
                label?.source?.facing ||
                label?.source?.direction
        )
    }

    /**
     * Resolves allowed source orientations.
     * @param {object} label Label row.
     * @returns {string[]}
     */
    static #requiredOrientations(label) {
        const source = label?.source || {}
        const values = Array.isArray(source.orientations)
            ? source.orientations
            : [source.requiredOrientation || source.allowedOrientation]
        return [
            ...new Set(values.map((value) => this.#normalizeOrientation(value)))
        ]
            .filter(Boolean)
            .sort()
    }

    /**
     * Normalizes an orientation token.
     * @param {unknown} value Source token.
     * @returns {string}
     */
    static #normalizeOrientation(value) {
        const text = String(value || '').toLowerCase()
        return (
            {
                up: 'up',
                top: 'up',
                down: 'down',
                bottom: 'down',
                left: 'left',
                right: 'right',
                'y-': 'up',
                'y+': 'down',
                'x-': 'left',
                'x+': 'right'
            }[text] || ''
        )
    }

    /**
     * Finds the nearest point on the label's own trace.
     * @param {object} label Label row.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {{ point: object, segment: object, distance: number } | null}
     */
    static #nearestTraceAnchor(label, segments) {
        const center = label.center
        let best = null
        for (const segment of Array.isArray(segments) ? segments : []) {
            if (segment.netName !== label.netName) continue
            const point = this.#projectPointToSegment(center, segment)
            const distance = Geometry.manhattan(center, point)
            if (
                !best ||
                distance < best.distance ||
                (distance === best.distance &&
                    Geometry.pointKey(point) < Geometry.pointKey(best.point))
            ) {
                best = { point, segment, distance }
            }
        }
        return best || null
    }

    /**
     * Builds ordered orientation search candidates.
     * @param {object} label Source label.
     * @param {{ point: object, segment: object }} anchor Nearest trace anchor.
     * @param {string} orientation Required orientation.
     * @returns {object[]}
     */
    static #candidatePlacements(label, anchor, orientation) {
        const candidates = []
        const seen = new Set()
        const addCandidate = (point, searchPhase, outwardOffset = 0) => {
            const bounds = this.#boundsForAnchor(
                label.bounds,
                point,
                orientation,
                outwardOffset
            )
            const key =
                Geometry.pointKey(point) +
                ':' +
                orientation +
                ':' +
                String(outwardOffset)
            if (seen.has(key)) return
            seen.add(key)
            candidates.push({
                candidateIndex: candidates.length,
                anchor: point,
                bounds,
                searchPhase,
                orientation,
                score: Geometry.manhattan(label.center, point) + outwardOffset
            })
        }

        addCandidate(anchor.point, 'direct')
        addCandidate(
            anchor.point,
            'outward',
            this.#outwardStep(label.bounds, orientation)
        )

        for (const point of this.#lateralAnchors(label, anchor)) {
            addCandidate(point, 'lateral')
        }
        return candidates
    }

    /**
     * Builds lateral trace anchors around the nearest anchor.
     * @param {object} label Source label.
     * @param {{ point: object, segment: object }} anchor Nearest trace anchor.
     * @returns {object[]}
     */
    static #lateralAnchors(label, anchor) {
        const axis = anchor.segment.axis
        const step =
            (axis === 'x' ? label.bounds.width : label.bounds.height) +
            LABEL_ORIENTATION_CLEARANCE * 2
        const points = []
        for (let ring = 1; ring <= LABEL_ORIENTATION_LATERAL_RINGS; ring++) {
            for (const sign of [-1, 1]) {
                points.push(
                    this.#shiftAnchorOnSegment(
                        anchor.point,
                        anchor.segment,
                        sign * step * ring
                    )
                )
            }
        }
        return points
    }

    /**
     * Shifts an anchor along a host segment, clamped to segment extents.
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
     * Resolves the outward search distance for an orientation.
     * @param {object} bounds Source label bounds.
     * @param {string} orientation Candidate orientation.
     * @returns {number}
     */
    static #outwardStep(bounds, orientation) {
        return (
            (orientation === 'left' || orientation === 'right'
                ? bounds.width
                : bounds.height) + LABEL_ORIENTATION_CLEARANCE
        )
    }

    /**
     * Projects a point to an orthogonal segment.
     * @param {object} point Source point.
     * @param {object} segment Segment row.
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
     * Builds candidate bounds from an anchor and orientation.
     * @param {object} sourceBounds Source label bounds.
     * @param {object} anchor Anchor point.
     * @param {string} orientation Candidate orientation.
     * @param {number} outwardOffset Additional outward offset.
     * @returns {object}
     */
    static #boundsForAnchor(
        sourceBounds,
        anchor,
        orientation,
        outwardOffset = 0
    ) {
        const width = sourceBounds.width
        const height = sourceBounds.height
        const offsetX =
            orientation === 'left'
                ? -(width / 2 + LABEL_ORIENTATION_CLEARANCE + outwardOffset)
                : orientation === 'right'
                  ? width / 2 + LABEL_ORIENTATION_CLEARANCE + outwardOffset
                  : 0
        const offsetY =
            orientation === 'up'
                ? -(height / 2 + LABEL_ORIENTATION_CLEARANCE + outwardOffset)
                : orientation === 'down'
                  ? height / 2 + LABEL_ORIENTATION_CLEARANCE + outwardOffset
                  : 0
        return Geometry.centerBounds(
            { x: anchor.x + offsetX, y: anchor.y + offsetY },
            width,
            height
        )
    }

    /**
     * Finds the first collision for a label candidate.
     * @param {object} sourceLabel Source label.
     * @param {object} candidate Candidate placement.
     * @param {SchematicBoundsSpatialIndex} labelIndex Label index.
     * @param {SchematicBoundsSpatialIndex} obstacleIndex Obstacle index.
     * @param {object[]} segments Orthogonal segments.
     * @returns {{ reason: string, source: string, sourceId: string, status: string } | null}
     */
    static #candidateCollision(
        sourceLabel,
        candidate,
        labelIndex,
        obstacleIndex,
        segments
    ) {
        const labelCollision = labelIndex
            .query(candidate.bounds)
            .find(
                (label) =>
                    label.id !== sourceLabel.id &&
                    Geometry.boundsTouchOrOverlap(
                        candidate.bounds,
                        label.bounds
                    )
            )
        if (labelCollision) {
            return {
                reason: 'label-collision',
                source: 'label',
                sourceId: labelCollision.id,
                status: 'label-collision'
            }
        }

        const obstacleCollision = obstacleIndex
            .query(candidate.bounds)
            .find((obstacle) =>
                Geometry.boundsTouchOrOverlap(candidate.bounds, obstacle.bounds)
            )
        if (obstacleCollision) {
            return {
                reason: 'body-collision',
                source: 'obstacle',
                sourceId: obstacleCollision.id,
                status: 'body-collision'
            }
        }

        const connector = this.#connectorSegment(candidate)
        const boundsTraceCollision = segments.find(
            (segment) =>
                segment.netName !== sourceLabel.netName &&
                Geometry.segmentIntersectsBounds(
                    segment.points,
                    candidate.bounds
                )
        )
        if (boundsTraceCollision) {
            return {
                reason: 'trace-collision',
                source: 'trace',
                sourceId: boundsTraceCollision.key,
                status: 'trace-collision'
            }
        }

        const connectorObstacleCollision = obstacleIndex
            .query(Geometry.boundsForPoints(connector.points))
            .find((obstacle) =>
                Geometry.segmentIntersectsBounds(
                    connector.points,
                    obstacle.bounds
                )
            )
        if (connectorObstacleCollision) {
            return {
                reason: 'connector-body-collision',
                source: 'connector-obstacle',
                sourceId: connectorObstacleCollision.id,
                status: 'connector-body-collision'
            }
        }

        const connectorLabelCollision = labelIndex
            .query(Geometry.boundsForPoints(connector.points))
            .find(
                (label) =>
                    label.id !== sourceLabel.id &&
                    Geometry.segmentIntersectsBounds(
                        connector.points,
                        label.bounds
                    )
            )
        if (connectorLabelCollision) {
            return {
                reason: 'connector-label-collision',
                source: 'connector-label',
                sourceId: connectorLabelCollision.id,
                status: 'connector-label-collision'
            }
        }

        const connectorTraceCollision = segments.find(
            (segment) =>
                segment.netName !== sourceLabel.netName &&
                this.#segmentsCollide(connector, segment)
        )
        if (connectorTraceCollision) {
            return {
                reason: 'connector-trace-collision',
                source: 'connector-trace',
                sourceId: connectorTraceCollision.key,
                status: 'connector-trace-collision'
            }
        }

        return null
    }

    /**
     * Builds a public candidate row.
     * @param {object} data Candidate data.
     * @returns {object}
     */
    static #candidateRow(data) {
        const debug = {
            currentOrientation: data.currentOrientation,
            requiredOrientation: data.requiredOrientation,
            anchor: data.candidate.anchor,
            status: 'accepted'
        }
        if (data.candidate.searchPhase !== 'direct') {
            debug.searchPhase = data.candidate.searchPhase
        }
        return {
            kind: 'label-orientation-candidate',
            netName: data.label.netName,
            labelId: data.label.id,
            labelIndex: data.label.labelIndex,
            candidateIndex: data.candidate.candidateIndex,
            bounds: data.candidate.bounds,
            debug
        }
    }

    /**
     * Builds a public connector row.
     * @param {object} data Connector data.
     * @returns {object}
     */
    static #connectorRow(data) {
        const debug = {
            requiredOrientation: data.requiredOrientation,
            candidateIndex: data.candidate.candidateIndex,
            candidateStatus: 'accepted'
        }
        if (data.candidate.searchPhase !== 'direct') {
            debug.searchPhase = data.candidate.searchPhase
        }
        return {
            kind: 'label-orientation-connector-candidate',
            netName: data.label.netName,
            labelId: data.label.id,
            points: this.#connectorSegment(data.candidate).points,
            debug
        }
    }

    /**
     * Builds a candidate decision row for timeline normalization.
     * @param {object} data Candidate decision data.
     * @returns {object}
     */
    static #decisionRow(data) {
        return {
            kind: 'label-orientation-candidate',
            candidateKind: 'label-orientation-candidate',
            status: data.status,
            reason: data.reason,
            selected: data.status === 'accepted',
            score: data.candidate.score,
            collisionSource: data.collisionSource,
            netName: data.label.netName,
            labelId: data.label.id,
            candidateId:
                data.label.id +
                ':orientation-' +
                String(data.candidate.candidateIndex),
            candidateIndex: data.candidate.candidateIndex,
            debug: {
                currentOrientation: data.currentOrientation,
                requiredOrientation: data.requiredOrientation,
                searchPhase: data.candidate.searchPhase,
                strategy: 'sampled-label-orientation',
                candidateStatus: data.candidateStatus || data.status,
                collisionSourceId: data.collisionSourceId
            }
        }
    }

    /**
     * Builds an orthogonal connector segment for a candidate.
     * @param {object} candidate Candidate placement.
     * @returns {object}
     */
    static #connectorSegment(candidate) {
        return {
            axis:
                candidate.orientation === 'left' ||
                candidate.orientation === 'right'
                    ? 'x'
                    : 'y',
            points: [
                candidate.anchor,
                this.#connectorEndPoint(
                    candidate.bounds,
                    candidate.anchor,
                    candidate.orientation
                )
            ]
        }
    }

    /**
     * Returns whether two orthogonal segments collide.
     * @param {object} left First segment.
     * @param {object} right Second segment.
     * @returns {boolean}
     */
    static #segmentsCollide(left, right) {
        if (!left || !right) return false
        if (left.axis === right.axis) {
            return Boolean(Geometry.segmentOverlap(left, right))
        }
        const horizontal = left.axis === 'x' ? left : right
        const vertical = left.axis === 'y' ? left : right
        const [hStart, hEnd] = horizontal.points
        const [vStart, vEnd] = vertical.points
        return (
            vStart.x >= Math.min(hStart.x, hEnd.x) &&
            vStart.x <= Math.max(hStart.x, hEnd.x) &&
            hStart.y >= Math.min(vStart.y, vEnd.y) &&
            hStart.y <= Math.max(vStart.y, vEnd.y)
        )
    }

    /**
     * Returns the connector endpoint on candidate bounds.
     * @param {object} bounds Candidate bounds.
     * @param {object} anchor Anchor point.
     * @param {string} orientation Orientation.
     * @returns {object}
     */
    static #connectorEndPoint(bounds, anchor, orientation) {
        if (orientation === 'up') return { x: anchor.x, y: bounds.maxY }
        if (orientation === 'down') return { x: anchor.x, y: bounds.minY }
        if (orientation === 'left') return { x: bounds.maxX, y: anchor.y }
        return { x: bounds.minX, y: anchor.y }
    }

    /**
     * Clamps a value between unordered extents.
     * @param {number} value Value.
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
}
