/**
 * Builds reusable drill cutout contours for 3D silkscreen scene detail.
 */
export class EcadScene3dDrillCutoutBuilder {
    static #CIRCLE_SEGMENTS = 24
    static #EPSILON = 0.001
    static #SLOT_CAP_SEGMENTS = 12

    /**
     * Adds drill cutouts and fill holes to both silkscreen sides.
     * @param {{ top?: object, bottom?: object } | undefined} silkscreen
     * @param {object[]} pads Pad detail primitives.
     * @param {object[]} vias Via detail primitives.
     * @returns {{ top: object, bottom: object }}
     */
    static augmentSilkscreen(silkscreen, pads, vias) {
        const cutouts = EcadScene3dDrillCutoutBuilder.buildCutouts(pads, vias)

        return {
            top: EcadScene3dDrillCutoutBuilder.#augmentSide(
                silkscreen?.top,
                cutouts
            ),
            bottom: EcadScene3dDrillCutoutBuilder.#augmentSide(
                silkscreen?.bottom,
                cutouts
            )
        }
    }

    /**
     * Builds all known pad and via drill contours.
     * @param {object[]} pads Pad detail primitives.
     * @param {object[]} vias Via detail primitives.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static buildCutouts(pads, vias) {
        return [
            ...EcadScene3dDrillCutoutBuilder.#buildPadCutouts(pads),
            ...EcadScene3dDrillCutoutBuilder.#buildViaCutouts(vias)
        ]
    }

    /**
     * Adds drill cutouts to one silkscreen side.
     * @param {object | undefined} side Side detail.
     * @param {{ points: object[] }[]} cutouts Drill cutouts.
     * @returns {object}
     */
    static #augmentSide(side, cutouts) {
        const existingSide = side || {}
        const drillCutouts = cutouts.map((cutout) => cutout.points)

        return {
            ...existingSide,
            fills: EcadScene3dDrillCutoutBuilder.#clipFills(
                existingSide.fills || [],
                cutouts
            ),
            tracks: [...(existingSide.tracks || [])],
            arcs: [...(existingSide.arcs || [])],
            texts: [...(existingSide.texts || [])],
            drillCutouts: EcadScene3dDrillCutoutBuilder.#mergePointLists(
                existingSide.drillCutouts,
                drillCutouts
            )
        }
    }

    /**
     * Adds drill-shaped holes to intersected silkscreen fills.
     * @param {object[]} fills Fill primitives.
     * @param {{ points: object[] }[]} cutouts Drill cutouts.
     * @returns {object[]}
     */
    static #clipFills(fills, cutouts) {
        if (!cutouts.length) {
            return [...fills]
        }

        return (Array.isArray(fills) ? fills : []).map((fill) => {
            const existingHoles =
                EcadScene3dDrillCutoutBuilder.#resolveExistingHoles(fill)
            const nextHoles = cutouts
                .filter((cutout) =>
                    EcadScene3dDrillCutoutBuilder.#cutoutTouchesFill(
                        cutout,
                        fill
                    )
                )
                .map((cutout) => cutout.points)
            const holes = EcadScene3dDrillCutoutBuilder.#mergePointLists(
                existingHoles,
                nextHoles
            )

            return holes.length === existingHoles.length
                ? fill
                : { ...fill, holes }
        })
    }

    /**
     * Builds drill contours for drilled pads.
     * @param {object[]} pads Pad detail primitives.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static #buildPadCutouts(pads) {
        return (Array.isArray(pads) ? pads : [])
            .map((pad) => {
                const diameter =
                    EcadScene3dDrillCutoutBuilder.#resolvePositiveNumber(pad, [
                        'holeDiameter',
                        'drillDiameter'
                    ])
                const slotLength =
                    EcadScene3dDrillCutoutBuilder.#resolvePositiveNumber(pad, [
                        'holeSlotLength',
                        'slotLength'
                    ])
                const rotationDeg =
                    Number(pad?.rotation || 0) + Number(pad?.holeRotation || 0)

                return EcadScene3dDrillCutoutBuilder.#buildCutout(
                    Number(pad?.x),
                    Number(pad?.y),
                    diameter,
                    slotLength,
                    rotationDeg
                )
            })
            .filter(Boolean)
    }

    /**
     * Builds circular drill contours for vias.
     * @param {object[]} vias Via detail primitives.
     * @returns {{ x: number, y: number, bounds: object, points: object[] }[]}
     */
    static #buildViaCutouts(vias) {
        return (Array.isArray(vias) ? vias : [])
            .map((via) =>
                EcadScene3dDrillCutoutBuilder.#buildCutout(
                    Number(via?.x),
                    Number(via?.y),
                    EcadScene3dDrillCutoutBuilder.#resolvePositiveNumber(via, [
                        'holeDiameter',
                        'drillDiameter'
                    ]),
                    0,
                    0
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds one drill contour from drill geometry.
     * @param {number} x Drill center X.
     * @param {number} y Drill center Y.
     * @param {number} diameter Drill diameter.
     * @param {number} slotLength Slot length.
     * @param {number} rotationDeg Slot rotation.
     * @returns {{ x: number, y: number, bounds: object, points: object[] } | null}
     */
    static #buildCutout(x, y, diameter, slotLength, rotationDeg) {
        if (
            !Number.isFinite(x) ||
            !Number.isFinite(y) ||
            !Number.isFinite(diameter) ||
            diameter <= EcadScene3dDrillCutoutBuilder.#EPSILON
        ) {
            return null
        }

        const points =
            Number.isFinite(slotLength) && slotLength > diameter
                ? EcadScene3dDrillCutoutBuilder.#buildSlotPoints(
                      x,
                      y,
                      diameter,
                      slotLength,
                      rotationDeg
                  )
                : EcadScene3dDrillCutoutBuilder.#buildCirclePoints(
                      x,
                      y,
                      diameter
                  )

        return {
            x,
            y,
            points,
            bounds: EcadScene3dDrillCutoutBuilder.#resolvePointBounds(points)
        }
    }

    /**
     * Builds a polygonal circular drill contour.
     * @param {number} x Drill center X.
     * @param {number} y Drill center Y.
     * @param {number} diameter Drill diameter.
     * @returns {object[]}
     */
    static #buildCirclePoints(x, y, diameter) {
        const radius = diameter / 2

        return Array.from(
            { length: EcadScene3dDrillCutoutBuilder.#CIRCLE_SEGMENTS },
            (_, index) => {
                const angle =
                    (Math.PI * 2 * index) /
                    EcadScene3dDrillCutoutBuilder.#CIRCLE_SEGMENTS

                return {
                    x: x + Math.cos(angle) * radius,
                    y: y + Math.sin(angle) * radius
                }
            }
        )
    }

    /**
     * Builds a polygonal slotted drill contour.
     * @param {number} x Drill center X.
     * @param {number} y Drill center Y.
     * @param {number} diameter Drill diameter.
     * @param {number} slotLength Slot length.
     * @param {number} rotationDeg Slot rotation.
     * @returns {object[]}
     */
    static #buildSlotPoints(x, y, diameter, slotLength, rotationDeg) {
        const radius = diameter / 2
        const halfStraight = Math.max((slotLength - diameter) / 2, 0)
        const rotation = (rotationDeg * Math.PI) / 180
        const points = []

        EcadScene3dDrillCutoutBuilder.#appendSlotCapPoints(
            points,
            x,
            y,
            halfStraight,
            radius,
            rotation,
            -Math.PI / 2
        )
        EcadScene3dDrillCutoutBuilder.#appendSlotCapPoints(
            points,
            x,
            y,
            -halfStraight,
            radius,
            rotation,
            Math.PI / 2
        )

        return points
    }

    /**
     * Appends sampled points for one slot cap.
     * @param {object[]} points Target point list.
     * @param {number} x Drill center X.
     * @param {number} y Drill center Y.
     * @param {number} capCenterX Local cap center X.
     * @param {number} radius Cap radius.
     * @param {number} rotation Slot rotation in radians.
     * @param {number} startAngle Cap start angle.
     * @returns {void}
     */
    static #appendSlotCapPoints(
        points,
        x,
        y,
        capCenterX,
        radius,
        rotation,
        startAngle
    ) {
        for (
            let index = 0;
            index <= EcadScene3dDrillCutoutBuilder.#SLOT_CAP_SEGMENTS;
            index += 1
        ) {
            const angle =
                startAngle +
                (Math.PI * index) /
                    EcadScene3dDrillCutoutBuilder.#SLOT_CAP_SEGMENTS
            points.push(
                EcadScene3dDrillCutoutBuilder.#rotatePoint(
                    x,
                    y,
                    capCenterX + Math.cos(angle) * radius,
                    Math.sin(angle) * radius,
                    rotation
                )
            )
        }
    }

    /**
     * Rotates one local point around a drill center.
     * @param {number} centerX Drill center X.
     * @param {number} centerY Drill center Y.
     * @param {number} localX Local X.
     * @param {number} localY Local Y.
     * @param {number} rotation Rotation in radians.
     * @returns {{ x: number, y: number }}
     */
    static #rotatePoint(centerX, centerY, localX, localY, rotation) {
        const cos = Math.cos(rotation)
        const sin = Math.sin(rotation)

        return {
            x: centerX + localX * cos - localY * sin,
            y: centerY + localX * sin + localY * cos
        }
    }

    /**
     * Returns true when a drill contour should cut one fill.
     * @param {{ x: number, y: number, bounds: object, points: object[] }} cutout
     * @param {object} fill Fill primitive.
     * @returns {boolean}
     */
    static #cutoutTouchesFill(cutout, fill) {
        const fillBounds =
            EcadScene3dDrillCutoutBuilder.#resolveFillBounds(fill)

        if (
            !fillBounds ||
            !EcadScene3dDrillCutoutBuilder.#boundsOverlap(
                cutout.bounds,
                fillBounds
            )
        ) {
            return false
        }

        const fillPoints =
            EcadScene3dDrillCutoutBuilder.#resolveFillPoints(fill)
        if (fillPoints.length < 3) {
            return true
        }

        return (
            EcadScene3dDrillCutoutBuilder.#isPointInPolygon(
                cutout,
                fillPoints
            ) ||
            cutout.points.some((point) =>
                EcadScene3dDrillCutoutBuilder.#isPointInPolygon(
                    point,
                    fillPoints
                )
            )
        )
    }

    /**
     * Merges point-list arrays without duplicate contours.
     * @param {object[][] | undefined} existing Existing point lists.
     * @param {object[][]} next Additional point lists.
     * @returns {object[][]}
     */
    static #mergePointLists(existing, next) {
        const merged = []
        const seen = new Set()

        for (const pointList of [...(existing || []), ...(next || [])]) {
            const key =
                EcadScene3dDrillCutoutBuilder.#buildPointListKey(pointList)
            if (!key || seen.has(key)) {
                continue
            }

            merged.push(pointList)
            seen.add(key)
        }

        return merged
    }

    /**
     * Builds one stable point-list dedupe key.
     * @param {object[]} points Point list.
     * @returns {string}
     */
    static #buildPointListKey(points) {
        const normalized =
            EcadScene3dDrillCutoutBuilder.#resolveFinitePoints(points)
        if (normalized.length < 3) {
            return ''
        }

        return normalized
            .map((point) => `${point.x.toFixed(4)},${point.y.toFixed(4)}`)
            .join('|')
    }

    /**
     * Resolves existing authored holes from a fill.
     * @param {object} fill Fill primitive.
     * @returns {object[][]}
     */
    static #resolveExistingHoles(fill) {
        return Array.isArray(fill?.holes)
            ? fill.holes.filter((hole) => Array.isArray(hole))
            : []
    }

    /**
     * Resolves finite polygon points from a fill.
     * @param {object} fill Fill primitive.
     * @returns {{ x: number, y: number }[]}
     */
    static #resolveFillPoints(fill) {
        return EcadScene3dDrillCutoutBuilder.#resolveFinitePoints(fill?.points)
    }

    /**
     * Resolves finite points from one point list.
     * @param {object[] | undefined} points Point list.
     * @returns {{ x: number, y: number }[]}
     */
    static #resolveFinitePoints(points) {
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
     * Resolves one fill's axis-aligned bounds.
     * @param {object} fill Fill primitive.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number } | null}
     */
    static #resolveFillBounds(fill) {
        const points = EcadScene3dDrillCutoutBuilder.#resolveFillPoints(fill)

        if (points.length) {
            return EcadScene3dDrillCutoutBuilder.#resolvePointBounds(points)
        }

        const x1 = Number(fill?.x1)
        const y1 = Number(fill?.y1)
        const x2 = Number(fill?.x2)
        const y2 = Number(fill?.y2)

        if (
            !Number.isFinite(x1) ||
            !Number.isFinite(y1) ||
            !Number.isFinite(x2) ||
            !Number.isFinite(y2)
        ) {
            return null
        }

        return {
            minX: Math.min(x1, x2),
            minY: Math.min(y1, y2),
            maxX: Math.max(x1, x2),
            maxY: Math.max(y1, y2)
        }
    }

    /**
     * Resolves axis-aligned bounds for finite points.
     * @param {object[]} points Point list.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number }}
     */
    static #resolvePointBounds(points) {
        const finitePoints =
            EcadScene3dDrillCutoutBuilder.#resolveFinitePoints(points)

        return {
            minX: Math.min(...finitePoints.map((point) => point.x)),
            minY: Math.min(...finitePoints.map((point) => point.y)),
            maxX: Math.max(...finitePoints.map((point) => point.x)),
            maxY: Math.max(...finitePoints.map((point) => point.y))
        }
    }

    /**
     * Returns true when two axis-aligned bounds overlap.
     * @param {object} first First bounds.
     * @param {object} second Second bounds.
     * @returns {boolean}
     */
    static #boundsOverlap(first, second) {
        return (
            Number(first.minX) <= Number(second.maxX) &&
            Number(first.maxX) >= Number(second.minX) &&
            Number(first.minY) <= Number(second.maxY) &&
            Number(first.maxY) >= Number(second.minY)
        )
    }

    /**
     * Returns true when a point is inside a polygon.
     * @param {{ x?: number, y?: number }} point Source point.
     * @param {{ x: number, y: number }[]} polygon Polygon points.
     * @returns {boolean}
     */
    static #isPointInPolygon(point, polygon) {
        let inside = false
        const x = Number(point?.x)
        const y = Number(point?.y)

        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            return false
        }

        for (
            let index = 0, previousIndex = polygon.length - 1;
            index < polygon.length;
            previousIndex = index, index += 1
        ) {
            const current = polygon[index]
            const previous = polygon[previousIndex]
            const intersects =
                current.y > y !== previous.y > y &&
                x <
                    ((previous.x - current.x) * (y - current.y)) /
                        (previous.y - current.y) +
                        current.x

            if (intersects) {
                inside = !inside
            }
        }

        return inside
    }

    /**
     * Resolves the first positive numeric field from an object.
     * @param {object} source Source object.
     * @param {string[]} fieldNames Candidate field names.
     * @returns {number}
     */
    static #resolvePositiveNumber(source, fieldNames) {
        for (const fieldName of fieldNames) {
            const value = Number(source?.[fieldName])
            if (Number.isFinite(value) && value > 0) {
                return value
            }
        }

        return 0
    }
}
