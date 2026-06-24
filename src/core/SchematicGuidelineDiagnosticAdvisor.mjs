import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

/**
 * Builds read-only routing guideline overlays from schematic body geometry.
 */
export class SchematicGuidelineDiagnosticAdvisor {
    /**
     * Suggests horizontal and vertical routing guidelines between obstacles.
     * @param {object[]} obstacles Schematic body obstacles.
     * @param {object} sheet Sheet metadata.
     * @returns {object[]} Guideline segment rows.
     */
    static suggest(obstacles, sheet) {
        const bodyObstacles = (
            Array.isArray(obstacles) ? obstacles : []
        ).filter((obstacle) => obstacle?.kind === 'component')
        const bounds = this.#guidelineBounds(bodyObstacles, sheet)
        const guidelines = []
        const seen = new Set()

        for (let left = 0; left < bodyObstacles.length; left++) {
            for (let right = left + 1; right < bodyObstacles.length; right++) {
                guidelines.push(
                    ...this.#guidelinesForPair(
                        bodyObstacles[left],
                        bodyObstacles[right],
                        bounds,
                        seen
                    )
                )
            }
        }

        return guidelines
    }

    /**
     * Builds guidelines for one obstacle pair.
     * @param {object} first First obstacle.
     * @param {object} second Second obstacle.
     * @param {object} bounds Guideline extent bounds.
     * @param {Set<string>} seen Dedupe keys.
     * @returns {object[]}
     */
    static #guidelinesForPair(first, second, bounds, seen) {
        const firstCenter = this.#boundsCenter(first.bounds)
        const secondCenter = this.#boundsCenter(second.bounds)
        const y = (firstCenter.y + secondCenter.y) / 2
        const x = (firstCenter.x + secondCenter.x) / 2
        return [
            this.#guideline(
                'horizontal',
                [
                    { x: bounds.minX, y },
                    { x: bounds.maxX, y }
                ],
                first,
                second,
                seen
            ),
            this.#guideline(
                'vertical',
                [
                    { x, y: bounds.minY },
                    { x, y: bounds.maxY }
                ],
                first,
                second,
                seen
            )
        ].filter(Boolean)
    }

    /**
     * Builds one guideline row if it has not already been emitted.
     * @param {string} orientation Guideline orientation.
     * @param {object[]} points Guideline points.
     * @param {object} first First source obstacle.
     * @param {object} second Second source obstacle.
     * @param {Set<string>} seen Dedupe keys.
     * @returns {object | null}
     */
    static #guideline(orientation, points, first, second, seen) {
        const key =
            orientation +
            ':' +
            points.map((point) => point.x + ',' + point.y).join(':')
        if (seen.has(key)) return null
        seen.add(key)
        return {
            kind: 'schematic-routing-guideline',
            orientation,
            points,
            debug: {
                sourceObstacleIds: [first.id, second.id]
            }
        }
    }

    /**
     * Resolves guideline extents from the sheet or obstacle union.
     * @param {object[]} obstacles Body obstacles.
     * @param {object} sheet Sheet metadata.
     * @returns {object}
     */
    static #guidelineBounds(obstacles, sheet) {
        const sheetBounds = this.#sheetBounds(sheet)
        if (sheetBounds) return sheetBounds
        return obstacles.reduce(
            (bounds, obstacle) =>
                bounds
                    ? Geometry.bounds(
                          Math.min(bounds.minX, obstacle.bounds.minX),
                          Math.min(bounds.minY, obstacle.bounds.minY),
                          Math.max(bounds.maxX, obstacle.bounds.maxX),
                          Math.max(bounds.maxY, obstacle.bounds.maxY)
                      )
                    : obstacle.bounds,
            Geometry.bounds(0, 0, 0, 0)
        )
    }

    /**
     * Resolves sheet bounds.
     * @param {object} sheet Sheet metadata.
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
     * Returns the center of bounds.
     * @param {object} bounds Bounds.
     * @returns {{ x: number, y: number }}
     */
    static #boundsCenter(bounds) {
        return {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        }
    }
}
