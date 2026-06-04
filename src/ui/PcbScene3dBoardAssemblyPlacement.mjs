/**
 * Builds the synthetic external placement for a full board assembly model.
 */
export class PcbScene3dBoardAssemblyPlacement {
    /**
     * Builds the synthetic placement for a full board assembly model.
     * @param {{ board?: { widthMil?: number, heightMil?: number, thicknessMil?: number, surfaceColor?: number }, boardAssemblyModel?: any }} sceneDescription
     * @returns {any | null}
     */
    static build(sceneDescription) {
        const model = sceneDescription?.boardAssemblyModel || null
        if (!model) {
            return null
        }

        const board = sceneDescription?.board || {}
        return {
            designator: 'Board assembly',
            sourceType: 'board-assembly',
            mountSide: 'board-assembly',
            rotationDeg: 0,
            positionMil: {
                x: -Number(board.widthMil || 0) / 2,
                y: -Number(board.heightMil || 0) / 2,
                z: 0
            },
            board: {
                widthMil: Number(board.widthMil || 0),
                heightMil: Number(board.heightMil || 0),
                thicknessMil: Number(board.thicknessMil || 0),
                surfaceColor: Number(board.surfaceColor)
            },
            externalModel: model
        }
    }
}
