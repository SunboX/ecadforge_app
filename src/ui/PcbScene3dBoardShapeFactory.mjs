import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'
import { PcbScene3dOutlineBuilder } from './PcbScene3dOutlineBuilder.mjs'

/**
 * Builds the board solid profile, including drilled holes.
 */
export class PcbScene3dBoardShapeFactory {
    /**
     * Builds one board shape with drill holes.
     * @param {any} THREE
     * @param {{ widthMil?: number, heightMil?: number, segments?: Array<Record<string, number | string>> }} board
     * @param {{ pads?: any[], vias?: any[] }} [detail]
     * @param {(x: number, y: number) => { x: number, y: number }} [normalizeBoardPoint]
     * @returns {any}
     */
    static buildShape(
        THREE,
        board,
        detail = {},
        normalizeBoardPoint = (x, y) => ({ x, y })
    ) {
        const shape = new THREE.Shape()
        const commands = PcbScene3dOutlineBuilder.buildCommands(board)

        if (!commands.length) {
            shape.moveTo(-board.widthMil / 2, -board.heightMil / 2)
            shape.lineTo(board.widthMil / 2, -board.heightMil / 2)
            shape.lineTo(board.widthMil / 2, board.heightMil / 2)
            shape.lineTo(-board.widthMil / 2, board.heightMil / 2)
            shape.lineTo(-board.widthMil / 2, -board.heightMil / 2)
        } else {
            for (const command of commands) {
                if (command.type === 'move') {
                    shape.moveTo(Number(command.x || 0), Number(command.y || 0))
                    continue
                }

                if (command.type === 'arc') {
                    shape.absarc(
                        Number(command.cx || 0),
                        Number(command.cy || 0),
                        Number(command.radius || 0),
                        Number(command.startAngleRad || 0),
                        Number(command.endAngleRad || 0),
                        Boolean(command.clockwise)
                    )
                    continue
                }

                shape.lineTo(Number(command.x || 0), Number(command.y || 0))
            }
            shape.closePath()
        }

        PcbScene3dDrillPathFactory.appendBoardDrills(
            THREE,
            shape,
            detail,
            normalizeBoardPoint
        )
        return shape
    }
}
