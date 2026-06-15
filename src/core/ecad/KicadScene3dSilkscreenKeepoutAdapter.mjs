const CIRCLE_SEGMENTS = 32
const ROUNDED_RECT_CORNER_SEGMENTS = 16
const RENDER_PAD_SHAPE_RECTANGULAR = 2
const GEOMETRY_EPSILON = 0.001

/**
 * Rebuilds KiCad silkscreen copper keepouts after pad shape normalization.
 */
export class KicadScene3dSilkscreenKeepoutAdapter {
    /**
     * Returns silkscreen detail with copper keepouts rebuilt from adapted pads.
     * @param {object | undefined} silkscreen Silkscreen detail.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {object[] | undefined} vias Scene via detail.
     * @returns {object | undefined}
     */
    static apply(silkscreen, pads, vias) {
        if (!silkscreen || typeof silkscreen !== 'object') {
            return silkscreen
        }

        return {
            ...silkscreen,
            top: KicadScene3dSilkscreenKeepoutAdapter.#rebuildSide(
                silkscreen.top,
                pads,
                vias,
                'top'
            ),
            bottom: KicadScene3dSilkscreenKeepoutAdapter.#rebuildSide(
                silkscreen.bottom,
                pads,
                vias,
                'bottom'
            )
        }
    }

    /**
     * Rebuilds copper keepouts while preserving authored fill holes.
     * @param {object | undefined} side Side-specific silkscreen detail.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {object[] | undefined} vias Scene via detail.
     * @param {'top' | 'bottom'} sideName Side name.
     * @returns {object | undefined}
     */
    static #rebuildSide(side, pads, vias, sideName) {
        if (!side || typeof side !== 'object') {
            return side
        }

        const oldGeneratedCutouts =
            KicadScene3dSilkscreenKeepoutAdapter.#contourCutouts(
                []
                    .concat(side.drillCutouts || [])
                    .concat(side.copperCutouts || [])
            )
        const drillCutouts =
            KicadScene3dSilkscreenKeepoutAdapter.#contourCutouts(
                side.drillCutouts
            )
        const copperCutouts =
            KicadScene3dSilkscreenKeepoutAdapter.#buildSideCutouts(
                pads,
                vias,
                sideName
            )
        const fills = KicadScene3dSilkscreenKeepoutAdapter.#stripGeneratedHoles(
            side.fills,
            oldGeneratedCutouts
        )

        return {
            ...side,
            copperCutouts: copperCutouts.map((cutout) => cutout.points),
            fills
        }
    }

    /**
     * Builds copper keepouts for pads and vias on one silkscreen side.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {object[] | undefined} vias Scene via detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static #buildSideCutouts(pads, vias, side) {
        return [
            ...KicadScene3dSilkscreenKeepoutAdapter.#buildPadCutouts(
                pads,
                side
            ),
            ...KicadScene3dSilkscreenKeepoutAdapter.#buildViaCutouts(vias)
        ]
    }

    /**
     * Builds pad copper keepouts for one side.
     * @param {object[] | undefined} pads Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static #buildPadCutouts(pads, side) {
        return (Array.isArray(pads) ? pads : [])
            .map((pad) =>
                KicadScene3dSilkscreenKeepoutAdapter.#buildPadCutout(pad, side)
            )
            .filter(Boolean)
    }

    /**
     * Builds one pad copper keepout.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {{ x: number, y: number, bounds: object, points: object[] } | null}
     */
    static #buildPadCutout(pad, side) {
        if (
            !KicadScene3dSilkscreenKeepoutAdapter.#hasVisiblePadSurface(
                pad,
                side
            )
        ) {
            return null
        }

        const spec =
            KicadScene3dSilkscreenKeepoutAdapter.#resolvePadSurfaceSpec(
                pad,
                side
            )
        const center = {
            x: Number(pad?.x || 0) + spec.offsetX,
            y: Number(pad?.y || 0) + spec.offsetY
        }
        const points = KicadScene3dSilkscreenKeepoutAdapter.#transformPoints(
            KicadScene3dSilkscreenKeepoutAdapter.#buildPadLocalPoints(spec),
            center,
            Number(pad?.rotation || 0)
        )

        return KicadScene3dSilkscreenKeepoutAdapter.#buildCutout(center, points)
    }

    /**
     * Resolves the visible pad surface shape.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {{ width: number, height: number, shape: number, cornerRadius: number, offsetX: number, offsetY: number }}
     */
    static #resolvePadSurfaceSpec(pad, side) {
        const size =
            KicadScene3dSilkscreenKeepoutAdapter.#resolvePadSurfaceSize(
                pad,
                side
            )
        const shape = KicadScene3dSilkscreenKeepoutAdapter.#resolvePadShape(
            pad,
            side
        )

        return {
            ...size,
            shape,
            cornerRadius:
                KicadScene3dSilkscreenKeepoutAdapter.#resolveCornerRadius(
                    pad,
                    size,
                    side
                ),
            ...KicadScene3dSilkscreenKeepoutAdapter.#resolvePadOffset(pad, side)
        }
    }

    /**
     * Resolves visible pad dimensions.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {{ width: number, height: number }}
     */
    static #resolvePadSurfaceSize(pad, side) {
        const preferredWidth =
            side === 'bottom'
                ? Number(pad?.sizeBottomX || 0)
                : Number(pad?.sizeTopX || 0)
        const preferredHeight =
            side === 'bottom'
                ? Number(pad?.sizeBottomY || 0)
                : Number(pad?.sizeTopY || 0)
        const width =
            Number(
                preferredWidth ||
                    pad?.sizeMidX ||
                    (side === 'bottom' ? pad?.sizeTopX : pad?.sizeBottomX) ||
                    0
            ) || 0
        const height =
            Number(
                preferredHeight ||
                    pad?.sizeMidY ||
                    (side === 'bottom' ? pad?.sizeTopY : pad?.sizeBottomY) ||
                    0
            ) || 0
        const holeDiameter = Number(pad?.holeDiameter || 0)

        return {
            width: width > 0 ? Math.max(width, holeDiameter, 0) : 0,
            height: height > 0 ? Math.max(height, holeDiameter, 0) : 0
        }
    }

    /**
     * Resolves the effective renderer pad shape for one side.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {number}
     */
    static #resolvePadShape(pad, side) {
        if (side === 'bottom') {
            if (
                pad?.hasRoundedRect &&
                Number.isInteger(pad?.roundedRectShapeBottom)
            ) {
                return Number(pad.roundedRectShapeBottom)
            }

            return KicadScene3dSilkscreenKeepoutAdapter.#firstFiniteValue(pad, [
                'shapeBottom',
                'shapeMid',
                'shapeTop'
            ])
        }

        if (pad?.hasRoundedRect && Number.isInteger(pad?.roundedRectShapeTop)) {
            return Number(pad.roundedRectShapeTop)
        }

        return KicadScene3dSilkscreenKeepoutAdapter.#firstFiniteValue(pad, [
            'shapeTop',
            'shapeMid',
            'shapeBottom'
        ])
    }

    /**
     * Resolves the visible rounded-rectangle corner radius in mils.
     * @param {object} pad Scene pad detail.
     * @param {{ width: number, height: number }} size Surface size.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {number}
     */
    static #resolveCornerRadius(pad, size, side) {
        const rawCornerRadius =
            side === 'bottom'
                ? Number(pad?.cornerRadiusBottom)
                : Number(pad?.cornerRadiusTop)
        if (
            pad?.hasRoundedRect &&
            Number.isFinite(rawCornerRadius) &&
            rawCornerRadius > 0
        ) {
            return Math.min(size.width, size.height) * (rawCornerRadius / 100)
        }

        return 0
    }

    /**
     * Resolves side-specific local pad offsets.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {{ offsetX: number, offsetY: number }}
     */
    static #resolvePadOffset(pad, side) {
        if (side === 'bottom') {
            return {
                offsetX: Number(pad?.offsetBottomX ?? pad?.offsetTopX ?? 0),
                offsetY: Number(pad?.offsetBottomY ?? pad?.offsetTopY ?? 0)
            }
        }

        return {
            offsetX: Number(pad?.offsetTopX ?? pad?.offsetBottomX ?? 0),
            offsetY: Number(pad?.offsetTopY ?? pad?.offsetBottomY ?? 0)
        }
    }

    /**
     * Builds local pad outline points.
     * @param {{ width: number, height: number, shape: number, cornerRadius: number }} spec
     * Pad surface spec.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildPadLocalPoints(spec) {
        if (
            spec.shape !== RENDER_PAD_SHAPE_RECTANGULAR &&
            Math.abs(Number(spec.width) - Number(spec.height)) <
                GEOMETRY_EPSILON
        ) {
            return KicadScene3dSilkscreenKeepoutAdapter.#buildCirclePoints(
                { x: 0, y: 0 },
                Math.max(Number(spec.width || 0), Number(spec.height || 0)) / 2
            )
        }

        if (Number(spec.cornerRadius || 0) > 0) {
            return KicadScene3dSilkscreenKeepoutAdapter.#buildRoundedRectPoints(
                spec.width,
                spec.height,
                spec.cornerRadius
            )
        }

        return KicadScene3dSilkscreenKeepoutAdapter.#buildRectanglePoints(
            spec.width,
            spec.height
        )
    }

    /**
     * Builds via copper keepouts.
     * @param {object[] | undefined} vias Scene via detail.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static #buildViaCutouts(vias) {
        return (Array.isArray(vias) ? vias : [])
            .map((via) => {
                const diameter = Number(
                    via?.diameter || via?.outerDiameter || 0
                )
                const center = {
                    x: Number(via?.x || 0),
                    y: Number(via?.y || 0)
                }

                return KicadScene3dSilkscreenKeepoutAdapter.#buildCutout(
                    center,
                    KicadScene3dSilkscreenKeepoutAdapter.#buildCirclePoints(
                        center,
                        diameter / 2
                    )
                )
            })
            .filter(Boolean)
    }

    /**
     * Builds an axis-aligned rectangle around the origin.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildRectanglePoints(width, height) {
        const halfWidth = Math.max(Number(width || 0), 0) / 2
        const halfHeight = Math.max(Number(height || 0), 0) / 2

        return [
            { x: -halfWidth, y: -halfHeight },
            { x: halfWidth, y: -halfHeight },
            { x: halfWidth, y: halfHeight },
            { x: -halfWidth, y: halfHeight }
        ]
    }

    /**
     * Builds a rounded rectangle around the origin.
     * @param {number} width Rectangle width.
     * @param {number} height Rectangle height.
     * @param {number} radius Corner radius.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildRoundedRectPoints(width, height, radius) {
        const halfWidth = Math.max(Number(width || 0), 0) / 2
        const halfHeight = Math.max(Number(height || 0), 0) / 2
        const safeRadius = Math.min(
            Math.max(Number(radius || 0), 0),
            halfWidth,
            halfHeight
        )
        if (safeRadius <= GEOMETRY_EPSILON) {
            return KicadScene3dSilkscreenKeepoutAdapter.#buildRectanglePoints(
                width,
                height
            )
        }

        return [
            ...KicadScene3dSilkscreenKeepoutAdapter.#buildCornerPoints(
                halfWidth - safeRadius,
                -halfHeight + safeRadius,
                safeRadius,
                -90,
                0
            ),
            ...KicadScene3dSilkscreenKeepoutAdapter.#buildCornerPoints(
                halfWidth - safeRadius,
                halfHeight - safeRadius,
                safeRadius,
                0,
                90
            ),
            ...KicadScene3dSilkscreenKeepoutAdapter.#buildCornerPoints(
                -halfWidth + safeRadius,
                halfHeight - safeRadius,
                safeRadius,
                90,
                180
            ),
            ...KicadScene3dSilkscreenKeepoutAdapter.#buildCornerPoints(
                -halfWidth + safeRadius,
                -halfHeight + safeRadius,
                safeRadius,
                180,
                270
            )
        ]
    }

    /**
     * Builds one rounded rectangle corner arc.
     * @param {number} cx Corner center X.
     * @param {number} cy Corner center Y.
     * @param {number} radius Corner radius.
     * @param {number} startAngle Start angle in degrees.
     * @param {number} endAngle End angle in degrees.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildCornerPoints(cx, cy, radius, startAngle, endAngle) {
        return Array.from(
            { length: ROUNDED_RECT_CORNER_SEGMENTS + 1 },
            (_, index) => {
                const fraction = index / ROUNDED_RECT_CORNER_SEGMENTS
                const angle =
                    ((startAngle + (endAngle - startAngle) * fraction) *
                        Math.PI) /
                    180

                return {
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius
                }
            }
        )
    }

    /**
     * Builds circular outline points.
     * @param {{ x: number, y: number }} center Center point.
     * @param {number} radius Circle radius.
     * @returns {{ x: number, y: number }[]}
     */
    static #buildCirclePoints(center, radius) {
        const safeRadius = Math.max(Number(radius || 0), 0)
        if (safeRadius <= GEOMETRY_EPSILON) {
            return []
        }

        return Array.from({ length: CIRCLE_SEGMENTS }, (_, index) => {
            const angle = (Math.PI * 2 * index) / CIRCLE_SEGMENTS

            return {
                x: Number(center?.x || 0) + Math.cos(angle) * safeRadius,
                y: Number(center?.y || 0) + Math.sin(angle) * safeRadius
            }
        })
    }

    /**
     * Rotates local points and translates them to board space.
     * @param {{ x: number, y: number }[]} points Local points.
     * @param {{ x: number, y: number }} center Board-space center.
     * @param {number} rotationDeg Rotation angle.
     * @returns {{ x: number, y: number }[]}
     */
    static #transformPoints(points, center, rotationDeg) {
        const angle = (Number(rotationDeg || 0) * Math.PI) / 180
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)

        return points.map((point) => ({
            x: Number(center.x || 0) + point.x * cos - point.y * sin,
            y: Number(center.y || 0) + point.x * sin + point.y * cos
        }))
    }

    /**
     * Wraps contour points as a bounded cutout.
     * @param {{ x: number, y: number }} center Cutout center.
     * @param {{ x: number, y: number }[]} points Cutout contour.
     * @returns {{ x: number, y: number, bounds: object, points: object[] } | null}
     */
    static #buildCutout(center, points) {
        const finitePoints = (Array.isArray(points) ? points : []).filter(
            (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
        )
        if (finitePoints.length < 3) {
            return null
        }

        return {
            x: Number(center.x || 0),
            y: Number(center.y || 0),
            points: finitePoints,
            bounds: KicadScene3dSilkscreenKeepoutAdapter.#resolvePointBounds(
                finitePoints
            )
        }
    }

    /**
     * Converts existing contour arrays into bounded cutouts.
     * @param {{ x?: number, y?: number }[][] | undefined} contours Contours.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static #contourCutouts(contours) {
        return (Array.isArray(contours) ? contours : [])
            .map((contour) => {
                const points =
                    KicadScene3dSilkscreenKeepoutAdapter.#finitePoints(contour)
                if (points.length < 3) {
                    return null
                }

                const center =
                    KicadScene3dSilkscreenKeepoutAdapter.#centroid(points)

                return KicadScene3dSilkscreenKeepoutAdapter.#buildCutout(
                    center,
                    points
                )
            })
            .filter(Boolean)
    }

    /**
     * Removes holes copied from old generated cutouts before reclipping fills.
     * @param {object[] | undefined} fills Silkscreen fills.
     * @param {{ points: object[] }[]} generatedCutouts Old generated cutouts.
     * @returns {object[] | undefined}
     */
    static #stripGeneratedHoles(fills, generatedCutouts) {
        if (!Array.isArray(fills)) {
            return fills
        }

        const generatedSignatures = new Set(
            generatedCutouts.map((cutout) =>
                KicadScene3dSilkscreenKeepoutAdapter.#contourSignature(
                    cutout.points
                )
            )
        )

        return fills.map((fill) => {
            if (!Array.isArray(fill?.holes)) {
                return fill
            }

            const holes = fill.holes.filter((hole) => {
                return !generatedSignatures.has(
                    KicadScene3dSilkscreenKeepoutAdapter.#contourSignature(hole)
                )
            })
            const output = { ...fill }
            if (holes.length) {
                output.holes = holes
            } else {
                delete output.holes
            }

            return output
        })
    }

    /**
     * Returns true when one pad has a visible copper face.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {boolean}
     */
    static #hasVisiblePadSurface(pad, side) {
        const maskOpening =
            KicadScene3dSilkscreenKeepoutAdapter.#resolveSolderMaskOpening(
                pad,
                side
            )
        if (maskOpening === false) {
            return false
        }

        const preferredSideHasSize =
            KicadScene3dSilkscreenKeepoutAdapter.#hasSideSize(pad, side)
        if (preferredSideHasSize) {
            return true
        }

        const alternateSideHasSize =
            KicadScene3dSilkscreenKeepoutAdapter.#hasSideSize(
                pad,
                side === 'bottom' ? 'top' : 'bottom'
            )
        const midHasSize =
            Number(pad?.sizeMidX || 0) > 0 || Number(pad?.sizeMidY || 0) > 0

        return !alternateSideHasSize && midHasSize
    }

    /**
     * Resolves an explicit side-specific solder-mask opening.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {boolean | null}
     */
    static #resolveSolderMaskOpening(pad, side) {
        const fieldName =
            side === 'bottom'
                ? 'hasBottomSolderMaskOpening'
                : 'hasTopSolderMaskOpening'

        return typeof pad?.[fieldName] === 'boolean' ? pad[fieldName] : null
    }

    /**
     * Checks whether one pad side has explicit copper dimensions.
     * @param {object} pad Scene pad detail.
     * @param {'top' | 'bottom'} side Side name.
     * @returns {boolean}
     */
    static #hasSideSize(pad, side) {
        if (side === 'bottom') {
            return (
                Number(pad?.sizeBottomX || 0) > 0 ||
                Number(pad?.sizeBottomY || 0) > 0
            )
        }

        return Number(pad?.sizeTopX || 0) > 0 || Number(pad?.sizeTopY || 0) > 0
    }

    /**
     * Resolves the first finite owned numeric value.
     * @param {object} value Source object.
     * @param {string[]} fields Candidate field names.
     * @returns {number}
     */
    static #firstFiniteValue(value, fields) {
        for (const field of fields) {
            if (!KicadScene3dSilkscreenKeepoutAdapter.#hasOwn(value, field)) {
                continue
            }

            const number = Number(value?.[field])
            if (Number.isFinite(number)) {
                return number
            }
        }

        return 0
    }

    /**
     * Keeps only finite points from a contour.
     * @param {object[] | undefined} points Source points.
     * @returns {{ x: number, y: number }[]}
     */
    static #finitePoints(points) {
        return (Array.isArray(points) ? points : [])
            .map((point) => ({
                x: Number(point?.x),
                y: Number(point?.y)
            }))
            .filter(
                (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
            )
    }

    /**
     * Resolves contour centroid.
     * @param {{ x: number, y: number }[]} points Contour points.
     * @returns {{ x: number, y: number }}
     */
    static #centroid(points) {
        const sum = points.reduce(
            (accumulator, point) => ({
                x: accumulator.x + point.x,
                y: accumulator.y + point.y
            }),
            { x: 0, y: 0 }
        )

        return {
            x: sum.x / points.length,
            y: sum.y / points.length
        }
    }

    /**
     * Resolves bounds for a point list.
     * @param {{ x: number, y: number }[]} points Points.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #resolvePointBounds(points) {
        const xs = points.map((point) => point.x)
        const ys = points.map((point) => point.y)

        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys)
        }
    }

    /**
     * Builds a stable contour signature from its bounds and point count.
     * @param {object[] | undefined} contour Contour points.
     * @returns {string}
     */
    static #contourSignature(contour) {
        const points =
            KicadScene3dSilkscreenKeepoutAdapter.#finitePoints(contour)
        if (!points.length) {
            return 'empty'
        }

        const bounds =
            KicadScene3dSilkscreenKeepoutAdapter.#resolvePointBounds(points)

        return [
            points.length,
            bounds.minX,
            bounds.minY,
            bounds.maxX,
            bounds.maxY
        ]
            .map((value) => Number(value || 0).toFixed(3))
            .join(':')
    }

    /**
     * Checks whether an object owns a field.
     * @param {object | undefined} value Source object.
     * @param {string} field Field name.
     * @returns {boolean}
     */
    static #hasOwn(value, field) {
        return Object.prototype.hasOwnProperty.call(value || {}, field)
    }
}
