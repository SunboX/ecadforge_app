import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'

/**
 * Builds annular via barrels for the interactive 3D PCB scene.
 */
export class PcbScene3dViaFactory {
    static #PAD_BARREL_OUTER_RADIUS_SCALE = 0.98
    static #PAD_BARREL_MIN_WALL_MIL = 1.2
    static #PAD_BARREL_WALL_FRACTION = 0.09

    /**
     * Builds the via mesh group for one scene.
     * @param {any} THREE
     * @param {{ diameter?: number, holeDiameter?: number, x?: number, y?: number, barrelOnly?: boolean }[]} vias
     * @param {number} thicknessMil
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any}
     */
    static buildGroup(THREE, vias, thicknessMil, normalizeBoardPoint) {
        const group = new THREE.Group()
        const material = new THREE.MeshStandardMaterial({
            color: 0xcaa24e,
            roughness: 0.48,
            metalness: 0.42,
            side: THREE.DoubleSide
        })
        const geometryCache = new Map()

        ;(vias || []).forEach((via) => {
            const geometry = PcbScene3dViaFactory.#resolveGeometry(
                THREE,
                geometryCache,
                via,
                thicknessMil
            )
            const mesh = new THREE.Mesh(geometry, material)
            const point = normalizeBoardPoint(
                Number(via?.x || 0),
                Number(via?.y || 0)
            )
            mesh.position.set(point.x, point.y, 0)
            if (geometry.type === 'CylinderGeometry') {
                mesh.rotation.x = Math.PI / 2
            }
            group.add(mesh)
        })

        return group
    }

    /**
     * Resolves one reusable via geometry from the via drill spec.
     * @param {any} THREE
     * @param {Map<string, any>} geometryCache
     * @param {{ diameter?: number, holeDiameter?: number, barrelOnly?: boolean }} via
     * @param {number} thicknessMil
     * @returns {any}
     */
    static #resolveGeometry(THREE, geometryCache, via, thicknessMil) {
        const outerRadius = Math.max(Number(via?.diameter || 0) / 2, 1.2)
        const holeDiameter = Math.max(Number(via?.holeDiameter || 0), 0)
        const depth = thicknessMil + 2
        const isBarrelOnly = Boolean(via?.barrelOnly)
        const cacheKey = [
            isBarrelOnly ? 'barrel' : 'annulus',
            outerRadius.toFixed(4),
            holeDiameter.toFixed(4),
            depth.toFixed(4)
        ].join(':')
        const cached = geometryCache.get(cacheKey)
        if (cached) {
            return cached
        }

        let geometry
        if (isBarrelOnly && holeDiameter > 0) {
            geometry = PcbScene3dViaFactory.#buildPadBarrelGeometry(
                THREE,
                holeDiameter,
                depth
            )
        } else if (holeDiameter > 0 && holeDiameter < outerRadius * 2 - 0.001) {
            const shape = new THREE.Shape()
            shape.moveTo(outerRadius, 0)
            shape.absarc(0, 0, outerRadius, 0, Math.PI, false)
            shape.absarc(0, 0, outerRadius, Math.PI, Math.PI * 2, false)
            const drillHole = PcbScene3dDrillPathFactory.buildViaHolePath(
                THREE,
                via
            )
            if (drillHole) {
                shape.holes.push(drillHole)
            }
            geometry = new THREE.ExtrudeGeometry(shape, {
                depth,
                bevelEnabled: false,
                curveSegments: 24,
                steps: 1
            })
            geometry.translate?.(0, 0, -depth / 2)
        } else {
            geometry = new THREE.CylinderGeometry(
                outerRadius,
                outerRadius,
                depth,
                18
            )
        }

        geometryCache.set(cacheKey, geometry)
        return geometry
    }

    /**
     * Builds a visible copper sleeve for through-hole pads.
     * @param {any} THREE
     * @param {number} holeDiameter
     * @param {number} depth
     * @returns {any}
     */
    static #buildPadBarrelGeometry(THREE, holeDiameter, depth) {
        const holeRadius = Math.max(Number(holeDiameter || 0) / 2, 0.8)
        const outerRadius = Math.max(
            holeRadius * PcbScene3dViaFactory.#PAD_BARREL_OUTER_RADIUS_SCALE,
            0.8
        )
        const wallThickness = Math.max(
            Number(holeDiameter || 0) *
                PcbScene3dViaFactory.#PAD_BARREL_WALL_FRACTION,
            PcbScene3dViaFactory.#PAD_BARREL_MIN_WALL_MIL
        )
        const innerRadius = Math.max(outerRadius - wallThickness, 0.6)
        const shape = PcbScene3dViaFactory.#buildCircleShape(
            THREE,
            outerRadius
        )
        shape.holes.push(
            PcbScene3dViaFactory.#buildCirclePath(THREE, innerRadius)
        )

        const geometry = new THREE.ExtrudeGeometry(shape, {
            depth,
            bevelEnabled: false,
            curveSegments: 24,
            steps: 1
        })
        geometry.translate?.(0, 0, -depth / 2)
        return geometry
    }

    /**
     * Builds one filled circular shape centered on the origin.
     * @param {any} THREE
     * @param {number} radius
     * @returns {any}
     */
    static #buildCircleShape(THREE, radius) {
        const shape = new THREE.Shape()
        shape.moveTo(radius, 0)
        shape.absarc(0, 0, radius, 0, Math.PI, false)
        shape.absarc(0, 0, radius, Math.PI, Math.PI * 2, false)
        return shape
    }

    /**
     * Builds one circular hole path centered on the origin.
     * @param {any} THREE
     * @param {number} radius
     * @returns {any}
     */
    static #buildCirclePath(THREE, radius) {
        const path = new THREE.Path()
        path.moveTo(radius, 0)
        path.absarc(0, 0, radius, 0, Math.PI, false)
        path.absarc(0, 0, radius, Math.PI, Math.PI * 2, false)
        path.closePath()
        return path
    }
}
