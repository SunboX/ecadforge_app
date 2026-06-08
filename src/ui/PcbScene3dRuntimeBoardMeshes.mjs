import { PcbScene3dBoardMaterialPalette } from './PcbScene3dBoardMaterialPalette.mjs'
import { PcbScene3dBoardShapeFactory } from './PcbScene3dBoardShapeFactory.mjs'

/**
 * Builds generated board meshes used by the interactive 3D runtime.
 */
export class PcbScene3dRuntimeBoardMeshes {
    /**
     * Builds the extruded board body mesh.
     * @param {any} THREE Three.js namespace.
     * @param {{ board?: any, detail?: any, boardAssemblyModel?: any }} sceneDescription Scene metadata.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeDetailPoint Detail coordinate normalizer.
     * @returns {any}
     */
    static buildBoardMesh(THREE, sceneDescription, normalizeDetailPoint) {
        const board = sceneDescription.board
        const geometry = PcbScene3dBoardShapeFactory.buildGeometry(
            THREE,
            board,
            sceneDescription.detail,
            normalizeDetailPoint
        )
        const hasBoardAssemblyModel = Boolean(
            sceneDescription.boardAssemblyModel
        )
        const generatedBodyVisible =
            PcbScene3dBoardMaterialPalette.isGeneratedBodyVisible({
                hasBoardAssemblyModel
            })
        const materialOptions = {
            roughness: 0.68,
            metalness: 0.08,
            visible: generatedBodyVisible
        }
        const edgeColor = Number(board.edgeColor)
        const resolvedEdgeColor = Number.isInteger(edgeColor)
            ? edgeColor
            : 0xc9ca78
        const surfaceColor = hasBoardAssemblyModel
            ? resolvedEdgeColor
            : PcbScene3dBoardMaterialPalette.resolveSurfaceColor(board, {
                  hasBoardAssemblyModel
              })

        return new THREE.Mesh(geometry, [
            new THREE.MeshStandardMaterial({
                ...materialOptions,
                color: surfaceColor,
                side: THREE.FrontSide
            }),
            new THREE.MeshStandardMaterial({
                ...materialOptions,
                color: resolvedEdgeColor,
                side: THREE.DoubleSide
            }),
            new THREE.MeshStandardMaterial({
                color: 0xd9a61d,
                roughness: 0.38,
                metalness: 0.55,
                visible: generatedBodyVisible,
                side: THREE.DoubleSide
            })
        ])
    }

    /**
     * Builds a line outline around the board edge.
     * @param {any} THREE Three.js namespace.
     * @param {{ board?: any, detail?: any }} sceneDescription Scene metadata.
     * @param {(x: number, y: number) => { x: number, y: number }} normalizeDetailPoint Detail coordinate normalizer.
     * @returns {any}
     */
    static buildBoardOutline(THREE, sceneDescription, normalizeDetailPoint) {
        const shape = PcbScene3dBoardShapeFactory.buildShape(
            THREE,
            sceneDescription.board,
            sceneDescription.detail,
            normalizeDetailPoint
        )
        const points = shape.getPoints(120)
        const positions = []
        const topZ = sceneDescription.board.thicknessMil / 2 + 0.8

        points.forEach((point) => {
            positions.push(point.x, point.y, topZ)
        })

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute(
            'position',
            new THREE.Float32BufferAttribute(positions, 3)
        )

        return new THREE.LineLoop(
            geometry,
            new THREE.LineBasicMaterial({ color: 0xc9ca78, transparent: true })
        )
    }
}
