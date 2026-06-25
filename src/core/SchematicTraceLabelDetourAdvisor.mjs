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
     * Builds partial snip-and-reconnect candidates for label/trace collisions.
     * @param {object[]} collisionBounds Collision bounds.
     * @param {object[]} labels Label bounds.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object[]} Snip-and-reconnect candidate segments.
     */
    static suggestSnipReconnect(collisionBounds, labels, segments) {
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
            const candidate = this.#snipReconnectPoints(
                segment,
                label.bounds
            )
            if (!candidate) return

            rows.push({
                kind: 'net-label-trace-snip-reconnect-candidate',
                netName: segment.netName,
                labelNetName: label.netName,
                labelId: label.id,
                candidateIndex: rows.length,
                points: candidate.points,
                debug: {
                    collisionIndex,
                    strategy: 'snip-and-reconnect-label-detour',
                    padding: LABEL_DETOUR_PADDING,
                    entryPoint: candidate.entryPoint,
                    exitPoint: candidate.exitPoint,
                    side: candidate.side
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
     * Builds a local detour around only the intersecting trace span.
     * @param {object} segment Orthogonal segment.
     * @param {object} labelBounds Label bounds.
     * @returns {{ points: object[], entryPoint: object, exitPoint: object, side: string } | null}
     */
    static #snipReconnectPoints(segment, labelBounds) {
        const bounds = this.#paddedBounds(labelBounds)
        const [start, end] = segment.points
        if (segment.axis === 'x') {
            return this.#horizontalSnipReconnect(start, end, bounds)
        }
        if (segment.axis === 'y') {
            return this.#verticalSnipReconnect(start, end, bounds)
        }
        return null
    }

    /**
     * Builds a local detour for a vertical segment.
     * @param {object} start Segment start.
     * @param {object} end Segment end.
     * @param {object} bounds Padded label bounds.
     * @returns {object | null}
     */
    static #verticalSnipReconnect(start, end, bounds) {
        const minY = Math.min(start.y, end.y)
        const maxY = Math.max(start.y, end.y)
        if (bounds.minY <= minY || bounds.maxY >= maxY) return null

        const ascending = end.y >= start.y
        const entryPoint = {
            x: start.x,
            y: ascending ? bounds.minY : bounds.maxY
        }
        const exitPoint = {
            x: start.x,
            y: ascending ? bounds.maxY : bounds.minY
        }
        const side = 'left'
        const detourX = bounds.minX
        return {
            points: this.#uniqueConsecutivePoints([
                start,
                entryPoint,
                { x: detourX, y: entryPoint.y },
                { x: detourX, y: exitPoint.y },
                exitPoint,
                end
            ]),
            entryPoint,
            exitPoint,
            side
        }
    }

    /**
     * Builds a local detour for a horizontal segment.
     * @param {object} start Segment start.
     * @param {object} end Segment end.
     * @param {object} bounds Padded label bounds.
     * @returns {object | null}
     */
    static #horizontalSnipReconnect(start, end, bounds) {
        const minX = Math.min(start.x, end.x)
        const maxX = Math.max(start.x, end.x)
        if (bounds.minX <= minX || bounds.maxX >= maxX) return null

        const leftToRight = end.x >= start.x
        const entryPoint = {
            x: leftToRight ? bounds.minX : bounds.maxX,
            y: start.y
        }
        const exitPoint = {
            x: leftToRight ? bounds.maxX : bounds.minX,
            y: start.y
        }
        const side = 'bottom'
        const detourY = bounds.minY
        return {
            points: this.#uniqueConsecutivePoints([
                start,
                entryPoint,
                { x: entryPoint.x, y: detourY },
                { x: exitPoint.x, y: detourY },
                exitPoint,
                end
            ]),
            entryPoint,
            exitPoint,
            side
        }
    }

    /**
     * Removes adjacent duplicate points.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #uniqueConsecutivePoints(points) {
        return points.filter(
            (point, index) =>
                index === 0 || !Geometry.samePoint(point, points[index - 1])
        )
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
