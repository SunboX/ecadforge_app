import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'
import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'

const LABEL_CANDIDATE_CLEARANCE = 0.5
const MAX_CANDIDATES_PER_LABEL = 3
const SEMANTIC_LABEL_SIDE_CLEARANCE = 2

/**
 * Suggests non-mutating label positions for labels with diagnostic collisions.
 */
export class SchematicNetLabelCandidateAdvisor {
    /**
     * Groups touching or overlapping labels into merged obstacle bounds.
     * @param {object[]} labels Label rows with bounds.
     * @param {object[]} [obstacles] Schematic body obstacles.
     * @returns {object[]} Label obstacle groups.
     */
    static buildLabelObstacleGroups(labels, obstacles = []) {
        const rows = Array.isArray(labels) ? labels : []
        const parent = rows.map((_, index) => index)
        const semanticPairs = new Map()
        const semanticProfiles = rows.map((label) =>
            this.#semanticLabelProfile(label, obstacles)
        )
        const find = (index) => {
            if (parent[index] === index) return index
            parent[index] = find(parent[index])
            return parent[index]
        }
        const union = (left, right) => {
            const leftRoot = find(left)
            const rightRoot = find(right)
            if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot
        }

        for (let left = 0; left < rows.length; left++) {
            for (let right = left + 1; right < rows.length; right++) {
                if (this.#labelsTouch(rows[left], rows[right])) {
                    union(left, right)
                } else if (
                    this.#sameSemanticSide(
                        semanticProfiles[left],
                        semanticProfiles[right]
                    )
                ) {
                    union(left, right)
                    semanticPairs.set(
                        this.#semanticPairKey(rows[left], rows[right]),
                        semanticProfiles[left]
                    )
                }
            }
        }

        const grouped = new Map()
        rows.forEach((label, index) => {
            const root = find(index)
            if (!grouped.has(root)) grouped.set(root, [])
            grouped.get(root).push(label)
        })

        return [...grouped.entries()]
            .sort(([left], [right]) => left - right)
            .map(([, groupLabels], index) =>
                this.#labelObstacleGroup(
                    groupLabels,
                    index,
                    this.#semanticGroupDebug(groupLabels, semanticPairs)
                )
            )
    }

    /**
     * Builds candidate bounds for labels involved in collisions.
     * @param {object[]} labels Label rows with bounds.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic obstacle bounds.
     * @param {object[]} collisions Collision bounds.
     * @param {object} [options] Advisor options.
     * @returns {object[]} Suggested label candidate bounds.
     */
    static suggest(labels, segments, obstacles, collisions, options = {}) {
        const labelIds = this.#collidingLabelIds(collisions)
        const labelObstacleGroups =
            options.labelObstacleGroups ||
            this.buildLabelObstacleGroups(labels, obstacles)
        const context = {
            segments,
            bodyObstacleIndex:
                options.bodyObstacleIndex ||
                new SchematicBoundsSpatialIndex(obstacles),
            labelObstacleGroupIndex:
                options.labelObstacleGroupIndex ||
                new SchematicBoundsSpatialIndex(labelObstacleGroups),
            sourceGroupsByLabelId:
                this.#sourceGroupsByLabelId(labelObstacleGroups)
        }
        const candidates = []

        for (const label of labels) {
            if (!labelIds.has(label.id)) continue
            candidates.push(...this.#candidatesForLabel(label, context))
        }

        return candidates
    }

    /**
     * Builds one merged label obstacle group row.
     * @param {object[]} labels Group labels.
     * @param {number} index Group index.
     * @param {object | null} semanticDebug Semantic grouping debug data.
     * @returns {object}
     */
    static #labelObstacleGroup(labels, index, semanticDebug = null) {
        const group = {
            id: 'label-obstacle-group:' + String(index + 1),
            kind: 'net-label-obstacle-group',
            labelIds: labels.map((label) => label.id),
            netNames: [...new Set(labels.map((label) => label.netName))],
            bounds: this.#unionBounds(labels.map((label) => label.bounds))
        }
        if (semanticDebug) group.debug = semanticDebug
        return group
    }

    /**
     * Returns whether two labels touch or overlap.
     * @param {object} left Left label.
     * @param {object} right Right label.
     * @returns {boolean}
     */
    static #labelsTouch(left, right) {
        return Geometry.boundsTouchOrOverlap(left.bounds, right.bounds)
    }

    /**
     * Resolves the nearest symbol side for a label.
     * @param {object} label Label row.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {object | null}
     */
    static #semanticLabelProfile(label, obstacles) {
        const labelCenter = this.#boundsCenter(label.bounds)
        const candidates = []
        for (const obstacle of Array.isArray(obstacles) ? obstacles : []) {
            if (obstacle?.kind !== 'component') continue
            candidates.push(
                ...this.#sideCandidates(label.bounds, labelCenter, obstacle)
            )
        }
        return candidates
            .filter(
                (candidate) =>
                    candidate.distance >= 0 &&
                    candidate.distance <= SEMANTIC_LABEL_SIDE_CLEARANCE
            )
            .sort(
                (left, right) =>
                    left.distance - right.distance ||
                    left.obstacleId.localeCompare(right.obstacleId) ||
                    left.side.localeCompare(right.side)
            )[0]
    }

    /**
     * Builds side profile candidates for one obstacle.
     * @param {object} bounds Label bounds.
     * @param {object} center Label center.
     * @param {object} obstacle Component obstacle.
     * @returns {object[]}
     */
    static #sideCandidates(bounds, center, obstacle) {
        const body = obstacle.bounds
        const verticalOverlap =
            center.y >= body.minY - SEMANTIC_LABEL_SIDE_CLEARANCE &&
            center.y <= body.maxY + SEMANTIC_LABEL_SIDE_CLEARANCE
        const horizontalOverlap =
            center.x >= body.minX - SEMANTIC_LABEL_SIDE_CLEARANCE &&
            center.x <= body.maxX + SEMANTIC_LABEL_SIDE_CLEARANCE
        const rows = []
        if (verticalOverlap && bounds.minX >= body.maxX) {
            rows.push({
                obstacleId: obstacle.id,
                side: 'right',
                distance: bounds.minX - body.maxX
            })
        }
        if (verticalOverlap && bounds.maxX <= body.minX) {
            rows.push({
                obstacleId: obstacle.id,
                side: 'left',
                distance: body.minX - bounds.maxX
            })
        }
        if (horizontalOverlap && bounds.minY >= body.maxY) {
            rows.push({
                obstacleId: obstacle.id,
                side: 'bottom',
                distance: bounds.minY - body.maxY
            })
        }
        if (horizontalOverlap && bounds.maxY <= body.minY) {
            rows.push({
                obstacleId: obstacle.id,
                side: 'top',
                distance: body.minY - bounds.maxY
            })
        }
        return rows
    }

    /**
     * Returns whether two labels share a semantic obstacle side.
     * @param {object | null} left Left profile.
     * @param {object | null} right Right profile.
     * @returns {boolean}
     */
    static #sameSemanticSide(left, right) {
        return Boolean(
            left &&
            right &&
            left.obstacleId === right.obstacleId &&
            left.side === right.side
        )
    }

    /**
     * Returns debug metadata for a semantic label group.
     * @param {object[]} labels Group labels.
     * @param {Map<string, object>} semanticPairs Semantic pair map.
     * @returns {object | null}
     */
    static #semanticGroupDebug(labels, semanticPairs) {
        for (let left = 0; left < labels.length; left++) {
            for (let right = left + 1; right < labels.length; right++) {
                const profile = semanticPairs.get(
                    this.#semanticPairKey(labels[left], labels[right])
                )
                if (!profile) continue
                return {
                    groupingKind: 'same-symbol-side',
                    obstacleId: profile.obstacleId,
                    side: profile.side
                }
            }
        }
        return null
    }

    /**
     * Builds a stable pair key from label ids.
     * @param {object} left Left label.
     * @param {object} right Right label.
     * @returns {string}
     */
    static #semanticPairKey(left, right) {
        return [left.id, right.id].sort().join('|')
    }

    /**
     * Builds a lookup from label id to obstacle group id.
     * @param {object[]} groups Label obstacle groups.
     * @returns {Map<string, string>}
     */
    static #sourceGroupsByLabelId(groups) {
        const map = new Map()
        for (const group of groups) {
            for (const labelId of group.labelIds) {
                map.set(labelId, group.id)
            }
        }
        return map
    }

    /**
     * Collects label ids referenced by collision rows.
     * @param {object[]} collisions Collision rows.
     * @returns {Set<string>}
     */
    static #collidingLabelIds(collisions) {
        const ids = new Set()
        for (const collision of collisions) {
            if (collision?.labelId) ids.add(collision.labelId)
            if (collision?.otherLabelId) ids.add(collision.otherLabelId)
        }
        return ids
    }

    /**
     * Builds candidate rows for one label.
     * @param {object} label Source label.
     * @param {object} context Candidate context.
     * @returns {object[]}
     */
    static #candidatesForLabel(label, context) {
        const candidates = []
        for (const offset of this.#candidateOffsets(label.bounds)) {
            const bounds = this.#translateBounds(
                label.bounds,
                offset.dx,
                offset.dy
            )
            if (this.#candidateCollides(label, bounds, context)) {
                continue
            }

            candidates.push({
                kind: 'net-label-candidate',
                netName: label.netName,
                labelId: label.id,
                labelIndex: label.labelIndex,
                candidateIndex: candidates.length,
                bounds,
                debug: {
                    offset,
                    sourceLabelGroupId:
                        context.sourceGroupsByLabelId.get(label.id) || ''
                }
            })
            if (candidates.length >= MAX_CANDIDATES_PER_LABEL) break
        }
        return candidates
    }

    /**
     * Returns deterministic candidate offsets around one label.
     * @param {object} bounds Label bounds.
     * @returns {Array<{ dx: number, dy: number, orientation: string }>}
     */
    static #candidateOffsets(bounds) {
        const xStep = bounds.width + LABEL_CANDIDATE_CLEARANCE
        const yStep = bounds.height + LABEL_CANDIDATE_CLEARANCE
        return [
            { dx: -xStep, dy: 0, orientation: 'left' },
            { dx: xStep, dy: 0, orientation: 'right' },
            { dx: 0, dy: -yStep, orientation: 'up' },
            { dx: 0, dy: yStep, orientation: 'down' },
            { dx: -xStep, dy: -yStep, orientation: 'up-left' },
            { dx: xStep, dy: -yStep, orientation: 'up-right' },
            { dx: -xStep, dy: yStep, orientation: 'down-left' },
            { dx: xStep, dy: yStep, orientation: 'down-right' }
        ]
    }

    /**
     * Checks whether a candidate collides with known geometry.
     * @param {object} sourceLabel Source label.
     * @param {object} bounds Candidate bounds.
     * @param {object} context Candidate context.
     * @returns {boolean}
     */
    static #candidateCollides(sourceLabel, bounds, context) {
        return (
            this.#collidesWithLabelGroups(
                bounds,
                context.labelObstacleGroupIndex
            ) ||
            this.#collidesWithUnrelatedTrace(
                sourceLabel,
                bounds,
                context.segments
            ) ||
            this.#collidesWithBodyObstacles(bounds, context.bodyObstacleIndex)
        )
    }

    /**
     * Checks candidate bounds against merged label groups.
     * @param {object} bounds Candidate bounds.
     * @param {SchematicBoundsSpatialIndex} index Label group index.
     * @returns {boolean}
     */
    static #collidesWithLabelGroups(bounds, index) {
        return index
            .query(bounds)
            .some((group) =>
                Geometry.boundsTouchOrOverlap(bounds, group.bounds)
            )
    }

    /**
     * Checks candidate bounds against unrelated net traces.
     * @param {object} sourceLabel Source label.
     * @param {object} bounds Candidate bounds.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {boolean}
     */
    static #collidesWithUnrelatedTrace(sourceLabel, bounds, segments) {
        return segments.some(
            (segment) =>
                segment.netName !== sourceLabel.netName &&
                Geometry.segmentIntersectsBounds(segment.points, bounds)
        )
    }

    /**
     * Checks candidate bounds against body obstacles.
     * @param {object} bounds Candidate bounds.
     * @param {SchematicBoundsSpatialIndex} index Body obstacle index.
     * @returns {boolean}
     */
    static #collidesWithBodyObstacles(bounds, index) {
        return index
            .query(bounds)
            .some((obstacle) =>
                Geometry.boundsTouchOrOverlap(bounds, obstacle.bounds)
            )
    }

    /**
     * Translates bounds without changing dimensions.
     * @param {object} bounds Source bounds.
     * @param {number} dx X offset.
     * @param {number} dy Y offset.
     * @returns {object}
     */
    static #translateBounds(bounds, dx, dy) {
        return Geometry.bounds(
            bounds.minX + dx,
            bounds.minY + dy,
            bounds.maxX + dx,
            bounds.maxY + dy
        )
    }

    /**
     * Returns a bounds center point.
     * @param {object} bounds Bounds.
     * @returns {{ x: number, y: number }}
     */
    static #boundsCenter(bounds) {
        return {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        }
    }

    /**
     * Returns a bounds union.
     * @param {object[]} boundsRows Bounds rows.
     * @returns {object}
     */
    static #unionBounds(boundsRows) {
        return boundsRows.reduce(
            (bounds, row) =>
                bounds
                    ? Geometry.bounds(
                          Math.min(bounds.minX, row.minX),
                          Math.min(bounds.minY, row.minY),
                          Math.max(bounds.maxX, row.maxX),
                          Math.max(bounds.maxY, row.maxY)
                      )
                    : row,
            null
        )
    }
}
