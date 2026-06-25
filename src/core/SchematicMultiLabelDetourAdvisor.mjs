import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const MULTI_LABEL_DETOUR_PADDING = 0.5

/**
 * Suggests read-only detours around touching label groups that sit on a trace.
 */
export class SchematicMultiLabelDetourAdvisor {
    /**
     * Builds merged-label detour candidates for label/trace collisions.
     * @param {object[]} collisionBounds Collision bounds.
     * @param {object[]} labels Label bounds.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {{ multiLabelTraceDetourSegments: object[], budget: object }}
     */
    static analyze(collisionBounds, labels, segments) {
        const rows = []
        const seen = new Set()
        const labelsById = new Map(
            (Array.isArray(labels) ? labels : []).map((label) => [
                label.id,
                label
            ])
        )
        const traceCollisions = (
            Array.isArray(collisionBounds) ? collisionBounds : []
        ).filter((collision) => collision?.kind === 'net-label-trace-overlap')

        traceCollisions.forEach((collision, collisionIndex) => {
            const label = labelsById.get(collision.labelId)
            if (!label) return
            const segment = this.#collidingSegment(label, collision, segments)
            if (!segment) return
            const group = this.#touchingTraceLabels(label, segment, labels)
            if (group.length < 2) return

            const key = this.#candidateKey(segment, group)
            if (seen.has(key)) return
            seen.add(key)

            const mergedBounds = this.#mergedBounds(group)
            const points = this.#detourPoints(segment, mergedBounds)
            if (!points) return

            rows.push({
                kind: 'multi-label-trace-detour-candidate',
                netName: segment.netName,
                labelNetNames: group.map((entry) => entry.netName),
                labelIds: group.map((entry) => entry.id),
                candidateIndex: rows.length,
                points,
                debug: {
                    collisionIndex,
                    strategy: 'merged-label-four-point-detour',
                    padding: MULTI_LABEL_DETOUR_PADDING,
                    mergedBounds,
                    status: 'accepted'
                }
            })
        })

        return {
            multiLabelTraceDetourSegments: rows,
            budget: this.#acceptedOnly(rows)
        }
    }

    /**
     * Finds the trace segment represented by one collision.
     * @param {object} label Label row.
     * @param {object} collision Collision row.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object | null}
     */
    static #collidingSegment(label, collision, segments) {
        return (
            (Array.isArray(segments) ? segments : []).find(
                (segment) =>
                    segment.netName === collision.otherNetName &&
                    Geometry.segmentIntersectsBounds(
                        segment.points,
                        label.bounds
                    )
            ) || null
        )
    }

    /**
     * Resolves labels that touch each other and the same trace segment.
     * @param {object} seedLabel Initial colliding label.
     * @param {object} segment Trace segment.
     * @param {object[]} labels All label rows.
     * @returns {object[]}
     */
    static #touchingTraceLabels(seedLabel, segment, labels) {
        const group = new Map([[seedLabel.id, seedLabel]])
        let changed = true
        while (changed) {
            changed = false
            for (const label of Array.isArray(labels) ? labels : []) {
                if (group.has(label.id)) continue
                if (label.netName === segment.netName) continue
                if (
                    !Geometry.segmentIntersectsBounds(
                        segment.points,
                        label.bounds
                    )
                ) {
                    continue
                }
                const touchesGroup = [...group.values()].some((entry) =>
                    Geometry.boundsTouchOrOverlap(entry.bounds, label.bounds)
                )
                if (!touchesGroup) continue
                group.set(label.id, label)
                changed = true
            }
        }

        return [...group.values()].sort((left, right) =>
            left.id.localeCompare(right.id)
        )
    }

    /**
     * Merges label bounds.
     * @param {object[]} labels Label rows.
     * @returns {object}
     */
    static #mergedBounds(labels) {
        return labels.reduce(
            (bounds, label) =>
                bounds
                    ? Geometry.bounds(
                          Math.min(bounds.minX, label.bounds.minX),
                          Math.min(bounds.minY, label.bounds.minY),
                          Math.max(bounds.maxX, label.bounds.maxX),
                          Math.max(bounds.maxY, label.bounds.maxY)
                      )
                    : label.bounds,
            null
        )
    }

    /**
     * Builds a four-point detour around merged bounds.
     * @param {object} segment Orthogonal segment.
     * @param {object} mergedBounds Merged label bounds.
     * @returns {Array<{ x: number, y: number }> | null}
     */
    static #detourPoints(segment, mergedBounds) {
        const bounds = this.#paddedBounds(mergedBounds)
        const [start, end] = segment.points
        if (segment.axis === 'x') {
            const y = bounds.minY
            return [start, { x: start.x, y }, { x: end.x, y }, end]
        }
        if (segment.axis === 'y') {
            const x = bounds.minX
            return [start, { x, y: start.y }, { x, y: end.y }, end]
        }
        return null
    }

    /**
     * Pads bounds by the detour clearance.
     * @param {object} bounds Source bounds.
     * @returns {object}
     */
    static #paddedBounds(bounds) {
        return Geometry.bounds(
            bounds.minX - MULTI_LABEL_DETOUR_PADDING,
            bounds.minY - MULTI_LABEL_DETOUR_PADDING,
            bounds.maxX + MULTI_LABEL_DETOUR_PADDING,
            bounds.maxY + MULTI_LABEL_DETOUR_PADDING
        )
    }

    /**
     * Builds a stable dedupe key for one candidate.
     * @param {object} segment Trace segment.
     * @param {object[]} labels Label group.
     * @returns {string}
     */
    static #candidateKey(segment, labels) {
        return segment.key + '|' + labels.map((label) => label.id).join('|')
    }

    /**
     * Builds a generated-equals-accepted budget.
     * @param {object[]} rows Accepted rows.
     * @returns {{ generated: number, accepted: number, rejected: number }}
     */
    static #acceptedOnly(rows) {
        return {
            generated: rows.length,
            accepted: rows.length,
            rejected: 0
        }
    }
}
