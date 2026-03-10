import { SchematicSvgUtils } from './SchematicSvgUtils.mjs'
import { SchematicTypography } from './SchematicTypography.mjs'
import { SchematicColorResolver } from './SchematicColorResolver.mjs'

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
        const baseTextOptions =
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
                    escapeHtml(
                        SchematicColorResolver.resolveFill(
                            row.fill,
                            '--schematic-fill-color'
                        )
                    ) +
                    '" stroke="' +
                    escapeHtml(
                        SchematicColorResolver.resolveColor(
                            row.color,
                            '--schematic-port-color'
                        )
                    ) +
                    '" />'
            )
            .join('')
        const labelMarkup = rows
            .map((row) => {
                const textOptions =
                    SchematicPortRenderer.#resolveLabelTextOptions(
                        row,
                        baseTextOptions
                    )

                return createSvgText(
                    'schematic-port-label',
                    SchematicPortRenderer.#resolveLabelX(
                        row.x,
                        row.width,
                        tipDepth,
                        direction
                    ),
                    SchematicPortRenderer.#resolveLabelBaselineY(
                        row.projectedY,
                        row.height,
                        textOptions.fontSize
                    ),
                    row.name,
                    SchematicColorResolver.resolveColor(
                        row.color,
                        '--schematic-port-color'
                    ),
                    'middle',
                    textOptions
                )
            })
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
     * Returns SVG text options scaled to fit one port box.
     * @param {{ width: number, height: number, name: string }} row
     * @param {{ fontSize: number, fontFamily: string, fontWeight: number }} baseTextOptions
     * @returns {{ fontSize: number, fontFamily: string, fontWeight: number }}
     */
    static #resolveLabelTextOptions(row, baseTextOptions) {
        return {
            ...baseTextOptions,
            fontSize: SchematicPortRenderer.#resolveLabelFontSize(
                row.name,
                row.width,
                row.height,
                baseTextOptions.fontSize
            )
        }
    }

    /**
     * Centers one label vertically using its scaled font size.
     * @param {number} projectedY
     * @param {number} height
     * @param {number} fontSize
     * @returns {number}
     */
    static #resolveLabelBaselineY(projectedY, height, fontSize) {
        return projectedY + height / 2 + fontSize * 0.36
    }

    /**
     * Scales one port label to fit within the recovered polygon.
     * @param {string} name
     * @param {number} width
     * @param {number} height
     * @param {number} defaultFontSize
     * @returns {number}
     */
    static #resolveLabelFontSize(name, width, height, defaultFontSize) {
        const maxFontSizeFromHeight = Math.max(Number(height || 10) * 0.75, 4)
        const horizontalPadding = 4
        const availableWidth = Math.max(
            Number(width || 40) - horizontalPadding,
            4
        )
        const estimatedWidthAtUnitSize =
            SchematicPortRenderer.#estimateLabelWidth(name, 1)
        const maxFontSizeFromWidth =
            estimatedWidthAtUnitSize > 0
                ? availableWidth / estimatedWidthAtUnitSize
                : defaultFontSize

        return Math.max(
            Math.min(
                Number(defaultFontSize || 10),
                maxFontSizeFromHeight,
                maxFontSizeFromWidth
            ),
            4
        )
    }

    /**
     * Approximates rendered label width for the default serif schematic font.
     * @param {string} text
     * @param {number} fontSize
     * @returns {number}
     */
    static #estimateLabelWidth(text, fontSize) {
        let width = 0

        for (const character of String(text || '')) {
            width +=
                SchematicPortRenderer.#measureCharacterWidth(character) *
                fontSize
        }

        return width
    }

    /**
     * Returns a rough Times New Roman width factor for one character.
     * @param {string} character
     * @returns {number}
     */
    static #measureCharacterWidth(character) {
        if (/\s/.test(character)) return 0.32
        if (/[.,;:!|]/.test(character)) return 0.24
        if (/[()[\]{}]/.test(character)) return 0.32
        if (/[-+/\\]/.test(character)) return 0.36
        if (/[MW@#%&]/.test(character)) return 0.82
        if (/[A-Z]/.test(character)) return 0.62
        if (/[a-z0-9]/.test(character)) return 0.5
        if (/[^ -~]/.test(character)) return 0.92

        return 0.56
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
