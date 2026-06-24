import { SchematicBoundsSpatialIndex } from './SchematicBoundsSpatialIndex.mjs'
import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const LABEL_ORIENTATION_CLEARANCE = 0.5

/**
 * Suggests non-mutating label placements that satisfy source orientation rules.
 */
export class SchematicLabelOrientationAdvisor {
    /**
     * Builds label orientation candidates and connector segments.
     * @param {object[]} labels Label rows.
     * @param {object[]} segments Orthogonal net segments.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ orientationLabelCandidateBounds: object[], orientationConnectorSegments: object[], budget: object }}
     */
    static suggest(labels, segments, obstacles = []) {
        const labelIndex = new SchematicBoundsSpatialIndex(labels)
        const obstacleIndex = new SchematicBoundsSpatialIndex(obstacles)
        const orientationLabelCandidateBounds = []
        const orientationConnectorSegments = []
        let generated = 0
        let rejected = 0

        for (const label of Array.isArray(labels) ? labels : []) {
            const currentOrientation = this.#currentOrientation(label)
            const requiredOrientations = this.#requiredOrientations(label)
            if (
                !currentOrientation ||
                !requiredOrientations.length ||
                requiredOrientations.includes(currentOrientation)
            ) {
                continue
            }

            for (const requiredOrientation of requiredOrientations) {
                generated += 1
                const anchor = this.#nearestTraceAnchor(label, segments)
                if (!anchor) {
                    rejected += 1
                    continue
                }

                const bounds = this.#boundsForAnchor(
                    label.bounds,
                    anchor,
                    requiredOrientation
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

                const candidateIndex = orientationLabelCandidateBounds.length
                orientationLabelCandidateBounds.push({
                    kind: 'label-orientation-candidate',
                    netName: label.netName,
                    labelId: label.id,
                    labelIndex: label.labelIndex,
                    candidateIndex,
                    bounds,
                    debug: {
                        currentOrientation,
                        requiredOrientation,
                        anchor,
                        status: 'accepted'
                    }
                })
                orientationConnectorSegments.push({
                    kind: 'label-orientation-connector-candidate',
                    netName: label.netName,
                    labelId: label.id,
                    points: [
                        anchor,
                        this.#connectorEndPoint(
                            bounds,
                            anchor,
                            requiredOrientation
                        )
                    ],
                    debug: {
                        requiredOrientation,
                        candidateIndex
                    }
                })
                break
            }
        }

        return {
            orientationLabelCandidateBounds,
            orientationConnectorSegments,
            budget: {
                generated,
                accepted: orientationLabelCandidateBounds.length,
                rejected
            }
        }
    }

    /**
     * Resolves the current source orientation.
     * @param {object} label Label row.
     * @returns {string}
     */
    static #currentOrientation(label) {
        return this.#normalizeOrientation(
            label?.source?.orientation ||
                label?.source?.facing ||
                label?.source?.direction
        )
    }

    /**
     * Resolves allowed source orientations.
     * @param {object} label Label row.
     * @returns {string[]}
     */
    static #requiredOrientations(label) {
        const source = label?.source || {}
        const values = Array.isArray(source.orientations)
            ? source.orientations
            : [source.requiredOrientation || source.allowedOrientation]
        return [
            ...new Set(values.map((value) => this.#normalizeOrientation(value)))
        ]
            .filter(Boolean)
            .sort()
    }

    /**
     * Normalizes an orientation token.
     * @param {unknown} value Source token.
     * @returns {string}
     */
    static #normalizeOrientation(value) {
        const text = String(value || '').toLowerCase()
        return (
            {
                up: 'up',
                top: 'up',
                down: 'down',
                bottom: 'down',
                left: 'left',
                right: 'right',
                'y-': 'up',
                'y+': 'down',
                'x-': 'left',
                'x+': 'right'
            }[text] || ''
        )
    }

    /**
     * Finds the nearest point on the label's own trace.
     * @param {object} label Label row.
     * @param {object[]} segments Orthogonal net segments.
     * @returns {object | null}
     */
    static #nearestTraceAnchor(label, segments) {
        const center = label.center
        let best = null
        for (const segment of Array.isArray(segments) ? segments : []) {
            if (segment.netName !== label.netName) continue
            const point = this.#projectPointToSegment(center, segment)
            const distance = Geometry.manhattan(center, point)
            if (
                !best ||
                distance < best.distance ||
                (distance === best.distance &&
                    Geometry.pointKey(point) < Geometry.pointKey(best.point))
            ) {
                best = { point, distance }
            }
        }
        return best?.point || null
    }

    /**
     * Projects a point to an orthogonal segment.
     * @param {object} point Source point.
     * @param {object} segment Segment row.
     * @returns {object}
     */
    static #projectPointToSegment(point, segment) {
        const [start, end] = segment.points
        if (segment.axis === 'x') {
            return {
                x: this.#clamp(point.x, start.x, end.x),
                y: start.y
            }
        }
        return {
            x: start.x,
            y: this.#clamp(point.y, start.y, end.y)
        }
    }

    /**
     * Builds candidate bounds from an anchor and orientation.
     * @param {object} sourceBounds Source label bounds.
     * @param {object} anchor Anchor point.
     * @param {string} orientation Candidate orientation.
     * @returns {object}
     */
    static #boundsForAnchor(sourceBounds, anchor, orientation) {
        const width = sourceBounds.width
        const height = sourceBounds.height
        const offsetX =
            orientation === 'left'
                ? -(width / 2 + LABEL_ORIENTATION_CLEARANCE)
                : orientation === 'right'
                  ? width / 2 + LABEL_ORIENTATION_CLEARANCE
                  : 0
        const offsetY =
            orientation === 'up'
                ? -(height / 2 + LABEL_ORIENTATION_CLEARANCE)
                : orientation === 'down'
                  ? height / 2 + LABEL_ORIENTATION_CLEARANCE
                  : 0
        return Geometry.centerBounds(
            { x: anchor.x + offsetX, y: anchor.y + offsetY },
            width,
            height
        )
    }

    /**
     * Checks whether a label candidate collides with known geometry.
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

    /**
     * Returns the connector endpoint on candidate bounds.
     * @param {object} bounds Candidate bounds.
     * @param {object} anchor Anchor point.
     * @param {string} orientation Orientation.
     * @returns {object}
     */
    static #connectorEndPoint(bounds, anchor, orientation) {
        if (orientation === 'up') return { x: anchor.x, y: bounds.maxY }
        if (orientation === 'down') return { x: anchor.x, y: bounds.minY }
        if (orientation === 'left') return { x: bounds.maxX, y: anchor.y }
        return { x: bounds.minX, y: anchor.y }
    }

    /**
     * Clamps a value between unordered extents.
     * @param {number} value Value.
     * @param {number} first First extent.
     * @param {number} second Second extent.
     * @returns {number}
     */
    static #clamp(value, first, second) {
        return Math.min(
            Math.max(value, Math.min(first, second)),
            Math.max(first, second)
        )
    }
}
