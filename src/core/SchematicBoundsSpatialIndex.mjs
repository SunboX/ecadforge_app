import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

const DEFAULT_CELL_SIZE = 10

/**
 * Indexes rectangular schematic bounds into deterministic grid buckets.
 */
export class SchematicBoundsSpatialIndex {
    #buckets = new Map()
    #cellSize
    #items = []

    /**
     * Builds an index from rows that expose a `bounds` object.
     * @param {object[]} items Bounds-bearing rows.
     * @param {{ cellSize?: number }} [options] Index options.
     */
    constructor(items = [], options = {}) {
        this.#cellSize = this.#resolvedCellSize(options.cellSize)
        for (const item of Array.isArray(items) ? items : []) {
            this.#add(item)
        }
    }

    /**
     * Returns serializable index diagnostics.
     * @returns {{ indexedItemCount: number, bucketCount: number, cellSize: number }}
     */
    get stats() {
        return {
            indexedItemCount: this.#items.length,
            bucketCount: this.#buckets.size,
            cellSize: this.#cellSize
        }
    }

    /**
     * Returns indexed rows whose bounds touch or overlap the query bounds.
     * @param {object} bounds Query bounds.
     * @returns {object[]}
     */
    query(bounds) {
        if (!this.#isValidBounds(bounds)) return []

        const matches = []
        const seen = new Set()
        for (const key of this.#bucketKeys(bounds)) {
            for (const item of this.#buckets.get(key) || []) {
                if (seen.has(item)) continue
                seen.add(item)
                if (Geometry.boundsTouchOrOverlap(bounds, item.bounds)) {
                    matches.push(item)
                }
            }
        }
        return matches
    }

    /**
     * Adds one row to every bucket touched by its bounds.
     * @param {object} item Bounds-bearing row.
     * @returns {void}
     */
    #add(item) {
        if (!this.#isValidBounds(item?.bounds)) return
        this.#items.push(item)
        for (const key of this.#bucketKeys(item.bounds)) {
            if (!this.#buckets.has(key)) this.#buckets.set(key, [])
            this.#buckets.get(key).push(item)
        }
    }

    /**
     * Returns all bucket keys touched by bounds.
     * @param {object} bounds Bounds.
     * @returns {string[]}
     */
    #bucketKeys(bounds) {
        const range = this.#bucketRange(bounds)
        const keys = []
        for (let x = range.minX; x <= range.maxX; x++) {
            for (let y = range.minY; y <= range.maxY; y++) {
                keys.push(this.#bucketKey(x, y))
            }
        }
        return keys
    }

    /**
     * Resolves the bucket coordinate range for bounds.
     * @param {object} bounds Bounds.
     * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
     */
    #bucketRange(bounds) {
        return {
            minX: Math.floor(bounds.minX / this.#cellSize),
            maxX: Math.floor(bounds.maxX / this.#cellSize),
            minY: Math.floor(bounds.minY / this.#cellSize),
            maxY: Math.floor(bounds.maxY / this.#cellSize)
        }
    }

    /**
     * Builds a stable bucket key.
     * @param {number} x Bucket x coordinate.
     * @param {number} y Bucket y coordinate.
     * @returns {string}
     */
    #bucketKey(x, y) {
        return String(x) + ':' + String(y)
    }

    /**
     * Resolves a positive cell size.
     * @param {unknown} value Requested cell size.
     * @returns {number}
     */
    #resolvedCellSize(value) {
        const cellSize = Number(value)
        return Number.isFinite(cellSize) && cellSize > 0
            ? cellSize
            : DEFAULT_CELL_SIZE
    }

    /**
     * Returns whether a value is usable finite bounds.
     * @param {object} bounds Bounds candidate.
     * @returns {boolean}
     */
    #isValidBounds(bounds) {
        return (
            Number.isFinite(bounds?.minX) &&
            Number.isFinite(bounds?.minY) &&
            Number.isFinite(bounds?.maxX) &&
            Number.isFinite(bounds?.maxY)
        )
    }
}
