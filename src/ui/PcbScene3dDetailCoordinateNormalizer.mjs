/**
 * Normalizes PCB detail primitive coordinates into the runtime board plane.
 */
export class PcbScene3dDetailCoordinateNormalizer {
    /**
     * Creates a reusable normalizer for one scene description.
     * @param {{ board?: { centerX?: number, centerY?: number }, boardAssemblyModel?: any, coordinateSystem?: string, sourceFormat?: string } | null} sceneDescription Scene metadata.
     * @returns {(x: number, y: number) => { x: number, y: number }}
     */
    static create(sceneDescription) {
        return (x, y) =>
            PcbScene3dDetailCoordinateNormalizer.normalize(
                sceneDescription,
                x,
                y
            )
    }

    /**
     * Normalizes one source detail coordinate into centered scene space.
     * @param {{ board?: { centerX?: number, centerY?: number }, boardAssemblyModel?: any, coordinateSystem?: string, sourceFormat?: string } | null} sceneDescription Scene metadata.
     * @param {number} x Source X coordinate.
     * @param {number} y Source Y coordinate.
     * @returns {{ x: number, y: number }}
     */
    static normalize(sceneDescription, x, y) {
        const board = sceneDescription?.board || {}
        const centerX = Number(board.centerX || 0)
        const centerY = Number(board.centerY || 0)
        const sourceX = Number(x || 0)
        const sourceY = Number(y || 0)

        return {
            x: sourceX - centerX,
            y: PcbScene3dDetailCoordinateNormalizer.#usesAssemblyModelPcbY(
                sceneDescription
            )
                ? centerY - sourceY
                : sourceY - centerY
        }
    }

    /**
     * Checks whether detail primitives are being aligned to an assembly model
     * that still uses the source PCB Y axis.
     * @param {{ boardAssemblyModel?: any, coordinateSystem?: string, sourceFormat?: string } | null} sceneDescription Scene metadata.
     * @returns {boolean}
     */
    static #usesAssemblyModelPcbY(sceneDescription) {
        if (
            String(sceneDescription?.coordinateSystem || '') === 'kicad-3d-y-up'
        ) {
            return false
        }

        const sourceFormat = String(
            sceneDescription?.sourceFormat || ''
        ).toLowerCase()

        return (
            sourceFormat === 'altium' &&
            Boolean(sceneDescription?.boardAssemblyModel)
        )
    }
}
