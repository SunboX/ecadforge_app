import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

/**
 * Suggests non-mutating symbol body and pin-edge fit candidates.
 */
export class SchematicSymbolFitAdvisor {
    /**
     * Builds symbol fit diagnostics from anchor and body geometry.
     * @param {object[]} netDebug Per-net debug rows.
     * @param {object[]} obstacles Schematic body obstacles.
     * @returns {{ symbolBodyFitCandidateBounds: object[], symbolPinSnapSegments: object[], budget: object }}
     */
    static suggest(netDebug, obstacles) {
        const components = this.#componentMap(obstacles)
        const pinsByComponent = this.#pinsByComponent(netDebug)
        const symbolBodyFitCandidateBounds = []
        const symbolPinSnapSegments = []
        let generated = 0
        let rejected = 0

        for (const [componentId, anchors] of pinsByComponent) {
            const obstacle = components.get(componentId)
            if (!obstacle) {
                rejected += anchors.length
                continue
            }

            const outside = anchors.filter(
                (anchor) =>
                    !this.#pointInsideOrOn(anchor.point, obstacle.bounds)
            )
            if (outside.length) {
                generated += 1
                symbolBodyFitCandidateBounds.push(
                    this.#bodyFitCandidate(obstacle, outside)
                )
            }

            for (const anchor of anchors) {
                if (this.#pointOnEdge(anchor.point, obstacle.bounds)) continue
                generated += 1
                symbolPinSnapSegments.push(
                    this.#pinSnapCandidate(obstacle, anchor)
                )
            }
        }

        return {
            symbolBodyFitCandidateBounds,
            symbolPinSnapSegments,
            budget: {
                generated,
                accepted:
                    symbolBodyFitCandidateBounds.length +
                    symbolPinSnapSegments.length,
                rejected
            }
        }
    }

    /**
     * Builds a map of component obstacles by source designator.
     * @param {object[]} obstacles Schematic obstacles.
     * @returns {Map<string, object>}
     */
    static #componentMap(obstacles) {
        const map = new Map()
        for (const obstacle of Array.isArray(obstacles) ? obstacles : []) {
            if (obstacle?.kind !== 'component') continue
            const key = this.#componentKey(obstacle.source)
            if (key) map.set(key, obstacle)
        }
        return map
    }

    /**
     * Groups pin anchors by owning component.
     * @param {object[]} netDebug Per-net debug rows.
     * @returns {Map<string, object[]>}
     */
    static #pinsByComponent(netDebug) {
        const grouped = new Map()
        for (const net of Array.isArray(netDebug) ? netDebug : []) {
            for (const anchor of Array.isArray(net?.anchors)
                ? net.anchors
                : []) {
                if (anchor.kind !== 'pin') continue
                const key = this.#componentKey(anchor.source)
                if (!key) continue
                if (!grouped.has(key)) grouped.set(key, [])
                grouped.get(key).push({
                    ...anchor,
                    netName: net.name
                })
            }
        }
        return grouped
    }

    /**
     * Resolves a component key from a row.
     * @param {object} row Source row.
     * @returns {string}
     */
    static #componentKey(row) {
        return String(row?.refdes || row?.component || row?.designator || '')
    }

    /**
     * Builds one expanded body candidate.
     * @param {object} obstacle Component obstacle.
     * @param {object[]} anchors Outside pin anchors.
     * @returns {object}
     */
    static #bodyFitCandidate(obstacle, anchors) {
        const bounds = anchors.reduce(
            (expanded, anchor) =>
                Geometry.bounds(
                    Math.min(expanded.minX, anchor.point.x),
                    Math.min(expanded.minY, anchor.point.y),
                    Math.max(expanded.maxX, anchor.point.x),
                    Math.max(expanded.maxY, anchor.point.y)
                ),
            obstacle.bounds
        )
        return {
            kind: 'symbol-body-fit-candidate',
            obstacleId: obstacle.id,
            bounds,
            debug: {
                sourcePinIds: anchors.map((anchor) => anchor.id),
                expansion: {
                    left: obstacle.bounds.minX - bounds.minX,
                    right: bounds.maxX - obstacle.bounds.maxX,
                    top: obstacle.bounds.minY - bounds.minY,
                    bottom: bounds.maxY - obstacle.bounds.maxY
                }
            }
        }
    }

    /**
     * Builds one pin snap candidate.
     * @param {object} obstacle Component obstacle.
     * @param {object} anchor Pin anchor.
     * @returns {object}
     */
    static #pinSnapCandidate(obstacle, anchor) {
        const snap = this.#nearestEdgePoint(anchor.point, obstacle.bounds)
        return {
            kind: 'symbol-pin-snap-candidate',
            obstacleId: obstacle.id,
            netName: anchor.netName,
            anchorId: anchor.id,
            points: [anchor.point, snap.point],
            debug: {
                snapSide: snap.side,
                reason: this.#pointInsideOrOn(anchor.point, obstacle.bounds)
                    ? 'pin-inside-symbol-body'
                    : 'pin-outside-symbol-body'
            }
        }
    }

    /**
     * Finds the nearest edge point on bounds.
     * @param {object} point Source point.
     * @param {object} bounds Bounds.
     * @returns {{ point: object, side: string }}
     */
    static #nearestEdgePoint(point, bounds) {
        const candidates = [
            {
                side: 'right',
                point: {
                    x: bounds.maxX,
                    y: this.#clamp(point.y, bounds.minY, bounds.maxY)
                }
            },
            {
                side: 'left',
                point: {
                    x: bounds.minX,
                    y: this.#clamp(point.y, bounds.minY, bounds.maxY)
                }
            },
            {
                side: 'top',
                point: {
                    x: this.#clamp(point.x, bounds.minX, bounds.maxX),
                    y: bounds.minY
                }
            },
            {
                side: 'bottom',
                point: {
                    x: this.#clamp(point.x, bounds.minX, bounds.maxX),
                    y: bounds.maxY
                }
            }
        ]
        return candidates
            .map((candidate) => ({
                ...candidate,
                distance: Geometry.manhattan(point, candidate.point)
            }))
            .sort(
                (left, right) =>
                    left.distance - right.distance ||
                    left.side.localeCompare(right.side)
            )[0]
    }

    /**
     * Returns whether a point lies inside or on bounds.
     * @param {object} point Point.
     * @param {object} bounds Bounds.
     * @returns {boolean}
     */
    static #pointInsideOrOn(point, bounds) {
        return (
            point.x >= bounds.minX &&
            point.x <= bounds.maxX &&
            point.y >= bounds.minY &&
            point.y <= bounds.maxY
        )
    }

    /**
     * Returns whether a point lies on a bounds edge.
     * @param {object} point Point.
     * @param {object} bounds Bounds.
     * @returns {boolean}
     */
    static #pointOnEdge(point, bounds) {
        return (
            this.#pointInsideOrOn(point, bounds) &&
            (point.x === bounds.minX ||
                point.x === bounds.maxX ||
                point.y === bounds.minY ||
                point.y === bounds.maxY)
        )
    }

    /**
     * Clamps a coordinate to bounds extents.
     * @param {number} value Value.
     * @param {number} min Minimum.
     * @param {number} max Maximum.
     * @returns {number}
     */
    static #clamp(value, min, max) {
        return Math.min(Math.max(value, min), max)
    }
}
