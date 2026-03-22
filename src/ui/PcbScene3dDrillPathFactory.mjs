/**
 * Builds reusable circular and slotted drill paths for the 3D PCB scene.
 */
export class PcbScene3dDrillPathFactory {
    static #PAD_HOLE_SHAPE_SLOT = 2
    static #ARC_SEGMENTS = 12

    /**
     * Appends all board drill holes from pads and vias to one board shape.
     * @param {any} THREE
     * @param {any} shape
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {void}
     */
    static appendBoardDrills(THREE, shape, detail, normalizeBoardPoint) {
        const seen = new Set()
        const drillSpecs = [
            ...PcbScene3dDrillPathFactory.#resolveViaDrillSpecs(detail?.vias || []),
            ...PcbScene3dDrillPathFactory.#resolvePadDrillSpecs(detail?.pads || [])
        ]

        for (const drillSpec of drillSpecs) {
            const key = PcbScene3dDrillPathFactory.#buildCacheKey(drillSpec)
            if (seen.has(key)) {
                continue
            }

            const point = normalizeBoardPoint(drillSpec.x, drillSpec.y)
            const holePath = PcbScene3dDrillPathFactory.buildDrillPath(THREE, {
                ...drillSpec,
                x: point.x,
                y: point.y
            })
            if (!holePath) {
                continue
            }

            shape.holes.push(holePath)
            seen.add(key)
        }
    }

    /**
     * Builds one local pad drill path centered on the pad origin.
     * @param {any} THREE
     * @param {{ holeDiameter?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null, rotation?: number | null }} pad
     * @returns {any | null}
     */
    static buildPadHolePath(THREE, pad) {
        const drillSpec = PcbScene3dDrillPathFactory.#resolvePadDrillSpec(pad)
        return drillSpec
            ? PcbScene3dDrillPathFactory.buildDrillPath(THREE, {
                  ...drillSpec,
                  x: 0,
                  y: 0
              })
            : null
    }

    /**
     * Builds one local via drill path centered on the via origin.
     * @param {any} THREE
     * @param {{ holeDiameter?: number }} via
     * @returns {any | null}
     */
    static buildViaHolePath(THREE, via) {
        const holeDiameter = Number(via?.holeDiameter || 0)
        if (holeDiameter <= 0) {
            return null
        }

        return PcbScene3dDrillPathFactory.buildDrillPath(THREE, {
            x: 0,
            y: 0,
            diameter: holeDiameter,
            slotLength: null,
            rotationDeg: 0
        })
    }

    /**
     * Builds one drill path from a normalized drill descriptor.
     * @param {any} THREE
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }} drillSpec
     * @returns {any | null}
     */
    static buildDrillPath(THREE, drillSpec) {
        const diameter = Number(drillSpec?.diameter || 0)
        if (diameter <= 0) {
            return null
        }

        if (
            Number(drillSpec?.slotLength || 0) >
            diameter + 0.001
        ) {
            return PcbScene3dDrillPathFactory.#buildSlotPath(THREE, drillSpec)
        }

        return PcbScene3dDrillPathFactory.#buildCirclePath(THREE, drillSpec)
    }

    /**
     * Resolves board-space via drill specs from normalized via detail.
     * @param {{ x?: number, y?: number, holeDiameter?: number }[]} vias
     * @returns {{ x: number, y: number, diameter: number, slotLength: null, rotationDeg: 0 }[]}
     */
    static #resolveViaDrillSpecs(vias) {
        return (vias || [])
            .map((via) => {
                const diameter = Number(via?.holeDiameter || 0)
                if (diameter <= 0) {
                    return null
                }

                return {
                    x: Number(via?.x || 0),
                    y: Number(via?.y || 0),
                    diameter,
                    slotLength: null,
                    rotationDeg: 0
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves board-space pad drill specs from normalized pad detail.
     * @param {any[]} pads
     * @returns {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }[]}
     */
    static #resolvePadDrillSpecs(pads) {
        return (pads || [])
            .map((pad) => {
                const drillSpec = PcbScene3dDrillPathFactory.#resolvePadDrillSpec(
                    pad
                )
                if (!drillSpec) {
                    return null
                }

                return {
                    ...drillSpec,
                    x: Number(pad?.x || 0),
                    y: Number(pad?.y || 0),
                    rotationDeg:
                        drillSpec.slotLength === null
                            ? 0
                            : PcbScene3dDrillPathFactory.#normalizeAngle(
                                  Number(pad?.rotation || 0) +
                                      Number(drillSpec.rotationDeg || 0)
                              )
                }
            })
            .filter(Boolean)
    }

    /**
     * Resolves one pad-local drill spec when the pad is through-hole.
     * @param {{ holeDiameter?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null }} pad
     * @returns {{ diameter: number, slotLength?: number | null, rotationDeg?: number | null } | null}
     */
    static #resolvePadDrillSpec(pad) {
        const diameter = Number(pad?.holeDiameter || 0)
        if (diameter <= 0) {
            return null
        }

        const slotLength =
            Number(pad?.holeShape) === PcbScene3dDrillPathFactory.#PAD_HOLE_SHAPE_SLOT &&
            Number(pad?.holeSlotLength || 0) > diameter
                ? Number(pad?.holeSlotLength || 0)
                : null

        return {
            diameter,
            slotLength,
            rotationDeg: Number(pad?.holeRotation || 0)
        }
    }

    /**
     * Builds one circular drill path.
     * @param {any} THREE
     * @param {{ x: number, y: number, diameter: number }} drillSpec
     * @returns {any}
     */
    static #buildCirclePath(THREE, drillSpec) {
        const radius = Math.max(Number(drillSpec.diameter || 0) / 2, 0.6)
        const path = new THREE.Path()
        const centerX = Number(drillSpec.x || 0)
        const centerY = Number(drillSpec.y || 0)

        path.moveTo(centerX + radius, centerY)
        path.absarc(centerX, centerY, radius, 0, Math.PI, false)
        path.absarc(centerX, centerY, radius, Math.PI, Math.PI * 2, false)
        path.closePath()
        return path
    }

    /**
     * Builds one slotted drill path as a rotated rounded rectangle.
     * @param {any} THREE
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }} drillSpec
     * @returns {any}
     */
    static #buildSlotPath(THREE, drillSpec) {
        const points = PcbScene3dDrillPathFactory.#buildSlotPoints(drillSpec)
        const path = new THREE.Path()

        if (!points.length) {
            return path
        }

        path.moveTo(points[0].x, points[0].y)
        for (let index = 1; index < points.length; index += 1) {
            path.lineTo(points[index].x, points[index].y)
        }
        path.closePath()
        return path
    }

    /**
     * Builds one rotated slot outline as sampled points.
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }} drillSpec
     * @returns {{ x: number, y: number }[]}
     */
    static #buildSlotPoints(drillSpec) {
        const diameter = Math.max(Number(drillSpec.diameter || 0), 1.2)
        const radius = Math.max(diameter / 2, 0.6)
        const slotLength = Math.max(Number(drillSpec.slotLength || 0), diameter)
        const straightHalf = Math.max(slotLength / 2 - radius, 0)
        const rotationRad =
            (Number(drillSpec.rotationDeg || 0) * Math.PI) / 180
        const sampledPoints = []

        PcbScene3dDrillPathFactory.#appendArcPoints(
            sampledPoints,
            straightHalf,
            0,
            radius,
            -Math.PI / 2,
            Math.PI / 2
        )
        PcbScene3dDrillPathFactory.#appendArcPoints(
            sampledPoints,
            -straightHalf,
            0,
            radius,
            Math.PI / 2,
            (Math.PI * 3) / 2,
            true
        )

        return sampledPoints.map((point) =>
            PcbScene3dDrillPathFactory.#rotateAndTranslatePoint(
                point,
                rotationRad,
                Number(drillSpec.x || 0),
                Number(drillSpec.y || 0)
            )
        )
    }

    /**
     * Appends sampled points for one drill-cap arc.
     * @param {{ x: number, y: number }[]} points
     * @param {number} cx
     * @param {number} cy
     * @param {number} radius
     * @param {number} startAngle
     * @param {number} endAngle
     * @param {boolean} [skipFirst]
     * @returns {void}
     */
    static #appendArcPoints(
        points,
        cx,
        cy,
        radius,
        startAngle,
        endAngle,
        skipFirst = false
    ) {
        for (let index = 0; index <= PcbScene3dDrillPathFactory.#ARC_SEGMENTS; index += 1) {
            if (skipFirst && index === 0) {
                continue
            }

            const t = index / PcbScene3dDrillPathFactory.#ARC_SEGMENTS
            const angle = startAngle + (endAngle - startAngle) * t
            points.push({
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius
            })
        }
    }

    /**
     * Rotates one local point around the origin and translates it into place.
     * @param {{ x: number, y: number }} point
     * @param {number} rotationRad
     * @param {number} dx
     * @param {number} dy
     * @returns {{ x: number, y: number }}
     */
    static #rotateAndTranslatePoint(point, rotationRad, dx, dy) {
        const cos = Math.cos(rotationRad)
        const sin = Math.sin(rotationRad)

        return {
            x: point.x * cos - point.y * sin + dx,
            y: point.x * sin + point.y * cos + dy
        }
    }

    /**
     * Builds one stable dedupe key for a board drill.
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }} drillSpec
     * @returns {string}
     */
    static #buildCacheKey(drillSpec) {
        return [
            Number(drillSpec.x || 0).toFixed(4),
            Number(drillSpec.y || 0).toFixed(4),
            Number(drillSpec.diameter || 0).toFixed(4),
            Number(drillSpec.slotLength || 0).toFixed(4),
            Number(drillSpec.rotationDeg || 0).toFixed(4)
        ].join(':')
    }

    /**
     * Normalizes one angle into the inclusive `[0, 360)` range.
     * @param {number} angleDeg
     * @returns {number}
     */
    static #normalizeAngle(angleDeg) {
        const normalized = Number(angleDeg || 0) % 360
        return normalized < 0 ? normalized + 360 : normalized
    }
}
