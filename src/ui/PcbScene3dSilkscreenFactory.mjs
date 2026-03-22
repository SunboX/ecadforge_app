import { PcbArcUtils } from './PcbArcUtils.mjs'

/**
 * Builds documentation-layer silkscreen meshes for the 3D PCB view.
 */
export class PcbScene3dSilkscreenFactory {
    static #FILL_THICKNESS_MIL = 0.8
    static #FULL_CIRCLE_EPSILON = 0.001

    /**
     * Builds the combined top and bottom silkscreen group.
     * @param {any} THREE
     * @param {{ top?: { fills?: any[], tracks?: any[], arcs?: any[] }, bottom?: { fills?: any[], tracks?: any[], arcs?: any[] } }} silkscreen
     * @param {number} topZ
     * @param {number} bottomZ
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any}
     */
    static buildGroup(THREE, silkscreen, topZ, bottomZ, normalizeBoardPoint) {
        const group = new THREE.Group()
        const topGroup = PcbScene3dSilkscreenFactory.#buildSideGroup(
            THREE,
            silkscreen?.top,
            Math.abs(Number(topZ || 0)),
            normalizeBoardPoint,
            false
        )
        const bottomGroup = PcbScene3dSilkscreenFactory.#buildSideGroup(
            THREE,
            silkscreen?.bottom,
            Math.abs(Number(bottomZ || 0)),
            normalizeBoardPoint,
            true
        )

        if (topGroup.children.length) {
            group.add(topGroup)
        }
        if (bottomGroup.children.length) {
            group.add(bottomGroup)
        }

        return group
    }

    /**
     * Builds one side-specific silkscreen group.
     * @param {any} THREE
     * @param {{ fills?: any[], tracks?: any[], arcs?: any[] } | undefined} silkscreen
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any}
     */
    static #buildSideGroup(THREE, silkscreen, z, normalizeBoardPoint, mirrorY) {
        const group = new THREE.Group()
        const trackMesh = PcbScene3dSilkscreenFactory.#buildTrackMesh(
            THREE,
            silkscreen?.tracks || [],
            z,
            normalizeBoardPoint,
            mirrorY
        )
        const arcMesh = PcbScene3dSilkscreenFactory.#buildArcMesh(
            THREE,
            silkscreen?.arcs || [],
            z,
            normalizeBoardPoint,
            mirrorY
        )
        const fillMeshes = PcbScene3dSilkscreenFactory.#buildFillMeshes(
            THREE,
            silkscreen?.fills || [],
            z,
            normalizeBoardPoint,
            mirrorY
        )

        if (trackMesh) {
            group.add(trackMesh)
        }
        if (arcMesh) {
            group.add(arcMesh)
        }
        if (fillMeshes.length) {
            group.add(...fillMeshes)
        }
        if (mirrorY && group.children.length) {
            group.rotation.x = Math.PI
        }

        return group
    }

    /**
     * Builds one filled mesh for all stroke-style silkscreen tracks.
     * @param {any} THREE
     * @param {{ x1: number, y1: number, x2: number, y2: number, width?: number }[]} tracks
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any | null}
     */
    static #buildTrackMesh(THREE, tracks, z, normalizeBoardPoint, mirrorY) {
        const positions = []

        for (const track of tracks) {
            const start = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(track.x1 || 0),
                Number(track.y1 || 0),
                mirrorY
            )
            const end = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(track.x2 || 0),
                Number(track.y2 || 0),
                mirrorY
            )
            PcbScene3dSilkscreenFactory.#appendTrackTriangles(
                positions,
                start,
                end,
                Number(track.width || 0),
                z
            )
        }

        return PcbScene3dSilkscreenFactory.#buildStrokeMesh(
            THREE,
            positions
        )
    }

    /**
     * Builds one filled mesh for all stroke-style silkscreen arcs.
     * @param {any} THREE
     * @param {{ x: number, y: number, radius: number, startAngle: number, endAngle: number, width?: number }[]} arcs
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any | null}
     */
    static #buildArcMesh(THREE, arcs, z, normalizeBoardPoint, mirrorY) {
        const positions = []

        for (const arc of arcs) {
            const center = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(arc.x || 0),
                Number(arc.y || 0),
                mirrorY
            )
            PcbScene3dSilkscreenFactory.#appendArcTriangles(
                positions,
                center,
                arc,
                z,
                mirrorY
            )
        }

        return PcbScene3dSilkscreenFactory.#buildStrokeMesh(
            THREE,
            positions
        )
    }

    /**
     * Builds thin fill meshes for silkscreen solids.
     * @param {any} THREE
     * @param {{ x1: number, y1: number, x2: number, y2: number }[]} fills
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any[]}
     */
    static #buildFillMeshes(THREE, fills, z, normalizeBoardPoint, mirrorY) {
        const material = PcbScene3dSilkscreenFactory.#buildMaterial(THREE)

        return fills.map((fill) => {
            const center = PcbScene3dSilkscreenFactory.#normalizePoint(
                normalizeBoardPoint,
                (Number(fill.x1 || 0) + Number(fill.x2 || 0)) / 2,
                (Number(fill.y1 || 0) + Number(fill.y2 || 0)) / 2,
                mirrorY
            )
            const mesh = new THREE.Mesh(
                new THREE.BoxGeometry(
                    Math.max(Math.abs(Number(fill.x2 || 0) - Number(fill.x1 || 0)), 1),
                    Math.max(Math.abs(Number(fill.y2 || 0) - Number(fill.y1 || 0)), 1),
                    PcbScene3dSilkscreenFactory.#FILL_THICKNESS_MIL
                ),
                material
            )
            mesh.position.set(center.x, center.y, z)
            return mesh
        })
    }

    /**
     * Builds one white stroke mesh from triangle positions.
     * @param {any} THREE
     * @param {number[]} positions
     * @returns {any | null}
     */
    static #buildStrokeMesh(THREE, positions) {
        if (!positions.length) {
            return null
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        )

        return new THREE.Mesh(
            geometry,
            PcbScene3dSilkscreenFactory.#buildMaterial(THREE)
        )
    }

    /**
     * Builds one shared silkscreen material.
     * @param {any} THREE
     * @returns {any}
     */
    static #buildMaterial(THREE) {
        return new THREE.MeshBasicMaterial({
            color: 0xf8f6ef,
            transparent: true,
            opacity: 0.96,
            toneMapped: false,
            fog: false,
            side: THREE.DoubleSide
        })
    }

    /**
     * Appends one widened track quad as two triangles.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} start
     * @param {{ x: number, y: number }} end
     * @param {number} width
     * @param {number} z
     * @returns {void}
     */
    static #appendTrackTriangles(positions, start, end, width, z) {
        const dx = end.x - start.x
        const dy = end.y - start.y
        const length = Math.hypot(dx, dy)
        const halfWidth = Math.max(Number(width || 0), 1) / 2

        if (length <= 0.001) {
            const minX = start.x - halfWidth
            const maxX = start.x + halfWidth
            const minY = start.y - halfWidth
            const maxY = start.y + halfWidth

            PcbScene3dSilkscreenFactory.#appendQuadTriangles(
                positions,
                { x: minX, y: minY },
                { x: maxX, y: minY },
                { x: maxX, y: maxY },
                { x: minX, y: maxY },
                z
            )
            return
        }

        const normalX = (-dy / length) * halfWidth
        const normalY = (dx / length) * halfWidth

        PcbScene3dSilkscreenFactory.#appendQuadTriangles(
            positions,
            { x: start.x + normalX, y: start.y + normalY },
            { x: end.x + normalX, y: end.y + normalY },
            { x: end.x - normalX, y: end.y - normalY },
            { x: start.x - normalX, y: start.y - normalY },
            z
        )
    }

    /**
     * Appends one widened arc band as triangles.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} center
     * @param {{ radius?: number, width?: number, startAngle?: number, endAngle?: number }} arc
     * @param {number} z
     * @param {boolean} mirrorY
     * @returns {void}
     */
    static #appendArcTriangles(positions, center, arc, z, mirrorY) {
        const strokeWidth = Math.max(Number(arc.width || 0), 1)
        const radius = Math.max(Number(arc.radius || 0), strokeWidth / 2, 0.8)
        const outerRadius = radius + strokeWidth / 2
        const innerRadius = Math.max(radius - strokeWidth / 2, 0)
        const startAngleRad = (Number(arc.startAngle || 0) * Math.PI) / 180
        const deltaAngleDeg = PcbArcUtils.resolveSweepDelta(
            Number(arc.startAngle || 0),
            Number(arc.endAngle || 0)
        )
        const isFullCircle =
            Math.abs(deltaAngleDeg) <=
                PcbScene3dSilkscreenFactory.#FULL_CIRCLE_EPSILON ||
            Math.abs(deltaAngleDeg) >=
                360 - PcbScene3dSilkscreenFactory.#FULL_CIRCLE_EPSILON
        const deltaAngleRad = isFullCircle
            ? Math.PI * 2
            : (deltaAngleDeg * Math.PI) / 180
        const segments = Math.max(
            isFullCircle ? 20 : 8,
            Math.ceil((Math.abs(deltaAngleRad) / Math.PI) * 18)
            )
        const yDirection = mirrorY ? -1 : 1

        for (let index = 0; index < segments; index += 1) {
            const startAngle =
                startAngleRad + (deltaAngleRad * index) / segments
            const endAngle =
                startAngleRad + (deltaAngleRad * (index + 1)) / segments
            const outerStart = {
                x: center.x + Math.cos(startAngle) * outerRadius,
                y: center.y + Math.sin(startAngle) * outerRadius * yDirection
            }
            const outerEnd = {
                x: center.x + Math.cos(endAngle) * outerRadius,
                y: center.y + Math.sin(endAngle) * outerRadius * yDirection
            }

            if (innerRadius <= 0.001) {
                PcbScene3dSilkscreenFactory.#appendTriangle(
                    positions,
                    { x: center.x, y: center.y },
                    outerStart,
                    outerEnd,
                    z
                )
                continue
            }

            const innerStart = {
                x: center.x + Math.cos(startAngle) * innerRadius,
                y: center.y + Math.sin(startAngle) * innerRadius * yDirection
            }
            const innerEnd = {
                x: center.x + Math.cos(endAngle) * innerRadius,
                y: center.y + Math.sin(endAngle) * innerRadius * yDirection
            }

            PcbScene3dSilkscreenFactory.#appendQuadTriangles(
                positions,
                outerStart,
                outerEnd,
                innerEnd,
                innerStart,
                z
            )
        }
    }

    /**
     * Appends one rectangle as two triangles.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} a
     * @param {{ x: number, y: number }} b
     * @param {{ x: number, y: number }} c
     * @param {{ x: number, y: number }} d
     * @param {number} z
     * @returns {void}
     */
    static #appendQuadTriangles(positions, a, b, c, d, z) {
        PcbScene3dSilkscreenFactory.#appendTriangle(positions, a, b, c, z)
        PcbScene3dSilkscreenFactory.#appendTriangle(positions, a, c, d, z)
    }

    /**
     * Normalizes one board point and optionally mirrors it around the local
     * X axis so underside primitives keep their world position after the face
     * flip group rotates them below the board.
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
     * Appends one triangle into the position buffer.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} a
     * @param {{ x: number, y: number }} b
     * @param {{ x: number, y: number }} c
     * @param {number} z
     * @returns {void}
     */
    static #appendTriangle(positions, a, b, c, z) {
        positions.push(a.x, a.y, z, b.x, b.y, z, c.x, c.y, z)
    }
}
