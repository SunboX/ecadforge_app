import { ParserUtils } from './ParserUtils.mjs'

const {
    getField,
    parseBoolean,
    parseNumericField,
    parseNumericFieldWithFraction,
    toColor
} = ParserUtils

/**
 * Normalizes schematic drawing primitives that are not plain line segments.
 */
export class SchematicPrimitiveParser {
    /**
     * Normalizes record-7 polygon primitives into fill-capable polygons.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ points: { x: number, y: number }[], color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[]}
     */
    static parseSchematicPolygons(records) {
        return records
            .map((record, index) => {
                const points = SchematicPrimitiveParser.#collectPolygonPoints(
                    record.fields
                )

                if (points.length < 2) {
                    return null
                }

                return {
                    points,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    fill: toColor(record.fields.AreaColor, '#ffe16f'),
                    isSolid: parseBoolean(record.fields.IsSolid),
                    transparent: parseBoolean(record.fields.Transparent),
                    lineWidth: parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-14 body primitives into drawable rectangles.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[]}
     */
    static parseSchematicRectangles(records) {
        return records
            .map((record, index) => {
                const x1 = parseNumericField(record.fields, 'Location.X')
                const y1 = parseNumericField(record.fields, 'Location.Y')
                const x2 = parseNumericField(record.fields, 'Corner.X')
                const y2 = parseNumericField(record.fields, 'Corner.Y')

                if (x1 === null || y1 === null || x2 === null || y2 === null) {
                    return null
                }

                return {
                    x: Math.min(x1, x2),
                    y: Math.min(y1, y2),
                    width: Math.abs(x2 - x1),
                    height: Math.abs(y2 - y1),
                    color: toColor(record.fields.Color, '#a44a1b'),
                    fill: toColor(record.fields.AreaColor, '#ffe16f'),
                    isSolid: parseBoolean(record.fields.IsSolid),
                    transparent: parseBoolean(record.fields.Transparent),
                    lineWidth: parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-11/12 curve primitives into drawable arcs.
     * Record 11 carries an optional secondary radius for ellipse segments.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, radius: number, radiusY?: number, startAngle: number, endAngle: number, color: string, width: number, ownerIndex?: string }[]}
     */
    static parseSchematicArcs(records) {
        return records
            .map((record, index) => {
                const x = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.X'
                )
                const y = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.Y'
                )
                const radius = parseNumericFieldWithFraction(
                    record.fields,
                    'Radius'
                )
                const radiusY = parseNumericFieldWithFraction(
                    record.fields,
                    'SecondaryRadius'
                )
                const startAngle = parseNumericField(record.fields, 'StartAngle')
                const endAngle = parseNumericField(record.fields, 'EndAngle')
                const normalizedRadiusY = radiusY === null ? radius : radiusY

                if (
                    x === null ||
                    y === null ||
                    radius === null ||
                    radius <= 0 ||
                    normalizedRadiusY === null ||
                    normalizedRadiusY <= 0
                ) {
                    return null
                }

                return {
                    x,
                    y,
                    radius,
                    ...(getField(record.fields, 'RECORD') === '11'
                        ? { radiusY: normalizedRadiusY }
                        : {}),
                    startAngle: startAngle === null ? 0 : startAngle,
                    endAngle: endAngle === null ? 360 : endAngle,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    width: parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-8 ellipse primitives into drawable outlines.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, radiusX: number, radiusY: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[]}
     */
    static parseSchematicEllipses(records) {
        return records
            .map((record, index) => {
                const x = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.X'
                )
                const y = parseNumericFieldWithFraction(
                    record.fields,
                    'Location.Y'
                )
                const radiusX = parseNumericFieldWithFraction(
                    record.fields,
                    'Radius'
                )
                const radiusY = parseNumericFieldWithFraction(
                    record.fields,
                    'SecondaryRadius'
                )

                if (
                    x === null ||
                    y === null ||
                    radiusX === null ||
                    radiusX <= 0 ||
                    radiusY === null ||
                    radiusY <= 0
                ) {
                    return null
                }

                return {
                    x,
                    y,
                    radiusX,
                    radiusY,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    fill: toColor(record.fields.AreaColor, '#ffffff'),
                    isSolid: parseBoolean(record.fields.IsSolid),
                    transparent: parseBoolean(record.fields.Transparent),
                    lineWidth: parseNumericField(record.fields, 'LineWidth') || 1,
                    renderOrder: SchematicPrimitiveParser.#resolveRenderOrder(
                        record.fields,
                        index
                    ),
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves one stable render-order key from Altium sheet order metadata.
     * @param {Record<string, string | string[]>} fields
     * @param {number} fallbackOrder
     * @returns {number}
     */
    static #resolveRenderOrder(fields, fallbackOrder) {
        const indexInSheet = parseNumericField(fields, 'IndexInSheet')

        if (indexInSheet !== null) {
            return indexInSheet
        }

        return fallbackOrder
    }

    /**
     * Collects one record-7 polygon point list in source order.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x: number, y: number }[]}
     */
    static #collectPolygonPoints(fields) {
        const locationCount = parseNumericField(fields, 'LocationCount')

        if (locationCount === null || locationCount < 2) {
            return []
        }

        const points = []

        for (let index = 1; index <= locationCount; index += 1) {
            const x = parseNumericField(fields, 'X' + index)
            const y = parseNumericField(fields, 'Y' + index)

            if (x === null || y === null) {
                break
            }

            points.push({ x, y })
        }

        return points
    }
}
