import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const SEGMENT_SHIFT_OFFSETS = [-0.5, 0.5, -1, 1]

/**
 * Suggests path-local shifts for cross-net overlaps on multi-part traces.
 */
export class SchematicSegmentOverlapShiftAdvisor {
    /**
     * Builds segment-level overlap shift candidates.
     * @param {object[]} overlapSegments Cross-net overlap markers.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label bounds.
     * @returns {{ segmentOverlapShiftSegments: object[], candidateDecisions: object[], budget: object }}
     */
    static analyze(overlapSegments, segments, obstacles, labels) {
        const rows = []
        const candidateDecisions = []
        let generated = 0
        const groups = this.#segmentGroups(segments)
        const blockers = this.#blockerBounds(obstacles, labels)

        for (const [overlapIndex, overlap] of (Array.isArray(overlapSegments)
            ? overlapSegments
            : []
        ).entries()) {
            const result = this.#candidateForOverlap(
                overlap,
                overlapIndex,
                groups,
                blockers
            )
            generated += result.generated
            rows.push(...result.rows)
            candidateDecisions.push(...result.candidateDecisions)
        }

        return {
            segmentOverlapShiftSegments: rows,
            candidateDecisions,
            budget: {
                generated,
                accepted: rows.length,
                rejected: Math.max(generated - rows.length, 0)
            }
        }
    }

    /**
     * Builds the first clear candidate for one overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {number} overlapIndex Overlap index.
     * @param {object[]} groups Original segment-row groups.
     * @param {object[]} blockers Body and label blockers.
     * @returns {{ rows: object[], candidateDecisions: object[], generated: number }}
     */
    static #candidateForOverlap(overlap, overlapIndex, groups, blockers) {
        const pair = this.#movingPair(overlap, groups)
        if (!pair) return { rows: [], candidateDecisions: [], generated: 0 }

        const candidateDecisions = []
        for (const [
            candidateIndex,
            offset
        ] of SEGMENT_SHIFT_OFFSETS.entries()) {
            const points = this.#shiftedPath(
                pair.moving.group,
                pair.moving.partIndex,
                overlap.axis,
                offset
            )
            const collision = this.#candidateCollision(points, blockers)
            const decision = this.#decisionRow({
                pair,
                overlap,
                overlapIndex,
                candidateIndex,
                offset,
                points,
                collision
            })
            candidateDecisions.push(decision)
            if (collision) continue

            return {
                rows: [
                    this.#candidateRow({
                        pair,
                        overlapIndex,
                        candidateIndex,
                        offset,
                        points
                    })
                ],
                candidateDecisions,
                generated: candidateIndex + 1
            }
        }

        return {
            rows: [],
            candidateDecisions,
            generated: SEGMENT_SHIFT_OFFSETS.length
        }
    }

    /**
     * Resolves the movable multi-part trace and stationary trace for an overlap.
     * @param {object} overlap Cross-net overlap row.
     * @param {object[]} groups Original segment-row groups.
     * @returns {{ moving: object, stationary: object } | null}
     */
    static #movingPair(overlap, groups) {
        const netNames = Array.isArray(overlap?.netNames)
            ? overlap.netNames.map((name) => String(name))
            : []
        if (netNames.length < 2) return null

        const matches = netNames
            .map((netName) => this.#overlapGroup(netName, overlap, groups))
            .filter(Boolean)
        if (matches.length < 2) return null

        const moving =
            matches.find((match) => match.group.parts.length > 1) || null
        if (!moving) return null

        const stationary =
            matches.find((match) => match.group.key !== moving.group.key) ||
            null
        if (!stationary) return null

        return { moving, stationary }
    }

    /**
     * Finds the segment-row group and part containing an overlap.
     * @param {string} netName Net name.
     * @param {object} overlap Cross-net overlap row.
     * @param {object[]} groups Original segment-row groups.
     * @returns {{ group: object, partIndex: number } | null}
     */
    static #overlapGroup(netName, overlap, groups) {
        for (const group of groups) {
            if (group.netName !== netName) continue
            const partIndex = group.parts.findIndex((part) =>
                this.#sameOverlap(part, overlap)
            )
            if (partIndex !== -1) return { group, partIndex }
        }
        return null
    }

    /**
     * Returns whether a segment part exactly contains the overlap marker.
     * @param {object} part Segment part.
     * @param {object} overlap Overlap row.
     * @returns {boolean}
     */
    static #sameOverlap(part, overlap) {
        if (part.axis !== overlap?.axis) return false
        const segmentOverlap = Geometry.segmentOverlap(part, {
            axis: overlap.axis,
            points: overlap.points
        })
        return Boolean(
            segmentOverlap &&
            Geometry.samePoint(segmentOverlap.points[0], overlap.points[0]) &&
            Geometry.samePoint(segmentOverlap.points[1], overlap.points[1])
        )
    }

    /**
     * Groups orthogonal parts by original segment row.
     * @param {object[]} segments Orthogonal net segment parts.
     * @returns {object[]}
     */
    static #segmentGroups(segments) {
        const grouped = new Map()
        for (const segment of Array.isArray(segments) ? segments : []) {
            const key = segment.netName + ':' + String(segment.segmentIndex)
            if (!grouped.has(key)) {
                grouped.set(key, {
                    key,
                    netName: segment.netName,
                    segmentIndex: segment.segmentIndex,
                    parts: []
                })
            }
            grouped.get(key).parts.push(segment)
        }

        return [...grouped.values()].map((group) => {
            const parts = group.parts.sort(
                (left, right) => left.partIndex - right.partIndex
            )
            return {
                ...group,
                parts,
                points: this.#pointsForParts(parts)
            }
        })
    }

    /**
     * Rebuilds the original point path from sorted segment parts.
     * @param {object[]} parts Sorted orthogonal parts.
     * @returns {object[]}
     */
    static #pointsForParts(parts) {
        if (!parts.length) return []
        return [parts[0].points[0], ...parts.map((part) => part.points[1])]
    }

    /**
     * Builds indexed body and label blocker bounds.
     * @param {object[]} obstacles Body obstacles.
     * @param {object[]} labels Label bounds.
     * @returns {object[]}
     */
    static #blockerBounds(obstacles, labels) {
        return [
            ...(Array.isArray(obstacles) ? obstacles : []),
            ...(Array.isArray(labels) ? labels : [])
        ]
    }

    /**
     * Builds a shifted path for one overlapped part.
     * @param {object} group Original segment-row group.
     * @param {number} partIndex Overlapped part index.
     * @param {'x' | 'y'} axis Overlap axis.
     * @param {number} offset Perpendicular offset.
     * @returns {object[]}
     */
    static #shiftedPath(group, partIndex, axis, offset) {
        const points = group.points
        const start = points[partIndex]
        const end = points[partIndex + 1]
        const shiftedStart = this.#shiftedPoint(start, axis, offset)
        const shiftedEnd = this.#shiftedPoint(end, axis, offset)
        const lastPartIndex = points.length - 2

        if (partIndex === 0) {
            return this.#withoutConsecutiveDuplicates([
                start,
                shiftedStart,
                shiftedEnd,
                ...points.slice(2)
            ])
        }

        if (partIndex === lastPartIndex) {
            return this.#withoutConsecutiveDuplicates([
                ...points.slice(0, partIndex),
                shiftedStart,
                shiftedEnd,
                end
            ])
        }

        return this.#withoutConsecutiveDuplicates([
            ...points.slice(0, partIndex),
            shiftedStart,
            shiftedEnd,
            ...points.slice(partIndex + 2)
        ])
    }

    /**
     * Shifts one point perpendicular to an overlap.
     * @param {object} point Source point.
     * @param {'x' | 'y'} axis Overlap axis.
     * @param {number} offset Perpendicular offset.
     * @returns {object}
     */
    static #shiftedPoint(point, axis, offset) {
        return axis === 'x'
            ? { x: point.x, y: point.y + offset }
            : { x: point.x + offset, y: point.y }
    }

    /**
     * Returns the first collision for a shifted path.
     * @param {object[]} points Candidate path points.
     * @param {object[]} blockers Body and label blockers.
     * @returns {{ reason: string, collisionSource: string, collisionSourceId: string } | null}
     */
    static #candidateCollision(points, blockers) {
        for (const part of this.#pathParts(points)) {
            if (!part.axis) {
                return {
                    reason: 'non-orthogonal-path',
                    collisionSource: 'path-shape',
                    collisionSourceId: ''
                }
            }
            for (const blocker of blockers) {
                if (
                    !Geometry.segmentIntersectsBounds(
                        part.points,
                        blocker.bounds
                    )
                ) {
                    continue
                }
                return {
                    reason:
                        blocker.kind === 'component'
                            ? 'body-collision'
                            : 'label-collision',
                    collisionSource:
                        blocker.kind === 'component' ? 'obstacle' : 'label',
                    collisionSourceId: blocker.id || ''
                }
            }
        }
        return null
    }

    /**
     * Splits a point path into orthogonal parts.
     * @param {object[]} points Candidate path points.
     * @returns {Array<{ points: object[], axis: string }>}
     */
    static #pathParts(points) {
        const parts = []
        for (let index = 0; index < points.length - 1; index++) {
            if (Geometry.samePoint(points[index], points[index + 1])) continue
            parts.push({
                points: [points[index], points[index + 1]],
                axis: Geometry.segmentAxis(points[index], points[index + 1])
            })
        }
        return parts
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
     * Builds a public shift candidate row.
     * @param {object} data Candidate row data.
     * @returns {object}
     */
    static #candidateRow(data) {
        const group = data.pair.moving.group
        return {
            kind: 'segment-overlap-shift-candidate',
            netName: group.netName,
            segmentKey: group.key,
            candidateId:
                group.key +
                ':segment-overlap-shift-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            points: data.points,
            debug: {
                overlapIndex: data.overlapIndex,
                shiftedPartIndex: data.pair.moving.partIndex,
                offset: data.offset,
                strategy: this.#strategyForPart(data.pair.moving),
                keptStraightTraceNetName: data.pair.stationary.group.netName,
                status: 'accepted'
            }
        }
    }

    /**
     * Builds one candidate decision row.
     * @param {object} data Candidate decision data.
     * @returns {object}
     */
    static #decisionRow(data) {
        const group = data.pair.moving.group
        return {
            kind: 'segment-overlap-shift-candidate',
            candidateKind: 'segment-overlap-shift-candidate',
            status: data.collision ? 'rejected' : 'accepted',
            reason: data.collision?.reason || '',
            selected: !data.collision,
            score: Math.abs(data.offset),
            collisionSource:
                data.collision?.collisionSource || 'cross-net-overlap',
            netName: group.netName,
            segmentKey: group.key,
            candidateId:
                group.key +
                ':segment-overlap-shift-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            debug: {
                overlapIndex: data.overlapIndex,
                shiftedPartIndex: data.pair.moving.partIndex,
                offset: data.offset,
                strategy: this.#strategyForPart(data.pair.moving),
                collisionSourceId: data.collision?.collisionSourceId || '',
                keptStraightTraceNetName: data.pair.stationary.group.netName
            }
        }
    }

    /**
     * Resolves the public strategy name for the shifted part.
     * @param {{ group: object, partIndex: number }} moving Moving group metadata.
     * @returns {string}
     */
    static #strategyForPart(moving) {
        const lastPartIndex = moving.group.parts.length - 1
        return moving.partIndex === 0 || moving.partIndex === lastPartIndex
            ? 'terminal-jog-segment-overlap-shift'
            : 'internal-segment-overlap-shift'
    }
}
