/**
 * Resolves standard schematic sheet-style display overrides.
 */
export class SchematicSheetStyleResolver {
    /**
     * Resolves the displayed horizontal sheet-zone count after the page size
     * has been normalized.
     * @param {{ width: number, height: number, xZones: number, paperSize?: string, sheetStyle?: number }} sheet
     * @returns {number}
     */
    static resolveXZones(sheet) {
        const configuredXZones = Math.max(Number(sheet?.xZones || 0), 1)
        if (Number(sheet?.sheetStyle || 0) !== 1) {
            return configuredXZones
        }

        const width = Number(sheet?.width || 0)
        const height = Number(sheet?.height || 0)
        if (width < height) {
            return configuredXZones
        }

        if (
            sheet?.paperSize === 'A3' ||
            (width === 1654 && height === 1169)
        ) {
            return 8
        }

        if (
            sheet?.paperSize === 'A4' ||
            (width === 1169 && height === 827)
        ) {
            return 4
        }

        return configuredXZones
    }
}
