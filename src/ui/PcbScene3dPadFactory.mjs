import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'

/**
 * Builds copper pad meshes for the interactive 3D PCB scene.
 */
export class PcbScene3dPadFactory {
    static #PAD_SHAPE_RECTANGULAR = 2
    static #PAD_THICKNESS_MIL = 2.2

    /**
     * Builds the pad mesh group for one scene.
     * @param {any} THREE
     * @param {any[]} pads
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {{ side?: 'top' | 'bottom', mirrorY?: boolean }} [options]
     * @returns {any}
     */
    static buildGroup(THREE, pads, z, normalizeBoardPoint, options = {}) {
        const group = new THREE.Group()
        const material = new THREE.MeshStandardMaterial({
            color: 0xd9a61d,
            roughness: 0.38,
            metalness: 0.55,
            side: THREE.DoubleSide
        })
        const geometryCache = new Map()
        const side = PcbScene3dPadFactory.#normalizeSide(options?.side)
        const mirrorY = Boolean(options?.mirrorY)

        ;(pads || []).forEach((pad) => {
            if (!PcbScene3dPadFactory.#hasVisibleSurface(pad, side)) {
                return
            }

            const spec = PcbScene3dPadFactory.resolvePadSurfaceSpec(pad, side)
            const geometry = PcbScene3dPadFactory.#resolveGeometry(
                THREE,
                geometryCache,
                spec,
                pad
            )
            const point = PcbScene3dPadFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(pad?.x || 0),
                Number(pad?.y || 0),
                mirrorY
            )
            const root = new THREE.Group()
            const mesh = new THREE.Mesh(geometry, material)
            root.position.set(point.x, point.y, 0)
            root.rotation.z = (Number(pad?.rotation || 0) * Math.PI) / 180
            mesh.position.set(
                spec.offsetX,
                mirrorY ? -spec.offsetY : spec.offsetY,
                z
            )
            if (geometry.type === 'CylinderGeometry') {
                mesh.rotation.x = Math.PI / 2
            }
            root.add(mesh)
            group.add(root)
        })

        return group
    }

    /**
     * Resolves the visible copper shape for one pad face.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number, holeShape?: number | null, holeSlotLength?: number | null, holeRotation?: number | null, shapeTop?: number, shapeMid?: number, shapeBottom?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, roundedRectShapeBottom?: number | null, cornerRadiusTop?: number | null, cornerRadiusBottom?: number | null, offsetTopX?: number, offsetTopY?: number, offsetBottomX?: number, offsetBottomY?: number }} pad
     * @param {'top' | 'bottom'} [side]
     * @returns {{ width: number, height: number, kind: 'circle' | 'rect' | 'rounded-rect', radius: number, cornerRadius: number, offsetX: number, offsetY: number, hasHole: boolean, holeDiameter: number, holeSlotLength: number | null, holeRotation: number }}
     */
    static resolvePadSurfaceSpec(pad, side = 'top') {
        const normalizedSide = PcbScene3dPadFactory.#normalizeSide(side)
        const size = PcbScene3dPadFactory.#resolvePadSurfaceSize(
            pad,
            normalizedSide
        )
        const cornerRadius = PcbScene3dPadFactory.#resolvePadCornerRadius(
            pad,
            size,
            normalizedSide
        )
        const offset = PcbScene3dPadFactory.#resolvePadOffset(
            pad,
            normalizedSide
        )

        return {
            width: size.width,
            height: size.height,
            kind: PcbScene3dPadFactory.#resolvePadKind(
                pad,
                size,
                cornerRadius,
                normalizedSide
            ),
            radius: Math.max(size.width, size.height) / 2,
            cornerRadius,
            offsetX: offset.x,
            offsetY: offset.y,
            hasHole: Number(pad?.holeDiameter || 0) > 0,
            holeDiameter: Math.max(Number(pad?.holeDiameter || 0), 0),
            holeSlotLength:
                Number(pad?.holeSlotLength || 0) >
                Number(pad?.holeDiameter || 0)
                    ? Number(pad?.holeSlotLength || 0)
                    : null,
            holeRotation: Number(pad?.holeRotation || 0)
        }
    }

    /**
     * Resolves the visible copper size for one pad face.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number }} pad
     * @param {'top' | 'bottom'} side
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
                    pad?.holeDiameter ||
                    0
            ) || 0
        const height =
            Number(
                preferredHeight ||
                    pad?.sizeMidY ||
                    (side === 'bottom' ? pad?.sizeTopY : pad?.sizeBottomY) ||
                    pad?.holeDiameter ||
                    0
            ) || 0
        const holeDiameter = Number(pad?.holeDiameter || 0)

        return {
            width: Math.max(width, holeDiameter, 1),
            height: Math.max(height, holeDiameter, 1)
        }
    }

    /**
     * Resolves the authored pad kind for one face.
     * @param {{ shapeTop?: number, shapeMid?: number, shapeBottom?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, roundedRectShapeBottom?: number | null }} pad
     * @param {{ width: number, height: number }} size
     * @param {number} cornerRadius
     * @param {'top' | 'bottom'} side
     * @returns {'circle' | 'rect' | 'rounded-rect'}
     */
    static #resolvePadKind(pad, size, cornerRadius, side) {
        if (PcbScene3dPadFactory.#isCircularPad(pad, size, side)) {
            return 'circle'
        }

        if (cornerRadius > 0.001) {
            return 'rounded-rect'
        }

        return 'rect'
    }

    /**
     * Returns true when one pad should render as a circular copper disc.
     * @param {{ shapeTop?: number, shapeMid?: number, shapeBottom?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, roundedRectShapeBottom?: number | null }} pad
     * @param {{ width: number, height: number }} size
     * @param {'top' | 'bottom'} side
     * @returns {boolean}
     */
    static #isCircularPad(pad, size, side) {
        if (
            PcbScene3dPadFactory.#resolvePadShape(pad, side) ===
            PcbScene3dPadFactory.#PAD_SHAPE_RECTANGULAR
        ) {
            return false
        }

        return Math.abs(Number(size.width) - Number(size.height)) < 0.001
    }

    /**
     * Resolves the effective pad shape code for one face, including any
     * rounded-rect extension override when present.
     * @param {{ shapeTop?: number, shapeMid?: number, shapeBottom?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, roundedRectShapeBottom?: number | null }} pad
     * @param {'top' | 'bottom'} side
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

            return Number(
                pad?.shapeBottom || pad?.shapeMid || pad?.shapeTop || 0
            )
        }

        if (pad?.hasRoundedRect && Number.isInteger(pad?.roundedRectShapeTop)) {
            return Number(pad.roundedRectShapeTop)
        }

        return Number(pad?.shapeTop || pad?.shapeMid || pad?.shapeBottom || 0)
    }

    /**
     * Resolves the visible corner radius for one pad face.
     * @param {{ shapeTop?: number, shapeMid?: number, shapeBottom?: number, hasRoundedRect?: boolean, roundedRectShapeTop?: number | null, roundedRectShapeBottom?: number | null, cornerRadiusTop?: number | null, cornerRadiusBottom?: number | null }} pad
     * @param {{ width: number, height: number }} size
     * @param {'top' | 'bottom'} side
     * @returns {number}
     */
    static #resolvePadCornerRadius(pad, size, side) {
        const roundedRectCornerRadius =
            PcbScene3dPadFactory.#resolveRoundedRectCornerRadius(
                pad,
                size,
                side
            )
        if (roundedRectCornerRadius > 0) {
            return roundedRectCornerRadius
        }

        if (PcbScene3dPadFactory.#resolvePadShape(pad, side) === 1) {
            return Math.min(size.width, size.height) / 2
        }

        return 0
    }

    /**
     * Resolves one optional explicit rounded-rect corner radius.
     * @param {{ hasRoundedRect?: boolean, cornerRadiusTop?: number | null, cornerRadiusBottom?: number | null }} pad
     * @param {{ width: number, height: number }} size
     * @param {'top' | 'bottom'} side
     * @returns {number}
     */
    static #resolveRoundedRectCornerRadius(pad, size, side) {
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
     * Resolves the local copper offset for one face.
     * @param {{ offsetTopX?: number, offsetTopY?: number, offsetBottomX?: number, offsetBottomY?: number }} pad
     * @param {'top' | 'bottom'} side
     * @returns {{ x: number, y: number }}
     */
    static #resolvePadOffset(pad, side) {
        if (side === 'bottom') {
            return {
                x: Number(pad?.offsetBottomX ?? pad?.offsetTopX ?? 0),
                y: Number(pad?.offsetBottomY ?? pad?.offsetTopY ?? 0)
            }
        }

        return {
            x: Number(pad?.offsetTopX ?? pad?.offsetBottomX ?? 0),
            y: Number(pad?.offsetTopY ?? pad?.offsetBottomY ?? 0)
        }
    }

    /**
     * Returns true when one pad has visible copper on the requested face.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeMidX?: number, sizeMidY?: number, sizeBottomX?: number, sizeBottomY?: number, holeDiameter?: number, hasTopSolderMaskOpening?: boolean, hasBottomSolderMaskOpening?: boolean }} pad
     * @param {'top' | 'bottom'} side
     * @returns {boolean}
     */
    static #hasVisibleSurface(pad, side) {
        const maskOpening = PcbScene3dPadFactory.#resolveSolderMaskOpening(
            pad,
            side
        )
        if (maskOpening === false) {
            return false
        }

        const preferredSideHasSize = PcbScene3dPadFactory.#hasSideSize(
            pad,
            side
        )
        if (preferredSideHasSize) {
            return true
        }

        const alternateSideHasSize = PcbScene3dPadFactory.#hasSideSize(
            pad,
            side === 'bottom' ? 'top' : 'bottom'
        )
        const midHasSize =
            Number(pad?.sizeMidX || 0) > 0 || Number(pad?.sizeMidY || 0) > 0

        return (
            (!alternateSideHasSize && midHasSize) ||
            (!alternateSideHasSize &&
                !midHasSize &&
                Number(pad?.holeDiameter || 0) > 0)
        )
    }

    /**
     * Resolves an explicit side-specific solder-mask opening when available.
     * @param {{ hasTopSolderMaskOpening?: boolean, hasBottomSolderMaskOpening?: boolean }} pad
     * @param {'top' | 'bottom'} side
     * @returns {boolean | null}
     */
    static #resolveSolderMaskOpening(pad, side) {
        const fieldName =
            side === 'bottom'
                ? 'hasBottomSolderMaskOpening'
                : 'hasTopSolderMaskOpening'

        if (typeof pad?.[fieldName] === 'boolean') {
            return pad[fieldName]
        }

        return null
    }

    /**
     * Returns true when one face has an explicit copper size.
     * @param {{ sizeTopX?: number, sizeTopY?: number, sizeBottomX?: number, sizeBottomY?: number }} pad
     * @param {'top' | 'bottom'} side
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
     * Normalizes one face selector to a supported side.
     * @param {string | undefined} side
     * @returns {'top' | 'bottom'}
     */
    static #normalizeSide(side) {
        return String(side || 'top').toLowerCase() === 'bottom'
            ? 'bottom'
            : 'top'
    }

    /**
     * Normalizes one board point and optionally mirrors it for underside
     * copper groups before the parent face flip rotates them below the board.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {number} x
     * @param {number} y
     * @param {boolean} mirrorY
     * @returns {{ x: number, y: number }}
     */
    static #normalizePoint(normalizeBoardPoint, x, y, mirrorY) {
        const point = normalizeBoardPoint(x, y)

        return {
            x: point.x,
            y: mirrorY ? -point.y : point.y
        }
    }

    /**
     * Resolves or creates one reusable geometry for the pad spec.
     * @param {any} THREE
     * @param {Map<string, any>} geometryCache
     * @param {any} pad
     * @param {{ width: number, height: number, kind: 'circle' | 'rect' | 'rounded-rect', radius: number, cornerRadius: number, hasHole: boolean, holeDiameter: number, holeSlotLength: number | null, holeRotation: number }} spec
     * @returns {any}
     */
    static #resolveGeometry(THREE, geometryCache, spec, pad) {
        const cacheKey = [
            spec.kind,
            spec.width.toFixed(4),
            spec.height.toFixed(4),
            spec.cornerRadius.toFixed(4),
            spec.holeDiameter.toFixed(4),
            Number(spec.holeSlotLength || 0).toFixed(4),
            spec.holeRotation.toFixed(4)
        ].join(':')
        const cached = geometryCache.get(cacheKey)
        if (cached) {
            return cached
        }

        let geometry
        if (spec.kind === 'circle' && !spec.hasHole) {
            geometry = new THREE.CylinderGeometry(
                spec.radius,
                spec.radius,
                PcbScene3dPadFactory.#PAD_THICKNESS_MIL,
                28
            )
        } else {
            const shape = PcbScene3dPadFactory.#buildOuterShape(THREE, spec)
            const drillHole = PcbScene3dDrillPathFactory.buildPadHolePath(
                THREE,
                pad
            )
            if (drillHole) {
                shape.holes.push(drillHole)
            }
            geometry = new THREE.ExtrudeGeometry(shape, {
                depth: PcbScene3dPadFactory.#PAD_THICKNESS_MIL,
                bevelEnabled: false,
                curveSegments: 16,
                steps: 1
            })
            geometry.translate?.(
                0,
                0,
                -PcbScene3dPadFactory.#PAD_THICKNESS_MIL / 2
            )
        }

        geometryCache.set(cacheKey, geometry)
        return geometry
    }

    /**
     * Builds one pad outline shape for extrusion.
     * @param {any} THREE
     * @param {{ width: number, height: number, kind: 'circle' | 'rect' | 'rounded-rect', radius: number, cornerRadius: number }} spec
     * @returns {any}
     */
    static #buildOuterShape(THREE, spec) {
        if (spec.kind === 'circle') {
            const shape = new THREE.Shape()
            shape.moveTo(spec.radius, 0)
            shape.absarc(0, 0, spec.radius, 0, Math.PI, false)
            shape.absarc(0, 0, spec.radius, Math.PI, Math.PI * 2, false)
            shape.closePath()
            return shape
        }

        if (spec.kind === 'rounded-rect') {
            return PcbScene3dPadFactory.#buildRoundedRectShape(THREE, spec)
        }

        return PcbScene3dPadFactory.#buildRectShape(THREE, spec)
    }

    /**
     * Builds one rectangular pad profile.
     * @param {any} THREE
     * @param {{ width: number, height: number }} spec
     * @returns {any}
     */
    static #buildRectShape(THREE, spec) {
        const halfWidth = spec.width / 2
        const halfHeight = spec.height / 2
        const shape = new THREE.Shape()

        shape.moveTo(-halfWidth, -halfHeight)
        shape.lineTo(halfWidth, -halfHeight)
        shape.lineTo(halfWidth, halfHeight)
        shape.lineTo(-halfWidth, halfHeight)
        shape.closePath()
        return shape
    }

    /**
     * Builds one rounded rectangular pad profile.
     * @param {any} THREE
     * @param {{ width: number, height: number, cornerRadius: number }} spec
     * @returns {any}
     */
    static #buildRoundedRectShape(THREE, spec) {
        const halfWidth = spec.width / 2
        const halfHeight = spec.height / 2
        const radius = Math.max(
            0,
            Math.min(spec.cornerRadius, halfWidth, halfHeight)
        )
        const shape = new THREE.Shape()

        if (radius <= 0.001) {
            shape.moveTo(-halfWidth, -halfHeight)
            shape.lineTo(halfWidth, -halfHeight)
            shape.lineTo(halfWidth, halfHeight)
            shape.lineTo(-halfWidth, halfHeight)
            shape.closePath()
            return shape
        }

        shape.moveTo(-halfWidth + radius, -halfHeight)
        shape.lineTo(halfWidth - radius, -halfHeight)
        shape.absarc(
            halfWidth - radius,
            -halfHeight + radius,
            radius,
            -Math.PI / 2,
            0,
            false
        )
        shape.lineTo(halfWidth, halfHeight - radius)
        shape.absarc(
            halfWidth - radius,
            halfHeight - radius,
            radius,
            0,
            Math.PI / 2,
            false
        )
        shape.lineTo(-halfWidth + radius, halfHeight)
        shape.absarc(
            -halfWidth + radius,
            halfHeight - radius,
            radius,
            Math.PI / 2,
            Math.PI,
            false
        )
        shape.lineTo(-halfWidth, -halfHeight + radius)
        shape.absarc(
            -halfWidth + radius,
            -halfHeight + radius,
            radius,
            Math.PI,
            (Math.PI * 3) / 2,
            false
        )
        shape.closePath()
        return shape
    }
}
