import { PcbArcUtils } from 'altium-toolkit/renderers'
import { PcbScene3dPadFactory } from './PcbScene3dPadFactory.mjs'
import { PcbScene3dCopperTextFactory } from './PcbScene3dCopperTextFactory.mjs'

/**
 * Builds copper-detail meshes for the interactive 3D PCB scene.
 */
export class PcbScene3dCopperFactory {
    static #TOP_COPPER_LAYER_ID = 1
    static #BOTTOM_COPPER_LAYER_ID = 32
    static #FULL_CIRCLE_EPSILON = 0.001
    static #ROUND_CAP_SEGMENTS = 16

    /**
     * Builds the combined top and bottom copper group.
     * @param {any} THREE
     * @param {{ tracks?: any[], arcs?: any[], pads?: any[], vias?: any[], copperTexts?: any[] }} detail
     * @param {number} topZ
     * @param {number} bottomZ
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @returns {any}
     */
    static buildGroup(THREE, detail, topZ, bottomZ, normalizeBoardPoint) {
        const group = new THREE.Group()
        const topGroup = PcbScene3dCopperFactory.#buildSideGroup(
            THREE,
            {
                tracks: PcbScene3dCopperFactory.#filterTracks(
                    detail?.tracks,
                    'top'
                ),
                arcs: PcbScene3dCopperFactory.#filterArcs(detail?.arcs, 'top'),
                pads: detail?.pads || [],
                vias: detail?.vias || [],
                copperTexts: detail?.copperTexts || []
            },
            Math.abs(Number(topZ || 0)),
            normalizeBoardPoint,
            false
        )
        const bottomGroup = PcbScene3dCopperFactory.#buildSideGroup(
            THREE,
            {
                tracks: PcbScene3dCopperFactory.#filterTracks(
                    detail?.tracks,
                    'bottom'
                ),
                arcs: PcbScene3dCopperFactory.#filterArcs(
                    detail?.arcs,
                    'bottom'
                ),
                pads: detail?.pads || [],
                vias: detail?.vias || [],
                copperTexts: detail?.copperTexts || []
            },
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
     * Builds one side-specific copper group.
     * @param {any} THREE
     * @param {{ tracks?: any[], arcs?: any[], pads?: any[], vias?: any[], copperTexts?: any[] }} detail
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any}
     */
    static #buildSideGroup(THREE, detail, z, normalizeBoardPoint, mirrorY) {
        const group = new THREE.Group()
        const trackMesh = PcbScene3dCopperFactory.#buildTrackMesh(
            THREE,
            detail?.tracks || [],
            z,
            normalizeBoardPoint,
            mirrorY
        )
        const arcMesh = PcbScene3dCopperFactory.#buildArcMesh(
            THREE,
            detail?.arcs || [],
            z,
            normalizeBoardPoint,
            mirrorY
        )
        const padGroup = PcbScene3dPadFactory.buildGroup(
            THREE,
            detail?.pads || [],
            z,
            normalizeBoardPoint,
            {
                side: mirrorY ? 'bottom' : 'top',
                mirrorY
            }
        )
        const textGroup = PcbScene3dCopperTextFactory.buildGroup(
            THREE,
            detail?.copperTexts || [],
            z + 0.25,
            normalizeBoardPoint,
            {
                side: mirrorY ? 'bottom' : 'top',
                mirrorY
            }
        )

        if (trackMesh) {
            group.add(trackMesh)
        }
        if (arcMesh) {
            group.add(arcMesh)
        }
        if (padGroup.children.length) {
            group.add(padGroup)
        }
        if (textGroup.children.length) {
            group.add(textGroup)
        }
        if (mirrorY && group.children.length) {
            group.rotation.x = Math.PI
        }

        return group
    }

    /**
     * Builds one widened copper-track mesh for one face.
     * @param {any} THREE
     * @param {{ x1?: number, y1?: number, x2?: number, y2?: number, width?: number }[]} tracks
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any | null}
     */
    static #buildTrackMesh(THREE, tracks, z, normalizeBoardPoint, mirrorY) {
        const positions = []

        for (const track of tracks) {
            const start = PcbScene3dCopperFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(track?.x1 || 0),
                Number(track?.y1 || 0),
                mirrorY
            )
            const end = PcbScene3dCopperFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(track?.x2 || 0),
                Number(track?.y2 || 0),
                mirrorY
            )
            PcbScene3dCopperFactory.#appendTrackTriangles(
                positions,
                start,
                end,
                Number(track?.width || 0),
                z
            )
        }

        return PcbScene3dCopperFactory.#buildStrokeMesh(THREE, positions)
    }

    /**
     * Builds one widened copper-arc mesh for one face.
     * @param {any} THREE
     * @param {{ x?: number, y?: number, radius?: number, startAngle?: number, endAngle?: number, width?: number }[]} arcs
     * @param {number} z
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeBoardPoint
     * @param {boolean} mirrorY
     * @returns {any | null}
     */
    static #buildArcMesh(THREE, arcs, z, normalizeBoardPoint, mirrorY) {
        const positions = []

        for (const arc of arcs) {
            const center = PcbScene3dCopperFactory.#normalizePoint(
                normalizeBoardPoint,
                Number(arc?.x || 0),
                Number(arc?.y || 0),
                mirrorY
            )
            PcbScene3dCopperFactory.#appendArcTriangles(
                positions,
                center,
                arc,
                z,
                mirrorY
            )
        }

        return PcbScene3dCopperFactory.#buildStrokeMesh(THREE, positions)
    }

    /**
     * Builds one copper stroke mesh from triangle positions.
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
        geometry.computeVertexNormals?.()

        return new THREE.Mesh(
            geometry,
            PcbScene3dCopperFactory.#buildMaterial(THREE)
        )
    }

    /**
     * Builds the shared copper material.
     * @param {any} THREE
     * @returns {any}
     */
    static #buildMaterial(THREE) {
        return new THREE.MeshStandardMaterial({
            color: 0xd9a61d,
            roughness: 0.38,
            metalness: 0.55,
            side: THREE.DoubleSide
        })
    }

    /**
     * Filters one track list to one outer copper face.
     * @param {any[] | undefined} tracks
     * @param {'top' | 'bottom'} side
     * @returns {any[]}
     */
    static #filterTracks(tracks, side) {
        return (tracks || []).filter((track) =>
            PcbScene3dCopperFactory.#matchesCopperLayer(track, side)
        )
    }

    /**
     * Filters one arc list to one outer copper face.
     * @param {any[] | undefined} arcs
     * @param {'top' | 'bottom'} side
     * @returns {any[]}
     */
    static #filterArcs(arcs, side) {
        return (arcs || []).filter((arc) =>
            PcbScene3dCopperFactory.#matchesCopperLayer(arc, side)
        )
    }

    /**
     * Returns true when one primitive belongs to the requested outer copper
     * face.
     * @param {{ layerId?: number, layerCode?: number }} primitive
     * @param {'top' | 'bottom'} side
     * @returns {boolean}
     */
    static #matchesCopperLayer(primitive, side) {
        const layerId = Number(
            primitive?.layerId ?? primitive?.layerCode ?? NaN
        )

        return side === 'bottom'
            ? layerId === PcbScene3dCopperFactory.#BOTTOM_COPPER_LAYER_ID
            : layerId === PcbScene3dCopperFactory.#TOP_COPPER_LAYER_ID
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

            PcbScene3dCopperFactory.#appendDiscTriangles(
                positions,
                { x: (minX + maxX) / 2, y: (minY + maxY) / 2 },
                halfWidth,
                z
            )
            return
        }

        const normalX = (-dy / length) * halfWidth
        const normalY = (dx / length) * halfWidth

        PcbScene3dCopperFactory.#appendQuadTriangles(
            positions,
            { x: start.x + normalX, y: start.y + normalY },
            { x: end.x + normalX, y: end.y + normalY },
            { x: end.x - normalX, y: end.y - normalY },
            { x: start.x - normalX, y: start.y - normalY },
            z
        )
        PcbScene3dCopperFactory.#appendDiscTriangles(
            positions,
            start,
            halfWidth,
            z
        )
        PcbScene3dCopperFactory.#appendDiscTriangles(
            positions,
            end,
            halfWidth,
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
        const strokeWidth = Math.max(Number(arc?.width || 0), 1)
        const radius = Math.max(Number(arc?.radius || 0), strokeWidth / 2, 0.8)
        const outerRadius = radius + strokeWidth / 2
        const innerRadius = Math.max(radius - strokeWidth / 2, 0)
        const startAngleRad = (Number(arc?.startAngle || 0) * Math.PI) / 180
        const deltaAngleDeg = PcbArcUtils.resolveSweepDelta(
            Number(arc?.startAngle || 0),
            Number(arc?.endAngle || 0)
        )
        const isFullCircle =
            Math.abs(deltaAngleDeg) <=
                PcbScene3dCopperFactory.#FULL_CIRCLE_EPSILON ||
            Math.abs(deltaAngleDeg) >=
                360 - PcbScene3dCopperFactory.#FULL_CIRCLE_EPSILON
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
                PcbScene3dCopperFactory.#appendTriangle(
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

            PcbScene3dCopperFactory.#appendQuadTriangles(
                positions,
                outerStart,
                outerEnd,
                innerEnd,
                innerStart,
                z
            )
        }

        if (!isFullCircle) {
            PcbScene3dCopperFactory.#appendDiscTriangles(
                positions,
                {
                    x: center.x + Math.cos(startAngleRad) * radius,
                    y: center.y + Math.sin(startAngleRad) * radius * yDirection
                },
                strokeWidth / 2,
                z
            )
            PcbScene3dCopperFactory.#appendDiscTriangles(
                positions,
                {
                    x:
                        center.x +
                        Math.cos(startAngleRad + deltaAngleRad) * radius,
                    y:
                        center.y +
                        Math.sin(startAngleRad + deltaAngleRad) *
                            radius *
                            yDirection
                },
                strokeWidth / 2,
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
        PcbScene3dCopperFactory.#appendTriangle(positions, a, b, c, z)
        PcbScene3dCopperFactory.#appendTriangle(positions, a, c, d, z)
    }

    /**
     * Appends one filled circle fan.
     * @param {number[]} positions
     * @param {{ x: number, y: number }} center
     * @param {number} radius
     * @param {number} z
     * @returns {void}
     */
    static #appendDiscTriangles(positions, center, radius, z) {
        const safeRadius = Math.max(Number(radius || 0), 0)
        if (safeRadius <= 0) {
            return
        }

        for (
            let index = 0;
            index < PcbScene3dCopperFactory.#ROUND_CAP_SEGMENTS;
            index += 1
        ) {
            const startAngle =
                (Math.PI * 2 * index) /
                PcbScene3dCopperFactory.#ROUND_CAP_SEGMENTS
            const endAngle =
                (Math.PI * 2 * (index + 1)) /
                PcbScene3dCopperFactory.#ROUND_CAP_SEGMENTS

            PcbScene3dCopperFactory.#appendTriangle(
                positions,
                center,
                {
                    x: center.x + Math.cos(startAngle) * safeRadius,
                    y: center.y + Math.sin(startAngle) * safeRadius
                },
                {
                    x: center.x + Math.cos(endAngle) * safeRadius,
                    y: center.y + Math.sin(endAngle) * safeRadius
                },
                z
            )
        }
    }

    /**
     * Normalizes one board point and optionally mirrors it around the local
     * X axis so underside copper keeps its world position after the face flip
     * rotates it below the board.
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
