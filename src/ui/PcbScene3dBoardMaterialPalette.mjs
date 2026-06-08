/**
 * Resolves PCB substrate material colors for the 3D runtime.
 */
export class PcbScene3dBoardMaterialPalette {
    static #DEFAULT_SURFACE_COLOR = 0x2a5f27

    /**
     * Resolves the solder-mask face color for the generated board shell.
     * @param {{ surfaceColor?: number } | undefined} board Board metadata.
     * @param {{ hasBoardAssemblyModel?: boolean }} [options] Scene options.
     * @returns {number}
     */
    static resolveSurfaceColor(board, options = {}) {
        if (options.hasBoardAssemblyModel) {
            return PcbScene3dBoardMaterialPalette.#DEFAULT_SURFACE_COLOR
        }

        return Number.isInteger(board?.surfaceColor)
            ? board.surfaceColor
            : PcbScene3dBoardMaterialPalette.#DEFAULT_SURFACE_COLOR
    }

    /**
     * Resolves whether the generated board face should render.
     * @param {{ hasBoardAssemblyModel?: boolean }} [options] Scene options.
     * @returns {boolean}
     */
    static isGeneratedSurfaceVisible(options = {}) {
        return PcbScene3dBoardMaterialPalette.isGeneratedBodyVisible(options)
    }

    /**
     * Resolves whether the generated board body should render.
     * @param {{ hasBoardAssemblyModel?: boolean }} [options] Scene options.
     * @returns {boolean}
     */
    static isGeneratedBodyVisible(options = {}) {
        return true
    }
}
