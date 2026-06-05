import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'

/**
 * Builds visual drill apertures for board-assembly substrates.
 */
export class PcbScene3dDrillVoidFactory {
    static #DEFAULT_VOID_COLOR = 0xf4f0ea
    static #PATH_SAMPLE_POINTS = 48
    static #SURFACE_OFFSET_MIL = 0.35
    static #VOID_RENDER_ORDER = 35

    /**
     * Builds board-assembly drill masks while leaving procedural boards open.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} [detail]
     * @param {number} [topZ]
     * @param {number} [bottomZ]
     * @param {(x: number, y: number) => { x: number, y: number }} [normalizeBoardPoint]
     * @param {{ enabled?: boolean, color?: number }} [options]
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
        const shapes = PcbScene3dDrillVoidFactory.#buildDrillShapes(
            THREE,
            detail,
            normalizeBoardPoint
        )
        if (!shapes.length) {
            return group
        }

        group.add(
            PcbScene3dDrillVoidFactory.#buildSideMesh(
                THREE,
                shapes,
                PcbScene3dDrillVoidFactory.#resolveSurfaceZ(topZ, 1),
                material,
                'top'
            ),
            PcbScene3dDrillVoidFactory.#buildSideMesh(
                THREE,
                shapes,
                PcbScene3dDrillVoidFactory.#resolveSurfaceZ(bottomZ, -1),
                material,
                'bottom'
            )
        )
        return group
    }

    /**
     * Builds the shared visual void material.
     * @param {any} THREE
     * @param {{ color?: number }} options
     * @returns {any}
     */
    static #buildMaterial(THREE, options) {
        return new THREE.MeshBasicMaterial({
            color: Number.isInteger(options?.color)
                ? options.color
                : PcbScene3dDrillVoidFactory.#DEFAULT_VOID_COLOR,
            depthWrite: false,
            side: THREE.DoubleSide
        })
    }

    /**
     * Builds filled shapes matching board drill apertures.
     * @param {any} THREE
     * @param {{ pads?: any[], vias?: any[] }} detail
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any[]}
     */
    static #buildDrillShapes(THREE, detail, normalizeBoardPoint) {
        return PcbScene3dDrillPathFactory.resolveBoardDrillSpecs(detail)
            .map((drillSpec) =>
                PcbScene3dDrillVoidFactory.#buildDrillShape(
                    THREE,
                    drillSpec,
                    normalizeBoardPoint
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds one filled shape for a drill aperture.
     * @param {any} THREE
     * @param {{ x: number, y: number, diameter: number, slotLength?: number | null, rotationDeg?: number | null }} drillSpec
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any | null}
     */
    static #buildDrillShape(THREE, drillSpec, normalizeBoardPoint) {
        const point = normalizeBoardPoint(drillSpec.x, drillSpec.y)
        const path = PcbScene3dDrillPathFactory.buildDrillPath(THREE, {
            ...drillSpec,
            x: point.x,
            y: point.y
        })
        const points =
            path?.getPoints?.(PcbScene3dDrillVoidFactory.#PATH_SAMPLE_POINTS) ||
            []

        return points.length >= 3 ? new THREE.Shape(points) : null
    }

    /**
     * Builds one top or bottom aperture mask mesh.
     * @param {any} THREE
     * @param {any[]} shapes
     * @param {number} z
     * @param {any} material
     * @param {'top' | 'bottom'} side
     * @returns {any}
     */
    static #buildSideMesh(THREE, shapes, z, material, side) {
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shapes), material)
        mesh.name = `drill-voids-${side}`
        mesh.position.set(0, 0, z)
        mesh.renderOrder = PcbScene3dDrillVoidFactory.#VOID_RENDER_ORDER
        mesh.userData.scene3dDrillVoidOverlay = true
        return mesh
    }

    /**
     * Offsets the mask slightly away from the solid board-assembly surface.
     * @param {number} z
     * @param {1 | -1} direction
     * @returns {number}
     */
    static #resolveSurfaceZ(z, direction) {
        return (
            Number(z || 0) +
            direction * PcbScene3dDrillVoidFactory.#SURFACE_OFFSET_MIL
        )
    }
}
