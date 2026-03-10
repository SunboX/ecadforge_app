import { ParserUtils } from './ParserUtils.mjs'

/**
 * Helpers for normalized schematic pins, ports, and crosses.
 */
export class SchematicPinParser {
    /**
     * Normalizes schematic pin records into drawable pin primitives.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor: string, labelMode: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[]}
     */
    static parseSchematicPins(records) {
        const groups = new Map()

        for (const record of records) {
            const ownerIndex = ParserUtils.getField(record.fields, 'OwnerIndex')
            const x = ParserUtils.parseNumericField(record.fields, 'Location.X')
            const y = ParserUtils.parseNumericField(record.fields, 'Location.Y')
            const length = ParserUtils.parseNumericField(
                record.fields,
                'PinLength'
            )
            const orientation =
                SchematicPinParser.#inferSchematicPinOrientation(
                    ParserUtils.parseNumericField(
                        record.fields,
                        'PinConglomerate'
                    )
                )

            if (
                x === null ||
                y === null ||
                length === null ||
                length <= 0 ||
                !orientation
            ) {
                continue
            }

            if (!groups.has(ownerIndex)) {
                groups.set(ownerIndex, [])
            }

            groups.get(ownerIndex).push({
                x,
                y,
                length,
                name: SchematicPinParser.#normalizeSchematicPinName(
                    ParserUtils.getField(record.fields, 'Name')
                ),
                designator: ParserUtils.getField(record.fields, 'Designator'),
                orientation,
                ownerIndex
            })
        }

        return [...groups.values()].flatMap((pins) =>
            SchematicPinParser.#normalizeSchematicPinGroup(pins)
        )
    }

    /**
     * Normalizes schematic port records into drawable port boxes.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} [lines]
     * @returns {{ x: number, y: number, width: number, height: number, name: string, fill: string, color: string, direction: 'left' | 'right' }[]}
     */
    static parseSchematicPorts(records, lines = []) {
        return records
            .map((record) => {
                const x =
                    ParserUtils.parseNumericField(
                        record.fields,
                        'Location.X'
                    ) || 0
                const y =
                    ParserUtils.parseNumericField(
                        record.fields,
                        'Location.Y'
                    ) || 0
                const width =
                    ParserUtils.parseNumericField(record.fields, 'Width') || 40

                return {
                    x,
                    y,
                    width,
                    height:
                        ParserUtils.parseNumericField(record.fields, 'Height') ||
                        10,
                    name: ParserUtils.getField(record.fields, 'Name'),
                    fill: ParserUtils.toColor(record.fields.AreaColor, '#ffe16f'),
                    color: ParserUtils.toColor(
                        record.fields.TextColor || record.fields.Color,
                        '#8d2b2b'
                    ),
                    direction:
                        SchematicPinParser.#resolveSchematicPortDirection(
                            record.fields,
                            x,
                            y,
                            width,
                            lines
                        )
                }
            })
            .filter((port) => port.name)
    }

    /**
     * Resolves which side of an off-sheet port should taper.
     * @param {Record<string, string | string[]>} fields
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @returns {'left' | 'right'}
     */
    static #resolveSchematicPortDirection(fields, x, y, width, lines) {
        const wireSide = SchematicPinParser.#findSchematicPortWireSide(
            x,
            y,
            width,
            lines
        )
        const ioType = ParserUtils.getField(fields, 'IOType')

        if (wireSide && ioType) {
            return SchematicPinParser.#inferSchematicPortDirectionFromIoType(
                ioType,
                wireSide
            )
        }

        return SchematicPinParser.#inferSchematicPortDirectionFromAlignment(
            ParserUtils.getField(fields, 'Alignment')
        )
    }

    /**
     * Returns which horizontal side a recovered wire touches for one port.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} lines
     * @returns {'left' | 'right' | null}
     */
    static #findSchematicPortWireSide(x, y, width, lines) {
        const tolerance = 0.01
        let touchesLeft = false
        let touchesRight = false

        for (const line of lines) {
            if (
                Math.abs(Number(line.y1) - y) > tolerance ||
                Math.abs(Number(line.y2) - y) > tolerance
            ) {
                continue
            }

            touchesLeft =
                touchesLeft ||
                Math.abs(Number(line.x1) - x) <= tolerance ||
                Math.abs(Number(line.x2) - x) <= tolerance
            touchesRight =
                touchesRight ||
                Math.abs(Number(line.x1) - (x + width)) <= tolerance ||
                Math.abs(Number(line.x2) - (x + width)) <= tolerance

            if (touchesLeft && touchesRight) {
                return null
            }
        }

        if (touchesLeft) {
            return 'left'
        }

        if (touchesRight) {
            return 'right'
        }

        return null
    }

    /**
     * Infers the tapered side from port IO type plus attached wire side.
     * @param {string} ioType
     * @param {'left' | 'right'} wireSide
     * @returns {'left' | 'right'}
     */
    static #inferSchematicPortDirectionFromIoType(ioType, wireSide) {
        if (String(ioType) === '2') {
            return wireSide
        }

        return wireSide === 'left' ? 'right' : 'left'
    }

    /**
     * Infers which side of an off-sheet port should taper from legacy
     * alignment data when no better connectivity clue is available.
     * @param {string} alignment
     * @returns {'left' | 'right'}
     */
    static #inferSchematicPortDirectionFromAlignment(alignment) {
        return String(alignment || '') === '2' ? 'right' : 'left'
    }

    /**
     * Normalizes no-connect crosses from schematic records.
     * @param {{ fields: Record<string, string | string[]> }[]} records
     * @returns {{ x: number, y: number, size: number, color: string }[]}
     */
    static parseSchematicCrosses(records) {
        return records
            .map((record) => ({
                x:
                    ParserUtils.parseNumericField(
                        record.fields,
                        'Location.X'
                    ) || 0,
                y:
                    ParserUtils.parseNumericField(
                        record.fields,
                        'Location.Y'
                    ) || 0,
                size: 6,
                color: ParserUtils.toColor(record.fields.Color, '#ff0000')
            }))
            .filter((cross) => cross.x || cross.y)
    }

    /**
     * Expands a schematic polyline record into drawable line segments.
     * @param {Record<string, string | string[]>} fields
     * @param {{ isBus?: boolean }} [options]
     * @returns {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle: number, isBus?: boolean }[]}
     */
    static parseSchematicPolyline(fields, options = {}) {
        const locationCount = ParserUtils.parseNumericField(
            fields,
            'LocationCount'
        )

        if (locationCount === null || locationCount < 2) {
            return []
        }

        const points = []

        for (let index = 1; index <= locationCount; index += 1) {
            const x = ParserUtils.parseNumericField(fields, 'X' + index)
            const y = ParserUtils.parseNumericField(fields, 'Y' + index)

            if (x === null || y === null) {
                break
            }

            points.push({ x, y })
        }

        const segments = []
        const lineStyle = ParserUtils.parseNumericField(fields, 'LineStyle') || 0

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]
            const current = points[index]

            segments.push({
                x1: previous.x,
                y1: previous.y,
                x2: current.x,
                y2: current.y,
                color: ParserUtils.toColor(fields.Color, '#a44a1b'),
                width: ParserUtils.parseNumericField(fields, 'LineWidth') || 1,
                lineStyle,
                isBus: options.isBus === true ? true : undefined
            })
        }

        return segments
    }

    /**
     * Expands a schematic polygon record into closed drawable line segments.
     * @param {Record<string, string | string[]>} fields
     * @returns {{ x1: number, y1: number, x2: number, y2: number, color: string, width: number, lineStyle: number }[]}
     */
    static parseSchematicPolygon(fields) {
        const locationCount = ParserUtils.parseNumericField(
            fields,
            'LocationCount'
        )

        if (locationCount === null || locationCount < 2) {
            return []
        }

        const points = []

        for (let index = 1; index <= locationCount; index += 1) {
            const x = ParserUtils.parseNumericField(fields, 'X' + index)
            const y = ParserUtils.parseNumericField(fields, 'Y' + index)

            if (x === null || y === null) {
                break
            }

            points.push({ x, y })
        }

        if (points.length < 2) {
            return []
        }

        const segments = []
        const lineStyle = ParserUtils.parseNumericField(fields, 'LineStyle') || 0

        for (let index = 1; index < points.length; index += 1) {
            const previous = points[index - 1]
            const current = points[index]

            segments.push({
                x1: previous.x,
                y1: previous.y,
                x2: current.x,
                y2: current.y,
                color: ParserUtils.toColor(fields.Color, '#a44a1b'),
                width: ParserUtils.parseNumericField(fields, 'LineWidth') || 1,
                lineStyle
            })
        }

        const firstPoint = points[0]
        const lastPoint = points[points.length - 1]

        segments.push({
            x1: lastPoint.x,
            y1: lastPoint.y,
            x2: firstPoint.x,
            y2: firstPoint.y,
            color: ParserUtils.toColor(fields.Color, '#a44a1b'),
            width: ParserUtils.parseNumericField(fields, 'LineWidth') || 1,
            lineStyle
        })

        return segments
    }

    /**
     * Deduces the visible pins for one schematic symbol owner.
     * @param {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', ownerIndex: string }[]} pins
     * @returns {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', color: string, labelColor: string, labelMode: 'hidden' | 'number-only' | 'name-only' | 'name-and-number', ownerIndex: string }[]}
     */
    static #normalizeSchematicPinGroup(pins) {
        const deduped = SchematicPinParser.#dedupeSchematicPins(pins)
        const names = [
            ...new Set(deduped.map((pin) => pin.name).filter(Boolean))
        ]
        const orientationCount = new Set(deduped.map((pin) => pin.orientation))
            .size
        const allPassive = names.every((name) =>
            SchematicPinParser.#isPassivePinName(name)
        )
        const semanticNames = names.filter(
            (name) => !SchematicPinParser.#isPassivePinName(name)
        )
        const allNumberedPins =
            deduped.length > 0 &&
            deduped.every(
                (pin) =>
                    /^\d+$/.test(String(pin.designator || '').trim()) &&
                    (!pin.name ||
                        /^\d+$/.test(String(pin.name || '').trim()))
            )
        let labelMode = 'name-and-number'

        if (allPassive && orientationCount > 2) {
            // Keep dense multi-side connector symbols whose contacts are only
            // identified by numbers; dropping them loses both pin numbers and
            // any power-port attachment geometry recovered from those pins.
            if (deduped.length > 4 && !allNumberedPins) {
                return []
            }

            labelMode = 'number-only'
        }

        if (allPassive && deduped.length <= 2) {
            labelMode = 'hidden'
        } else if (!semanticNames.length && orientationCount <= 2) {
            labelMode = 'number-only'
        } else if (
            semanticNames.length >= Math.max(names.length - 1, 3) &&
            orientationCount <= 2 &&
            deduped.length <= 4
        ) {
            labelMode = 'name-only'
        }

        return deduped.map((pin) => ({
            ...pin,
            color: '#0000ff',
            labelColor: '#1f1f1f',
            labelMode
        }))
    }

    /**
     * Removes duplicate pin records emitted for alternate display modes.
     * @param {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', ownerIndex: string }[]} pins
     * @returns {{ x: number, y: number, length: number, name: string, designator: string, orientation: 'left' | 'right' | 'top' | 'bottom', ownerIndex: string }[]}
     */
    static #dedupeSchematicPins(pins) {
        const seen = new Set()
        const deduped = []

        for (const pin of pins) {
            const key = [
                pin.ownerIndex,
                pin.x,
                pin.y,
                pin.length,
                pin.name,
                pin.designator,
                pin.orientation
            ].join('::')

            if (seen.has(key)) continue

            seen.add(key)
            deduped.push(pin)
        }

        return deduped
    }

    /**
     * Removes Altium backslash escape markers from visible pin labels.
     * @param {string} name
     * @returns {string}
     */
    static #normalizeSchematicPinName(name) {
        return String(name || '').replaceAll('\\', '').trim()
    }

    /**
     * Returns true when a pin name looks like a passive-symbol terminal.
     * @param {string} name
     * @returns {boolean}
     */
    static #isPassivePinName(name) {
        return /^(\d+|[AK])$/i.test(String(name || '').trim())
    }

    /**
     * Maps Altium pin conglomerate flags into a side orientation.
     * @param {number | null} conglomerate
     * @returns {'left' | 'right' | 'top' | 'bottom' | null}
     */
    static #inferSchematicPinOrientation(conglomerate) {
        switch (conglomerate) {
            case 34:
            case 50:
            case 58:
                return 'left'
            case 32:
            case 48:
            case 56:
                return 'right'
            case 33:
            case 49:
            case 57:
                return 'top'
            case 35:
            case 51:
            case 59:
                return 'bottom'
            default:
                return null
        }
    }
}
