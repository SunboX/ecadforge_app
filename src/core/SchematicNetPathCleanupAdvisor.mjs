import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

/**
 * Suggests simplified versions of authored net paths.
 */
export class SchematicNetPathCleanupAdvisor {
    /**
     * Builds cleanup candidate paths from collected orthogonal segments.
     * @param {object[]} segments Orthogonal net segment parts.
     * @param {object[]} [obstacles] Schematic body obstacles.
     * @param {object[]} [labels] Label rows.
     * @returns {object[]} Cleanup candidate segments.
     */
    static suggest(segments, obstacles = [], labels = []) {
        return this.#pathGroups(segments).flatMap((group) => {
            const cleaned = this.#cleanPath(group.points, obstacles, labels)
            if (this.#pathKey(cleaned.points) === this.#pathKey(group.points)) {
                return []
            }
            return [
                {
                    kind: 'net-path-cleanup-candidate',
                    netName: group.netName,
                    segmentIndex: group.segmentIndex,
                    points: cleaned.points,
                    debug: {
                        originalPointCount: group.points.length,
                        cleanedPointCount: cleaned.points.length,
                        removedPointCount:
                            group.points.length - cleaned.points.length,
                        cleanupKinds: cleaned.cleanupKinds,
                        ...(cleaned.collisionChecked
                            ? { collisionChecked: true }
                            : {})
                    }
                }
            ]
        })
    }

    /**
     * Groups split segment parts back into full segment paths.
     * @param {object[]} segments Orthogonal net segment parts.
     * @returns {object[]}
     */
    static #pathGroups(segments) {
        const groups = new Map()
        for (const segment of Array.isArray(segments) ? segments : []) {
            const key = segment.netName + ':' + String(segment.segmentIndex)
            if (!groups.has(key)) {
                groups.set(key, {
                    netName: segment.netName,
                    segmentIndex: segment.segmentIndex,
                    parts: []
                })
            }
            groups.get(key).parts.push(segment)
        }

        return [...groups.values()].map((group) => {
            const parts = group.parts.sort((a, b) => a.partIndex - b.partIndex)
            return {
                netName: group.netName,
                segmentIndex: group.segmentIndex,
                points: [
                    parts[0].points[0],
                    ...parts.map((part) => part.points[1])
                ]
            }
        })
    }

    /**
     * Removes redundant points from one path.
     * @param {Array<{ x: number, y: number }>} points Source points.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label rows.
     * @returns {{ points: object[], cleanupKinds: string[] }}
     */
    static #cleanPath(points, obstacles, labels) {
        const withoutDuplicates = this.#removeConsecutiveDuplicates(points)
        const withoutBacktracks =
            this.#removeImmediateBacktracks(withoutDuplicates)
        const withoutColinear = this.#removeColinearPoints(withoutBacktracks)
        const cleanupKinds = []
        if (withoutBacktracks.length < withoutDuplicates.length) {
            cleanupKinds.push('immediate-backtrack')
        }
        if (withoutColinear.length < withoutBacktracks.length) {
            cleanupKinds.push('colinear-points')
        }
        if (cleanupKinds.length) {
            return {
                points: withoutColinear,
                cleanupKinds
            }
        }

        const stairStep = this.#stairStepCandidate(points, obstacles, labels)
        if (stairStep) return stairStep

        const balancedZ = this.#balancedZShapeCandidate(
            points,
            obstacles,
            labels
        )
        if (balancedZ) return balancedZ

        const minimized = this.#turnMinimizationCandidate(
            withoutColinear,
            obstacles,
            labels
        )
        if (minimized) return minimized

        return {
            points: withoutColinear,
            cleanupKinds
        }
    }

    /**
     * Removes consecutive duplicate points.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #removeConsecutiveDuplicates(points) {
        return points.filter(
            (point, index) =>
                index === 0 || !Geometry.samePoint(point, points[index - 1])
        )
    }

    /**
     * Removes simple A-B-A backtrack runs.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #removeImmediateBacktracks(points) {
        const cleaned = []
        for (const point of points) {
            const previous = cleaned[cleaned.length - 1]
            const beforePrevious = cleaned[cleaned.length - 2]
            if (beforePrevious && Geometry.samePoint(beforePrevious, point)) {
                cleaned.pop()
                continue
            }
            if (!previous || !Geometry.samePoint(previous, point)) {
                cleaned.push(point)
            }
        }
        return cleaned
    }

    /**
     * Removes middle points that do not change direction.
     * @param {object[]} points Source points.
     * @returns {object[]}
     */
    static #removeColinearPoints(points) {
        if (points.length < 3) return points
        const cleaned = [points[0]]
        for (let index = 1; index < points.length - 1; index++) {
            const previous = cleaned[cleaned.length - 1]
            const current = points[index]
            const next = points[index + 1]
            if (
                Geometry.segmentAxis(previous, current) &&
                Geometry.segmentAxis(previous, current) ===
                    Geometry.segmentAxis(current, next)
            ) {
                continue
            }
            cleaned.push(current)
        }
        cleaned.push(points[points.length - 1])
        return cleaned
    }

    /**
     * Builds a simpler path for alternating stair-step runs.
     * @param {object[]} points Source points.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label rows.
     * @returns {object | null}
     */
    static #stairStepCandidate(points, obstacles, labels) {
        if (!this.#isStairStep(points)) return null
        const start = points[0]
        const end = points[points.length - 1]
        const candidates = [
            [start, { x: end.x, y: start.y }, end],
            [start, { x: start.x, y: end.y }, end]
        ]
        const candidate = candidates.find(
            (path) =>
                this.#isValidPath(path) &&
                !this.#pathCollides(path, obstacles, labels)
        )
        return candidate
            ? { points: candidate, cleanupKinds: ['stair-step'] }
            : null
    }

    /**
     * Builds a balanced Z-shape candidate for four-point paths.
     * @param {object[]} points Source points.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label rows.
     * @returns {object | null}
     */
    static #balancedZShapeCandidate(points, obstacles, labels) {
        if (points.length !== 4) return null
        const [p0, p1, p2, p3] = points
        const firstAxis = Geometry.segmentAxis(p0, p1)
        const middleAxis = Geometry.segmentAxis(p1, p2)
        const lastAxis = Geometry.segmentAxis(p2, p3)
        if (!firstAxis || !middleAxis || firstAxis !== lastAxis) return null
        if (firstAxis === middleAxis) return null

        const balanced =
            firstAxis === 'x'
                ? [
                      p0,
                      { x: (p0.x + p3.x) / 2, y: p1.y },
                      { x: (p0.x + p3.x) / 2, y: p2.y },
                      p3
                  ]
                : [
                      p0,
                      { x: p1.x, y: (p0.y + p3.y) / 2 },
                      { x: p2.x, y: (p0.y + p3.y) / 2 },
                      p3
                  ]
        if (this.#pathKey(balanced) === this.#pathKey(points)) return null
        if (this.#pathCollides(balanced, obstacles, labels)) return null
        return {
            points: balanced,
            cleanupKinds: ['balanced-z-shape']
        }
    }

    /**
     * Builds a reduced-turn path by reconnecting removable point runs.
     * @param {object[]} points Source points.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label rows.
     * @returns {object | null}
     */
    static #turnMinimizationCandidate(points, obstacles, labels) {
        const sourceTurns = this.#turnCount(points)
        const sourceKey = this.#pathKey(points)
        let best = null

        for (let startIndex = 0; startIndex < points.length - 2; startIndex++) {
            for (
                let endIndex = startIndex + 2;
                endIndex < points.length;
                endIndex++
            ) {
                for (const connection of this.#connectionOptions(
                    points[startIndex],
                    points[endIndex]
                )) {
                    const candidate = this.#removeColinearPoints([
                        ...points.slice(0, startIndex + 1),
                        ...connection.slice(1, -1),
                        ...points.slice(endIndex)
                    ])
                    if (this.#pathKey(candidate) === sourceKey) continue
                    if (!this.#isValidPath(candidate)) continue
                    if (this.#pathCollides(candidate, obstacles, labels)) {
                        continue
                    }

                    const candidateTurns = this.#turnCount(candidate)
                    if (
                        candidateTurns > sourceTurns ||
                        (candidateTurns === sourceTurns &&
                            candidate.length >= points.length)
                    ) {
                        continue
                    }

                    if (
                        !best ||
                        candidateTurns < best.turnCount ||
                        (candidateTurns === best.turnCount &&
                            candidate.length < best.points.length) ||
                        (candidateTurns === best.turnCount &&
                            candidate.length === best.points.length &&
                            this.#pathLength(candidate) < best.length)
                    ) {
                        best = {
                            points: candidate,
                            turnCount: candidateTurns,
                            length: this.#pathLength(candidate)
                        }
                    }
                }
            }
        }

        return best
            ? {
                  points: best.points,
                  cleanupKinds: ['turn-minimization'],
                  collisionChecked: true
              }
            : null
    }

    /**
     * Builds direct or elbow connection options between two points.
     * @param {object} start Start point.
     * @param {object} end End point.
     * @returns {object[][]}
     */
    static #connectionOptions(start, end) {
        if (start.x === end.x || start.y === end.y) {
            return [[start, end]]
        }
        return [
            [start, { x: end.x, y: start.y }, end],
            [start, { x: start.x, y: end.y }, end]
        ]
    }

    /**
     * Counts turns in one path.
     * @param {object[]} points Path points.
     * @returns {number}
     */
    static #turnCount(points) {
        let turns = 0
        for (let index = 1; index < points.length - 1; index++) {
            const previousAxis = Geometry.segmentAxis(
                points[index - 1],
                points[index]
            )
            const nextAxis = Geometry.segmentAxis(
                points[index],
                points[index + 1]
            )
            if (previousAxis && nextAxis && previousAxis !== nextAxis) {
                turns += 1
            }
        }
        return turns
    }

    /**
     * Computes Manhattan path length.
     * @param {object[]} points Path points.
     * @returns {number}
     */
    static #pathLength(points) {
        let length = 0
        for (let index = 0; index < points.length - 1; index++) {
            length += Geometry.manhattan(points[index], points[index + 1])
        }
        return length
    }

    /**
     * Returns whether a path alternates segment axes enough to be a stair-step.
     * @param {object[]} points Source points.
     * @returns {boolean}
     */
    static #isStairStep(points) {
        if (points.length < 5) return false
        const axes = []
        for (let index = 0; index < points.length - 1; index++) {
            const axis = Geometry.segmentAxis(points[index], points[index + 1])
            if (!axis) return false
            axes.push(axis)
        }
        return axes.every(
            (axis, index) => index === 0 || axis !== axes[index - 1]
        )
    }

    /**
     * Returns whether all candidate path parts are valid orthogonal segments.
     * @param {object[]} points Candidate path.
     * @returns {boolean}
     */
    static #isValidPath(points) {
        return points.every(
            (point, index) =>
                index === 0 ||
                (!Geometry.samePoint(points[index - 1], point) &&
                    Geometry.segmentAxis(points[index - 1], point))
        )
    }

    /**
     * Returns whether a path intersects supplied obstacles or labels.
     * @param {object[]} points Candidate path.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object[]} labels Label rows.
     * @returns {boolean}
     */
    static #pathCollides(points, obstacles, labels) {
        const boundsRows = [
            ...(Array.isArray(obstacles) ? obstacles : []),
            ...(Array.isArray(labels) ? labels : [])
        ]
        for (let index = 0; index < points.length - 1; index++) {
            const part = [points[index], points[index + 1]]
            if (
                boundsRows.some((row) =>
                    Geometry.segmentIntersectsBounds(part, row.bounds)
                )
            ) {
                return true
            }
        }
        return false
    }

    /**
     * Builds a stable key for one path.
     * @param {object[]} points Path points.
     * @returns {string}
     */
    static #pathKey(points) {
        return points.map((point) => Geometry.pointKey(point)).join('|')
    }
}
