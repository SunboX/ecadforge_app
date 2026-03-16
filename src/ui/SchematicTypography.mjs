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
     * Builds render options for one schematic text label, including the signed
     * SVG rotation derived from the original Altium orientation.
     * @param {{ fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number, sourceOrientation?: number }} text
     * @returns {{ fontSize?: number, fontFamily?: string, fontWeight?: number, rotation?: number }}
     */
    static buildSchematicTextRenderOptions(text) {
        return {
            fontSize: text.fontSize,
            fontFamily: text.fontFamily,
            fontWeight: text.fontWeight,
            rotation: SchematicTypography.#resolveSignedTextRotation(
                text.rotation,
                text.sourceOrientation
            )
        }
    }

    /**
     * Collects number-only owner groups whose top pin numbers should rotate
     * along the vertical pin axis.
     * @param {{ ownerIndex?: string, orientation: 'left' | 'right' | 'top' | 'bottom', labelMode?: 'hidden' | 'number-only' | 'name-only' | 'name-and-number' }[]} pins
     * @returns {Set<string>}
     */
    static collectRotatedVerticalNumberOwners(pins) {
        const ownerPins = new Map()

        for (const pin of pins) {
            const ownerIndex = String(pin.ownerIndex || '').trim()
            if (!ownerIndex) continue
            if (!ownerPins.has(ownerIndex)) ownerPins.set(ownerIndex, [])
            ownerPins.get(ownerIndex).push(pin)
        }

        return new Set(
            [...ownerPins.entries()]
                .filter(([, groupedPins]) => {
                    const hasTopPin = groupedPins.some(
                        (pin) => pin.orientation === 'top'
                    )
                    const hasHorizontalPins = groupedPins.some(
                        (pin) =>
                            pin.orientation === 'left' ||
                            pin.orientation === 'right'
                    )
                    return (
                        groupedPins.length > 4 &&
                        hasTopPin &&
                        hasHorizontalPins &&
                        groupedPins.every(
                            (pin) =>
                                (pin.labelMode || 'name-and-number') ===
                                'number-only'
                        )
                    )
                })
                .map(([ownerIndex]) => ownerIndex)
        )
    }

    /**
     * Converts Altium point sizes into SVG font units.
     * @param {number} size
     * @returns {number}
     */
    static #toSvgFontSize(size) {
        return Number(size || 10)
    }

    /**
     * Resolves the signed SVG rotation for one schematic text label.
     * @param {number | undefined} rotation
     * @param {number | undefined} sourceOrientation
     * @returns {number}
     */
    static #resolveSignedTextRotation(rotation, sourceOrientation) {
        const normalizedRotation = Number(rotation || 0)

        if (!normalizedRotation) {
            return 0
        }

        if (Number(sourceOrientation || 0) === 3) {
            return normalizedRotation
        }

        return -normalizedRotation
    }
}
