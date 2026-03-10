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
     * Normalizes record-14 body primitives into drawable rectangles.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number, ownerIndex?: string }[]}
     */
    static parseSchematicRectangles(records) {
        return records
            .map((record) => {
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
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }

    /**
     * Normalizes record-12 curve primitives into drawable arcs.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number, ownerIndex?: string }[]}
     */
    static parseSchematicArcs(records) {
        return records
            .map((record) => {
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
                const startAngle = parseNumericField(record.fields, 'StartAngle')
                const endAngle = parseNumericField(record.fields, 'EndAngle')

                if (x === null || y === null || radius === null || radius <= 0) {
                    return null
                }

                return {
                    x,
                    y,
                    radius,
                    startAngle: startAngle === null ? 0 : startAngle,
                    endAngle:
                        endAngle === null
                            ? startAngle === null
                                ? 360
                                : startAngle
                            : endAngle,
                    color: toColor(record.fields.Color, '#a44a1b'),
                    width: parseNumericField(record.fields, 'LineWidth') || 1,
                    ownerIndex:
                        getField(record.fields, 'OwnerIndex') || undefined
                }
            })
            .filter(Boolean)
    }
}
