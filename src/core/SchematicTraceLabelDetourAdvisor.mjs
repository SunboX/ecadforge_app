import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const LABEL_DETOUR_PADDING = 0.5

/**
 * Suggests non-mutating trace detours around label collisions.
 */
export class SchematicTraceLabelDetourAdvisor {
    /**
     * Builds detour candidates for label/trace collisions.
     * @param {object[]} collisionBounds Collision bounds.
     * @param {object[]} labels Label bounds.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object[]} Detour candidate segments.
     */
    static suggest(collisionBounds, labels, segments) {
        const rows = []
        const labelsById = new Map(labels.map((label) => [label.id, label]))
        const traceCollisions = (
            Array.isArray(collisionBounds) ? collisionBounds : []
        ).filter((collision) => collision?.kind === 'net-label-trace-overlap')

        traceCollisions.forEach((collision, collisionIndex) => {
            const label = labelsById.get(collision.labelId)
            if (!label) return
            const segment = this.#collidingSegment(label, collision, segments)
            if (!segment) return
            const points = this.#detourPoints(segment, label.bounds)
            if (!points) return

            rows.push({
                kind: 'net-label-trace-detour-candidate',
                netName: segment.netName,
                labelNetName: label.netName,
                labelId: label.id,
                points,
                debug: {
                    collisionIndex,
                    strategy: 'four-point-detour',
                    padding: LABEL_DETOUR_PADDING
                }
            })
        })

        return rows
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
            segments.find(
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
     * Builds a four-point detour around label bounds.
     * @param {object} segment Orthogonal segment.
     * @param {object} labelBounds Label bounds.
     * @returns {Array<{ x: number, y: number }> | null}
     */
    static #detourPoints(segment, labelBounds) {
        const bounds = this.#paddedBounds(labelBounds)
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
            bounds.minX - LABEL_DETOUR_PADDING,
            bounds.minY - LABEL_DETOUR_PADDING,
            bounds.maxX + LABEL_DETOUR_PADDING,
            bounds.maxY + LABEL_DETOUR_PADDING
        )
    }
}
