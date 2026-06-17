const MILS_PER_MILLIMETER = 1000 / 25.4

/**
 * Rebuilds KiCad 3D board outlines from native Edge.Cuts primitives.
 */
export class KicadScene3dBoardOutlineAdapter {
    static #POINT_MATCH_TOLERANCE_MM = 0.35
    static #ARC_DETERMINANT_EPSILON = 1e-9

    /**
     * Returns a document model whose 3D outline follows native KiCad edges.
     * @param {object} documentModel KiCad document model.
     * @returns {object}
     */
    static apply(documentModel) {
        const boardOutline =
            KicadScene3dBoardOutlineAdapter.#buildBoardOutline(documentModel)

        if (!boardOutline) {
            return documentModel
        }

        return {
            ...documentModel,
            pcb: {
                ...documentModel.pcb,
                boardOutline
            }
        }
    }

    /**
     * Builds a normalized board outline from native KiCad outline primitives.
     * @param {object} documentModel KiCad document model.
     * @returns {object | null}
     */
    static #buildBoardOutline(documentModel) {
        const kicadBoard = documentModel?.pcb?.kicadBoard
        const segments = KicadScene3dBoardOutlineAdapter.#connectSegments(
            KicadScene3dBoardOutlineAdapter.#normalizeSegments(
                kicadBoard?.outlines
            )
        )
        if (!segments.length) {
            return null
        }

        const bounds = KicadScene3dBoardOutlineAdapter.#resolveBounds(
            kicadBoard?.bounds,
            segments
        )
        if (!bounds) {
            return null
        }

        return {
            widthMil: KicadScene3dBoardOutlineAdapter.#toMil(bounds.width),
            heightMil: KicadScene3dBoardOutlineAdapter.#toMil(bounds.height),
            minX: KicadScene3dBoardOutlineAdapter.#toMil(bounds.minX),
            minY: KicadScene3dBoardOutlineAdapter.#toMil(bounds.minY),
            segments: segments.map((segment) =>
                KicadScene3dBoardOutlineAdapter.#toMilSegment(segment)
            )
        }
    }

    /**
     * Normalizes native outline primitives into start/end segments.
     * @param {object[]} outlines Native KiCad outline primitives.
     * @returns {object[]}
     */
    static #normalizeSegments(outlines) {
        return (Array.isArray(outlines) ? outlines : [])
            .map((outline) =>
                KicadScene3dBoardOutlineAdapter.#normalizeSegment(outline)
            )
            .filter(Boolean)
    }

    /**
     * Normalizes one native outline primitive.
     * @param {object} outline Native outline primitive.
     * @returns {object | null}
     */
    static #normalizeSegment(outline) {
        if (outline?.type === 'line') {
            const start = KicadScene3dBoardOutlineAdapter.#point(outline.start)
            const end = KicadScene3dBoardOutlineAdapter.#point(outline.end)
            return start && end ? { type: 'line', start, end } : null
        }

        if (outline?.type === 'arc') {
            const start = KicadScene3dBoardOutlineAdapter.#point(outline.start)
            const mid = KicadScene3dBoardOutlineAdapter.#point(outline.mid)
            const end = KicadScene3dBoardOutlineAdapter.#point(outline.end)
            if (!start || !mid || !end) {
                return null
            }

            const center = KicadScene3dBoardOutlineAdapter.#arcCenter(
                start,
                mid,
                end
            )
            if (!center) {
                return { type: 'line', start, end }
            }

            return {
                type: 'arc',
                start,
                mid,
                end,
                center,
                radius: KicadScene3dBoardOutlineAdapter.#distance(center, start)
            }
        }

        return null
    }

    /**
     * Orders unordered outline segments into one connected chain.
     * @param {object[]} segments Normalized outline segments.
     * @returns {object[]}
     */
    static #connectSegments(segments) {
        if (!segments.length) {
            return []
        }

        const [first, ...rest] = segments
        const chain = [first]
        const unused = [...rest]

        while (unused.length) {
            const next = KicadScene3dBoardOutlineAdapter.#takeNextSegment(
                unused,
                chain[chain.length - 1].end
            )
            if (!next) {
                return []
            }
            chain.push(next)
        }

        if (
            !KicadScene3dBoardOutlineAdapter.#samePoint(
                chain[0].start,
                chain[chain.length - 1].end
            )
        ) {
            return []
        }

        return chain
    }

    /**
     * Finds and removes the next segment connected to a chain end point.
     * @param {object[]} unused Remaining candidate segments.
     * @param {{ x: number, y: number }} end Current chain end.
     * @returns {object | null}
     */
    static #takeNextSegment(unused, end) {
        const index = unused.findIndex(
            (segment) =>
                KicadScene3dBoardOutlineAdapter.#samePoint(
                    segment.start,
                    end
                ) ||
                KicadScene3dBoardOutlineAdapter.#samePoint(segment.end, end)
        )
        if (index < 0) {
            return null
        }

        const [segment] = unused.splice(index, 1)
        return KicadScene3dBoardOutlineAdapter.#samePoint(segment.start, end)
            ? segment
            : KicadScene3dBoardOutlineAdapter.#reverseSegment(segment)
    }

    /**
     * Reverses a line or arc segment.
     * @param {object} segment Segment to reverse.
     * @returns {object}
     */
    static #reverseSegment(segment) {
        return {
            ...segment,
            start: segment.end,
            end: segment.start
        }
    }

    /**
     * Resolves a finite point object.
     * @param {object} point Candidate point.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(point) {
        const x = Number(point?.x)
        const y = Number(point?.y)
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Resolves a circle center from three arc points.
     * @param {{ x: number, y: number }} start Arc start.
     * @param {{ x: number, y: number }} mid Arc midpoint.
     * @param {{ x: number, y: number }} end Arc end.
     * @returns {{ x: number, y: number } | null}
     */
    static #arcCenter(start, mid, end) {
        const determinant =
            2 *
            (start.x * (mid.y - end.y) +
                mid.x * (end.y - start.y) +
                end.x * (start.y - mid.y))
        if (
            Math.abs(determinant) <=
            KicadScene3dBoardOutlineAdapter.#ARC_DETERMINANT_EPSILON
        ) {
            return null
        }

        const startSquare = start.x * start.x + start.y * start.y
        const midSquare = mid.x * mid.x + mid.y * mid.y
        const endSquare = end.x * end.x + end.y * end.y

        return {
            x:
                (startSquare * (mid.y - end.y) +
                    midSquare * (end.y - start.y) +
                    endSquare * (start.y - mid.y)) /
                determinant,
            y:
                (startSquare * (end.x - mid.x) +
                    midSquare * (start.x - end.x) +
                    endSquare * (mid.x - start.x)) /
                determinant
        }
    }

    /**
     * Resolves outline bounds from KiCad bounds or segment points.
     * @param {object} bounds Native board bounds.
     * @param {object[]} segments Connected segments.
     * @returns {{ minX: number, minY: number, width: number, height: number } | null}
     */
    static #resolveBounds(bounds, segments) {
        const minX = Number(bounds?.minX)
        const minY = Number(bounds?.minY)
        const width = Number(bounds?.width)
        const height = Number(bounds?.height)
        if (
            Number.isFinite(minX) &&
            Number.isFinite(minY) &&
            Number.isFinite(width) &&
            Number.isFinite(height) &&
            width > 0 &&
            height > 0
        ) {
            return { minX, minY, width, height }
        }

        return KicadScene3dBoardOutlineAdapter.#boundsFromSegments(segments)
    }

    /**
     * Computes bounds from segment points.
     * @param {object[]} segments Connected segments.
     * @returns {{ minX: number, minY: number, width: number, height: number } | null}
     */
    static #boundsFromSegments(segments) {
        const points = segments.flatMap((segment) =>
            [segment.start, segment.mid, segment.end].filter(Boolean)
        )
        if (!points.length) {
            return null
        }

        const bounds = points.reduce(
            (current, point) => ({
                minX: Math.min(current.minX, point.x),
                minY: Math.min(current.minY, point.y),
                maxX: Math.max(current.maxX, point.x),
                maxY: Math.max(current.maxY, point.y)
            }),
            {
                minX: Infinity,
                minY: Infinity,
                maxX: -Infinity,
                maxY: -Infinity
            }
        )

        return {
            minX: bounds.minX,
            minY: bounds.minY,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY
        }
    }

    /**
     * Converts one segment from millimeters to mils.
     * @param {object} segment Segment in millimeters.
     * @returns {object}
     */
    static #toMilSegment(segment) {
        const converted = {
            type: segment.type,
            x1: KicadScene3dBoardOutlineAdapter.#toMil(segment.start.x),
            y1: KicadScene3dBoardOutlineAdapter.#toMil(segment.start.y),
            x2: KicadScene3dBoardOutlineAdapter.#toMil(segment.end.x),
            y2: KicadScene3dBoardOutlineAdapter.#toMil(segment.end.y)
        }

        if (segment.type === 'arc') {
            converted.cx = KicadScene3dBoardOutlineAdapter.#toMil(
                segment.center.x
            )
            converted.cy = KicadScene3dBoardOutlineAdapter.#toMil(
                segment.center.y
            )
            converted.radius = KicadScene3dBoardOutlineAdapter.#toMil(
                segment.radius
            )
        }

        return converted
    }

    /**
     * Converts millimeters to mils.
     * @param {number} value Millimeter value.
     * @returns {number}
     */
    static #toMil(value) {
        return Number(value || 0) * MILS_PER_MILLIMETER
    }

    /**
     * Checks whether two points are close enough to be connected.
     * @param {{ x: number, y: number }} left First point.
     * @param {{ x: number, y: number }} right Second point.
     * @returns {boolean}
     */
    static #samePoint(left, right) {
        return (
            KicadScene3dBoardOutlineAdapter.#distance(left, right) <=
            KicadScene3dBoardOutlineAdapter.#POINT_MATCH_TOLERANCE_MM
        )
    }

    /**
     * Measures point distance.
     * @param {{ x: number, y: number }} left First point.
     * @param {{ x: number, y: number }} right Second point.
     * @returns {number}
     */
    static #distance(left, right) {
        return Math.hypot(
            Number(right?.x || 0) - Number(left?.x || 0),
            Number(right?.y || 0) - Number(left?.y || 0)
        )
    }
}
