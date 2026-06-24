import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const POWER_LABEL_CLEARANCE = 0.5

/**
 * Suggests corner-anchored placements for supply-style net labels.
 */
export class SchematicPowerLabelCornerAdvisor {
    /**
     * Builds power label corner candidate bounds.
     * @param {object[]} labels Label rows.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ powerLabelCornerCandidateBounds: object[], budget: object }}
     */
    static suggest(labels, segments, obstacles = []) {
        const labelIndex = new SchematicBoundsSpatialIndex(labels)
        const obstacleIndex = new SchematicBoundsSpatialIndex(obstacles)
        const powerLabelCornerCandidateBounds = []
        let generated = 0
        let rejected = 0

        for (const label of Array.isArray(labels) ? labels : []) {
            if (!this.#isPowerLabel(label)) continue
            const corners = this.#traceCornersForLabel(label, segments)
            for (const corner of corners) {
                generated += 1
                const orientation = this.#orientationForLabel(label)
                const bounds = this.#boundsForCorner(
                    label.bounds,
                    corner.point,
                    orientation
                )
                if (
                    this.#candidateCollides(
                        label,
                        bounds,
                        labelIndex,
                        obstacleIndex,
                        segments
                    )
                ) {
                    rejected += 1
                    continue
                }
                powerLabelCornerCandidateBounds.push({
                    kind: 'power-label-corner-candidate',
                    netName: label.netName,
                    labelId: label.id,
                    labelIndex: label.labelIndex,
                    candidateIndex: powerLabelCornerCandidateBounds.length,
                    bounds,
                    debug: {
                        corner: corner.point,
                        orientation,
                        distance: Geometry.manhattan(
                            label.center,
                            corner.point
                        ),
                        segmentKeys: corner.segmentKeys
                    }
                })
                break
            }
        }

        return {
            powerLabelCornerCandidateBounds,
            budget: {
                generated,
                accepted: powerLabelCornerCandidateBounds.length,
                rejected
            }
        }
    }

    /**
     * Returns whether a label appears to represent a supply rail.
     * @param {object} label Label row.
     * @returns {boolean}
     */
    static #isPowerLabel(label) {
        const text = String(label?.text || label?.netName || '').toUpperCase()
        return /^(VCC|VDD|VSS|GND|VBUS|VIN|VOUT|POWER|PWR)(?:[_+-].*)?$/u.test(
            text
        )
    }

    /**
     * Chooses a default visual orientation for one power label.
     * @param {object} label Label row.
     * @returns {string}
     */
    static #orientationForLabel(label) {
        const text = String(label?.text || label?.netName || '').toUpperCase()
        return /^(GND|VSS)(?:[_+-].*)?$/u.test(text) ? 'down' : 'up'
    }

    /**
     * Finds trace corners belonging to a label net.
     * @param {object} label Label row.
     * @param {object[]} segments Orthogonal segment parts.
     * @returns {object[]}
     */
    static #traceCornersForLabel(label, segments) {
        const grouped = this.#pathGroups(
            (Array.isArray(segments) ? segments : []).filter(
                (segment) => segment.netName === label.netName
            )
        )
        return grouped
            .flatMap((group) => this.#cornersForPath(group))
            .sort(
                (left, right) =>
                    Geometry.manhattan(label.center, left.point) -
                        Geometry.manhattan(label.center, right.point) ||
                    Geometry.pointKey(left.point).localeCompare(
                        Geometry.pointKey(right.point)
                    )
            )
    }

    /**
     * Groups segment parts into authored paths.
     * @param {object[]} segments Segment parts.
     * @returns {object[]}
     */
    static #pathGroups(segments) {
        const groups = new Map()
        for (const segment of segments) {
            const key = segment.netName + ':' + String(segment.segmentIndex)
            if (!groups.has(key)) groups.set(key, [])
            groups.get(key).push(segment)
        }
        return [...groups.values()].map((parts) => {
            const sorted = parts.sort((a, b) => a.partIndex - b.partIndex)
            return {
                points: [
                    sorted[0].points[0],
                    ...sorted.map((part) => part.points[1])
                ],
                segmentKeys: sorted.map((part) => part.key)
            }
        })
    }

    /**
     * Returns corner points in one path.
     * @param {object} group Path group.
     * @returns {object[]}
     */
    static #cornersForPath(group) {
        const corners = []
        for (let index = 1; index < group.points.length - 1; index++) {
            const previous = group.points[index - 1]
            const current = group.points[index]
            const next = group.points[index + 1]
            if (
                Geometry.segmentAxis(previous, current) &&
                Geometry.segmentAxis(previous, current) !==
                    Geometry.segmentAxis(current, next)
            ) {
                corners.push({
                    point: current,
                    segmentKeys: [
                        group.segmentKeys[index - 1],
                        group.segmentKeys[index]
                    ]
                })
            }
        }
        return corners
    }

    /**
     * Builds label bounds for a trace corner.
     * @param {object} sourceBounds Source label bounds.
     * @param {object} corner Corner point.
     * @param {string} orientation Orientation.
     * @returns {object}
     */
    static #boundsForCorner(sourceBounds, corner, orientation) {
        const offsetY =
            orientation === 'up'
                ? -(sourceBounds.height / 2 + POWER_LABEL_CLEARANCE)
                : sourceBounds.height / 2 + POWER_LABEL_CLEARANCE
        return Geometry.centerBounds(
            { x: corner.x, y: corner.y + offsetY },
            sourceBounds.width,
            sourceBounds.height
        )
    }

    /**
     * Returns whether the candidate overlaps nearby geometry.
     * @param {object} sourceLabel Source label.
     * @param {object} bounds Candidate bounds.
     * @param {SchematicBoundsSpatialIndex} labelIndex Label index.
     * @param {SchematicBoundsSpatialIndex} obstacleIndex Obstacle index.
     * @param {object[]} segments Orthogonal segments.
     * @returns {boolean}
     */
    static #candidateCollides(
        sourceLabel,
        bounds,
        labelIndex,
        obstacleIndex,
        segments
    ) {
        return (
            labelIndex
                .query(bounds)
                .some(
                    (label) =>
                        label.id !== sourceLabel.id &&
                        Geometry.boundsTouchOrOverlap(bounds, label.bounds)
                ) ||
            obstacleIndex
                .query(bounds)
                .some((obstacle) =>
                    Geometry.boundsTouchOrOverlap(bounds, obstacle.bounds)
                ) ||
            segments.some(
                (segment) =>
                    segment.netName !== sourceLabel.netName &&
                    Geometry.segmentIntersectsBounds(segment.points, bounds)
            )
        )
    }
}
