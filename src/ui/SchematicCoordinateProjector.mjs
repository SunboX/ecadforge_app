/**
 * Resolves schematic renderer coordinate transforms.
 */
export class SchematicCoordinateProjector {
    /**
     * Projects source Y coordinates into rendered group coordinates.
     * @param {number} y Source y-coordinate.
     * @param {number} contentHeight Rendered content height.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {number}
     */
    static projectY(y, contentHeight, isKicad) {
        return isKicad ? y : contentHeight - y
    }

    /**
     * Resolves content height used by the active schematic renderer.
     * @param {object} schematic Schematic model.
     * @param {boolean} isKicad Whether coordinates are direct.
     * @returns {number}
     */
    static resolveContentHeight(schematic, isKicad) {
        const sheet = schematic?.sheet || {}
        if (isKicad) {
            return Math.max(Number(sheet.height || 100), 1)
        }

        const width = Math.max(Number(sheet.width || 1000), 100)
        const height = Math.max(Number(sheet.height || 700), 100)
        const margin = Math.max(Number(sheet.marginWidth || 20), 10)
        const sourceWidth = Number(sheet.sourceWidth || 0)
        const sourceHeight = Number(sheet.sourceHeight || 0)
        if (
            !sheet.borderOn ||
            sheet.paperSize ||
            width !== sourceWidth ||
            height !== sourceHeight ||
            height <= margin * 2
        ) {
            return height
        }

        return height + margin
    }
}
