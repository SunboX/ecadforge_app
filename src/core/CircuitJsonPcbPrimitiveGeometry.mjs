/**
 * Provides shared geometry helpers for CircuitJSON PCB primitive builders.
 */
export class CircuitJsonPcbPrimitiveGeometry {
    /**
     * Builds a normalized bounds record.
     * @param {number} minX Minimum x.
     * @param {number} minY Minimum y.
     * @param {number} maxX Maximum x.
     * @param {number} maxY Maximum y.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }}
     */
    static bounds(minX, minY, maxX, maxY) {
        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            height: maxY - minY
        }
    }

    /**
     * Builds bounds from a center and dimensions.
     * @param {{ x: number, y: number }} center Center point.
     * @param {number} width Width.
     * @param {number} height Height.
     * @returns {object}
     */
    static centerBounds(center, width, height) {
        return CircuitJsonPcbPrimitiveGeometry.bounds(
            center.x - width / 2,
            center.y - height / 2,
            center.x + width / 2,
            center.y + height / 2
        )
    }

    /**
     * Builds segment bounds.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @param {number} width Segment width.
     * @returns {object}
     */
    static segmentBounds(start, end, width) {
        const margin = Math.max(width / 2, 0)
        return CircuitJsonPcbPrimitiveGeometry.bounds(
            Math.min(start.x, end.x) - margin,
            Math.min(start.y, end.y) - margin,
            Math.max(start.x, end.x) + margin,
            Math.max(start.y, end.y) + margin
        )
    }

    /**
     * Builds bounds for a point list.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {object | null}
     */
    static pointsBounds(points) {
        return points.reduce(
            (bounds, point) =>
                bounds
                    ? CircuitJsonPcbPrimitiveGeometry.bounds(
                          Math.min(bounds.minX, point.x),
                          Math.min(bounds.minY, point.y),
                          Math.max(bounds.maxX, point.x),
                          Math.max(bounds.maxY, point.y)
                      )
                    : CircuitJsonPcbPrimitiveGeometry.bounds(
                          point.x,
                          point.y,
                          point.x,
                          point.y
                      ),
            null
        )
    }

    /**
     * Builds merged primitive bounds.
     * @param {object[]} primitives Primitive rows.
     * @returns {object | null}
     */
    static mergedPrimitiveBounds(primitives) {
        return primitives.reduce((bounds, primitive) => {
            if (!primitive.bounds) return bounds
            if (!bounds) return primitive.bounds
            return CircuitJsonPcbPrimitiveGeometry.bounds(
                Math.min(bounds.minX, primitive.bounds.minX),
                Math.min(bounds.minY, primitive.bounds.minY),
                Math.max(bounds.maxX, primitive.bounds.maxX),
                Math.max(bounds.maxY, primitive.bounds.maxY)
            )
        }, null)
    }

    /**
     * Builds corner anchors for bounds.
     * @param {object} bounds Bounds record.
     * @returns {object[]}
     */
    static cornerAnchors(bounds) {
        return CircuitJsonPcbPrimitiveGeometry.boundsAnchors(bounds)
    }

    /**
     * Builds corner, edge-center, and center anchors for bounds.
     * @param {object} bounds Bounds record.
     * @returns {object[]}
     */
    static boundsAnchors(bounds) {
        const centerX = CircuitJsonPcbPrimitiveGeometry.#round(
            bounds.minX + bounds.width / 2
        )
        const centerY = CircuitJsonPcbPrimitiveGeometry.#round(
            bounds.minY + bounds.height / 2
        )
        return [
            { point: { x: bounds.minX, y: bounds.minY } },
            { point: { x: centerX, y: bounds.minY } },
            { point: { x: bounds.maxX, y: bounds.minY } },
            { point: { x: bounds.maxX, y: centerY } },
            { point: { x: bounds.maxX, y: bounds.maxY } },
            { point: { x: centerX, y: bounds.maxY } },
            { point: { x: bounds.minX, y: bounds.maxY } },
            { point: { x: bounds.minX, y: centerY } },
            { point: { x: centerX, y: centerY } }
        ]
    }

    /**
     * Rounds computed geometry values to stable precision.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        return Math.round(Number(value || 0) * 1_000_000) / 1_000_000
    }
}
