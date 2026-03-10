import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

const { escapeHtml, formatNumber, projectSchematicY } = SchematicSvgUtils

/**
 * Renders synthesized junction dots for connected schematic wire routes.
 */
export class SchematicJunctionRenderer {
    /**
     * Builds junction-dot markup from connected wire linework.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, ownerIndex?: string, isBus?: boolean }[]} lines
     * @param {{ x: number, y: number }[]} crosses
     * @param {number} sheetHeight
     * @returns {string}
     */
    static buildMarkup(lines, crosses, sheetHeight) {
        return SchematicJunctionRenderer.#resolveJunctions(lines, crosses)
            .map(
                (junction) =>
                    '<circle class="schematic-junction" cx="' +
                    formatNumber(junction.x) +
                    '" cy="' +
                    formatNumber(projectSchematicY(sheetHeight, junction.y)) +
                    '" r="2" fill="' +
                    escapeHtml(
                        SchematicColorResolver.resolveColor(
                            junction.color,
                            '--schematic-blue-color'
                        )
                    ) +
                    '" />'
            )
            .join('')
    }

    /**
     * Resolves all wire-junction points that should display a connection dot.
     * @param {{ x1: number, y1: number, x2: number, y2: number, color: string, ownerIndex?: string, isBus?: boolean }[]} lines
     * @param {{ x: number, y: number }[]} crosses
     * @returns {{ x: number, y: number, color: string }[]}
     */
    static #resolveJunctions(lines, crosses) {
        const wireLines = lines.filter(
            (line) => !line.ownerIndex && line.isBus !== true
        )

        return SchematicJunctionRenderer.#collectCandidatePoints(wireLines)
            .filter(
                (point) =>
                    !SchematicJunctionRenderer.#hasNearbyCross(point, crosses)
            )
            .flatMap((point) => {
                const contributingLines = wireLines.filter((line) =>
                    SchematicJunctionRenderer.#lineContainsPoint(line, point)
                )
                const directions = new Set()

                for (const line of contributingLines) {
                    SchematicJunctionRenderer.#appendDirections(
                        directions,
                        line,
                        point
                    )
                }

                if (directions.size < 3) {
                    return []
                }

                return [
                    {
                        x: point.x,
                        y: point.y,
                        color:
                            contributingLines[0]?.color ||
                            'var(--schematic-blue-color)'
                    }
                ]
            })
    }

    /**
     * Collects all distinct wire endpoints as candidate junction points.
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @returns {{ x: number, y: number }[]}
     */
    static #collectCandidatePoints(lines) {
        const candidates = new Map()

        for (const line of lines) {
            for (const point of [
                { x: line.x1, y: line.y1 },
                { x: line.x2, y: line.y2 }
            ]) {
                candidates.set(
                    SchematicJunctionRenderer.#pointKey(point),
                    point
                )
            }
        }

        return [...candidates.values()]
    }

    /**
     * Adds all directions a line contributes at one candidate point.
     * @param {Set<string>} directions
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {void}
     */
    static #appendDirections(directions, line, point) {
        if (line.x1 === line.x2 && line.x1 === point.x) {
            const minY = Math.min(line.y1, line.y2)
            const maxY = Math.max(line.y1, line.y2)

            if (point.y > minY + 0.01) {
                directions.add('south')
            }

            if (point.y < maxY - 0.01) {
                directions.add('north')
            }

            return
        }

        if (line.y1 === line.y2 && line.y1 === point.y) {
            const minX = Math.min(line.x1, line.x2)
            const maxX = Math.max(line.x1, line.x2)

            if (point.x > minX + 0.01) {
                directions.add('west')
            }

            if (point.x < maxX - 0.01) {
                directions.add('east')
            }
        }
    }

    /**
     * Returns true when one cross marker occupies the same point.
     * @param {{ x: number, y: number }} point
     * @param {{ x: number, y: number }[]} crosses
     * @returns {boolean}
     */
    static #hasNearbyCross(point, crosses) {
        return crosses.some(
            (cross) =>
                Math.abs(cross.x - point.x) <= 0.01 &&
                Math.abs(cross.y - point.y) <= 0.01
        )
    }

    /**
     * Returns true when one axis-aligned line passes through a candidate point.
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @param {{ x: number, y: number }} point
     * @returns {boolean}
     */
    static #lineContainsPoint(line, point) {
        if (line.x1 === line.x2 && line.x1 === point.x) {
            return (
                point.y >= Math.min(line.y1, line.y2) - 0.01 &&
                point.y <= Math.max(line.y1, line.y2) + 0.01
            )
        }

        if (line.y1 === line.y2 && line.y1 === point.y) {
            return (
                point.x >= Math.min(line.x1, line.x2) - 0.01 &&
                point.x <= Math.max(line.x1, line.x2) + 0.01
            )
        }

        return false
    }

    /**
     * Builds a stable map key for one point.
     * @param {{ x: number, y: number }} point
     * @returns {string}
     */
    static #pointKey(point) {
        return String(point.x) + ':' + String(point.y)
    }
}
