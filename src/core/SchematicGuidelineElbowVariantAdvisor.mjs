import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const MAX_VARIANTS_PER_PATH = 3

/**
 * Suggests elbow variants that snap movable interior segments to guidelines.
 */
export class SchematicGuidelineElbowVariantAdvisor {
    /**
     * Builds guideline-snapped path candidates.
     * @param {object[]} segments Orthogonal segment parts.
     * @param {object[]} guidelines Routing guideline rows.
     * @returns {object[]} Guideline-snapped path candidates.
     */
    static suggest(segments, guidelines) {
        const guidelineRows = this.#guidelinesByMoveAxis(guidelines)
        const candidates = []

        for (const group of this.#pathGroups(segments)) {
            candidates.push(...this.#variantsForGroup(group, guidelineRows))
        }

        return candidates
    }

    /**
     * Builds variants for one authored path group.
     * @param {object} group Path group.
     * @param {Map<string, object[]>} guidelineRows Guidelines by move axis.
     * @returns {object[]}
     */
    static #variantsForGroup(group, guidelineRows) {
        if (group.points.length < 4) return []
        const variants = []
        const seen = new Set([this.#pathKey(group.points)])

        for (
            let partIndex = 1;
            partIndex <= group.points.length - 3;
            partIndex++
        ) {
            const start = group.points[partIndex]
            const end = group.points[partIndex + 1]
            const segmentAxis = Geometry.segmentAxis(start, end)
            const moveAxis = segmentAxis === 'x' ? 'y' : 'x'
            const currentCoordinate = moveAxis === 'x' ? start.x : start.y
            const candidates = this.#coordinateCandidates(
                guidelineRows.get(moveAxis) || [],
                currentCoordinate
            )

            for (const guideline of candidates) {
                const points = this.#movedPoints(
                    group.points,
                    partIndex,
                    moveAxis,
                    guideline.coordinate
                )
                if (!points || seen.has(this.#pathKey(points))) continue
                seen.add(this.#pathKey(points))
                variants.push({
                    kind: 'guideline-snapped-elbow-candidate',
                    netName: group.netName,
                    segmentIndex: group.segmentIndex,
                    points,
                    debug: {
                        sourceGuidelineIndex: guideline.index,
                        movedPartIndex: partIndex,
                        axis: moveAxis,
                        originalCoordinate: currentCoordinate,
                        snappedCoordinate: guideline.coordinate
                    }
                })
                if (variants.length >= MAX_VARIANTS_PER_PATH) return variants
            }
        }

        return variants
    }

    /**
     * Groups split segment parts back into full authored paths.
     * @param {object[]} segments Orthogonal segment parts.
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
     * Indexes guidelines by the coordinate axis they can move a segment onto.
     * @param {object[]} guidelines Guideline rows.
     * @returns {Map<string, object[]>}
     */
    static #guidelinesByMoveAxis(guidelines) {
        const rows = new Map([
            ['x', []],
            ['y', []]
        ])
        ;(Array.isArray(guidelines) ? guidelines : []).forEach(
            (guideline, index) => {
                const normalized = this.#guidelineCoordinate(guideline, index)
                if (!normalized) return
                rows.get(normalized.axis).push(normalized)
            }
        )
        return rows
    }

    /**
     * Resolves a guideline coordinate.
     * @param {object} guideline Guideline row.
     * @param {number} index Guideline index.
     * @returns {object | null}
     */
    static #guidelineCoordinate(guideline, index) {
        const [start, end] = Array.isArray(guideline?.points)
            ? guideline.points
            : []
        if (!start || !end) return null
        if (guideline.orientation === 'vertical') {
            return { axis: 'x', coordinate: start.x, index }
        }
        if (guideline.orientation === 'horizontal') {
            return { axis: 'y', coordinate: start.y, index }
        }
        return null
    }

    /**
     * Returns guideline coordinates sorted by distance from the current value.
     * @param {object[]} guidelines Guideline rows.
     * @param {number} currentCoordinate Current movable coordinate.
     * @returns {object[]}
     */
    static #coordinateCandidates(guidelines, currentCoordinate) {
        return guidelines
            .filter(
                (guideline) =>
                    Number.isFinite(guideline.coordinate) &&
                    guideline.coordinate !== currentCoordinate
            )
            .sort(
                (left, right) =>
                    Math.abs(left.coordinate - currentCoordinate) -
                        Math.abs(right.coordinate - currentCoordinate) ||
                    left.coordinate - right.coordinate
            )
    }

    /**
     * Moves one interior segment and validates the resulting path.
     * @param {object[]} points Source path.
     * @param {number} partIndex Segment part index.
     * @param {'x' | 'y'} axis Move axis.
     * @param {number} coordinate New coordinate.
     * @returns {object[] | null}
     */
    static #movedPoints(points, partIndex, axis, coordinate) {
        const moved = points.map((point) => ({ ...point }))
        moved[partIndex][axis] = coordinate
        moved[partIndex + 1][axis] = coordinate
        return this.#isValidOrthogonalPath(moved) ? moved : null
    }

    /**
     * Returns whether a path is orthogonal and free of zero-length parts.
     * @param {object[]} points Candidate path.
     * @returns {boolean}
     */
    static #isValidOrthogonalPath(points) {
        for (let index = 0; index < points.length - 1; index++) {
            if (Geometry.samePoint(points[index], points[index + 1])) {
                return false
            }
            if (!Geometry.segmentAxis(points[index], points[index + 1])) {
                return false
            }
        }
        return true
    }

    /**
     * Builds a stable path key.
     * @param {object[]} points Path points.
     * @returns {string}
     */
    static #pathKey(points) {
        return points.map((point) => Geometry.pointKey(point)).join('|')
    }
}
