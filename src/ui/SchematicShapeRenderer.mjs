import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders normalized schematic shape primitives into SVG markup.
 */
export class SchematicShapeRenderer {
    /**
     * Builds one schematic rectangle primitive.
     * @param {{ x: number, y: number, width: number, height: number, color: string, fill: string, isSolid: boolean, transparent: boolean, lineWidth: number }} rectangle
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildRectangleMarkup(rectangle, sheetHeight) {
        return (
            '<rect class="schematic-rectangle" x="' +
            formatNumber(rectangle.x) +
            '" y="' +
            formatNumber(
                projectSchematicY(sheetHeight, rectangle.y + rectangle.height)
            ) +
            '" width="' +
            formatNumber(rectangle.width) +
            '" height="' +
            formatNumber(rectangle.height) +
            '" fill="' +
            escapeHtml(
                SchematicColorResolver.resolveFill(
                    SchematicShapeRenderer.#resolveSchematicRectangleFill(rectangle),
                    '--schematic-fill-color'
                )
            ) +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    rectangle.color,
                    '--schematic-blue-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(rectangle.lineWidth || 1, 0.8)) +
            '" />'
        )
    }

    /**
     * Builds one schematic arc primitive as an SVG path.
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, color: string, width: number }} arc
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildArcMarkup(arc, sheetHeight) {
        const radius = Math.max(Number(arc.radius) || 0, 0.8)
        const delta = SchematicShapeRenderer.#normalizeArcDelta(
            arc.startAngle,
            arc.endAngle
        )
        const sweep = delta >= 0 ? 0 : 1
        const path =
            Math.abs(delta) >= 359.999
                ? SchematicShapeRenderer.#buildFullCircleArcPath(
                      arc,
                      radius,
                      sheetHeight,
                      sweep
                  )
                : SchematicShapeRenderer.#buildPartialArcPath(
                      arc,
                      radius,
                      sheetHeight,
                      delta,
                      sweep
                  )

        return (
            '<path class="schematic-arc" d="' +
            path +
            '" stroke="' +
            escapeHtml(
                SchematicColorResolver.resolveColor(
                    arc.color,
                    '--schematic-blue-color'
                )
            ) +
            '" stroke-width="' +
            formatNumber(Math.max(arc.width || 1, 0.8)) +
            '" fill="none" />'
        )
    }

    /**
     * Resolves the visible fill for one schematic rectangle primitive.
     * @param {{ fill: string, isSolid: boolean, transparent: boolean }} rectangle
     * @returns {string}
     */
    static #resolveSchematicRectangleFill(rectangle) {
        if (rectangle.transparent || !rectangle.isSolid) {
            return 'none'
        }

        return rectangle.fill || 'none'
    }

    /**
     * Builds one non-circular SVG arc path.
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number }} arc
     * @param {number} radius
     * @param {number} sheetHeight
     * @param {number} delta
     * @param {0 | 1} sweep
     * @returns {string}
     */
    static #buildPartialArcPath(arc, radius, sheetHeight, delta, sweep) {
        const start = SchematicShapeRenderer.#projectArcPoint(
            arc,
            arc.startAngle,
            sheetHeight
        )
        const end = SchematicShapeRenderer.#projectArcPoint(
            arc,
            arc.endAngle,
            sheetHeight
        )

        return (
            'M ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y) +
            ' A ' +
            formatNumber(radius) +
            ' ' +
            formatNumber(radius) +
            ' 0 ' +
            (Math.abs(delta) > 180 ? '1' : '0') +
            ' ' +
            sweep +
            ' ' +
            formatNumber(end.x) +
            ' ' +
            formatNumber(end.y)
        )
    }

    /**
     * Builds one full-circle arc path from two half-arc segments.
     * @param {{ x: number, y: number, startAngle: number }} arc
     * @param {number} radius
     * @param {number} sheetHeight
     * @param {0 | 1} sweep
     * @returns {string}
     */
    static #buildFullCircleArcPath(arc, radius, sheetHeight, sweep) {
        const startAngle = Number(arc.startAngle) || 0
        const midAngle = startAngle + (sweep === 0 ? 180 : -180)
        const start = SchematicShapeRenderer.#projectArcPoint(
            arc,
            startAngle,
            sheetHeight
        )
        const mid = SchematicShapeRenderer.#projectArcPoint(
            arc,
            midAngle,
            sheetHeight
        )

        return (
            'M ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y) +
            ' A ' +
            formatNumber(radius) +
            ' ' +
            formatNumber(radius) +
            ' 0 0 ' +
            sweep +
            ' ' +
            formatNumber(mid.x) +
            ' ' +
            formatNumber(mid.y) +
            ' A ' +
            formatNumber(radius) +
            ' ' +
            formatNumber(radius) +
            ' 0 0 ' +
            sweep +
            ' ' +
            formatNumber(start.x) +
            ' ' +
            formatNumber(start.y)
        )
    }

    /**
     * Projects one schematic arc point into the SVG coordinate system.
     * @param {{ x: number, y: number, radius: number }} arc
     * @param {number} angle
     * @param {number} sheetHeight
     * @returns {{ x: number, y: number }}
     */
    static #projectArcPoint(arc, angle, sheetHeight) {
        const radians = (Number(angle) * Math.PI) / 180

        return {
            x: Number(arc.x) + Number(arc.radius) * Math.cos(radians),
            y: projectSchematicY(
                sheetHeight,
                Number(arc.y) + Number(arc.radius) * Math.sin(radians)
            )
        }
    }

    /**
     * Keeps one schematic arc delta inside a single turn.
     * @param {number} startAngle
     * @param {number} endAngle
     * @returns {number}
     */
    static #normalizeArcDelta(startAngle, endAngle) {
        let delta = Number(endAngle) - Number(startAngle)

        while (delta <= -360) {
            delta += 360
        }

        while (delta > 360) {
            delta -= 360
        }

        return delta
    }
}
