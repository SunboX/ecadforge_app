/**
 * Applies placement-oriented cleanup passes to normalized schematic text.
 */
export class SchematicTextPostProcessor {
    /**
     * Removes free text labels already covered by visible off-sheet ports.
     * @param {{ x: number, y: number, text: string, recordType?: string }[]} texts
     * @param {{ x: number, y: number, width: number, name: string }[]} ports
     * @returns {{ x: number, y: number, text: string, recordType?: string }[]}
     */
    static dropDuplicatePortLabels(texts, ports) {
        return texts.filter(
            (text) =>
                !ports.some(
                    (port) =>
                        text.recordType === '25' &&
                        port.name === text.text &&
                        Math.abs(port.y - text.y) <= 2 &&
                        text.x < port.x &&
                        port.x - text.x <= Math.max(port.width + 20, 80)
                )
        )
    }

    /**
     * Adds multipart section suffixes like A/B/J to visible designator texts
     * when the active Altium part id is stored separately from the base
     * designator string.
     * @param {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]} texts
     * @param {Map<string, string>} activeMultipartOwnerParts
     * @returns {{ text: string, name?: string, ownerIndex?: string, recordType?: string }[]}
     */
    static decorateMultipartDesignators(texts, activeMultipartOwnerParts) {
        return texts.map((text) => {
            const ownerIndex = String(text.ownerIndex || '')
            const suffix =
                SchematicTextPostProcessor.#formatMultipartPartSuffix(
                    activeMultipartOwnerParts.get(ownerIndex)
                )

            if (
                !suffix ||
                text.recordType !== '34' ||
                String(text.name || '').trim().toLowerCase() !== 'designator'
            ) {
                return text
            }

            if (!/\d$/i.test(text.text) || text.text.endsWith(suffix)) {
                return text
            }

            return {
                ...text,
                text: text.text + suffix
            }
        })
    }

    /**
     * Re-anchors horizontal component texts from their owner primitive bounds
     * so labels to the left of a symbol right-align and labels to the right
     * keep reading left-to-right.
     * @param {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, ownerIndex: string, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' }[]} ports
     * @returns {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]}
     */
    static anchorComponentTextsFromOwnerBounds(texts, lines, pins, ports = []) {
        const ownerBounds = SchematicTextPostProcessor.#buildOwnerBounds(
            lines,
            pins
        )
        const ownerPinCounts =
            SchematicTextPostProcessor.#buildOwnerPinCounts(pins)

        return texts.map((text) => {
            if (
                !text ||
                text.name !== 'Designator' ||
                text.rotation ||
                !text.ownerIndex
            ) {
                return text
            }

            const bounds = ownerBounds.get(text.ownerIndex)

            if (!bounds) {
                return text
            }

            const paddedText =
                SchematicTextPostProcessor.#padDesignatorAboveOwner(
                    text,
                    bounds
                )
            const ownerPinCount = ownerPinCounts.get(text.ownerIndex) || 0

            if (text.y > bounds.maxY) {
                return paddedText
            }

            if (text.y < bounds.minY) {
                return paddedText
            }

            if (paddedText.x <= bounds.minX + 2) {
                if (
                    SchematicTextPostProcessor.#hasNearbyLeftWireLabel(
                        paddedText,
                        texts,
                        lines,
                        pins,
                        ports
                    ) ||
                    SchematicTextPostProcessor.#isCompactTwoPinOwner(
                        bounds,
                        ownerPinCount
                    )
                ) {
                    return paddedText
                }

                return {
                    ...paddedText,
                    anchor: 'end'
                }
            }

            if (paddedText.x >= bounds.maxX - 2) {
                return {
                    ...paddedText,
                    anchor: 'start'
                }
            }

            return paddedText
        })
    }

    /**
     * Right-aligns wire labels that precede a same-row component designator so
     * they stay clear of the symbol body.
     * Labels that sit on a wire segment whose left endpoint is an actual pin
     * or off-sheet port keep their original left-to-right flow.
     * @param {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]} texts
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' }[]} ports
     * @returns {{ x: number, y: number, text: string, name?: string, ownerIndex?: string, recordType?: string, rotation?: number, anchor?: 'start' | 'middle' | 'end' }[]}
     */
    static anchorWireLabelsNearDesignators(texts, lines, pins, ports = []) {
        return texts.map((text) => {
            if (
                !text ||
                text.recordType !== '25' ||
                text.rotation ||
                text.anchor !== 'start'
            ) {
                return text
            }

            const hasNearbyRightDesignator = texts.some(
                (candidate) =>
                    candidate &&
                    candidate.name === 'Designator' &&
                    !candidate.rotation &&
                    candidate.x > text.x &&
                    candidate.x - text.x <= 80 &&
                    Math.abs(candidate.y - text.y) <= 2
            )

            if (!hasNearbyRightDesignator) {
                return text
            }

            if (
                SchematicTextPostProcessor.#hasPinConnectedAtWireStart(
                    text,
                    lines,
                    pins
                ) ||
                SchematicTextPostProcessor.#hasLineConnectedAtWireStart(
                    text,
                    lines
                ) ||
                SchematicTextPostProcessor.#hasPortConnectedAtWireStart(
                    text,
                    lines,
                    ports
                )
            ) {
                return text
            }

            return {
                ...text,
                anchor: 'end'
            }
        })
    }

    /**
     * Builds per-owner primitive bounds from drawable lines and pins.
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, ownerIndex: string }[]} pins
     * @returns {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>}
     */
    static #buildOwnerBounds(lines, pins) {
        const ownerBounds = new Map()

        for (const line of lines) {
            if (!line.ownerIndex) {
                continue
            }

            SchematicTextPostProcessor.#extendBounds(ownerBounds, line.ownerIndex, [
                { x: line.x1, y: line.y1 },
                { x: line.x2, y: line.y2 }
            ])
        }

        for (const pin of pins) {
            if (!pin.ownerIndex) {
                continue
            }

            SchematicTextPostProcessor.#extendBounds(ownerBounds, pin.ownerIndex, [
                { x: pin.x, y: pin.y }
            ])
        }

        return ownerBounds
    }

    /**
     * Counts visible pins per owner so compact passive parts can keep their
     * left-to-right designator flow.
     * @param {{ ownerIndex: string }[]} pins
     * @returns {Map<string, number>}
     */
    static #buildOwnerPinCounts(pins) {
        const ownerPinCounts = new Map()

        for (const pin of pins) {
            if (!pin.ownerIndex) {
                continue
            }

            ownerPinCounts.set(
                pin.ownerIndex,
                (ownerPinCounts.get(pin.ownerIndex) || 0) + 1
            )
        }

        return ownerPinCounts
    }

    /**
     * Adds a small gap between a top-side designator and the owner outline.
     * @param {{ x: number, y: number }} text
     * @param {{ maxY: number }} bounds
     * @returns {{ x: number, y: number }}
     */
    static #padDesignatorAboveOwner(text, bounds) {
        if (text.y <= bounds.maxY) {
            return text
        }

        return {
            ...text,
            y: bounds.maxY + 4
        }
    }

    /**
     * Returns true for compact two-pin symbols such as the small capacitors on
     * the Bluetooth sheet, whose left-side designators should keep reading
     * left-to-right instead of flipping toward the body.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds
     * @param {number} ownerPinCount
     * @returns {boolean}
     */
    static #isCompactTwoPinOwner(bounds, ownerPinCount) {
        return (
            ownerPinCount === 2 &&
            bounds.maxX - bounds.minX <= 12 &&
            bounds.maxY - bounds.minY <= 20
        )
    }

    /**
     * Returns true when a designator sits immediately to the right of a visible
     * same-row wire label and should preserve the left-to-right flow.
     * @param {{ x: number, y: number, recordType?: string, rotation?: number }} text
     * @param {{ x: number, y: number, recordType?: string, rotation?: number }}[] texts
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' }[]} ports
     * @returns {boolean}
     */
    static #hasNearbyLeftWireLabel(text, texts, lines, pins, ports) {
        return texts.some(
            (candidate) =>
                candidate &&
                candidate !== text &&
                candidate.recordType === '25' &&
                !candidate.rotation &&
                candidate.x < text.x &&
                text.x - candidate.x <= 80 &&
                Math.abs(candidate.y - text.y) <= 2 &&
                (SchematicTextPostProcessor.#hasPinConnectedAtWireStart(
                    candidate,
                    lines,
                    pins
                ) ||
                    SchematicTextPostProcessor.#hasLineConnectedAtWireStart(
                        candidate,
                        lines
                    ) ||
                    SchematicTextPostProcessor.#hasPortConnectedAtWireStart(
                        candidate,
                        lines,
                        ports
                    ))
        )
    }

    /**
     * Returns true when the left endpoint of the label's wire segment is
     * already connected into another wire segment, such as a bus breakout.
     * Those labels should keep reading left-to-right from the junction.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @returns {boolean}
     */
    static #hasLineConnectedAtWireStart(text, lines) {
        const containingSegment =
            SchematicTextPostProcessor.#findContainingHorizontalWireSegment(
                text,
                lines
            )

        if (!containingSegment) {
            return false
        }

        const leftPoint = {
            x: Math.min(containingSegment.x1, containingSegment.x2),
            y: text.y
        }

        return lines.some(
            (line) =>
                line !== containingSegment &&
                SchematicTextPostProcessor.#pointTouchesLine(leftPoint, line)
        )
    }

    /**
     * Converts one numeric multipart section id into an alphabetic suffix.
     * @param {string | undefined} partId
     * @returns {string}
     */
    static #formatMultipartPartSuffix(partId) {
        const numericPartId = Number.parseInt(String(partId || ''), 10)
        if (!Number.isInteger(numericPartId) || numericPartId <= 0) {
            return ''
        }

        let suffix = ''
        let remaining = numericPartId

        while (remaining > 0) {
            remaining -= 1
            suffix = String.fromCharCode(65 + (remaining % 26)) + suffix
            remaining = Math.floor(remaining / 26)
        }

        return suffix
    }

    /**
     * Returns true when the horizontal wire segment under the label starts at a
     * pin endpoint, which means the label should continue reading rightward.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }[]} pins
     * @returns {boolean}
     */
    static #hasPinConnectedAtWireStart(text, lines, pins) {
        const containingSegment =
            SchematicTextPostProcessor.#findContainingHorizontalWireSegment(
                text,
                lines
            )

        if (!containingSegment) {
            return false
        }

        const leftX = Math.min(containingSegment.x1, containingSegment.x2)

        return pins.some((pin) => {
            const endpoint = SchematicTextPostProcessor.#projectPinOuterEndpoint(
                pin
            )

            return (
                endpoint &&
                Math.abs(endpoint.x - leftX) <= 2 &&
                Math.abs(endpoint.y - text.y) <= 2
            )
        })
    }

    /**
     * Returns true when the horizontal wire segment under the label starts at an
     * off-sheet port connection, which means the label should keep reading
     * rightward from that port.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' }[]} ports
     * @returns {boolean}
     */
    static #hasPortConnectedAtWireStart(text, lines, ports) {
        const containingSegment =
            SchematicTextPostProcessor.#findContainingHorizontalWireSegment(
                text,
                lines
            )

        if (!containingSegment) {
            return false
        }

        const leftX = Math.min(containingSegment.x1, containingSegment.x2)

        return ports.some((port) => {
            const endpoint =
                SchematicTextPostProcessor.#projectPortConnectionEndpoint(port)

            return (
                endpoint &&
                Math.abs(endpoint.x - leftX) <= 2 &&
                Math.abs(endpoint.y - text.y) <= 2
            )
        })
    }

    /**
     * Finds the horizontal wire segment that carries a text label.
     * @param {{ x: number, y: number }} text
     * @param {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string }[]} lines
     * @returns {{ x1: number, y1: number, x2: number, y2: number, ownerIndex?: string } | null}
     */
    static #findContainingHorizontalWireSegment(text, lines) {
        const candidates = lines.filter(
            (line) =>
                Math.abs(line.y1 - text.y) <= 2 &&
                Math.abs(line.y2 - text.y) <= 2 &&
                Math.min(line.x1, line.x2) - 2 <= text.x &&
                text.x <= Math.max(line.x1, line.x2) + 2
        )

        if (!candidates.length) {
            return null
        }

        return candidates.sort(
            (left, right) =>
                Math.abs(Math.min(left.x1, left.x2) - text.x) -
                Math.abs(Math.min(right.x1, right.x2) - text.x)
        )[0]
    }

    /**
     * Returns true when a point lands on a line segment endpoint or on an
     * axis-aligned segment interior.
     * @param {{ x: number, y: number }} point
     * @param {{ x1: number, y1: number, x2: number, y2: number }} line
     * @returns {boolean}
     */
    static #pointTouchesLine(point, line) {
        const touchesStart =
            Math.abs(line.x1 - point.x) <= 2 && Math.abs(line.y1 - point.y) <= 2
        const touchesEnd =
            Math.abs(line.x2 - point.x) <= 2 && Math.abs(line.y2 - point.y) <= 2

        if (touchesStart || touchesEnd) {
            return true
        }

        const minX = Math.min(line.x1, line.x2) - 2
        const maxX = Math.max(line.x1, line.x2) + 2
        const minY = Math.min(line.y1, line.y2) - 2
        const maxY = Math.max(line.y1, line.y2) + 2

        if (
            Math.abs(line.x1 - line.x2) <= 2 &&
            Math.abs(point.x - line.x1) <= 2 &&
            point.y >= minY &&
            point.y <= maxY
        ) {
            return true
        }

        if (
            Math.abs(line.y1 - line.y2) <= 2 &&
            Math.abs(point.y - line.y1) <= 2 &&
            point.x >= minX &&
            point.x <= maxX
        ) {
            return true
        }

        return false
    }

    /**
     * Projects the wire-connection endpoint for one off-sheet port.
     * @param {{ x: number, y: number, width: number, direction?: 'left' | 'right' }} port
     * @returns {{ x: number, y: number }}
     */
    static #projectPortConnectionEndpoint(port) {
        return {
            x: (port.direction || 'right') === 'left' ? port.x + port.width : port.x,
            y: port.y
        }
    }

    /**
     * Expands one owner-bound entry with a set of points.
     * @param {Map<string, { minX: number, minY: number, maxX: number, maxY: number }>} ownerBounds
     * @param {string} ownerIndex
     * @param {{ x: number, y: number }[]} points
     * @returns {void}
     */
    static #extendBounds(ownerBounds, ownerIndex, points) {
        const current = ownerBounds.get(ownerIndex) || {
            minX: Number.POSITIVE_INFINITY,
            minY: Number.POSITIVE_INFINITY,
            maxX: Number.NEGATIVE_INFINITY,
            maxY: Number.NEGATIVE_INFINITY
        }

        for (const point of points) {
            current.minX = Math.min(current.minX, point.x)
            current.minY = Math.min(current.minY, point.y)
            current.maxX = Math.max(current.maxX, point.x)
            current.maxY = Math.max(current.maxY, point.y)
        }

        ownerBounds.set(ownerIndex, current)
    }

    /**
     * Projects one pin into its wire-connected outer endpoint.
     * @param {{ x: number, y: number, length: number, orientation: 'left' | 'right' | 'top' | 'bottom' }} pin
     * @returns {{ x: number, y: number } | null}
     */
    static #projectPinOuterEndpoint(pin) {
        switch (pin.orientation) {
            case 'left':
                return { x: pin.x - pin.length, y: pin.y }
            case 'right':
                return { x: pin.x + pin.length, y: pin.y }
            case 'top':
                return { x: pin.x, y: pin.y + pin.length }
            case 'bottom':
                return { x: pin.x, y: pin.y - pin.length }
            default:
                return null
        }
    }
}
