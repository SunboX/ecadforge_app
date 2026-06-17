/**
 * Snaps near-matching KiCad Edge.Cuts endpoints for the SVG renderer.
 */
export class KicadPcbRenderOutlineAdapter {
    static #POINT_MATCH_TOLERANCE_MM = 0.35

    /**
     * Returns a KiCad document model with renderer-connectable outlines.
     * @param {object} documentModel KiCad document model.
     * @returns {object}
     */
    static apply(documentModel) {
        const kicadBoard = documentModel?.pcb?.kicadBoard
        const outlines = KicadPcbRenderOutlineAdapter.#connectOutlines(
            kicadBoard?.outlines
        )
        if (!outlines.length) {
            return documentModel
        }

        return {
            ...documentModel,
            pcb: {
                ...documentModel.pcb,
                kicadBoard: {
                    ...kicadBoard,
                    outlines
                }
            }
        }
    }

    /**
     * Builds one connected outline chain from native KiCad outline primitives.
     * @param {object[]} outlines Native KiCad outline primitives.
     * @returns {object[]}
     */
    static #connectOutlines(outlines) {
        const segments = (Array.isArray(outlines) ? outlines : [])
            .map((outline) =>
                KicadPcbRenderOutlineAdapter.#normalizeOutline(outline)
            )
            .filter(Boolean)
        if (!segments.length) {
            return []
        }

        const [first, ...rest] = segments
        const chain = [first]
        const unused = [...rest]

        while (unused.length) {
            const next = KicadPcbRenderOutlineAdapter.#takeNextSegment(
                unused,
                chain.at(-1).end
            )
            if (!next) {
                return []
            }

            chain.push({
                ...next,
                start: KicadPcbRenderOutlineAdapter.#copyPoint(chain.at(-1).end)
            })
        }

        if (
            !KicadPcbRenderOutlineAdapter.#samePoint(
                chain[0].start,
                chain.at(-1).end
            )
        ) {
            return []
        }

        chain[chain.length - 1] = {
            ...chain.at(-1),
            end: KicadPcbRenderOutlineAdapter.#copyPoint(chain[0].start)
        }

        return chain
    }

    /**
     * Normalizes one outline primitive into line or arc form.
     * @param {object} outline Native outline primitive.
     * @returns {object | null}
     */
    static #normalizeOutline(outline) {
        if (outline?.type === 'line') {
            const start = KicadPcbRenderOutlineAdapter.#point(outline.start)
            const end = KicadPcbRenderOutlineAdapter.#point(outline.end)
            return start && end
                ? {
                      ...outline,
                      start,
                      end
                  }
                : null
        }

        if (outline?.type === 'arc') {
            const start = KicadPcbRenderOutlineAdapter.#point(outline.start)
            const mid = KicadPcbRenderOutlineAdapter.#point(outline.mid)
            const end = KicadPcbRenderOutlineAdapter.#point(outline.end)
            return start && mid && end
                ? {
                      ...outline,
                      start,
                      mid,
                      end
                  }
                : null
        }

        return null
    }

    /**
     * Finds and removes the next segment connected to a chain endpoint.
     * @param {object[]} unused Remaining candidate segments.
     * @param {{ x: number, y: number }} end Current chain endpoint.
     * @returns {object | null}
     */
    static #takeNextSegment(unused, end) {
        const index = unused.findIndex((segment) => {
            return (
                KicadPcbRenderOutlineAdapter.#samePoint(segment.start, end) ||
                KicadPcbRenderOutlineAdapter.#samePoint(segment.end, end)
            )
        })
        if (index < 0) {
            return null
        }

        const [segment] = unused.splice(index, 1)
        return KicadPcbRenderOutlineAdapter.#samePoint(segment.start, end)
            ? segment
            : KicadPcbRenderOutlineAdapter.#reverseSegment(segment)
    }

    /**
     * Reverses one line or arc segment.
     * @param {object} segment Segment to reverse.
     * @returns {object}
     */
    static #reverseSegment(segment) {
        return {
            ...segment,
            start: KicadPcbRenderOutlineAdapter.#copyPoint(segment.end),
            end: KicadPcbRenderOutlineAdapter.#copyPoint(segment.start)
        }
    }

    /**
     * Resolves a finite point.
     * @param {object} point Candidate point.
     * @returns {{ x: number, y: number } | null}
     */
    static #point(point) {
        const x = Number(point?.x)
        const y = Number(point?.y)
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null
    }

    /**
     * Copies a point value.
     * @param {{ x: number, y: number }} point Point to copy.
     * @returns {{ x: number, y: number }}
     */
    static #copyPoint(point) {
        return {
            x: Number(point?.x || 0),
            y: Number(point?.y || 0)
        }
    }

    /**
     * Checks whether two points are close enough to connect.
     * @param {{ x: number, y: number }} left First point.
     * @param {{ x: number, y: number }} right Second point.
     * @returns {boolean}
     */
    static #samePoint(left, right) {
        return (
            KicadPcbRenderOutlineAdapter.#distance(left, right) <=
            KicadPcbRenderOutlineAdapter.#POINT_MATCH_TOLERANCE_MM
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
