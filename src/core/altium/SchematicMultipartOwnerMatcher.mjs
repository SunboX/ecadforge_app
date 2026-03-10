import { ParserUtils } from './ParserUtils.mjs'

const { getField, parseBoolean, parseNumericField } = ParserUtils

/**
 * Resolves which multipart symbol section is visible for one schematic owner.
 */
export class SchematicMultipartOwnerMatcher {
    /**
     * Matches multipart owner indexes to the currently visible part id stored
     * on their component placements.
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} records
     * @param {{ raw: string, fields: Record<string, string | string[]> }[]} componentRecords
     * @returns {Map<string, string>}
     */
    static collectActiveMultipartOwnerParts(records, componentRecords) {
        const partBounds = new Map()

        for (const record of records) {
            const ownerIndex = getField(record.fields, 'OwnerIndex')
            const ownerPartId = getField(record.fields, 'OwnerPartId')

            if (!ownerIndex || !ownerPartId || ownerPartId === '-1') {
                continue
            }

            const points =
                SchematicMultipartOwnerMatcher.#collectSchematicRecordPoints(
                    record.fields
                )
            if (!points.length) {
                continue
            }

            const key = ownerIndex + '::' + ownerPartId
            const existingBounds = partBounds.get(key) || {
                ownerIndex,
                ownerPartId,
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY
            }

            for (const [x, y] of points) {
                existingBounds.minX = Math.min(existingBounds.minX, x)
                existingBounds.minY = Math.min(existingBounds.minY, y)
                existingBounds.maxX = Math.max(existingBounds.maxX, x)
                existingBounds.maxY = Math.max(existingBounds.maxY, y)
            }

            partBounds.set(key, existingBounds)
        }

        const activeOwnerParts = new Map()

        for (const record of componentRecords) {
            const currentPartId = String(
                parseNumericField(record.fields, 'CurrentPartId') || ''
            )
            const partCount = parseNumericField(record.fields, 'PartCount') || 0
            const x = parseNumericField(record.fields, 'Location.X')
            const y = parseNumericField(record.fields, 'Location.Y')
            const isMirrored = parseBoolean(record.fields.IsMirrored)

            if (!currentPartId || partCount <= 1 || x === null || y === null) {
                continue
            }

            const bestMatch = [...partBounds.values()]
                .filter((bounds) => bounds.ownerPartId === currentPartId)
                .map((bounds) => ({
                    ...bounds,
                    score: SchematicMultipartOwnerMatcher.#scoreBoundsAnchor(
                        bounds,
                        x,
                        y,
                        isMirrored,
                        currentPartId
                    )
                }))
                .sort((left, right) => left.score - right.score)[0]

            if (bestMatch && bestMatch.score <= 4) {
                activeOwnerParts.set(bestMatch.ownerIndex, bestMatch.ownerPartId)
            }
        }

        return activeOwnerParts
    }

    /**
     * Returns true when one schematic record belongs to the selected visible
     * part for a multipart owner.
     * @param {Record<string, string | string[]>} fields
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {boolean}
     */
    static isActiveOwnerPartRecord(fields, activeMultipartOwnerParts) {
        const ownerIndex = getField(fields, 'OwnerIndex')
        if (!ownerIndex) {
            return true
        }

        const activePartId = activeMultipartOwnerParts.get(ownerIndex)
        if (!activePartId) {
            return true
        }

        const ownerPartId = getField(fields, 'OwnerPartId')
        if (!ownerPartId || ownerPartId === '-1') {
            return true
        }

        return ownerPartId === activePartId
    }

    /**
     * Collects the coordinate points embedded in one schematic record.
     * @param {Record<string, string | string[]>} fields
     * @returns {[number, number][]}
     */
    static #collectSchematicRecordPoints(fields) {
        const points = []
        const locationX = parseNumericField(fields, 'Location.X')
        const locationY = parseNumericField(fields, 'Location.Y')
        const cornerX = parseNumericField(fields, 'Corner.X')
        const cornerY = parseNumericField(fields, 'Corner.Y')
        const locationCount = parseNumericField(fields, 'LocationCount') || 0

        if (locationX !== null && locationY !== null) {
            points.push([locationX, locationY])
        }

        if (cornerX !== null && cornerY !== null) {
            points.push([cornerX, cornerY])
        }

        for (let index = 1; index <= locationCount; index += 1) {
            const x = parseNumericField(fields, 'X' + index)
            const y = parseNumericField(fields, 'Y' + index)

            if (x === null || y === null) {
                break
            }

            points.push([x, y])
        }

        return points
    }

    /**
     * Scores how closely one component placement matches the corners of one
     * multipart part bounds box. Altium mirrored units can anchor on the
     * right-hand side instead of the default top-left corner.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} x
     * @param {number} y
     * @param {boolean} isMirrored
     * @param {string} currentPartId
     * @returns {number}
     */
    static #scoreBoundsAnchor(bounds, x, y, isMirrored, currentPartId) {
        if (!isMirrored || currentPartId === '1') {
            return Math.abs(bounds.minX - x) + Math.abs(bounds.minY - y)
        }

        return Math.min(
            Math.abs(bounds.maxX - x) + Math.abs(bounds.minY - y),
            Math.abs(bounds.maxX - x) + Math.abs(bounds.maxY - y)
        )
    }
}
