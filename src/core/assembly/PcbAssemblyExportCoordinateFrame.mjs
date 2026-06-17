const MIL_TO_MM = 0.0254

/**
 * Maps internal PCB Z-up mesh coordinates into the exported viewer frame.
 */
export class PcbAssemblyExportCoordinateFrame {
    /**
     * Converts one internal vertex from mils into exported millimetres.
     * @param {number[]} vertex Internal mesh vertex in mils.
     * @returns {number[]}
     */
    static vertexMilToMm(vertex) {
        const x = Number(vertex?.[0] || 0)
        const y = Number(vertex?.[1] || 0)
        const z = Number(vertex?.[2] || 0)

        return [x * MIL_TO_MM, z * MIL_TO_MM, -y * MIL_TO_MM]
    }
}
