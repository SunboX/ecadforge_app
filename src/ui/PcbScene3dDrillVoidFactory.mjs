import { PcbScene3dBoardShapeFactory } from './PcbScene3dBoardShapeFactory.mjs'
import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'

/**
 * Builds open drill-interior surfaces for board-assembly substrates.
 */
export class PcbScene3dDrillVoidFactory {
    static #DEFAULT_INTERIOR_COLOR = 0xf4f0ea
    static #INTERIOR_RADIUS_SCALE = 0.86
    static #INTERIOR_SEGMENTS = 18

    /**
     * Builds open-ended circular drill interiors without capping apertures.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} [detail]
     * @param {number} [topZ]
     * @param {number} [bottomZ]
     * @param {(x: number, y: number) => { x: number, y: number }} [normalizeBoardPoint]
     * @param {{ enabled?: boolean, color?: number, board?: object }} [options]
     * @returns {any}
     */
    static buildGroup(
        THREE,
        detail = {},
        topZ = 0,
        bottomZ = 0,
        normalizeBoardPoint = (x, y) => ({ x, y }),
        options = {}
    ) {
        const group = new THREE.Group()
        group.name = 'drill-voids'
        if (!options?.enabled) {
            return group
        }

        const material = PcbScene3dDrillVoidFactory.#buildMaterial(
            THREE,
            options
        )
        const geometryCache = new Map()
        const depth = Math.max(Math.abs(Number(topZ) - Number(bottomZ)), 1)
        const centerZ = (Number(topZ || 0) + Number(bottomZ || 0)) / 2
        const platedDrillKeys =
            PcbScene3dDrillVoidFactory.#buildPlatedDrillKeySet(detail)
        const edgeDrillKeys = PcbScene3dDrillVoidFactory.#buildEdgeDrillKeySet(
            THREE,
            detail,
            normalizeBoardPoint,
            options
        )

        PcbScene3dDrillPathFactory.resolveBoardDrillSpecs(detail).forEach(
            (drillSpec) => {
                if (
                    platedDrillKeys.has(
                        PcbScene3dDrillVoidFactory.#drillKey(drillSpec)
                    ) ||
                    edgeDrillKeys.has(
                        PcbScene3dDrillVoidFactory.#drillKey(drillSpec)
                    )
                ) {
                    return
                }

                const mesh = PcbScene3dDrillVoidFactory.#buildInteriorMesh(
                    THREE,
                    geometryCache,
                    drillSpec,
                    depth,
                    centerZ,
                    material,
                    normalizeBoardPoint
                )
                if (mesh) {
                    group.add(mesh)
                }
            }
        )

        return group
    }

    /**
     * Builds a lookup for circular drills already carved into the board edge.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {{ board?: object }} options
     * @returns {Set<string>}
     */
    static #buildEdgeDrillKeySet(
        THREE,
        detail,
        normalizeBoardPoint,
        options
    ) {
        return new Set(
            PcbScene3dBoardShapeFactory.resolveCircularEdgeDrills(
                THREE,
                options?.board,
                detail,
                normalizeBoardPoint
            ).map((drillSpec) =>
                PcbScene3dDrillVoidFactory.#drillKey(drillSpec)
            )
        )
    }

    /**
     * Builds a lookup for drill holes that already have copper barrel geometry.
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @returns {Set<string>}
     */
    static #buildPlatedDrillKeySet(detail) {
        const platedDrills = new Set()

        for (const via of detail?.vias || []) {
            if (PcbScene3dDrillVoidFactory.#hasViaCopperAnnulus(via)) {
                platedDrills.add(PcbScene3dDrillVoidFactory.#drillKey(via))
            }
        }

        for (const pad of detail?.pads || []) {
            if (PcbScene3dDrillVoidFactory.#hasPadCopperAnnulus(pad)) {
                platedDrills.add(PcbScene3dDrillVoidFactory.#drillKey(pad))
            }
        }

        return platedDrills
    }

    /**
     * Checks whether one via has a copper annulus around its drill.
     * @param {any} via Via primitive.
     * @returns {boolean}
     */
    static #hasViaCopperAnnulus(via) {
        const holeDiameter = Number(via?.holeDiameter || 0)
        return (
            holeDiameter > 0 &&
            Number(via?.diameter || 0) > holeDiameter + 0.001
        )
    }

    /**
     * Checks whether one pad has copper larger than its drill aperture.
     * @param {any} pad Pad primitive.
     * @returns {boolean}
     */
    static #hasPadCopperAnnulus(pad) {
        const holeDiameter = Number(pad?.holeDiameter || 0)
        if (holeDiameter <= 0) {
            return false
        }

        return [
            pad?.sizeTopX,
            pad?.sizeTopY,
            pad?.sizeMidX,
            pad?.sizeMidY,
            pad?.sizeBottomX,
            pad?.sizeBottomY
        ].some((size) => Number(size || 0) > holeDiameter + 0.001)
    }

    /**
     * Builds a stable lookup key for one circular drill.
     * @param {{ x?: number, y?: number, holeDiameter?: number, diameter?: number }} drill
     * @returns {string}
     */
    static #drillKey(drill) {
        return [
            Number(drill?.x || 0).toFixed(4),
            Number(drill?.y || 0).toFixed(4),
            Number(drill?.holeDiameter || drill?.diameter || 0).toFixed(4)
        ].join(':')
    }

    /**
     * Builds the shared drill-interior material.
     * @param {any} THREE
     * @param {{ color?: number }} options
     * @returns {any}
     */
    static #buildMaterial(THREE, options) {
        return new THREE.MeshStandardMaterial({
            color: Number.isInteger(options?.color)
                ? options.color
                : PcbScene3dDrillVoidFactory.#DEFAULT_INTERIOR_COLOR,
            roughness: 0.82,
            metalness: 0,
            side: THREE.DoubleSide
        })
    }

    /**
     * Builds one open circular drill-interior mesh.
     * @param {any} THREE
     * @param {Map<string, any>} geometryCache
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null }} drillSpec
     * @param {number} depth
     * @param {number} centerZ
     * @param {any} material
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any | null}
     */
    static #buildInteriorMesh(
        THREE,
        geometryCache,
        drillSpec,
        depth,
        centerZ,
        material,
        normalizeBoardPoint
    ) {
        if (
            Number(drillSpec?.slotLength || 0) >
            Number(drillSpec?.diameter || 0) + 0.001
        ) {
            return null
        }

        const point = normalizeBoardPoint(
            Number(drillSpec?.x || 0),
            Number(drillSpec?.y || 0)
        )
        const mesh = new THREE.Mesh(
            PcbScene3dDrillVoidFactory.#resolveGeometry(
                THREE,
                geometryCache,
                Number(drillSpec?.diameter || 0),
                depth
            ),
            material
        )
        mesh.name = 'drill-void-interior'
        mesh.position.set(point.x, point.y, centerZ)
        mesh.rotation.x = Math.PI / 2
        return mesh
    }

    /**
     * Resolves a reusable open-cylinder geometry for a circular drill.
     * @param {any} THREE
     * @param {Map<string, any>} geometryCache
     * @param {number} diameter
     * @param {number} depth
     * @returns {any}
     */
    static #resolveGeometry(THREE, geometryCache, diameter, depth) {
        const radius = Math.max(
            (Math.max(Number(diameter || 0), 1) / 2) *
                PcbScene3dDrillVoidFactory.#INTERIOR_RADIUS_SCALE,
            0.6
        )
        const cacheKey = [radius.toFixed(4), depth.toFixed(4)].join(':')
        const cached = geometryCache.get(cacheKey)
        if (cached) {
            return cached
        }

        const geometry = new THREE.CylinderGeometry(
            radius,
            radius,
            depth,
            PcbScene3dDrillVoidFactory.#INTERIOR_SEGMENTS,
            1,
            true
        )
        geometryCache.set(cacheKey, geometry)
        return geometry
    }
}
