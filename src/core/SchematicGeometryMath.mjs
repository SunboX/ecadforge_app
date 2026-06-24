export const SCHEMATIC_GEOMETRY_EPSILON = 1e-6

/**
 * Provides deterministic schematic coordinate and bounds helpers.
 */
export class SchematicGeometryMath {
    /**
     * Resolves every valid point-list representation exposed by one segment.
     * @param {object} segment Segment metadata.
     * @returns {Array<Array<{ x: number, y: number }>>}
     */
    static validSegmentForms(segment) {
        const forms = []
        if (Array.isArray(segment?.points)) {
            forms.push(this.#normalizedPointList(segment.points))
        }

        const endpointForm = this.#endpointPointList(segment)
        if (endpointForm) forms.push(endpointForm)

        const xyForm = this.#xyPointList(segment)
        if (xyForm) forms.push(xyForm)

        return forms.filter(Boolean)
    }

    /**
     * Converts an object with x/y coordinates into a finite point.
     * @param {object} point Raw point.
     * @returns {{ x: number, y: number } | null}
     */
    static pointFromObject(point) {
        const x = Number(point?.x)
        const y = Number(point?.y)
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Returns whether every point list has the same coordinates.
     * @param {Array<Array<{ x: number, y: number }>>} forms Segment forms.
     * @returns {boolean}
     */
    static pointListsMatch(forms) {
        const [first, ...rest] = forms
        return rest.every((points) => this.#samePointList(first, points))
    }

    /**
     * Returns whether two points match within tolerance.
     * @param {{ x: number, y: number }} a First point.
     * @param {{ x: number, y: number }} b Second point.
     * @returns {boolean}
     */
    static samePoint(a, b) {
        return (
            Math.abs(a.x - b.x) <= SCHEMATIC_GEOMETRY_EPSILON &&
            Math.abs(a.y - b.y) <= SCHEMATIC_GEOMETRY_EPSILON
        )
    }

    /**
     * Returns the varying axis for an orthogonal segment.
     * @param {{ x: number, y: number }} start Segment start.
     * @param {{ x: number, y: number }} end Segment end.
     * @returns {'x' | 'y' | ''}
     */
    static segmentAxis(start, end) {
        if (Math.abs(start.y - end.y) <= SCHEMATIC_GEOMETRY_EPSILON) {
            return 'x'
        }
        if (Math.abs(start.x - end.x) <= SCHEMATIC_GEOMETRY_EPSILON) {
            return 'y'
        }
        return ''
    }

    /**
     * Returns Manhattan distance between two points.
     * @param {{ x: number, y: number }} a First point.
     * @param {{ x: number, y: number }} b Second point.
     * @returns {number}
     */
    static manhattan(a, b) {
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
    }

    /**
     * Resolves the overlapping portion of two colinear segments.
     * @param {object} a First segment.
     * @param {object} b Second segment.
     * @returns {{ points: Array<{ x: number, y: number }>, axis: 'x' | 'y' } | null}
     */
    static segmentOverlap(a, b) {
        if (a.axis !== b.axis) return null
        const [aStart, aEnd] = a.points
        const [bStart, bEnd] = b.points

        if (a.axis === 'x') {
            if (Math.abs(aStart.y - bStart.y) > SCHEMATIC_GEOMETRY_EPSILON) {
                return null
            }
            const range = this.rangeOverlap(aStart.x, aEnd.x, bStart.x, bEnd.x)
            return range
                ? {
                      points: [
                          { x: range[0], y: aStart.y },
                          { x: range[1], y: aStart.y }
                      ],
                      axis: 'x'
                  }
                : null
        }

        if (Math.abs(aStart.x - bStart.x) > SCHEMATIC_GEOMETRY_EPSILON) {
            return null
        }
        const range = this.rangeOverlap(aStart.y, aEnd.y, bStart.y, bEnd.y)
        return range
            ? {
                  points: [
                      { x: aStart.x, y: range[0] },
                      { x: aStart.x, y: range[1] }
                  ],
                  axis: 'y'
              }
            : null
    }

    /**
     * Returns the overlapping numeric range when it has positive length.
     * @param {number} aStart First start.
     * @param {number} aEnd First end.
     * @param {number} bStart Second start.
     * @param {number} bEnd Second end.
     * @returns {[number, number] | null}
     */
    static rangeOverlap(aStart, aEnd, bStart, bEnd) {
        const min = Math.max(Math.min(aStart, aEnd), Math.min(bStart, bEnd))
        const max = Math.min(Math.max(aStart, aEnd), Math.max(bStart, bEnd))
        return max - min > SCHEMATIC_GEOMETRY_EPSILON ? [min, max] : null
    }

    /**
     * Builds a stable point key.
     * @param {{ x: number, y: number }} point Point.
     * @returns {string}
     */
    static pointKey(point) {
        return point.x.toFixed(6) + ',' + point.y.toFixed(6)
    }

    /**
     * Returns whether a point lies on an orthogonal segment.
     * @param {{ x: number, y: number }} point Point.
     * @param {object} segment Segment row.
     * @returns {boolean}
     */
    static pointOnSegment(point, segment) {
        const [start, end] = segment.points
        if (segment.axis === 'x') {
            return (
                Math.abs(point.y - start.y) <= SCHEMATIC_GEOMETRY_EPSILON &&
                point.x >=
                    Math.min(start.x, end.x) - SCHEMATIC_GEOMETRY_EPSILON &&
                point.x <= Math.max(start.x, end.x) + SCHEMATIC_GEOMETRY_EPSILON
            )
        }
        return (
            Math.abs(point.x - start.x) <= SCHEMATIC_GEOMETRY_EPSILON &&
            point.y >= Math.min(start.y, end.y) - SCHEMATIC_GEOMETRY_EPSILON &&
            point.y <= Math.max(start.y, end.y) + SCHEMATIC_GEOMETRY_EPSILON
        )
    }

    /**
     * Returns whether an orthogonal segment intersects bounds with positive length.
     * @param {Array<{ x: number, y: number }>} points Segment points.
     * @param {object} bounds Bounds.
     * @returns {boolean}
     */
    static segmentIntersectsBounds(points, bounds) {
        const [start, end] = points
        if (Math.abs(start.y - end.y) <= SCHEMATIC_GEOMETRY_EPSILON) {
            const y = start.y
            if (
                y < bounds.minY - SCHEMATIC_GEOMETRY_EPSILON ||
                y > bounds.maxY + SCHEMATIC_GEOMETRY_EPSILON
            ) {
                return false
            }
            return Boolean(
                this.rangeOverlap(start.x, end.x, bounds.minX, bounds.maxX)
            )
        }
        if (Math.abs(start.x - end.x) <= SCHEMATIC_GEOMETRY_EPSILON) {
            const x = start.x
            if (
                x < bounds.minX - SCHEMATIC_GEOMETRY_EPSILON ||
                x > bounds.maxX + SCHEMATIC_GEOMETRY_EPSILON
            ) {
                return false
            }
            return Boolean(
                this.rangeOverlap(start.y, end.y, bounds.minY, bounds.maxY)
            )
        }
        return false
    }

    /**
     * Resolves bounds from points.
     * @param {Array<{ x: number, y: number }>} points Points.
     * @returns {object}
     */
    static boundsForPoints(points) {
        return points.reduce(
            (bounds, point) =>
                bounds
                    ? this.bounds(
                          Math.min(bounds.minX, point.x),
                          Math.min(bounds.minY, point.y),
                          Math.max(bounds.maxX, point.x),
                          Math.max(bounds.maxY, point.y)
                      )
                    : this.bounds(point.x, point.y, point.x, point.y),
            null
        )
    }

    /**
     * Resolves bounds from an object.
     * @param {object} value Bounds candidate.
     * @returns {object | null}
     */
    static boundsFromObject(value) {
        if (!value) return null
        const minX = this.number(value.minX ?? value.left, NaN)
        const minY = this.number(value.minY ?? value.top, NaN)
        const maxX = this.number(value.maxX ?? value.right, NaN)
        const maxY = this.number(value.maxY ?? value.bottom, NaN)
        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY)
        ) {
            return null
        }
        return this.bounds(minX, minY, maxX, maxY)
    }

    /**
     * Builds center-based bounds.
     * @param {{ x: number, y: number }} center Center point.
     * @param {number} width Width.
     * @param {number} height Height.
     * @returns {object}
     */
    static centerBounds(center, width, height) {
        return this.bounds(
            center.x - width / 2,
            center.y - height / 2,
            center.x + width / 2,
            center.y + height / 2
        )
    }

    /**
     * Builds normalized bounds.
     * @param {number} minX Minimum x.
     * @param {number} minY Minimum y.
     * @param {number} maxX Maximum x.
     * @param {number} maxY Maximum y.
     * @returns {object}
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
     * Returns whether two bounds overlap with positive area.
     * @param {object} left Left bounds.
     * @param {object} right Right bounds.
     * @returns {boolean}
     */
    static boundsOverlap(left, right) {
        return (
            left.minX < right.maxX - SCHEMATIC_GEOMETRY_EPSILON &&
            left.maxX > right.minX + SCHEMATIC_GEOMETRY_EPSILON &&
            left.minY < right.maxY - SCHEMATIC_GEOMETRY_EPSILON &&
            left.maxY > right.minY + SCHEMATIC_GEOMETRY_EPSILON
        )
    }

    /**
     * Returns whether two bounds touch or overlap.
     * @param {object} left Left bounds.
     * @param {object} right Right bounds.
     * @returns {boolean}
     */
    static boundsTouchOrOverlap(left, right) {
        return (
            left.minX <= right.maxX + SCHEMATIC_GEOMETRY_EPSILON &&
            left.maxX >= right.minX - SCHEMATIC_GEOMETRY_EPSILON &&
            left.minY <= right.maxY + SCHEMATIC_GEOMETRY_EPSILON &&
            left.maxY >= right.minY - SCHEMATIC_GEOMETRY_EPSILON
        )
    }

    /**
     * Resolves intersection bounds.
     * @param {object} left Left bounds.
     * @param {object} right Right bounds.
     * @returns {object | null}
     */
    static intersectionBounds(left, right) {
        const minX = Math.max(left.minX, right.minX)
        const minY = Math.max(left.minY, right.minY)
        const maxX = Math.min(left.maxX, right.maxX)
        const maxY = Math.min(left.maxY, right.maxY)
        return maxX >= minX && maxY >= minY
            ? this.bounds(minX, minY, maxX, maxY)
            : null
    }

    /**
     * Parses a numeric value.
     * @param {unknown} value Value.
     * @param {number} fallback Fallback.
     * @returns {number}
     */
    static number(value, fallback) {
        if (Number.isFinite(value)) return Number(value)
        if (typeof value === 'string') {
            const match = value.trim().match(/^-?\d+(?:\.\d+)?/u)
            if (match) return Number(match[0])
        }
        return fallback
    }

    /**
     * Normalizes a point list if every point is finite.
     * @param {any[]} points Raw points.
     * @returns {Array<{ x: number, y: number }> | null}
     */
    static #normalizedPointList(points) {
        if (!Array.isArray(points) || points.length < 2) return null
        const normalized = points.map((point) => this.pointFromObject(point))
        return normalized.every(Boolean) ? normalized : null
    }

    /**
     * Resolves a start/end or from/to point list.
     * @param {object} segment Segment metadata.
     * @returns {Array<{ x: number, y: number }> | null}
     */
    static #endpointPointList(segment) {
        const start = segment?.start || segment?.from
        const end = segment?.end || segment?.to
        if (!start || !end) return null
        return this.#normalizedPointList([start, end])
    }

    /**
     * Resolves an x1/y1/x2/y2 point list.
     * @param {object} segment Segment metadata.
     * @returns {Array<{ x: number, y: number }> | null}
     */
    static #xyPointList(segment) {
        const hasAny =
            'x1' in Object(segment) ||
            'y1' in Object(segment) ||
            'x2' in Object(segment) ||
            'y2' in Object(segment)
        if (!hasAny) return null
        return this.#normalizedPointList([
            { x: segment?.x1, y: segment?.y1 },
            { x: segment?.x2, y: segment?.y2 }
        ])
    }

    /**
     * Returns whether two point lists match within tolerance.
     * @param {{ x: number, y: number }[]} a First point list.
     * @param {{ x: number, y: number }[]} b Second point list.
     * @returns {boolean}
     */
    static #samePointList(a, b) {
        return (
            a.length === b.length &&
            a.every((point, index) => this.samePoint(point, b[index]))
        )
    }
}
