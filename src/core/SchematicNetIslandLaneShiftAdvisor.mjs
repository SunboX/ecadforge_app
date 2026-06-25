import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const LANE_SHIFT_OFFSETS = [-1, 1, -2, 2]
const OBSTACLE_AWARE_CLEARANCE = 0.2

/**
 * Suggests read-only lane shifts for overlapping connected net islands.
 */
export class SchematicNetIslandLaneShiftAdvisor {
    /**
     * Builds lane-shift candidates for cross-net overlap markers.
     * @param {object[]} overlapSegments Cross-net overlap markers.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label bounds.
     * @returns {{ netIslandLaneShiftSegments: object[], candidateDecisions: object[], budget: object }}
     */
    static analyze(overlapSegments, segments, obstacles, labels) {
        const rows = []
        const candidateDecisions = []
        let generated = 0
        const boundsIndex = new SchematicBoundsSpatialIndex(
            this.#indexedBounds(obstacles, labels)
        )

        for (const [overlapIndex, overlap] of (Array.isArray(overlapSegments)
            ? overlapSegments
            : []
        ).entries()) {
            const candidate = this.#candidateForOverlap(
                overlap,
                overlapIndex,
                segments,
                boundsIndex
            )
            generated += candidate.generated
            rows.push(...candidate.rows)
            candidateDecisions.push(...candidate.candidateDecisions)
        }

        return {
            netIslandLaneShiftSegments: rows,
            candidateDecisions,
            budget: {
                generated,
                accepted: rows.length,
                rejected: Math.max(generated - rows.length, 0)
            }
        }
    }

    /**
     * Builds the first clear lane shift for one overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {number} overlapIndex Overlap row index.
     * @param {object[]} segments Orthogonal net segments.
     * @param {SchematicBoundsSpatialIndex} boundsIndex Indexed body and label bounds.
     * @returns {{ rows: object[], candidateDecisions: object[], generated: number }}
     */
    static #candidateForOverlap(overlap, overlapIndex, segments, boundsIndex) {
        const netNames = Array.isArray(overlap?.netNames)
            ? overlap.netNames.map((name) => String(name))
            : []
        if (netNames.length < 2) {
            return { rows: [], candidateDecisions: [], generated: 0 }
        }

        const sourceSegment = this.#sourceSegmentForOverlap(
            overlap,
            netNames[0],
            segments
        )
        if (!sourceSegment) {
            return { rows: [], candidateDecisions: [], generated: 0 }
        }

        const island = this.#islandContaining(sourceSegment, segments)
        if (!island) return { rows: [], candidateDecisions: [], generated: 0 }

        let generated = 0
        let candidateIndex = 0
        const candidateDecisions = []
        const usedOffsets = new Set()
        for (const offset of LANE_SHIFT_OFFSETS) {
            const result = this.#evaluateOffset({
                offset,
                candidateIndex,
                overlap,
                overlapIndex,
                segments,
                boundsIndex,
                sourceSegment,
                otherNetName: netNames[1],
                island,
                strategy: 'fixed-offset',
                obstacleAware: false
            })
            usedOffsets.add(this.#offsetKey(offset))
            generated += island.segments.length
            candidateIndex += 1
            if (!result.collision) {
                return {
                    generated,
                    rows: result.rows,
                    candidateDecisions: [result.decision]
                }
            }

            candidateDecisions.push(result.decision)
            for (const obstacleAwareOffset of this.#obstacleAwareOffsets(
                result.collision,
                offset,
                overlap.axis
            )) {
                const key = this.#offsetKey(obstacleAwareOffset)
                if (usedOffsets.has(key)) continue
                usedOffsets.add(key)
                const obstacleAwareResult = this.#evaluateOffset({
                    offset: obstacleAwareOffset,
                    candidateIndex,
                    overlap,
                    overlapIndex,
                    segments,
                    boundsIndex,
                    sourceSegment,
                    otherNetName: netNames[1],
                    island,
                    strategy: 'obstacle-aware-offset',
                    obstacleAware: true
                })
                generated += island.segments.length
                candidateIndex += 1
                if (!obstacleAwareResult.collision) {
                    return {
                        generated,
                        rows: obstacleAwareResult.rows,
                        candidateDecisions: [
                            ...candidateDecisions,
                            obstacleAwareResult.decision
                        ]
                    }
                }
                candidateDecisions.push(obstacleAwareResult.decision)
            }
        }

        return { rows: [], candidateDecisions, generated }
    }

    /**
     * Evaluates one lane-shift offset.
     * @param {object} data Offset evaluation data.
     * @returns {{ rows: object[], decision: object, collision: object | null }}
     */
    static #evaluateOffset(data) {
        const shifted = this.#shiftedSegments(
            data.island,
            data.overlap.axis,
            data.offset
        )
        const collision = this.#candidateCollisionDetails(
            shifted,
            data.boundsIndex,
            data.segments
        )
        if (collision) {
            return {
                rows: [],
                decision: this.#decisionRow({
                    ...data,
                    status: 'rejected',
                    reason: collision.reason,
                    collisionSource: collision.collisionSource,
                    collisionSourceId: collision.collisionSourceId
                }),
                collision
            }
        }

        return {
            rows: shifted.map((segment) =>
                this.#candidateRow({
                    segment,
                    overlap: data.overlap,
                    overlapIndex: data.overlapIndex,
                    otherNetName: data.otherNetName,
                    island: data.island,
                    offset: data.offset,
                    candidateIndex: data.candidateIndex,
                    strategy: data.strategy,
                    obstacleAware: data.obstacleAware
                })
            ),
            decision: this.#decisionRow({
                ...data,
                status: 'accepted',
                reason: '',
                collisionSource: 'cross-net-overlap',
                collisionSourceId: ''
            }),
            collision: null
        }
    }

    /**
     * Builds indexed body and label bounds with source metadata.
     * @param {object[]} obstacles Body obstacles.
     * @param {object[]} labels Label bounds.
     * @returns {object[]}
     */
    static #indexedBounds(obstacles, labels) {
        return [
            ...(Array.isArray(obstacles) ? obstacles : []).map((obstacle) => ({
                ...obstacle,
                diagnosticSource: 'obstacle'
            })),
            ...(Array.isArray(labels) ? labels : []).map((label) => ({
                ...label,
                diagnosticSource: 'label'
            }))
        ]
    }

    /**
     * Builds obstacle-aware offsets from the blocking obstacle edge.
     * @param {object} collision Collision details.
     * @param {number} currentOffset Current fixed offset.
     * @param {'x' | 'y'} overlapAxis Overlap axis.
     * @returns {number[]}
     */
    static #obstacleAwareOffsets(collision, currentOffset, overlapAxis) {
        if (collision.collisionSource !== 'obstacle') return []
        const bounds = collision.bounds
        if (!bounds) return []

        if (overlapAxis === 'x') {
            const originalY =
                collision.shiftedSegment.points[0].y - currentOffset
            return [
                this.#stableOffset(
                    bounds.minY - originalY - OBSTACLE_AWARE_CLEARANCE
                ),
                this.#stableOffset(
                    bounds.maxY - originalY + OBSTACLE_AWARE_CLEARANCE
                )
            ]
        }

        const originalX = collision.shiftedSegment.points[0].x - currentOffset
        return [
            this.#stableOffset(
                bounds.minX - originalX - OBSTACLE_AWARE_CLEARANCE
            ),
            this.#stableOffset(
                bounds.maxX - originalX + OBSTACLE_AWARE_CLEARANCE
            )
        ]
    }

    /**
     * Builds a stable key for a numeric offset.
     * @param {number} offset Lane offset.
     * @returns {string}
     */
    static #offsetKey(offset) {
        return String(Number(offset).toFixed(6))
    }

    /**
     * Rounds an offset for deterministic public output.
     * @param {number} offset Lane offset.
     * @returns {number}
     */
    static #stableOffset(offset) {
        return Number(offset.toFixed(6))
    }

    /**
     * Returns the first candidate collision details, if any.
     * @param {object[]} shiftedSegments Shifted segment rows.
     * @param {SchematicBoundsSpatialIndex} boundsIndex Indexed body and label bounds.
     * @param {object[]} sourceSegments Original net segments.
     * @returns {object | null}
     */
    static #candidateCollisionDetails(
        shiftedSegments,
        boundsIndex,
        sourceSegments
    ) {
        for (const segment of shiftedSegments) {
            const boundsHit = this.#segmentBoundsHitDetails(
                segment,
                boundsIndex
            )
            if (boundsHit) return boundsHit
        }

        for (const segment of shiftedSegments) {
            const overlap = this.#segmentOverlapDetails(segment, sourceSegments)
            if (overlap) return overlap
        }

        return null
    }

    /**
     * Returns details for the first indexed bounds hit.
     * @param {object} segment Shifted segment.
     * @param {SchematicBoundsSpatialIndex} boundsIndex Indexed body and label bounds.
     * @returns {object | null}
     */
    static #segmentBoundsHitDetails(segment, boundsIndex) {
        const bounds = Geometry.boundsForPoints(segment.points)
        const item = boundsIndex
            .query(bounds)
            .find((entry) =>
                Geometry.segmentIntersectsBounds(segment.points, entry.bounds)
            )
        if (!item) return null

        const collisionSource = item.diagnosticSource || 'obstacle'
        return {
            reason:
                collisionSource === 'label'
                    ? 'label-collision'
                    : 'body-collision',
            collisionSource,
            collisionSourceId: item.id || '',
            bounds: item.bounds,
            shiftedSegment: segment
        }
    }

    /**
     * Returns details for the first overlap against a non-candidate segment.
     * @param {object} shiftedSegment Shifted segment.
     * @param {object[]} sourceSegments Original net segments.
     * @returns {object | null}
     */
    static #segmentOverlapDetails(shiftedSegment, sourceSegments) {
        const segment = (
            Array.isArray(sourceSegments) ? sourceSegments : []
        ).find(
            (entry) =>
                entry.key !== shiftedSegment.key &&
                Boolean(Geometry.segmentOverlap(shiftedSegment, entry))
        )
        return segment
            ? {
                  reason: 'trace-overlap',
                  collisionSource: 'trace',
                  collisionSourceId: segment.key,
                  shiftedSegment
              }
            : null
    }

    /**
     * Builds a candidate decision row for timeline normalization.
     * @param {object} data Decision data.
     * @returns {object}
     */
    static #decisionRow(data) {
        return {
            kind: 'net-island-lane-shift-candidate',
            candidateKind: 'net-island-lane-shift-candidate',
            status: data.status,
            reason: data.reason,
            selected: data.status === 'accepted',
            score: Math.abs(data.offset),
            collisionSource: data.collisionSource,
            netName: data.sourceSegment.netName,
            segmentKey: data.sourceSegment.key,
            candidateId:
                data.island.id + ':lane-shift-' + String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            debug: {
                overlapIndex: data.overlapIndex,
                islandId: data.island.id,
                offset: data.offset,
                axis: data.overlap.axis,
                strategy: data.strategy,
                collisionSourceId: data.collisionSourceId || ''
            }
        }
    }

    /**
     * Finds the source segment containing one overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {string} netName Moving net name.
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
     * Finds the connected same-net island containing a source segment.
     * @param {object} sourceSegment Source segment.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {{ id: string, segments: object[] } | null}
     */
    static #islandContaining(sourceSegment, segments) {
        const islands = this.#islandsForNet(
            sourceSegment.netName,
            Array.isArray(segments) ? segments : []
        )
        return (
            islands.find((island) =>
                island.segments.some(
                    (segment) => segment.key === sourceSegment.key
                )
            ) || null
        )
    }

    /**
     * Groups same-net segments into connected islands.
     * @param {string} netName Net name.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {Array<{ id: string, segments: object[] }>}
     */
    static #islandsForNet(netName, segments) {
        const rows = segments.filter((segment) => segment.netName === netName)
        if (!rows.length) return []

        const parent = new Map()
        const find = (key) => {
            if (!parent.has(key)) parent.set(key, key)
            const current = parent.get(key)
            if (current === key) return key
            const root = find(current)
            parent.set(key, root)
            return root
        }
        const union = (left, right) => parent.set(find(left), find(right))

        for (const segment of rows) {
            union(
                Geometry.pointKey(segment.points[0]),
                Geometry.pointKey(segment.points[1])
            )
        }

        const grouped = new Map()
        for (const segment of rows) {
            const root = find(Geometry.pointKey(segment.points[0]))
            if (!grouped.has(root)) grouped.set(root, [])
            grouped.get(root).push(segment)
        }

        return [...grouped.values()].map((items, index) => ({
            id: String(netName) + ':island-' + String(index + 1),
            segments: items
        }))
    }

    /**
     * Shifts every segment in an island perpendicular to an overlap.
     * @param {{ segments: object[] }} island Connected island.
     * @param {'x' | 'y'} overlapAxis Overlap axis.
     * @param {number} offset Lane offset.
     * @returns {object[]}
     */
    static #shiftedSegments(island, overlapAxis, offset) {
        return island.segments.map((segment) => ({
            ...segment,
            points: segment.points.map((point) =>
                this.#shiftedPoint(point, overlapAxis, offset)
            )
        }))
    }

    /**
     * Shifts one point perpendicular to an overlap.
     * @param {{ x: number, y: number }} point Source point.
     * @param {'x' | 'y'} overlapAxis Overlap axis.
     * @param {number} offset Lane offset.
     * @returns {{ x: number, y: number }}
     */
    static #shiftedPoint(point, overlapAxis, offset) {
        return overlapAxis === 'x'
            ? { x: point.x, y: point.y + offset }
            : { x: point.x + offset, y: point.y }
    }

    /**
     * Builds a public lane-shift row.
     * @param {object} data Candidate row data.
     * @returns {object}
     */
    static #candidateRow(data) {
        const debug = {
            overlapIndex: data.overlapIndex,
            islandId: data.island.id,
            offset: data.offset,
            axis: data.overlap.axis,
            status: 'accepted'
        }
        if (data.obstacleAware) {
            debug.strategy = data.strategy
            debug.obstacleAware = true
            debug.score = Math.abs(data.offset)
        }

        return {
            kind: 'net-island-lane-shift-candidate',
            netName: data.segment.netName,
            otherNetName: data.otherNetName,
            candidateId:
                data.island.id + ':lane-shift-' + String(data.candidateIndex),
            segmentKey: data.segment.key,
            points: data.segment.points,
            debug
        }
    }
}
