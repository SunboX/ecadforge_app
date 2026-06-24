import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

/**
 * Detects candidate connections that run through a symbol body centerline.
 */
export class SchematicRestrictedCenterlineAdvisor {
    /**
     * Builds restricted centerline diagnostics.
     * @param {{ orthogonalSegments: object[], fallbackSegments: object[], obstacles: object[] }} data Diagnostic data.
     * @returns {{ restrictedCenterlineSegments: object[], issues: object[] }}
     */
    static analyze(data) {
        const restrictedCenterlineSegments = []
        const issues = []
        const seen = new Set()
        const sources = this.#sourceSegments(data)

        for (const source of sources) {
            for (const obstacle of this.#componentObstacles(data.obstacles)) {
                const crossing = this.#centerlineCrossing(source, obstacle)
                if (!crossing) continue

                const key = [
                    source.netName,
                    obstacle.id,
                    crossing.axis,
                    crossing.points.map(Geometry.pointKey).join(':')
                ].join('|')
                if (seen.has(key)) continue
                seen.add(key)

                const row = {
                    kind: 'schematic-routing-restricted-centerline-crossing',
                    netName: source.netName,
                    obstacleId: obstacle.id,
                    axis: crossing.axis,
                    points: crossing.points,
                    debug: {
                        sourceKind: source.sourceKind,
                        centerline: crossing.centerline,
                        sourceSegmentKey: source.sourceSegmentKey
                    }
                }
                restrictedCenterlineSegments.push(row)
                issues.push({
                    type: 'schematic-routing-restricted-centerline-crossing',
                    severity: 'warning',
                    netName: source.netName,
                    obstacleId: obstacle.id,
                    axis: crossing.axis,
                    debug: {
                        sourceSegment: source,
                        restrictedSegment: row
                    }
                })
            }
        }

        return { restrictedCenterlineSegments, issues }
    }

    /**
     * Normalizes authored and fallback rows into source segments.
     * @param {object} data Diagnostic data.
     * @returns {object[]}
     */
    static #sourceSegments(data) {
        return [
            ...(Array.isArray(data.orthogonalSegments)
                ? data.orthogonalSegments.map((segment) => ({
                      netName: segment.netName,
                      points: segment.points,
                      axis: segment.axis,
                      sourceKind: 'authored-net-segment',
                      sourceSegmentKey: segment.key || ''
                  }))
                : []),
            ...(Array.isArray(data.fallbackSegments)
                ? data.fallbackSegments.map((segment) => ({
                      netName: segment.netName,
                      points: segment.points,
                      axis: this.#axisForPoints(segment.points),
                      sourceKind: String(segment.kind || 'fallback-connection'),
                      sourceSegmentKey: ''
                  }))
                : [])
        ].filter((segment) => segment.axis)
    }

    /**
     * Returns component body obstacles only.
     * @param {object[]} obstacles Schematic obstacles.
     * @returns {object[]}
     */
    static #componentObstacles(obstacles) {
        return (Array.isArray(obstacles) ? obstacles : []).filter(
            (obstacle) => obstacle?.kind === 'component'
        )
    }

    /**
     * Resolves the axis for a two-point segment.
     * @param {object[]} points Segment points.
     * @returns {'x' | 'y' | ''}
     */
    static #axisForPoints(points) {
        if (!Array.isArray(points) || points.length < 2) return ''
        return Geometry.segmentAxis(points[0], points[1])
    }

    /**
     * Finds the portion of a source segment crossing an obstacle centerline.
     * @param {object} source Source segment.
     * @param {object} obstacle Component obstacle.
     * @returns {object | null}
     */
    static #centerlineCrossing(source, obstacle) {
        const [start, end] = source.points
        const bounds = obstacle.bounds
        const center = {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        }

        if (
            source.axis === 'x' &&
            Geometry.samePoint(
                { x: start.x, y: start.y },
                { x: start.x, y: center.y }
            )
        ) {
            const range = Geometry.rangeOverlap(
                start.x,
                end.x,
                bounds.minX,
                bounds.maxX
            )
            if (!range) return null
            return {
                axis: 'x',
                centerline: 'horizontal',
                points: [
                    { x: range[0], y: center.y },
                    { x: range[1], y: center.y }
                ]
            }
        }

        if (
            source.axis === 'y' &&
            Geometry.samePoint(
                { x: start.x, y: start.y },
                { x: center.x, y: start.y }
            )
        ) {
            const range = Geometry.rangeOverlap(
                start.y,
                end.y,
                bounds.minY,
                bounds.maxY
            )
            if (!range) return null
            return {
                axis: 'y',
                centerline: 'vertical',
                points: [
                    { x: center.x, y: range[0] },
                    { x: center.x, y: range[1] }
                ]
            }
        }

        return null
    }
}
