/**
 * Builds stable board-outline commands for the 3D PCB runtime.
 */
export class PcbScene3dOutlineBuilder {
    static #DEGENERATE_LINE_EPSILON = 0.01

    /**
     * Converts one board outline into local move/line/arc commands.
     * @param {{ centerX?: number, centerY?: number, segments?: Array<Record<string, number | string>> }} board
     * @returns {Array<Record<string, number | boolean>>}
     */
    static buildCommands(board) {
        const segments = Array.isArray(board?.segments) ? board.segments : []
        if (!segments.length) {
            return []
        }

        const centerX = Number(board?.centerX || 0)
        const centerY = Number(board?.centerY || 0)
        const firstPoint = PcbScene3dOutlineBuilder.#toLocalPoint(
            Number(segments[0].x1 || 0),
            Number(segments[0].y1 || 0),
            centerX,
            centerY
        )
        const commands = [
            {
                type: 'move',
                x: firstPoint.x,
                y: firstPoint.y
            }
        ]

        for (const segment of segments) {
            if (segment.type === 'arc') {
                const arcCommand = PcbScene3dOutlineBuilder.#buildArcCommand(
                    segment,
                    centerX,
                    centerY
                )
                if (arcCommand) {
                    commands.push(arcCommand)
                }
                continue
            }

            const lineCommand = PcbScene3dOutlineBuilder.#buildLineCommand(
                segment,
                centerX,
                centerY
            )
            if (lineCommand) {
                commands.push(lineCommand)
            }
        }

        return commands
    }

    /**
     * Converts one outline line segment into a local line command.
     * @param {Record<string, number | string>} segment
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ type: 'line', x: number, y: number } | null}
     */
    static #buildLineCommand(segment, centerX, centerY) {
        const startPoint = PcbScene3dOutlineBuilder.#toLocalPoint(
            Number(segment.x1 || 0),
            Number(segment.y1 || 0),
            centerX,
            centerY
        )
        const endPoint = PcbScene3dOutlineBuilder.#toLocalPoint(
            Number(segment.x2 || 0),
            Number(segment.y2 || 0),
            centerX,
            centerY
        )

        if (
            PcbScene3dOutlineBuilder.#distanceBetween(startPoint, endPoint) <
            PcbScene3dOutlineBuilder.#DEGENERATE_LINE_EPSILON
        ) {
            return null
        }

        return {
            type: 'line',
            x: endPoint.x,
            y: endPoint.y
        }
    }

    /**
     * Converts one outline arc segment into a local arc command traced from
     * the ordered segment endpoints instead of the serialized angle fields.
     * @param {Record<string, number | string>} segment
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ type: 'arc', cx: number, cy: number, radius: number, startX: number, startY: number, endX: number, endY: number, startAngleRad: number, endAngleRad: number, clockwise: boolean } | null}
     */
    static #buildArcCommand(segment, centerX, centerY) {
        const arcCenter = PcbScene3dOutlineBuilder.#toLocalPoint(
            Number(segment.cx || 0),
            Number(segment.cy || 0),
            centerX,
            centerY
        )
        const startPoint = PcbScene3dOutlineBuilder.#toLocalPoint(
            Number(segment.x1 || 0),
            Number(segment.y1 || 0),
            centerX,
            centerY
        )
        const endPoint = PcbScene3dOutlineBuilder.#toLocalPoint(
            Number(segment.x2 || 0),
            Number(segment.y2 || 0),
            centerX,
            centerY
        )
        const radius =
            Math.max(
                Number(segment.radius || 0),
                PcbScene3dOutlineBuilder.#distanceBetween(arcCenter, startPoint),
                PcbScene3dOutlineBuilder.#distanceBetween(arcCenter, endPoint)
            ) || 0

        if (!radius) {
            return null
        }

        const startAngleRad = Math.atan2(
            startPoint.y - arcCenter.y,
            startPoint.x - arcCenter.x
        )
        const endAngleRad = Math.atan2(
            endPoint.y - arcCenter.y,
            endPoint.x - arcCenter.x
        )
        const deltaAngle = PcbScene3dOutlineBuilder.#resolveShortDeltaAngle(
            startAngleRad,
            endAngleRad
        )

        return {
            type: 'arc',
            cx: arcCenter.x,
            cy: arcCenter.y,
            radius,
            startX: startPoint.x,
            startY: startPoint.y,
            endX: endPoint.x,
            endY: endPoint.y,
            startAngleRad,
            endAngleRad,
            clockwise: deltaAngle < 0
        }
    }

    /**
     * Converts one board-space point into local centered scene coordinates.
     * @param {number} x
     * @param {number} y
     * @param {number} centerX
     * @param {number} centerY
     * @returns {{ x: number, y: number }}
     */
    static #toLocalPoint(x, y, centerX, centerY) {
        return {
            x: Number(x || 0) - centerX,
            y: Number(y || 0) - centerY
        }
    }

    /**
     * Measures one point-to-point distance.
     * @param {{ x: number, y: number }} left
     * @param {{ x: number, y: number }} right
     * @returns {number}
     */
    static #distanceBetween(left, right) {
        const deltaX = Number(right.x || 0) - Number(left.x || 0)
        const deltaY = Number(right.y || 0) - Number(left.y || 0)
        return Math.hypot(deltaX, deltaY)
    }

    /**
     * Resolves the shortest signed delta between two radians.
     * @param {number} startAngleRad
     * @param {number} endAngleRad
     * @returns {number}
     */
    static #resolveShortDeltaAngle(startAngleRad, endAngleRad) {
        let deltaAngle = endAngleRad - startAngleRad

        if (deltaAngle > Math.PI) {
            deltaAngle -= Math.PI * 2
        }

        if (deltaAngle < -Math.PI) {
            deltaAngle += Math.PI * 2
        }

        return deltaAngle
    }
}
