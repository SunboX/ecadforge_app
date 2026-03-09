import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'

const { createSvgText, escapeHtml, formatNumber, projectSchematicY } =
    SchematicSvgUtils

/**
 * Renders schematic off-sheet ports and stacked port groups.
 */
export class SchematicPortRenderer {
    /**
     * Builds schematic off-sheet port boxes, stacking adjacent rows into one
     * shared outline when they use the same geometry and styling.
     * @param {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[]} ports
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static buildMarkup(ports, sheetHeight, sheet) {
        return SchematicPortRenderer.#groupPorts(ports)
            .map((portGroup) =>
                SchematicPortRenderer.#buildPortGroupMarkup(
                    portGroup,
                    sheetHeight,
                    sheet
                )
            )
            .join('')
    }

    /**
     * Builds one grouped schematic off-sheet port symbol.
     * @param {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[]} portGroup
     * @param {number} sheetHeight
     * @param {{ fonts?: Record<string, { size: number, family: string, bold: boolean }> }} sheet
     * @returns {string}
     */
    static #buildPortGroupMarkup(portGroup, sheetHeight, sheet) {
        const rows = [...portGroup]
            .map((port) => ({
                ...port,
                projectedY:
                    projectSchematicY(sheetHeight, port.y) - port.height / 2
            }))
            .sort((left, right) => left.projectedY - right.projectedY)
        const firstRow = rows[0]
        const lastRow = rows[rows.length - 1]
        const x = firstRow.x
        const width = firstRow.width
        const direction = firstRow.direction || 'right'
        const tipDepth = Math.min(
            Math.max(firstRow.height - 2, 4),
            width / 2
        )
        const textOptions =
            SchematicTypography.buildDefaultSchematicFontOptions(sheet)
        const outlineMarkup = rows
            .map(
                (row) =>
                    '<polygon points="' +
                    escapeHtml(
                        SchematicPortRenderer.#buildOutlinePoints(
                            row.x,
                            row.projectedY,
                            row.width,
                            row.height,
                            tipDepth,
                            direction
                        )
                    ) +
                    '" fill="' +
                    escapeHtml(row.fill) +
                    '" stroke="' +
                    escapeHtml(row.color) +
                    '" />'
            )
            .join('')
        const labelMarkup = rows
            .map((row) =>
                createSvgText(
                    'schematic-port-label',
                    SchematicPortRenderer.#resolveLabelX(
                        row.x,
                        row.width,
                        tipDepth,
                        direction
                    ),
                    row.projectedY + row.height * 0.72,
                    row.name,
                    row.color,
                    'middle',
                    textOptions
                )
            )
            .join('')

        return (
            '<g class="schematic-port">' +
            outlineMarkup +
            labelMarkup +
            '</g>'
        )
    }

    /**
     * Builds the outer polygon for one off-sheet port group.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} tipDepth
     * @param {'left' | 'right'} direction
     * @returns {string}
     */
    static #buildOutlinePoints(x, y, width, height, tipDepth, direction) {
        if (direction === 'left') {
            return [
                [x, y + height / 2],
                [x + tipDepth, y],
                [x + width, y],
                [x + width, y + height],
                [x + tipDepth, y + height]
            ]
                .map(([pointX, pointY]) =>
                    formatNumber(pointX) + ',' + formatNumber(pointY)
                )
                .join(' ')
        }

        return [
            [x, y],
            [x + width - tipDepth, y],
            [x + width, y + height / 2],
            [x + width - tipDepth, y + height],
            [x, y + height]
        ]
            .map(([pointX, pointY]) =>
                formatNumber(pointX) + ',' + formatNumber(pointY)
            )
            .join(' ')
    }

    /**
     * Centers one port label within the rectangular body ahead of the tip.
     * @param {number} x
     * @param {number} width
     * @param {number} tipDepth
     * @param {'left' | 'right'} direction
     * @returns {number}
     */
    static #resolveLabelX(x, width, tipDepth, direction) {
        const bodyWidth = width - tipDepth

        if (direction === 'left') {
            return x + tipDepth + bodyWidth / 2
        }

        return x + bodyWidth / 2
    }

    /**
     * Groups vertically adjacent off-sheet ports that share the same geometry
     * and styling so they render as one stacked symbol.
     * @param {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[]} ports
     * @returns {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[][]}
     */
    static #groupPorts(ports) {
        const sortedPorts = [...ports].sort(
            (left, right) =>
                left.x - right.x ||
                left.width - right.width ||
                left.height - right.height ||
                String(left.fill).localeCompare(String(right.fill)) ||
                String(left.color).localeCompare(String(right.color)) ||
                left.y - right.y
        )
        const groups = []

        for (const port of sortedPorts) {
            const previousGroup = groups[groups.length - 1]

            if (
                previousGroup &&
                SchematicPortRenderer.#canAppendPort(previousGroup, port)
            ) {
                previousGroup.push(port)
                continue
            }

            groups.push([port])
        }

        return groups
    }

    /**
     * Returns true when one port can extend an existing stacked-port group.
     * @param {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }[]} portGroup
     * @param {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction?: 'left' | 'right' }} port
     * @returns {boolean}
     */
    static #canAppendPort(portGroup, port) {
        const firstPort = portGroup[0]
        const previousPort = portGroup[portGroup.length - 1]

        return (
            firstPort.x === port.x &&
            firstPort.width === port.width &&
            firstPort.height === port.height &&
            firstPort.fill === port.fill &&
            firstPort.color === port.color &&
            (firstPort.direction || 'right') === (port.direction || 'right') &&
            Math.abs(port.y - previousPort.y - previousPort.height) <= 0.01
        )
    }
}
