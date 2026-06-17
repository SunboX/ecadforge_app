/**
 * Keeps Altium 3D board bodies anchored to the parsed edge-cut outline.
 */
export class AltiumScene3dBoardOutlineAdapter {
    static #BOUND_EPSILON_MIL = 1

    /**
     * Restores the source board outline when toolkit refinement picked an
     * inset board-region contour.
     * @param {object} sceneDescription Built scene description.
     * @param {object} documentModel Source document model.
     * @returns {object}
     */
    static apply(sceneDescription, documentModel) {
        const sourceOutline = documentModel?.pcb?.boardOutline
        const sourceBounds =
            AltiumScene3dBoardOutlineAdapter.#resolveBounds(sourceOutline)
        const sceneBounds = AltiumScene3dBoardOutlineAdapter.#resolveBounds(
            sceneDescription?.board
        )

        if (
            String(sceneDescription?.sourceFormat || '').toLowerCase() !==
                'altium' ||
            !AltiumScene3dBoardOutlineAdapter.#hasSegments(sourceOutline) ||
            !sourceBounds ||
            !sceneBounds ||
            AltiumScene3dBoardOutlineAdapter.#boundsMatch(
                sourceBounds,
                sceneBounds
            )
        ) {
            return sceneDescription
        }

        return AltiumScene3dBoardOutlineAdapter.#restoreOutline(
            sceneDescription,
            sourceOutline,
            sourceBounds,
            sceneBounds
        )
    }

    /**
     * Returns true when an outline carries usable path segments.
     * @param {object | null | undefined} outline Source outline.
     * @returns {boolean}
     */
    static #hasSegments(outline) {
        return Array.isArray(outline?.segments) && outline.segments.length >= 3
    }

    /**
     * Restores the board outline and shifts local placements back to it.
     * @param {object} sceneDescription Scene description.
     * @param {object} sourceOutline Source outline.
     * @param {object} sourceBounds Source outline bounds.
     * @param {object} sceneBounds Current scene board bounds.
     * @returns {object}
     */
    static #restoreOutline(
        sceneDescription,
        sourceOutline,
        sourceBounds,
        sceneBounds
    ) {
        const deltaX = sceneBounds.centerX - sourceBounds.centerX
        const deltaY = sceneBounds.centerY - sourceBounds.centerY

        return {
            ...sceneDescription,
            board: {
                ...(sceneDescription?.board || {}),
                minX: sourceBounds.minX,
                minY: sourceBounds.minY,
                widthMil: sourceBounds.widthMil,
                heightMil: sourceBounds.heightMil,
                centerX: sourceBounds.centerX,
                centerY: sourceBounds.centerY,
                segments: sourceOutline.segments
            },
            components: AltiumScene3dBoardOutlineAdapter.#realignPlacements(
                sceneDescription?.components,
                deltaX,
                deltaY
            ),
            externalPlacements:
                AltiumScene3dBoardOutlineAdapter.#realignPlacements(
                    sceneDescription?.externalPlacements,
                    deltaX,
                    deltaY
                ),
            staticBodyPlacements:
                AltiumScene3dBoardOutlineAdapter.#realignPlacements(
                    sceneDescription?.staticBodyPlacements,
                    deltaX,
                    deltaY
                )
        }
    }

    /**
     * Shifts board-local placements by an origin delta.
     * @param {object[] | undefined} placements Scene placements.
     * @param {number} deltaX Local X delta.
     * @param {number} deltaY Local Y delta.
     * @returns {object[] | undefined}
     */
    static #realignPlacements(placements, deltaX, deltaY) {
        if (!Array.isArray(placements)) {
            return placements
        }

        if (!deltaX && !deltaY) {
            return placements
        }

        return placements.map((placement) =>
            AltiumScene3dBoardOutlineAdapter.#realignPlacement(
                placement,
                deltaX,
                deltaY
            )
        )
    }

    /**
     * Shifts one board-local placement and its optional contact-pad hints.
     * @param {object} placement Scene placement.
     * @param {number} deltaX Local X delta.
     * @param {number} deltaY Local Y delta.
     * @returns {object}
     */
    static #realignPlacement(placement, deltaX, deltaY) {
        return {
            ...placement,
            positionMil: AltiumScene3dBoardOutlineAdapter.#shiftPoint(
                placement?.positionMil,
                deltaX,
                deltaY
            ),
            modelTransform:
                AltiumScene3dBoardOutlineAdapter.#realignModelTransform(
                    placement?.modelTransform,
                    deltaX,
                    deltaY
                )
        }
    }

    /**
     * Shifts local contact-pad hints in one model transform.
     * @param {object | undefined} modelTransform Model transform metadata.
     * @param {number} deltaX Local X delta.
     * @param {number} deltaY Local Y delta.
     * @returns {object | undefined}
     */
    static #realignModelTransform(modelTransform, deltaX, deltaY) {
        if (!Array.isArray(modelTransform?.contactPadsMil)) {
            return modelTransform
        }

        return {
            ...modelTransform,
            contactPadsMil: modelTransform.contactPadsMil.map((pad) =>
                AltiumScene3dBoardOutlineAdapter.#shiftPoint(
                    pad,
                    deltaX,
                    deltaY
                )
            )
        }
    }

    /**
     * Shifts one point-like object.
     * @param {object | undefined} point Point-like object.
     * @param {number} deltaX Local X delta.
     * @param {number} deltaY Local Y delta.
     * @returns {object | undefined}
     */
    static #shiftPoint(point, deltaX, deltaY) {
        if (!point) {
            return point
        }

        return {
            ...point,
            x: Number(point.x || 0) + deltaX,
            y: Number(point.y || 0) + deltaY
        }
    }

    /**
     * Resolves finite board bounds from explicit bounds or path segments.
     * @param {object | null | undefined} outline Outline-like object.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number, centerX: number, centerY: number } | null}
     */
    static #resolveBounds(outline) {
        const explicitBounds =
            AltiumScene3dBoardOutlineAdapter.#explicitBounds(outline)

        return (
            explicitBounds ||
            AltiumScene3dBoardOutlineAdapter.#segmentBounds(outline?.segments)
        )
    }

    /**
     * Resolves explicit finite board bounds.
     * @param {object | null | undefined} outline Outline-like object.
     * @returns {object | null}
     */
    static #explicitBounds(outline) {
        const minX = Number(outline?.minX)
        const minY = Number(outline?.minY)
        const widthMil = Number(outline?.widthMil)
        const heightMil = Number(outline?.heightMil)

        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(widthMil) ||
            !Number.isFinite(heightMil) ||
            widthMil <= 0 ||
            heightMil <= 0
        ) {
            return null
        }

        return AltiumScene3dBoardOutlineAdapter.#boundsFromEdges(
            minX,
            minY,
            minX + widthMil,
            minY + heightMil
        )
    }

    /**
     * Resolves bounds from path segments.
     * @param {object[] | undefined} segments Outline segments.
     * @returns {object | null}
     */
    static #segmentBounds(segments) {
        if (!Array.isArray(segments) || !segments.length) {
            return null
        }

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY

        for (const segment of segments) {
            for (const point of [
                [segment?.x1, segment?.y1],
                [segment?.x2, segment?.y2]
            ]) {
                const x = Number(point[0])
                const y = Number(point[1])
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    continue
                }

                minX = Math.min(minX, x)
                minY = Math.min(minY, y)
                maxX = Math.max(maxX, x)
                maxY = Math.max(maxY, y)
            }
        }

        if (minX >= maxX || minY >= maxY) {
            return null
        }

        return AltiumScene3dBoardOutlineAdapter.#boundsFromEdges(
            minX,
            minY,
            maxX,
            maxY
        )
    }

    /**
     * Builds a normalized bounds object from edges.
     * @param {number} minX Minimum X.
     * @param {number} minY Minimum Y.
     * @param {number} maxX Maximum X.
     * @param {number} maxY Maximum Y.
     * @returns {object}
     */
    static #boundsFromEdges(minX, minY, maxX, maxY) {
        const widthMil = maxX - minX
        const heightMil = maxY - minY

        return {
            minX,
            minY,
            maxX,
            maxY,
            widthMil,
            heightMil,
            centerX: minX + widthMil / 2,
            centerY: minY + heightMil / 2
        }
    }

    /**
     * Returns true when two board envelopes match within import tolerance.
     * @param {object} left First bounds.
     * @param {object} right Second bounds.
     * @returns {boolean}
     */
    static #boundsMatch(left, right) {
        return ['minX', 'minY', 'maxX', 'maxY'].every((key) => {
            return (
                Math.abs(
                    Number(left?.[key] || 0) - Number(right?.[key] || 0)
                ) <= AltiumScene3dBoardOutlineAdapter.#BOUND_EPSILON_MIL
            )
        })
    }
}
