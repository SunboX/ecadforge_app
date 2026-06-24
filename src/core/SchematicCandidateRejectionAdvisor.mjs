import { SchematicGeometryMath as Geometry } from './SchematicGeometryMath.mjs'

/**
 * Converts diagnostic collisions into candidate rejection telemetry.
 */
export class SchematicCandidateRejectionAdvisor {
    /**
     * Builds candidate rejection rows.
     * @param {{ collisionBounds: object[], labels: object[], restrictedCenterlineSegments: object[], sheet?: object }} data Diagnostic data.
     * @returns {object[]} Candidate rejection rows.
     */
    static suggest(data) {
        const rows = []
        const seen = new Set()
        this.#pushCollisionRejections(rows, seen, data.collisionBounds)
        this.#pushRestrictedCenterlineRejections(
            rows,
            seen,
            data.restrictedCenterlineSegments
        )
        this.#pushOutsideSheetRejections(rows, seen, data.labels, data.sheet)
        return rows
    }

    /**
     * Adds rejection rows derived from collision diagnostics.
     * @param {object[]} rows Mutable rejection rows.
     * @param {Set<string>} seen Dedupe set.
     * @param {object[]} collisions Collision rows.
     * @returns {void}
     */
    static #pushCollisionRejections(rows, seen, collisions) {
        for (const collision of Array.isArray(collisions) ? collisions : []) {
            if (collision.kind === 'net-label-trace-overlap') {
                this.#push(rows, seen, {
                    candidateKind: 'net-label-candidate',
                    netName: collision.netName,
                    labelId: collision.labelId,
                    reason: 'trace-collision',
                    bounds: collision.bounds,
                    debug: { sourceKind: collision.kind }
                })
            } else if (collision.kind === 'net-label-net-label-overlap') {
                this.#push(rows, seen, {
                    candidateKind: 'net-label-candidate',
                    netName: collision.netName,
                    labelId: collision.labelId,
                    reason: 'label-collision',
                    bounds: collision.bounds,
                    debug: { sourceKind: collision.kind }
                })
                this.#push(rows, seen, {
                    candidateKind: 'net-label-candidate',
                    netName: collision.otherNetName,
                    labelId: collision.otherLabelId,
                    reason: 'label-collision',
                    bounds: collision.bounds,
                    debug: { sourceKind: collision.kind }
                })
            } else if (collision.kind === 'net-label-symbol-overlap') {
                this.#push(rows, seen, {
                    candidateKind: 'net-label-candidate',
                    netName: collision.netName,
                    labelId: collision.labelId,
                    reason: 'body-collision',
                    bounds: collision.bounds,
                    debug: {
                        sourceKind: collision.kind,
                        obstacleId: collision.obstacleId
                    }
                })
            }
        }
    }

    /**
     * Adds rejection rows from restricted centerline diagnostics.
     * @param {object[]} rows Mutable rejection rows.
     * @param {Set<string>} seen Dedupe set.
     * @param {object[]} restrictedRows Restricted centerline rows.
     * @returns {void}
     */
    static #pushRestrictedCenterlineRejections(rows, seen, restrictedRows) {
        for (const row of Array.isArray(restrictedRows) ? restrictedRows : []) {
            this.#push(rows, seen, {
                candidateKind: 'connection-candidate',
                netName: row.netName,
                labelId: '',
                reason: 'restricted-centerline',
                points: row.points,
                debug: {
                    sourceKind: row.kind,
                    obstacleId: row.obstacleId
                }
            })
        }
    }

    /**
     * Adds rejection rows for label candidates outside the schematic sheet.
     * @param {object[]} rows Mutable rejection rows.
     * @param {Set<string>} seen Dedupe set.
     * @param {object[]} labels Label rows.
     * @param {object} sheet Sheet metadata.
     * @returns {void}
     */
    static #pushOutsideSheetRejections(rows, seen, labels, sheet) {
        const sheetBounds = this.#sheetBounds(sheet)
        if (!sheetBounds) return
        for (const label of Array.isArray(labels) ? labels : []) {
            if (this.#boundsInside(label.bounds, sheetBounds)) continue
            this.#push(rows, seen, {
                candidateKind: 'net-label-candidate',
                netName: label.netName,
                labelId: label.id,
                reason: 'outside-sheet',
                bounds: label.bounds,
                debug: { sheetBounds }
            })
        }
    }

    /**
     * Pushes one deduplicated rejection row.
     * @param {object[]} rows Mutable rejection rows.
     * @param {Set<string>} seen Dedupe set.
     * @param {object} row Rejection row.
     * @returns {void}
     */
    static #push(rows, seen, row) {
        const key = [
            row.candidateKind,
            row.netName,
            row.labelId,
            row.reason,
            row.debug?.obstacleId || ''
        ].join('|')
        if (seen.has(key)) return
        seen.add(key)
        rows.push({
            kind: 'diagnostic-candidate-rejection',
            ...row
        })
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
     * Returns whether inner bounds fit within outer bounds.
     * @param {object} inner Inner bounds.
     * @param {object} outer Outer bounds.
     * @returns {boolean}
     */
    static #boundsInside(inner, outer) {
        return (
            inner.minX >= outer.minX &&
            inner.maxX <= outer.maxX &&
            inner.minY >= outer.minY &&
            inner.maxY <= outer.maxY
        )
    }
}
