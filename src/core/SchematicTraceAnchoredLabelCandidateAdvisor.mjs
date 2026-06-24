import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const LABEL_TRACE_ANCHOR_CLEARANCE = 0.5
const MAX_TRACE_ANCHORED_CANDIDATES_PER_LABEL = 3
const MAX_TRACE_ANCHORED_REJECTIONS_PER_LABEL = 2

/**
 * Suggests label candidates anchored to the label's own trace geometry.
 */
export class SchematicTraceAnchoredLabelCandidateAdvisor {
    /**
     * Builds trace-anchored label candidates for colliding labels.
     * @param {object[]} labels Label rows.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} collisionBounds Collision rows.
     * @returns {object[]} Trace-anchored label candidate rows.
     */
    static suggest(labels, segments, obstacles, collisionBounds) {
        return this.analyze(labels, segments, obstacles, collisionBounds)
            .traceAnchoredLabelCandidateBounds
    }

    /**
     * Builds accepted and rejected trace-anchored label candidate rows.
     * @param {object[]} labels Label rows.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} collisionBounds Collision rows.
     * @returns {{ traceAnchoredLabelCandidateBounds: object[], traceAnchoredLabelRejectedCandidateBounds: object[], budget: object }}
     */
    static analyze(labels, segments, obstacles, collisionBounds) {
        const labelIds = this.#collidingLabelIds(collisionBounds)
        const labelIndex = new SchematicBoundsSpatialIndex(labels)
        const obstacleIndex = new SchematicBoundsSpatialIndex(obstacles)
        const rows = []
        const rejectedRows = []
        let generated = 0

        for (const label of labels) {
            if (!labelIds.has(label.id)) continue
            const analyzed = this.#candidatesForLabel(
                label,
                segments,
                labelIndex,
                obstacleIndex
            )
            generated += analyzed.generated
            rows.push(...analyzed.accepted)
            rejectedRows.push(...analyzed.rejected)
        }

        return {
            traceAnchoredLabelCandidateBounds: rows,
            traceAnchoredLabelRejectedCandidateBounds: rejectedRows,
            budget: {
                generated,
                accepted: rows.length,
                rejected: rejectedRows.length
            }
        }
    }

    /**
     * Collects label ids referenced by collision rows.
     * @param {object[]} collisionBounds Collision rows.
     * @returns {Set<string>}
     */
    static #collidingLabelIds(collisionBounds) {
        const ids = new Set()
        for (const collision of Array.isArray(collisionBounds)
            ? collisionBounds
            : []) {
            if (collision?.labelId) ids.add(collision.labelId)
            if (collision?.otherLabelId) ids.add(collision.otherLabelId)
        }
        return ids
    }

    /**
     * Builds trace-anchored candidates for one label.
     * @param {object} label Label row.
     * @param {object[]} segments Orthogonal net segments.
     * @param {SchematicBoundsSpatialIndex} labelIndex Label index.
     * @param {SchematicBoundsSpatialIndex} obstacleIndex Obstacle index.
     * @returns {{ accepted: object[], rejected: object[], generated: number }}
     */
    static #candidatesForLabel(label, segments, labelIndex, obstacleIndex) {
        const accepted = []
        const rejected = []
        let generated = 0
        const ownSegments = segments.filter(
            (segment) => segment.netName === label.netName
        )

        for (const anchor of this.#traceAnchors(ownSegments)) {
            for (const orientation of this.#orientationsForAnchor(
                label,
                anchor
            )) {
                const bounds = this.#boundsForAnchor(
                    label.bounds,
                    anchor.point,
                    orientation
                )
                generated += 1
                const reason = this.#candidateRejectionReason(
                    label,
                    bounds,
                    labelIndex,
                    obstacleIndex,
                    segments
                )
                if (reason) {
                    if (
                        rejected.length <
                        MAX_TRACE_ANCHORED_REJECTIONS_PER_LABEL
                    ) {
                        rejected.push({
                            kind: 'trace-anchored-net-label-rejected-candidate',
                            netName: label.netName,
                            labelId: label.id,
                            labelIndex: label.labelIndex,
                            candidateIndex: rejected.length,
                            reason,
                            bounds,
                            debug: {
                                anchor: anchor.point,
                                orientation,
                                segmentKey: anchor.segmentKey,
                                pathDistance: anchor.pathDistance
                            }
                        })
                    }
                    continue
                }
                if (accepted.length < MAX_TRACE_ANCHORED_CANDIDATES_PER_LABEL) {
                    accepted.push({
                        kind: 'trace-anchored-net-label-candidate',
                        netName: label.netName,
                        labelId: label.id,
                        labelIndex: label.labelIndex,
                        candidateIndex: accepted.length,
                        bounds,
                        debug: {
                            anchor: anchor.point,
                            orientation,
                            segmentKey: anchor.segmentKey,
                            pathDistance: anchor.pathDistance
                        }
                    })
                }
                if (
                    accepted.length >=
                        MAX_TRACE_ANCHORED_CANDIDATES_PER_LABEL &&
                    rejected.length >= MAX_TRACE_ANCHORED_REJECTIONS_PER_LABEL
                ) {
                    return { accepted, rejected, generated }
                }
            }
        }

        return { accepted, rejected, generated }
    }

    /**
     * Builds deterministic anchor points along trace segments.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {Array<{ point: object, segmentKey: string, pathDistance: number, axis: string }>}
     */
    static #traceAnchors(segments) {
        const anchors = []
        for (const segment of segments) {
            const [start, end] = segment.points
            const distance = Geometry.manhattan(start, end)
            anchors.push({
                point: start,
                segmentKey: segment.key,
                pathDistance: 0,
                axis: segment.axis
            })
            anchors.push({
                point: end,
                segmentKey: segment.key,
                pathDistance: distance,
                axis: segment.axis
            })
            anchors.push({
                point: {
                    x: (start.x + end.x) / 2,
                    y: (start.y + end.y) / 2
                },
                segmentKey: segment.key,
                pathDistance: distance / 2,
                axis: segment.axis
            })
        }
        return anchors
    }

    /**
     * Resolves orientations for an anchor, honoring source constraints.
     * @param {object} label Label row.
     * @param {object} anchor Trace anchor.
     * @returns {string[]}
     */
    static #orientationsForAnchor(label, anchor) {
        const constrained = this.#orientationConstraints(label)
        if (constrained.length) return constrained
        return anchor.axis === 'x' ? ['up', 'down'] : ['left', 'right']
    }

    /**
     * Resolves optional label orientation constraints.
     * @param {object} label Label row.
     * @returns {string[]}
     */
    static #orientationConstraints(label) {
        const source = label?.source || {}
        const values = Array.isArray(source.orientations)
            ? source.orientations
            : [source.orientation || source.facing || source.direction]
        return values
            .map((value) => this.#normalizedOrientation(value))
            .filter(Boolean)
    }

    /**
     * Normalizes a source orientation value.
     * @param {unknown} value Orientation value.
     * @returns {string}
     */
    static #normalizedOrientation(value) {
        const text = String(value || '').toLowerCase()
        return (
            {
                up: 'up',
                down: 'down',
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
     * Builds label bounds from an anchor and orientation.
     * @param {object} sourceBounds Source label bounds.
     * @param {{ x: number, y: number }} anchor Anchor point.
     * @param {string} orientation Candidate orientation.
     * @returns {object}
     */
    static #boundsForAnchor(sourceBounds, anchor, orientation) {
        const width = sourceBounds.width
        const height = sourceBounds.height
        const offsetX =
            orientation === 'left'
                ? -(width / 2 + LABEL_TRACE_ANCHOR_CLEARANCE)
                : orientation === 'right'
                  ? width / 2 + LABEL_TRACE_ANCHOR_CLEARANCE
                  : 0
        const offsetY =
            orientation === 'up'
                ? -(height / 2 + LABEL_TRACE_ANCHOR_CLEARANCE)
                : orientation === 'down'
                  ? height / 2 + LABEL_TRACE_ANCHOR_CLEARANCE
                  : 0
        return Geometry.centerBounds(
            { x: anchor.x + offsetX, y: anchor.y + offsetY },
            width,
            height
        )
    }

    /**
     * Resolves a candidate rejection reason against nearby geometry.
     * @param {object} sourceLabel Source label.
     * @param {object} bounds Candidate bounds.
     * @param {SchematicBoundsSpatialIndex} labelIndex Label index.
     * @param {SchematicBoundsSpatialIndex} obstacleIndex Obstacle index.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {string}
     */
    static #candidateRejectionReason(
        sourceLabel,
        bounds,
        labelIndex,
        obstacleIndex,
        segments
    ) {
        if (
            obstacleIndex
                .query(bounds)
                .some((obstacle) =>
                    Geometry.boundsTouchOrOverlap(bounds, obstacle.bounds)
                )
        ) {
            return 'body-collision'
        }
        if (
            labelIndex
                .query(bounds)
                .some(
                    (label) =>
                        label.id !== sourceLabel.id &&
                        Geometry.boundsTouchOrOverlap(bounds, label.bounds)
                )
        ) {
            return 'label-collision'
        }
        if (
            segments.some(
                (segment) =>
                    segment.netName !== sourceLabel.netName &&
                    Geometry.segmentIntersectsBounds(segment.points, bounds)
            )
        ) {
            return 'trace-collision'
        }
        return ''
    }
}
