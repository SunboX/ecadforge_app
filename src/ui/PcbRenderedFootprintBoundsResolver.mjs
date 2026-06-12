import { SvgArcBoundsResolver } from './SvgArcBoundsResolver.mjs'

/**
 * Resolves selected-footprint marker bounds from rendered PCB SVG elements.
 */
export class PcbRenderedFootprintBoundsResolver {
    /**
     * Resolves SVG-space marker bounds from rendered footprint elements.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {string} selectedComponentKey Selected component key.
     * @param {{ width: number, height: number } | null} viewBox SVG viewBox.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number } | null}
     */
    static resolveMarkerBounds(markup, selectedComponentKey, viewBox) {
        const prefix = PcbRenderedFootprintBoundsResolver.#escapeRegExp(
            PcbRenderedFootprintBoundsResolver.#escapeHtml(
                'footprint:' + selectedComponentKey + ':'
            )
        )
        const matcher = new RegExp(
            '<([a-zA-Z][\\w:-]*)\\b(?=[^>]*\\bdata-footprint-id="' +
                prefix +
                ')[^>]*>',
            'g'
        )
        let bounds = null

        for (const match of String(markup).matchAll(matcher)) {
            bounds = PcbRenderedFootprintBoundsResolver.#includeBounds(
                bounds,
                PcbRenderedFootprintBoundsResolver.#resolveElementBounds(
                    match[1],
                    match[0]
                )
            )
        }
        if (!bounds) return null

        return PcbRenderedFootprintBoundsResolver.#expandMarkerBounds(
            bounds,
            PcbRenderedFootprintBoundsResolver.#resolveMarkerMargin(
                bounds,
                viewBox
            )
        )
    }

    /**
     * Resolves the root SVG viewBox.
     * @param {string} markup Renderer-owned SVG markup.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } | null}
     */
    static resolveSvgViewBox(markup) {
        const match = String(markup).match(/<svg\b[^>]*\bviewBox="([^"]+)"/)
        const values = String(match?.[1] || '')
            .trim()
            .split(/[\s,]+/)
            .map(Number)
        if (
            values.length < 4 ||
            values.some((value) => !Number.isFinite(value)) ||
            values[2] <= 0 ||
            values[3] <= 0
        ) {
            return null
        }

        return {
            minX: values[0],
            minY: values[1],
            maxX: values[0] + values[2],
            maxY: values[1] + values[3],
            width: values[2],
            height: values[3]
        }
    }

    /**
     * Returns true when marker bounds overlap the visible SVG coordinate area.
     * @param {{ x: number, y: number, width: number, height: number }} bounds Marker bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} viewBox SVG viewBox.
     * @returns {boolean}
     */
    static boundsOverlapViewBox(bounds, viewBox) {
        if (!viewBox) return true

        return (
            bounds.x <= viewBox.maxX &&
            bounds.x + bounds.width >= viewBox.minX &&
            bounds.y <= viewBox.maxY &&
            bounds.y + bounds.height >= viewBox.minY
        )
    }

    /**
     * Resolves raw SVG bounds for one rendered footprint element.
     * @param {string} tagName SVG tag name.
     * @param {string} markup SVG start tag markup.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveElementBounds(tagName, markup) {
        const tag = String(tagName || '').toLowerCase()
        if (tag === 'line') {
            return PcbRenderedFootprintBoundsResolver.#resolvePoints(markup, [
                'x1',
                'y1',
                'x2',
                'y2'
            ])
        }
        if (tag === 'rect') {
            return PcbRenderedFootprintBoundsResolver.#resolveRectBounds(markup)
        }
        if (tag === 'circle') {
            return PcbRenderedFootprintBoundsResolver.#resolveCenterBounds(
                markup,
                'r',
                'r'
            )
        }
        if (tag === 'ellipse') {
            return PcbRenderedFootprintBoundsResolver.#resolveCenterBounds(
                markup,
                'rx',
                'ry'
            )
        }
        if (tag === 'path') {
            return PcbRenderedFootprintBoundsResolver.#resolvePathBounds(
                PcbRenderedFootprintBoundsResolver.#svgAttribute(markup, 'd')
            )
        }
        if (['polygon', 'polyline'].includes(tag)) {
            return PcbRenderedFootprintBoundsResolver.#resolveNumberBounds(
                PcbRenderedFootprintBoundsResolver.#svgAttribute(
                    markup,
                    'points'
                )
            )
        }

        return null
    }

    /**
     * Resolves raw SVG bounds for a rendered rectangle.
     * @param {string} markup SVG start tag markup.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveRectBounds(markup) {
        const x = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            'x'
        )
        const y = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            'y'
        )
        const width = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            'width'
        )
        const height = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            'height'
        )
        if (x === null || y === null || width === null || height === null) {
            return null
        }

        return { minX: x, minY: y, maxX: x + width, maxY: y + height }
    }

    /**
     * Resolves raw SVG bounds around a center with x/y radii.
     * @param {string} markup SVG start tag markup.
     * @param {string} xRadiusAttribute Radius x attribute name.
     * @param {string} yRadiusAttribute Radius y attribute name.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveCenterBounds(markup, xRadiusAttribute, yRadiusAttribute) {
        const cx = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            'cx'
        )
        const cy = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            'cy'
        )
        const rx = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            xRadiusAttribute
        )
        const ry = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
            markup,
            yRadiusAttribute
        )
        if (cx === null || cy === null || rx === null || ry === null) {
            return null
        }

        return { minX: cx - rx, minY: cy - ry, maxX: cx + rx, maxY: cy + ry }
    }

    /**
     * Resolves raw SVG bounds from a fixed list of point attributes.
     * @param {string} markup SVG start tag markup.
     * @param {string[]} attributes Alternating x/y attribute names.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePoints(markup, attributes) {
        let bounds = null
        for (let index = 0; index + 1 < attributes.length; index += 2) {
            const x = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
                markup,
                attributes[index]
            )
            const y = PcbRenderedFootprintBoundsResolver.#svgAttributeNumber(
                markup,
                attributes[index + 1]
            )
            if (x !== null && y !== null) {
                bounds = PcbRenderedFootprintBoundsResolver.#includePoint(
                    bounds,
                    x,
                    y
                )
            }
        }

        return bounds
    }

    /**
     * Resolves raw SVG bounds from a string containing x/y number pairs.
     * @param {string} text Attribute text.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveNumberBounds(text) {
        const numbers = String(text).match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)
        if (!numbers?.length) return null

        let bounds = null
        for (let index = 0; index + 1 < numbers.length; index += 2) {
            bounds = PcbRenderedFootprintBoundsResolver.#includePoint(
                bounds,
                Number(numbers[index]),
                Number(numbers[index + 1])
            )
        }

        return bounds
    }

    /**
     * Resolves raw SVG bounds from path command geometry.
     * @param {string} text Path data.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolvePathBounds(text) {
        const tokens = PcbRenderedFootprintBoundsResolver.#pathTokens(text)
        let index = 0
        let command = ''
        let current = { x: 0, y: 0 }
        let subpathStart = { x: 0, y: 0 }
        let bounds = null
        let previousCommand = ''
        let previousCubicControl = null
        let previousQuadraticControl = null

        while (index < tokens.length) {
            if (
                PcbRenderedFootprintBoundsResolver.#isPathCommand(tokens[index])
            ) {
                command = tokens[index]
                index += 1
            }
            if (!command) break

            const lowerCommand = command.toLowerCase()
            if (lowerCommand === 'z') {
                bounds =
                    PcbRenderedFootprintBoundsResolver.#includeSegmentBounds(
                        bounds,
                        current,
                        subpathStart
                    )
                current = subpathStart
                previousCommand = lowerCommand
                previousCubicControl = null
                previousQuadraticControl = null
                command = ''
                continue
            }

            if (lowerCommand === 'm') {
                const result =
                    PcbRenderedFootprintBoundsResolver.#consumeMovePathCommand(
                        tokens,
                        index,
                        command,
                        current,
                        subpathStart,
                        bounds
                    )
                index = result.index
                current = result.current
                subpathStart = result.subpathStart
                bounds = result.bounds
                command = command === lowerCommand ? 'l' : 'L'
                previousCommand = lowerCommand
                previousCubicControl = null
                previousQuadraticControl = null
                if (!result.consumed && index < tokens.length) index += 1
                continue
            }

            const consumed =
                PcbRenderedFootprintBoundsResolver.#consumeDrawablePathCommand({
                    tokens,
                    index,
                    command,
                    current,
                    bounds,
                    previousCommand,
                    previousCubicControl,
                    previousQuadraticControl
                })
            index = consumed.index
            current = consumed.current
            bounds = consumed.bounds
            previousCommand = consumed.previousCommand
            previousCubicControl = consumed.previousCubicControl
            previousQuadraticControl = consumed.previousQuadraticControl
            if (!consumed.consumed && index < tokens.length) index += 1
        }

        return bounds
    }

    /**
     * Tokenizes path commands and numeric parameters.
     * @param {string} text Path data.
     * @returns {string[]}
     */
    static #pathTokens(text) {
        return (
            String(text).match(
                /[AaCcHhLlMmQqSsTtVvZz]|[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/g
            ) || []
        )
    }

    /**
     * Consumes one move command and any implicit following line commands.
     * @param {string[]} tokens Path tokens.
     * @param {number} index Current token index.
     * @param {string} command Path command.
     * @param {{ x: number, y: number }} current Current point.
     * @param {{ x: number, y: number }} subpathStart Current subpath start.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @returns {{ index: number, current: { x: number, y: number }, subpathStart: { x: number, y: number }, bounds: { minX: number, minY: number, maxX: number, maxY: number } | null, consumed: boolean }}
     */
    static #consumeMovePathCommand(
        tokens,
        index,
        command,
        current,
        subpathStart,
        bounds
    ) {
        const relative = command === command.toLowerCase()
        let nextIndex = index
        let nextCurrent = current
        let nextSubpathStart = subpathStart
        let nextBounds = bounds
        let isFirstPair = true
        let consumed = false

        while (nextIndex < tokens.length) {
            const values = PcbRenderedFootprintBoundsResolver.#readPathNumbers(
                tokens,
                nextIndex,
                2
            )
            if (!values) break

            const point = PcbRenderedFootprintBoundsResolver.#pathPoint(
                nextCurrent,
                values[0],
                values[1],
                relative
            )
            if (isFirstPair) {
                nextCurrent = point
                nextSubpathStart = point
                isFirstPair = false
            } else {
                nextBounds =
                    PcbRenderedFootprintBoundsResolver.#includeSegmentBounds(
                        nextBounds,
                        nextCurrent,
                        point
                    )
                nextCurrent = point
            }
            nextIndex += 2
            consumed = true
        }

        return {
            index: nextIndex,
            current: nextCurrent,
            subpathStart: nextSubpathStart,
            bounds: nextBounds,
            consumed
        }
    }

    /**
     * Consumes repeated drawable path segments for one command.
     * @param {{ tokens: string[], index: number, command: string, current: { x: number, y: number }, bounds: { minX: number, minY: number, maxX: number, maxY: number } | null, previousCommand: string, previousCubicControl: { x: number, y: number } | null, previousQuadraticControl: { x: number, y: number } | null }} state Parser state.
     * @returns {{ index: number, current: { x: number, y: number }, bounds: { minX: number, minY: number, maxX: number, maxY: number } | null, previousCommand: string, previousCubicControl: { x: number, y: number } | null, previousQuadraticControl: { x: number, y: number } | null, consumed: boolean }}
     */
    static #consumeDrawablePathCommand(state) {
        const lowerCommand = state.command.toLowerCase()
        const parameterCount =
            PcbRenderedFootprintBoundsResolver.#pathParameterCount(lowerCommand)
        let nextIndex = state.index
        let current = state.current
        let bounds = state.bounds
        let previousCommand = state.previousCommand
        let previousCubicControl = state.previousCubicControl
        let previousQuadraticControl = state.previousQuadraticControl
        let consumed = false

        while (parameterCount > 0 && nextIndex < state.tokens.length) {
            const values = PcbRenderedFootprintBoundsResolver.#readPathNumbers(
                state.tokens,
                nextIndex,
                parameterCount
            )
            if (!values) break

            const segment =
                PcbRenderedFootprintBoundsResolver.#resolvePathSegment(
                    lowerCommand,
                    state.command === lowerCommand,
                    values,
                    current,
                    previousCommand,
                    previousCubicControl,
                    previousQuadraticControl
                )
            bounds = PcbRenderedFootprintBoundsResolver.#includeBounds(
                bounds,
                segment.bounds
            )
            current = segment.current
            previousCommand = lowerCommand
            previousCubicControl = segment.previousCubicControl
            previousQuadraticControl = segment.previousQuadraticControl
            nextIndex += parameterCount
            consumed = true
        }

        return {
            index: nextIndex,
            current,
            bounds,
            previousCommand,
            previousCubicControl,
            previousQuadraticControl,
            consumed
        }
    }

    /**
     * Resolves one path segment and updated control-point state.
     * @param {string} command Lowercase path command.
     * @param {boolean} relative Whether segment coordinates are relative.
     * @param {number[]} values Segment parameters.
     * @param {{ x: number, y: number }} current Current point.
     * @param {string} previousCommand Previous command.
     * @param {{ x: number, y: number } | null} previousCubicControl Previous cubic control point.
     * @param {{ x: number, y: number } | null} previousQuadraticControl Previous quadratic control point.
     * @returns {{ current: { x: number, y: number }, bounds: { minX: number, minY: number, maxX: number, maxY: number } | null, previousCubicControl: { x: number, y: number } | null, previousQuadraticControl: { x: number, y: number } | null }}
     */
    static #resolvePathSegment(
        command,
        relative,
        values,
        current,
        previousCommand,
        previousCubicControl,
        previousQuadraticControl
    ) {
        if (command === 'h') {
            return PcbRenderedFootprintBoundsResolver.#resolveLinePathSegment(
                current,
                {
                    x: relative ? current.x + values[0] : values[0],
                    y: current.y
                }
            )
        }
        if (command === 'v') {
            return PcbRenderedFootprintBoundsResolver.#resolveLinePathSegment(
                current,
                {
                    x: current.x,
                    y: relative ? current.y + values[0] : values[0]
                }
            )
        }
        if (command === 'l' || command === 't') {
            const end = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[0],
                values[1],
                relative
            )
            return PcbRenderedFootprintBoundsResolver.#resolveLinePathSegment(
                current,
                end
            )
        }
        if (command === 'c') {
            const control1 = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[0],
                values[1],
                relative
            )
            const control2 = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[2],
                values[3],
                relative
            )
            const end = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[4],
                values[5],
                relative
            )
            return PcbRenderedFootprintBoundsResolver.#resolveCurvePathSegment(
                current,
                [control1, control2, end],
                end,
                control2,
                null
            )
        }
        if (command === 's') {
            const control1 =
                ['c', 's'].includes(previousCommand) && previousCubicControl
                    ? PcbRenderedFootprintBoundsResolver.#reflectPoint(
                          current,
                          previousCubicControl
                      )
                    : current
            const control2 = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[0],
                values[1],
                relative
            )
            const end = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[2],
                values[3],
                relative
            )
            return PcbRenderedFootprintBoundsResolver.#resolveCurvePathSegment(
                current,
                [control1, control2, end],
                end,
                control2,
                null
            )
        }
        if (command === 'q') {
            const control = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[0],
                values[1],
                relative
            )
            const end = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[2],
                values[3],
                relative
            )
            return PcbRenderedFootprintBoundsResolver.#resolveCurvePathSegment(
                current,
                [control, end],
                end,
                null,
                control
            )
        }
        if (command === 'a') {
            const end = PcbRenderedFootprintBoundsResolver.#pathPoint(
                current,
                values[5],
                values[6],
                relative
            )
            return {
                current: end,
                bounds: SvgArcBoundsResolver.resolve(
                    current,
                    values[0],
                    values[1],
                    values[2],
                    values[3],
                    values[4],
                    end
                ),
                previousCubicControl: null,
                previousQuadraticControl: null
            }
        }

        return {
            current,
            bounds: null,
            previousCubicControl: null,
            previousQuadraticControl: null
        }
    }

    /**
     * Resolves one straight path segment.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {{ current: { x: number, y: number }, bounds: { minX: number, minY: number, maxX: number, maxY: number }, previousCubicControl: null, previousQuadraticControl: null }}
     */
    static #resolveLinePathSegment(start, end) {
        return {
            current: end,
            bounds: PcbRenderedFootprintBoundsResolver.#includeSegmentBounds(
                null,
                start,
                end
            ),
            previousCubicControl: null,
            previousQuadraticControl: null
        }
    }

    /**
     * Resolves one curve path segment using its control hull.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }[]} points Control and end points.
     * @param {{ x: number, y: number }} end End point.
     * @param {{ x: number, y: number } | null} cubicControl Next cubic control state.
     * @param {{ x: number, y: number } | null} quadraticControl Next quadratic control state.
     * @returns {{ current: { x: number, y: number }, bounds: { minX: number, minY: number, maxX: number, maxY: number }, previousCubicControl: { x: number, y: number } | null, previousQuadraticControl: { x: number, y: number } | null }}
     */
    static #resolveCurvePathSegment(
        start,
        points,
        end,
        cubicControl,
        quadraticControl
    ) {
        let bounds = PcbRenderedFootprintBoundsResolver.#includePoint(
            null,
            start.x,
            start.y
        )
        for (const point of points) {
            bounds = PcbRenderedFootprintBoundsResolver.#includePoint(
                bounds,
                point.x,
                point.y
            )
        }

        return {
            current: end,
            bounds,
            previousCubicControl: cubicControl,
            previousQuadraticControl: quadraticControl
        }
    }

    /**
     * Resolves one path point from absolute or relative parameters.
     * @param {{ x: number, y: number }} current Current point.
     * @param {number} x Parameter x value.
     * @param {number} y Parameter y value.
     * @param {boolean} relative Whether parameters are relative.
     * @returns {{ x: number, y: number }}
     */
    static #pathPoint(current, x, y, relative) {
        return {
            x: relative ? current.x + x : x,
            y: relative ? current.y + y : y
        }
    }

    /**
     * Reflects a previous control point around the current point.
     * @param {{ x: number, y: number }} current Current point.
     * @param {{ x: number, y: number }} point Previous control point.
     * @returns {{ x: number, y: number }}
     */
    static #reflectPoint(current, point) {
        return {
            x: current.x * 2 - point.x,
            y: current.y * 2 - point.y
        }
    }

    /**
     * Includes the endpoints of one segment.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {{ x: number, y: number }} start Start point.
     * @param {{ x: number, y: number }} end End point.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #includeSegmentBounds(bounds, start, end) {
        return PcbRenderedFootprintBoundsResolver.#includePoint(
            PcbRenderedFootprintBoundsResolver.#includePoint(
                bounds,
                start.x,
                start.y
            ),
            end.x,
            end.y
        )
    }

    /**
     * Reads a fixed number of path numeric parameters.
     * @param {string[]} tokens Path tokens.
     * @param {number} index Starting token index.
     * @param {number} count Parameter count.
     * @returns {number[] | null}
     */
    static #readPathNumbers(tokens, index, count) {
        if (index + count > tokens.length) return null

        const values = []
        for (let offset = 0; offset < count; offset += 1) {
            const token = tokens[index + offset]
            if (PcbRenderedFootprintBoundsResolver.#isPathCommand(token)) {
                return null
            }
            const value = Number(token)
            if (!Number.isFinite(value)) return null
            values.push(value)
        }

        return values
    }

    /**
     * Resolves the parameter count for one path segment.
     * @param {string} command Lowercase path command.
     * @returns {number}
     */
    static #pathParameterCount(command) {
        return (
            {
                a: 7,
                c: 6,
                h: 1,
                l: 2,
                q: 4,
                s: 4,
                t: 2,
                v: 1
            }[command] || 0
        )
    }

    /**
     * Returns true for SVG path command tokens.
     * @param {string} token Path token.
     * @returns {boolean}
     */
    static #isPathCommand(token) {
        return /^[AaCcHhLlMmQqSsTtVvZz]$/.test(String(token || ''))
    }

    /**
     * Resolves a margin appropriate for rendered SVG footprint bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Raw SVG bounds.
     * @param {{ width: number, height: number } | null} viewBox SVG viewBox.
     * @returns {number}
     */
    static #resolveMarkerMargin(bounds, viewBox) {
        const span = Math.max(
            Math.max(0, bounds.maxX - bounds.minX),
            Math.max(0, bounds.maxY - bounds.minY)
        )
        const viewBoxSpan = viewBox
            ? Math.min(viewBox.width, viewBox.height)
            : span
        const margin = Math.max(span * 0.1, viewBoxSpan * 0.012)

        return Number.isFinite(margin) && margin > 0 ? margin : 1
    }

    /**
     * Expands raw SVG bounds into marker bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} bounds Raw SVG bounds.
     * @param {number} margin Marker margin.
     * @returns {{ x: number, y: number, width: number, height: number, rx: number }}
     */
    static #expandMarkerBounds(bounds, margin) {
        const width = Math.max(0, bounds.maxX - bounds.minX + margin * 2)
        const height = Math.max(0, bounds.maxY - bounds.minY + margin * 2)

        return {
            x: bounds.minX - margin,
            y: bounds.minY - margin,
            width,
            height,
            rx: Math.min(16, width / 8, height / 8)
        }
    }

    /**
     * Merges two raw SVG bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} candidate Candidate bounds.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #includeBounds(bounds, candidate) {
        if (!candidate) return bounds
        const withMin = PcbRenderedFootprintBoundsResolver.#includePoint(
            bounds,
            candidate.minX,
            candidate.minY
        )

        return PcbRenderedFootprintBoundsResolver.#includePoint(
            withMin,
            candidate.maxX,
            candidate.maxY
        )
    }

    /**
     * Includes one point in raw SVG bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number } | null} bounds Current bounds.
     * @param {number} x Point x.
     * @param {number} y Point y.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #includePoint(bounds, x, y) {
        if (!bounds) return { minX: x, minY: y, maxX: x, maxY: y }

        return {
            minX: Math.min(bounds.minX, x),
            minY: Math.min(bounds.minY, y),
            maxX: Math.max(bounds.maxX, x),
            maxY: Math.max(bounds.maxY, y)
        }
    }

    /**
     * Resolves a numeric SVG attribute.
     * @param {string} markup SVG start tag markup.
     * @param {string} name Attribute name.
     * @returns {number | null}
     */
    static #svgAttributeNumber(markup, name) {
        return PcbRenderedFootprintBoundsResolver.#finiteNumber(
            PcbRenderedFootprintBoundsResolver.#svgAttribute(markup, name)
        )
    }

    /**
     * Resolves one SVG attribute value.
     * @param {string} markup SVG start tag markup.
     * @param {string} name Attribute name.
     * @returns {string}
     */
    static #svgAttribute(markup, name) {
        const match = String(markup).match(
            new RegExp(
                '\\b' +
                    PcbRenderedFootprintBoundsResolver.#escapeRegExp(name) +
                    '="([^"]*)"'
            )
        )

        return String(match?.[1] || '')
    }

    /**
     * Resolves a finite number or null.
     * @param {unknown} value Raw value.
     * @returns {number | null}
     */
    static #finiteNumber(value) {
        const number = Number(value)

        return Number.isFinite(number) ? number : null
    }

    /**
     * Escapes text for use inside a regular expression.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static #escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    }

    /**
     * Escapes markup text.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
