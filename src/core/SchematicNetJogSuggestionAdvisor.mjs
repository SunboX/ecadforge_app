import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const JOG_OFFSETS = [-1, 1, -2, 2]

/**
 * Suggests non-mutating jog paths for cross-net overlap diagnostics.
 */
export class SchematicNetJogSuggestionAdvisor {
    /**
     * Builds jog candidate segments for overlap markers.
     * @param {object[]} overlapSegments Cross-net overlap markers.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label bounds.
     * @param {{ bodyObstacleIndex?: SchematicBoundsSpatialIndex }} [options] Advisor options.
     * @returns {object[]} Jog candidate rows.
     */
    static suggest(overlapSegments, segments, obstacles, labels, options = {}) {
        const bodyObstacleIndex =
            options.bodyObstacleIndex ||
            new SchematicBoundsSpatialIndex(obstacles)
        const labelIndex = new SchematicBoundsSpatialIndex(labels)
        const suggestions = []

        for (const [overlapIndex, overlap] of (Array.isArray(overlapSegments)
            ? overlapSegments
            : []
        ).entries()) {
            const suggestion = this.#suggestionForOverlap(
                overlap,
                overlapIndex,
                segments,
                bodyObstacleIndex,
                labelIndex
            )
            if (suggestion) suggestions.push(suggestion)
        }

        return suggestions
    }

    /**
     * Builds the first clear jog candidate for one overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {number} overlapIndex Overlap index.
     * @param {object[]} segments Orthogonal net segments.
     * @param {SchematicBoundsSpatialIndex} bodyObstacleIndex Body obstacle index.
     * @param {SchematicBoundsSpatialIndex} labelIndex Label bounds index.
     * @returns {object | null}
     */
    static #suggestionForOverlap(
        overlap,
        overlapIndex,
        segments,
        bodyObstacleIndex,
        labelIndex
    ) {
        const netNames = Array.isArray(overlap?.netNames)
            ? overlap.netNames.map((name) => String(name))
            : []
        if (netNames.length < 2 || !Array.isArray(overlap?.points)) {
            return null
        }
        const sourceSegment = this.#sourceSegmentForOverlap(
            overlap,
            netNames[0],
            segments
        )

        for (const offset of JOG_OFFSETS) {
            const points = this.#jogPoints(overlap, offset, sourceSegment)
            if (!points || this.#pathCollides(points, bodyObstacleIndex)) {
                continue
            }
            if (this.#pathCollides(points, labelIndex)) continue

            return {
                kind: 'cross-net-overlap-jog-candidate',
                netName: netNames[0],
                otherNetName: netNames[1],
                axis: overlap.axis,
                points,
                debug: {
                    overlapIndex,
                    offset,
                    endpointPreserving: Boolean(sourceSegment),
                    ...(sourceSegment
                        ? { preservedEndpoints: sourceSegment.points }
                        : {})
                }
            }
        }

        return null
    }

    /**
     * Builds a jog path displaced perpendicular to an overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {number} offset Perpendicular jog offset.
     * @param {object | null} sourceSegment Source segment containing overlap.
     * @returns {Array<{ x: number, y: number }> | null}
     */
    static #jogPoints(overlap, offset, sourceSegment = null) {
        const [start, end] = overlap.points
        if (!start || !end) return null
        if (sourceSegment) {
            return this.#endpointPreservingJogPoints(
                sourceSegment,
                overlap,
                offset
            )
        }
        if (overlap.axis === 'x') {
            return [
                start,
                { x: start.x, y: start.y + offset },
                { x: end.x, y: end.y + offset },
                end
            ]
        }
        if (overlap.axis === 'y') {
            return [
                start,
                { x: start.x + offset, y: start.y },
                { x: end.x + offset, y: end.y },
                end
            ]
        }
        return null
    }

    /**
     * Finds the source segment for the first net in an overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {string} netName Net name to move.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object | null}
     */
    static #sourceSegmentForOverlap(overlap, netName, segments) {
        return (
            (Array.isArray(segments) ? segments : []).find((segment) => {
                if (
                    segment.netName !== netName ||
                    segment.axis !== overlap.axis
                ) {
                    return false
                }
                const segmentOverlap = Geometry.segmentOverlap(segment, {
                    axis: overlap.axis,
                    points: overlap.points
                })
                return (
                    segmentOverlap &&
                    Geometry.samePoint(
                        segmentOverlap.points[0],
                        overlap.points[0]
                    ) &&
                    Geometry.samePoint(
                        segmentOverlap.points[1],
                        overlap.points[1]
                    )
                )
            }) || null
        )
    }

    /**
     * Builds a jog that preserves the original segment endpoints.
     * @param {object} segment Source segment.
     * @param {object} overlap Overlap row.
     * @param {number} offset Perpendicular jog offset.
     * @returns {object[]}
     */
    static #endpointPreservingJogPoints(segment, overlap, offset) {
        const [segmentStart, segmentEnd] = segment.points
        const [overlapStart, overlapEnd] = this.#orderedOverlapPoints(
            segment,
            overlap
        )
        const shiftedStart =
            overlap.axis === 'x'
                ? { x: overlapStart.x, y: overlapStart.y + offset }
                : { x: overlapStart.x + offset, y: overlapStart.y }
        const shiftedEnd =
            overlap.axis === 'x'
                ? { x: overlapEnd.x, y: overlapEnd.y + offset }
                : { x: overlapEnd.x + offset, y: overlapEnd.y }
        return this.#withoutConsecutiveDuplicates([
            segmentStart,
            overlapStart,
            shiftedStart,
            shiftedEnd,
            overlapEnd,
            segmentEnd
        ])
    }

    /**
     * Returns overlap points in the source segment direction.
     * @param {object} segment Source segment.
     * @param {object} overlap Overlap row.
     * @returns {object[]}
     */
    static #orderedOverlapPoints(segment, overlap) {
        const [start, end] = segment.points
        const [left, right] = overlap.points
        if (overlap.axis === 'x') {
            return start.x <= end.x ? [left, right] : [right, left]
        }
        return start.y <= end.y ? [left, right] : [right, left]
    }

    /**
     * Removes adjacent duplicate points from a path.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #withoutConsecutiveDuplicates(points) {
        return points.filter(
            (point, index) =>
                index === 0 || !Geometry.samePoint(point, points[index - 1])
        )
    }

    /**
     * Returns whether any jog part intersects indexed bounds.
     * @param {Array<{ x: number, y: number }>} points Jog points.
     * @param {SchematicBoundsSpatialIndex} index Bounds index.
     * @returns {boolean}
     */
    static #pathCollides(points, index) {
        for (const part of this.#pathParts(points)) {
            const bounds = Geometry.boundsForPoints(part.points)
            const candidates = index.query(bounds)
            if (
                candidates.some((candidate) =>
                    Geometry.segmentIntersectsBounds(
                        part.points,
                        candidate.bounds
                    )
                )
            ) {
                return true
            }
        }
        return false
    }

    /**
     * Splits a point list into two-point path parts.
     * @param {Array<{ x: number, y: number }>} points Jog points.
     * @returns {Array<{ points: Array<{ x: number, y: number }> }>}
     */
    static #pathParts(points) {
        const parts = []
        for (let index = 0; index < points.length - 1; index++) {
            if (Geometry.samePoint(points[index], points[index + 1])) continue
            parts.push({ points: [points[index], points[index + 1]] })
        }
        return parts
    }
}
