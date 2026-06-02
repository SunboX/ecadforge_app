import { PcbScene3dDrillPathFactory } from './PcbScene3dDrillPathFactory.mjs'

/**
 * Builds annular via barrels for the interactive 3D PCB scene.
 */
export class PcbScene3dViaFactory {
    /**
     * Builds the via mesh group for one scene.
     * @param {any} THREE
     * @param {{ diameter?: number, holeDiameter?: number, x?: number, y?: number }[]} vias
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
     * @param {{ diameter?: number, holeDiameter?: number }} via
     * @param {number} thicknessMil
     * @returns {any}
     */
    static #resolveGeometry(THREE, geometryCache, via, thicknessMil) {
        const outerRadius = Math.max(Number(via?.diameter || 0) / 2, 1.2)
        const holeDiameter = Math.max(Number(via?.holeDiameter || 0), 0)
        const depth = thicknessMil + 2
        const cacheKey = [
            outerRadius.toFixed(4),
            holeDiameter.toFixed(4),
            depth.toFixed(4)
        ].join(':')
        const cached = geometryCache.get(cacheKey)
        if (cached) {
            return cached
        }

        let geometry
        if (holeDiameter > 0 && holeDiameter < outerRadius * 2 - 0.001) {
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
}
