import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const EDGE_EPSILON = 0.01

/**
 * Reports anchor placement issues before connectivity analysis.
 */
export class SchematicAnchorPreflightDiagnostics {
    /**
     * Analyzes pin-like anchors against sheet and symbol-body geometry.
     * @param {{ netName: string, netIndex: number, anchors: object[], obstacles: object[], sheet?: object }} context Analysis context.
     * @returns {object[]} Preflight diagnostic issues.
     */
    static analyze(context) {
        const issues = []
        const sheetBounds = this.#sheetBounds(context?.sheet)

        for (const anchor of Array.isArray(context?.anchors)
            ? context.anchors
            : []) {
            if (!this.#isPinLikeAnchor(anchor)) continue
            if (
                sheetBounds &&
                !this.#pointInsideOrOn(anchor.point, sheetBounds)
            ) {
                issues.push(
                    this.#issue(
                        context,
                        anchor,
                        'anchor-outside-sheet',
                        null,
                        sheetBounds
                    )
                )
            }

            const obstacle = this.#componentObstacleForAnchor(
                anchor,
                context?.obstacles
            )
            if (!obstacle) continue
            if (this.#pointStrictlyInside(anchor.point, obstacle.bounds)) {
                issues.push(
                    this.#issue(
                        context,
                        anchor,
                        'anchor-inside-symbol-body',
                        obstacle,
                        sheetBounds
                    )
                )
                continue
            }
            if (!this.#pointOnBoundsEdge(anchor.point, obstacle.bounds)) {
                issues.push(
                    this.#issue(
                        context,
                        anchor,
                        'anchor-off-symbol-edge',
                        obstacle,
                        sheetBounds
                    )
                )
            }
        }

        return issues
    }

    /**
     * Builds one preflight issue row.
     * @param {object} context Analysis context.
     * @param {object} anchor Anchor row.
     * @param {string} preflightKind Preflight issue kind.
     * @param {object | null} obstacle Matched body obstacle.
     * @param {object | null} sheetBounds Sheet bounds.
     * @returns {object}
     */
    static #issue(context, anchor, preflightKind, obstacle, sheetBounds) {
        return {
            type: 'schematic-anchor-preflight',
            severity: 'warning',
            netName: context.netName,
            netIndex: context.netIndex,
            anchorId: anchor.id,
            anchorKind: anchor.kind,
            preflightKind,
            obstacleId: obstacle?.id,
            debug: {
                anchor,
                obstacle,
                sheetBounds
            }
        }
    }

    /**
     * Returns whether an anchor kind should be preflighted.
     * @param {object} anchor Anchor row.
     * @returns {boolean}
     */
    static #isPinLikeAnchor(anchor) {
        return ['pin', 'port', 'sheetEntry'].includes(
            String(anchor?.kind || '')
        )
    }

    /**
     * Finds the component obstacle referenced by an anchor source row.
     * @param {object} anchor Anchor row.
     * @param {object[]} obstacles Schematic obstacles.
     * @returns {object | null}
     */
    static #componentObstacleForAnchor(anchor, obstacles) {
        const key = this.#componentKey(anchor?.source)
        if (!key || !Array.isArray(obstacles)) return null
        const obstacleId = 'component:' + key
        return obstacles.find((obstacle) => obstacle?.id === obstacleId) || null
    }

    /**
     * Resolves a component identifier from an anchor source row.
     * @param {object} source Anchor source row.
     * @returns {string}
     */
    static #componentKey(source) {
        return String(
            source?.refdes || source?.component || source?.designator || ''
        ).trim()
    }

    /**
     * Resolves the sheet bounds when width/height or explicit bounds exist.
     * @param {object} sheet Sheet row.
     * @returns {object | null}
     */
    static #sheetBounds(sheet) {
        const explicit = Geometry.boundsFromObject(sheet?.bounds)
        if (explicit) return explicit

        const width = Geometry.number(sheet?.width, NaN)
        const height = Geometry.number(sheet?.height, NaN)
        if (!Number.isFinite(width) || !Number.isFinite(height)) return null
        const x = Geometry.number(sheet?.x, 0)
        const y = Geometry.number(sheet?.y, 0)
        return Geometry.bounds(x, y, x + width, y + height)
    }

    /**
     * Returns whether a point is inside or on bounds.
     * @param {{ x: number, y: number }} point Point.
     * @param {object} bounds Bounds.
     * @returns {boolean}
     */
    static #pointInsideOrOn(point, bounds) {
        return (
            point.x >= bounds.minX - EDGE_EPSILON &&
            point.x <= bounds.maxX + EDGE_EPSILON &&
            point.y >= bounds.minY - EDGE_EPSILON &&
            point.y <= bounds.maxY + EDGE_EPSILON
        )
    }

    /**
     * Returns whether a point is strictly inside bounds.
     * @param {{ x: number, y: number }} point Point.
     * @param {object} bounds Bounds.
     * @returns {boolean}
     */
    static #pointStrictlyInside(point, bounds) {
        return (
            point.x > bounds.minX + EDGE_EPSILON &&
            point.x < bounds.maxX - EDGE_EPSILON &&
            point.y > bounds.minY + EDGE_EPSILON &&
            point.y < bounds.maxY - EDGE_EPSILON
        )
    }

    /**
     * Returns whether a point sits on any bounds edge.
     * @param {{ x: number, y: number }} point Point.
     * @param {object} bounds Bounds.
     * @returns {boolean}
     */
    static #pointOnBoundsEdge(point, bounds) {
        if (!this.#pointInsideOrOn(point, bounds)) return false
        return (
            Math.abs(point.x - bounds.minX) <= EDGE_EPSILON ||
            Math.abs(point.x - bounds.maxX) <= EDGE_EPSILON ||
            Math.abs(point.y - bounds.minY) <= EDGE_EPSILON ||
            Math.abs(point.y - bounds.maxY) <= EDGE_EPSILON
        )
    }
}
