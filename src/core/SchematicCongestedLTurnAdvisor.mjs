import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const REROUTE_TRACE_CLEARANCE = 1
const REROUTE_OBSTACLE_CLEARANCE = 0.6

/**
 * Suggests read-only rectangle reroutes for congested L-turn paths.
 */
export class SchematicCongestedLTurnAdvisor {
    /**
     * Builds congested L-turn reroute candidates.
     * @param {object[]} overlapSegments Cross-net overlap rows.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ congestedLTurnRerouteSegments: object[], candidateDecisions: object[], budget: object }}
     */
    static analyze(overlapSegments, segments, obstacles) {
        const rows = []
        const candidateDecisions = []

        for (const path of this.#authoredPaths(segments)) {
            const result = this.#candidatesForPath(
                path,
                overlapSegments,
                obstacles,
                segments
            )
            rows.push(...result.rows)
            candidateDecisions.push(...result.candidateDecisions)
        }

        return {
            congestedLTurnRerouteSegments: rows,
            candidateDecisions,
            budget: {
                generated: candidateDecisions.length,
                accepted: rows.length,
                rejected: candidateDecisions.filter(
                    (row) => row.status === 'rejected'
                ).length
            }
        }
    }

    /**
     * Reconstructs authored paths from segment parts.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object[]}
     */
    static #authoredPaths(segments) {
        const groups = new Map()
        for (const segment of Array.isArray(segments) ? segments : []) {
            const key =
                segment.netName + ':' + String(segment.segmentIndex ?? 0)
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key).push(segment)
        }

        return [...groups.entries()]
            .map(([key, parts]) => this.#authoredPath(key, parts))
            .filter(Boolean)
    }

    /**
     * Builds one authored path from sorted segment parts.
     * @param {string} key Authored path key.
     * @param {object[]} parts Segment parts.
     * @returns {object | null}
     */
    static #authoredPath(key, parts) {
        const sorted = [...parts].sort(
            (left, right) => left.partIndex - right.partIndex
        )
        if (sorted.length < 2) return null

        const points = [sorted[0].points[0]]
        for (const part of sorted) points.push(part.points[1])
        return {
            key,
            netName: sorted[0].netName,
            segmentIndex: sorted[0].segmentIndex,
            parts: sorted,
            points
        }
    }

    /**
     * Builds reroute candidates for one path.
     * @param {object} path Authored path.
     * @param {object[]} overlapSegments Cross-net overlaps.
     * @param {object[]} obstacles Body obstacles.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {{ rows: object[], candidateDecisions: object[] }}
     */
    static #candidatesForPath(path, overlapSegments, obstacles, segments) {
        for (
            let cornerIndex = 1;
            cornerIndex < path.points.length - 1;
            cornerIndex++
        ) {
            const previous = path.parts[cornerIndex - 1]
            const next = path.parts[cornerIndex]
            if (!previous || !next || previous.axis === next.axis) continue

            const overlaps = this.#legOverlaps(
                path.netName,
                [previous, next],
                overlapSegments
            )
            const obstacleHits = this.#legObstacleHits(
                [previous, next],
                obstacles
            )
            if (!overlaps.length || !obstacleHits.length) continue

            return this.#candidateRows({
                path,
                previous,
                next,
                cornerIndex,
                overlapCount: overlaps.length,
                overlaps,
                obstacleHits,
                obstacles,
                segments
            })
        }
        return { rows: [], candidateDecisions: [] }
    }

    /**
     * Finds cross-net overlaps touching either L-turn leg.
     * @param {string} netName Path net name.
     * @param {object[]} legs Adjacent path legs.
     * @param {object[]} overlapSegments Cross-net overlaps.
     * @returns {object[]}
     */
    static #legOverlaps(netName, legs, overlapSegments) {
        return (Array.isArray(overlapSegments) ? overlapSegments : []).filter(
            (overlap) =>
                Array.isArray(overlap?.netNames) &&
                overlap.netNames.includes(netName) &&
                legs.some((leg) =>
                    Geometry.segmentOverlap(leg, {
                        axis: overlap.axis,
                        points: overlap.points
                    })
                )
        )
    }

    /**
     * Finds body obstacles touching either L-turn leg.
     * @param {object[]} legs Adjacent path legs.
     * @param {object[]} obstacles Body obstacles.
     * @returns {object[]}
     */
    static #legObstacleHits(legs, obstacles) {
        return (Array.isArray(obstacles) ? obstacles : []).filter((obstacle) =>
            legs.some((leg) =>
                Geometry.segmentIntersectsBounds(leg.points, obstacle.bounds)
            )
        )
    }

    /**
     * Builds public reroute rows and decision telemetry.
     * @param {object} data Candidate data.
     * @returns {{ rows: object[], candidateDecisions: object[] }}
     */
    static #candidateRows(data) {
        const rows = []
        const candidateDecisions = []
        const specs = this.#rerouteSpecs(
            data.path.points[data.cornerIndex - 1],
            data.path.points[data.cornerIndex],
            data.path.points[data.cornerIndex + 1],
            data.obstacleHits
        )
        const lTurn = this.#lTurnMetadata(data)
        const blockerIntersections = this.#blockerIntersections(
            [data.previous, data.next],
            data.overlaps,
            data.obstacleHits
        )
        const rectangleCandidates = []

        for (const spec of specs) {
            const rectangleCandidate = this.#rectangleCandidate(spec)
            rectangleCandidates.push(rectangleCandidate)
            const row = this.#candidateRow({
                ...data,
                points: spec.points,
                candidateIndex: spec.candidateIndex,
                strategy: spec.strategy,
                lTurn,
                blockerIntersections,
                rectangleCandidate:
                    this.#cloneRectangleCandidate(rectangleCandidate),
                rectangleCandidates: rectangleCandidates.map((candidate) =>
                    this.#cloneRectangleCandidate(candidate)
                ),
                rejectedCandidateCount: candidateDecisions.filter(
                    (decision) => decision.status === 'rejected'
                ).length
            })
            const collision = this.#candidateCollision(
                row,
                data.path,
                data.segments,
                data.obstacles
            )
            if (collision) {
                candidateDecisions.push(
                    this.#decisionRow(row, {
                        status: 'rejected',
                        reason: collision.reason,
                        collisionSource: collision.source,
                        collisionSourceId: collision.sourceId
                    })
                )
                continue
            }

            rows.push(row)
            candidateDecisions.push(this.#decisionRow(row))
            break
        }

        return { rows, candidateDecisions }
    }

    /**
     * Builds a public reroute row.
     * @param {object} data Candidate data.
     * @returns {object}
     */
    static #candidateRow(data) {
        const debug = {
            corner: data.path.points[data.cornerIndex],
            overlapCount: data.overlapCount,
            obstacleCount: data.obstacleHits.length,
            strategy: data.strategy,
            lTurn: data.lTurn,
            blockerIntersections: data.blockerIntersections,
            rectangleCandidate: data.rectangleCandidate,
            rectangleCandidates: data.rectangleCandidates,
            candidateStatus: 'accepted',
            status: 'accepted',
            score:
                data.overlapCount +
                data.obstacleHits.length +
                data.candidateIndex
        }
        if (data.rejectedCandidateCount > 0) {
            debug.rejectedCandidateCount = data.rejectedCandidateCount
        }
        return {
            kind: 'congested-l-turn-reroute-candidate',
            netName: data.path.netName,
            segmentKey: data.path.key,
            candidateId:
                data.path.key +
                ':congested-l-turn-' +
                String(data.candidateIndex),
            candidateIndex: data.candidateIndex,
            points: data.points,
            debug
        }
    }

    /**
     * Builds stable metadata for the L-turn under evaluation.
     * @param {object} data Candidate data.
     * @returns {object}
     */
    static #lTurnMetadata(data) {
        return {
            start: this.#point(data.path.points[data.cornerIndex - 1]),
            corner: this.#point(data.path.points[data.cornerIndex]),
            end: this.#point(data.path.points[data.cornerIndex + 1]),
            previousSegmentKey: data.previous.key,
            nextSegmentKey: data.next.key
        }
    }

    /**
     * Builds compact blocker intersection rows for one L-turn.
     * @param {object[]} legs L-turn legs.
     * @param {object[]} overlaps Cross-net overlap rows.
     * @param {object[]} obstacleHits Body obstacles touching the turn.
     * @returns {object[]}
     */
    static #blockerIntersections(legs, overlaps, obstacleHits) {
        return [
            ...this.#overlapIntersections(overlaps),
            ...this.#obstacleIntersections(legs, obstacleHits)
        ]
    }

    /**
     * Builds overlap blocker intersection rows.
     * @param {object[]} overlaps Cross-net overlap rows.
     * @returns {object[]}
     */
    static #overlapIntersections(overlaps) {
        return (Array.isArray(overlaps) ? overlaps : []).map(
            (overlap, index) => ({
                source: 'overlap',
                sourceId:
                    overlap.key ||
                    (Array.isArray(overlap.netNames)
                        ? overlap.netNames.join(':')
                        : 'overlap-' + String(index)),
                axis: overlap.axis,
                points: overlap.points.map((point) => this.#point(point)),
                bounds: Geometry.boundsForPoints(overlap.points)
            })
        )
    }

    /**
     * Builds body obstacle intersection rows.
     * @param {object[]} legs L-turn legs.
     * @param {object[]} obstacleHits Body obstacles touching the turn.
     * @returns {object[]}
     */
    static #obstacleIntersections(legs, obstacleHits) {
        const rows = []
        for (const obstacle of Array.isArray(obstacleHits)
            ? obstacleHits
            : []) {
            for (const leg of legs) {
                if (
                    !Geometry.segmentIntersectsBounds(
                        leg.points,
                        obstacle.bounds
                    )
                ) {
                    continue
                }
                rows.push({
                    source: 'obstacle',
                    sourceId: obstacle.id,
                    segmentKey: leg.key,
                    bounds:
                        Geometry.intersectionBounds(
                            Geometry.boundsForPoints(leg.points),
                            obstacle.bounds
                        ) || obstacle.bounds
                })
            }
        }
        return rows
    }

    /**
     * Builds compact metadata for one evaluated rectangle candidate.
     * @param {object} spec Candidate spec.
     * @returns {object}
     */
    static #rectangleCandidate(spec) {
        return {
            candidateIndex: spec.candidateIndex,
            strategy: spec.strategy,
            bounds: Geometry.boundsForPoints(spec.points)
        }
    }

    /**
     * Copies one rectangle candidate row.
     * @param {object} candidate Rectangle candidate metadata.
     * @returns {object}
     */
    static #cloneRectangleCandidate(candidate) {
        return {
            candidateIndex: candidate.candidateIndex,
            strategy: candidate.strategy,
            bounds: { ...candidate.bounds }
        }
    }

    /**
     * Copies one public point.
     * @param {object} point Source point.
     * @returns {{ x: number, y: number }}
     */
    static #point(point) {
        return { x: point.x, y: point.y }
    }

    /**
     * Builds deterministic reroute specs for one L-turn.
     * @param {object} start Path start.
     * @param {object} corner L-turn corner.
     * @param {object} end Path end.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {object[]}
     */
    static #rerouteSpecs(start, corner, end, obstacleHits) {
        const specs = [
            {
                candidateIndex: 0,
                strategy: 'rectangle-reroute',
                points: this.#reroutePoints(start, corner, end, obstacleHits)
            }
        ]
        for (const points of this.#intersectionReroutePoints(
            start,
            corner,
            end,
            obstacleHits
        )) {
            if (
                specs.some((spec) => this.#pointListsMatch(spec.points, points))
            ) {
                continue
            }
            specs.push({
                candidateIndex: specs.length,
                strategy: 'intersection-driven-rectangle-reroute',
                points
            })
        }
        return specs
    }

    /**
     * Builds rectangle reroute options from obstacle intersection bounds.
     * @param {object} start Path start.
     * @param {object} corner L-turn corner.
     * @param {object} end Path end.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {Array<object[]>}
     */
    static #intersectionReroutePoints(start, corner, end, obstacleHits) {
        const previousAxis = Geometry.segmentAxis(start, corner)
        if (previousAxis === 'x') {
            const horizontalSign = this.#direction(corner.x - start.x)
            const detourX = this.#detourX(corner, horizontalSign, obstacleHits)
            return this.#detourYChoices(obstacleHits).map((detourY) => [
                start,
                { x: start.x, y: detourY },
                { x: detourX, y: detourY },
                { x: detourX, y: end.y },
                end
            ])
        }

        const verticalSign = this.#direction(corner.y - start.y)
        const detourY = this.#detourY(corner, verticalSign, obstacleHits)
        return this.#detourXChoices(obstacleHits).map((detourX) => [
            start,
            { x: detourX, y: start.y },
            { x: detourX, y: detourY },
            { x: end.x, y: detourY },
            end
        ])
    }

    /**
     * Builds y-coordinate options just outside obstacle intersections.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {number[]}
     */
    static #detourYChoices(obstacleHits) {
        return this.#uniqueNumbers([
            ...obstacleHits.map((obstacle) =>
                this.#roundCoordinate(
                    obstacle.bounds.minY - REROUTE_OBSTACLE_CLEARANCE
                )
            ),
            ...obstacleHits.map((obstacle) =>
                this.#roundCoordinate(
                    obstacle.bounds.maxY + REROUTE_OBSTACLE_CLEARANCE
                )
            )
        ])
    }

    /**
     * Builds x-coordinate options just outside obstacle intersections.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {number[]}
     */
    static #detourXChoices(obstacleHits) {
        return this.#uniqueNumbers([
            ...obstacleHits.map((obstacle) =>
                this.#roundCoordinate(
                    obstacle.bounds.minX - REROUTE_OBSTACLE_CLEARANCE
                )
            ),
            ...obstacleHits.map((obstacle) =>
                this.#roundCoordinate(
                    obstacle.bounds.maxX + REROUTE_OBSTACLE_CLEARANCE
                )
            )
        ])
    }

    /**
     * Builds rectangle reroute points around an L-turn corner.
     * @param {{ x: number, y: number }} start Path start.
     * @param {{ x: number, y: number }} corner L-turn corner.
     * @param {{ x: number, y: number }} end Path end.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {Array<{ x: number, y: number }>}
     */
    static #reroutePoints(start, corner, end, obstacleHits) {
        const previousAxis = Geometry.segmentAxis(start, corner)
        const horizontalSign = this.#direction(corner.x - start.x)
        const verticalSign = this.#direction(end.y - corner.y)
        if (previousAxis === 'x') {
            const detourY = corner.y - verticalSign * REROUTE_TRACE_CLEARANCE
            const detourX = this.#detourX(corner, horizontalSign, obstacleHits)
            return [
                start,
                { x: start.x, y: detourY },
                { x: detourX, y: detourY },
                { x: detourX, y: end.y },
                end
            ]
        }

        const horizontalEndSign = this.#direction(end.x - corner.x)
        const detourX = corner.x - horizontalEndSign * REROUTE_TRACE_CLEARANCE
        const detourY = this.#detourY(corner, verticalSign, obstacleHits)
        return [
            start,
            { x: detourX, y: start.y },
            { x: detourX, y: detourY },
            { x: end.x, y: detourY },
            end
        ]
    }

    /**
     * Resolves the detour x coordinate outside obstacle bounds.
     * @param {{ x: number }} corner L-turn corner.
     * @param {number} sign Horizontal movement direction.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {number}
     */
    static #detourX(corner, sign, obstacleHits) {
        const traceValue = corner.x + sign * REROUTE_TRACE_CLEARANCE
        const obstacleValue =
            sign > 0
                ? Math.max(
                      ...obstacleHits.map(
                          (obstacle) =>
                              obstacle.bounds.maxX + REROUTE_OBSTACLE_CLEARANCE
                      )
                  )
                : Math.min(
                      ...obstacleHits.map(
                          (obstacle) =>
                              obstacle.bounds.minX - REROUTE_OBSTACLE_CLEARANCE
                      )
                  )
        return this.#roundCoordinate(
            sign > 0
                ? Math.max(traceValue, obstacleValue)
                : Math.min(traceValue, obstacleValue)
        )
    }

    /**
     * Resolves the detour y coordinate outside obstacle bounds.
     * @param {{ y: number }} corner L-turn corner.
     * @param {number} sign Vertical movement direction.
     * @param {object[]} obstacleHits Obstacles touching the L-turn.
     * @returns {number}
     */
    static #detourY(corner, sign, obstacleHits) {
        const traceValue = corner.y + sign * REROUTE_TRACE_CLEARANCE
        const obstacleValue =
            sign > 0
                ? Math.max(
                      ...obstacleHits.map(
                          (obstacle) =>
                              obstacle.bounds.maxY + REROUTE_OBSTACLE_CLEARANCE
                      )
                  )
                : Math.min(
                      ...obstacleHits.map(
                          (obstacle) =>
                              obstacle.bounds.minY - REROUTE_OBSTACLE_CLEARANCE
                      )
                  )
        return this.#roundCoordinate(
            sign > 0
                ? Math.max(traceValue, obstacleValue)
                : Math.min(traceValue, obstacleValue)
        )
    }

    /**
     * Returns a deterministic non-zero direction.
     * @param {number} value Direction value.
     * @returns {number}
     */
    static #direction(value) {
        return value >= 0 ? 1 : -1
    }

    /**
     * Rounds public coordinates to stable tenths when needed.
     * @param {number} value Coordinate value.
     * @returns {number}
     */
    static #roundCoordinate(value) {
        return Number(value.toFixed(6))
    }

    /**
     * Finds the first collision for a reroute candidate.
     * @param {object} candidate Candidate row.
     * @param {object} path Source path.
     * @param {object[]} segments All orthogonal segments.
     * @param {object[]} obstacles Body obstacles.
     * @returns {{ reason: string, source: string, sourceId: string } | null}
     */
    static #candidateCollision(candidate, path, segments, obstacles) {
        const candidateSegments = this.#segmentsForPoints(
            candidate.points,
            path.netName
        )
        for (const obstacle of Array.isArray(obstacles) ? obstacles : []) {
            if (
                !candidateSegments.some((segment) =>
                    Geometry.segmentIntersectsBounds(
                        segment.points,
                        obstacle.bounds
                    )
                )
            ) {
                continue
            }
            return {
                reason: 'body-collision',
                source: 'obstacle',
                sourceId: obstacle.id
            }
        }

        for (const segment of Array.isArray(segments) ? segments : []) {
            if (segment.netName === path.netName) continue
            if (
                !candidateSegments.some((candidateSegment) =>
                    this.#segmentsCollide(candidateSegment, segment)
                )
            ) {
                continue
            }
            return {
                reason: 'trace-collision',
                source: 'trace',
                sourceId: segment.key
            }
        }
        return null
    }

    /**
     * Builds orthogonal segment rows from a candidate point list.
     * @param {object[]} points Candidate points.
     * @param {string} netName Net name.
     * @returns {object[]}
     */
    static #segmentsForPoints(points, netName) {
        const segments = []
        for (let index = 0; index < points.length - 1; index++) {
            const start = points[index]
            const end = points[index + 1]
            const axis = Geometry.segmentAxis(start, end)
            if (!axis || Geometry.samePoint(start, end)) continue
            segments.push({
                key: netName + ':candidate:' + String(index),
                netName,
                axis,
                points: [start, end]
            })
        }
        return segments
    }

    /**
     * Returns whether two orthogonal segments collide.
     * @param {object} left First segment.
     * @param {object} right Second segment.
     * @returns {boolean}
     */
    static #segmentsCollide(left, right) {
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
     * Returns whether two point lists match.
     * @param {object[]} left First point list.
     * @param {object[]} right Second point list.
     * @returns {boolean}
     */
    static #pointListsMatch(left, right) {
        return (
            left.length === right.length &&
            left.every((point, index) =>
                Geometry.samePoint(point, right[index])
            )
        )
    }

    /**
     * Deduplicates numbers while preserving order.
     * @param {number[]} values Source values.
     * @returns {number[]}
     */
    static #uniqueNumbers(values) {
        const seen = new Set()
        const unique = []
        for (const value of values) {
            const key = value.toFixed(6)
            if (seen.has(key)) continue
            seen.add(key)
            unique.push(value)
        }
        return unique
    }

    /**
     * Builds a candidate decision row for timeline normalization.
     * @param {object} candidate Accepted candidate row.
     * @param {object} [data] Decision data.
     * @returns {object}
     */
    static #decisionRow(candidate, data = {}) {
        const status = data.status || 'accepted'
        return {
            kind: candidate.kind,
            candidateKind: candidate.kind,
            status,
            reason: data.reason || '',
            selected: status === 'accepted',
            score: candidate.debug.score,
            collisionSource: data.collisionSource || 'congested-l-turn',
            netName: candidate.netName,
            segmentKey: candidate.segmentKey,
            candidateId: candidate.candidateId,
            candidateIndex: candidate.candidateIndex,
            debug: {
                strategy: candidate.debug.strategy,
                lTurn: candidate.debug.lTurn,
                blockerIntersections: candidate.debug.blockerIntersections,
                rectangleCandidate: candidate.debug.rectangleCandidate,
                candidateStatus: status,
                collisionSourceId: data.collisionSourceId || ''
            }
        }
    }
}
