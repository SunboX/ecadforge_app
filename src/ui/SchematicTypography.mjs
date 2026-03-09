/**
 * Shared typography helpers for synthetic schematic SVG labels.
 */
export class SchematicTypography {
    /**
     * Returns true when the schematic already contains a visible designator text
     * close to one component origin.
     * @param {{ x?: number, y?: number }} component
     * @param {{ x: number, y: number, name?: string }[]} texts
     * @returns {boolean}
     */
    static hasNearbyVisibleDesignatorText(component, texts) {
        return texts.some(
            (text) =>
                String(text.name || '').trim().toLowerCase() === 'designator' &&
                Math.abs(Number(text.x) - Number(component.x)) <= 80 &&
                Math.abs(Number(text.y) - Number(component.y)) <= 80
        )
    }

    /**
     * Builds the default font options used for synthetic schematic labels.
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {{ fontSize: number, fontFamily: string, fontWeight: number }}
     */
    static buildDefaultSchematicFontOptions(sheet) {
        const font = sheet?.fonts?.['1'] || {
            size: 10,
            family: 'Times New Roman',
            bold: false
        }

        return {
            fontSize: SchematicTypography.#toSvgFontSize(font.size),
            fontFamily: font.family || 'Times New Roman',
            fontWeight: font.bold ? 700 : 400
        }
    }

    /**
     * Converts Altium point sizes into SVG font units.
     * @param {number} size
     * @returns {number}
     */
    static #toSvgFontSize(size) {
        return Number(size || 10)
    }
}
