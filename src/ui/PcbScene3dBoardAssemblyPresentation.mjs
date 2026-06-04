import { PcbScene3dBoardMaterialPalette } from './PcbScene3dBoardMaterialPalette.mjs'

/**
 * Applies display-only material adjustments to full-board assembly models.
 */
export class PcbScene3dBoardAssemblyPresentation {
    /** @type {number} */
    static #BOARD_COVER_AREA_RATIO = 0.15

    /** @type {number} */
    static #BOARD_COVER_LONG_SPAN_RATIO = 0.25

    /** @type {number} */
    static #COARSE_COVER_TRIANGLE_LIMIT = 36

    /**
     * Hides coarse board/shield surfaces in full-board assemblies so the
     * PCB-derived substrate, copper, and silkscreen remain the visual source.
     * @param {any} modelGroup Loaded board assembly group.
     * @param {{ widthMil?: number, heightMil?: number, thicknessMil?: number } | null | undefined} board Board dimensions.
     * @returns {void}
     */
    static apply(modelGroup, board) {
        const meshRecords =
            PcbScene3dBoardAssemblyPresentation.#collectMeshRecords(modelGroup)
        const boardBounds =
            PcbScene3dBoardAssemblyPresentation.#resolveBoardEnvelope(
                meshRecords,
                board
            )
        const surfaceColor =
            PcbScene3dBoardAssemblyPresentation.#resolveSurfaceColor(board)
        const importedSurfaceColor =
            PcbScene3dBoardAssemblyPresentation.#resolveImportedSurfaceColor(
                meshRecords
            )

        if (Number.isInteger(importedSurfaceColor)) {
            modelGroup.userData = modelGroup.userData || {}
            modelGroup.userData.scene3dBoardAssemblySurfaceColor =
                importedSurfaceColor
        }

        meshRecords.forEach((record) =>
            PcbScene3dBoardAssemblyPresentation.#applyMeshPresentation(
                record,
                boardBounds,
                surfaceColor
            )
        )
        PcbScene3dBoardAssemblyPresentation.#centerSubstrateOnBoardPlane(
            modelGroup,
            boardBounds
        )
    }

    /**
     * Resolves assembly meshes into presentation records.
     * @param {any} modelGroup Loaded board assembly group.
     * @returns {{ object: any, meshBounds: { minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, sizeX: number, sizeY: number, sizeZ: number }, materialKind: string, triangleCount: number }[]}
     */
    static #collectMeshRecords(modelGroup) {
        const records = []

        PcbScene3dBoardAssemblyPresentation.#traverseModelObjects(
            modelGroup,
            (object) => {
                if (!object?.material) {
                    return
                }

                const meshBounds =
                    PcbScene3dBoardAssemblyPresentation.#resolveMeshBoundsMil(
                        object
                    )
                if (!meshBounds) {
                    return
                }

                records.push({
                    object,
                    meshBounds,
                    materialKind:
                        PcbScene3dBoardAssemblyPresentation.#resolveMaterialKind(
                            object.material
                        ),
                    triangleCount:
                        PcbScene3dBoardAssemblyPresentation.#resolveTriangleCount(
                            object
                        )
                })
            }
        )

        return records
    }

    /**
     * Applies display treatment to one assembly mesh record.
     * @param {{ object: any, meshBounds: { minX: number, minY: number, maxX: number, maxY: number }, materialKind: string, triangleCount: number }} record Mesh record.
     * @param {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, widthMil: number, heightMil: number, areaMil: number } | null} boardBounds Board envelope.
     * @param {number} surfaceColor Board substrate color.
     * @returns {void}
     */
    static #applyMeshPresentation(record, boardBounds, surfaceColor) {
        if (record?.materialKind === 'board') {
            PcbScene3dBoardAssemblyPresentation.#applyMaterialColor(
                record.object?.material,
                surfaceColor
            )
            record.object.visible = true
            return
        }

        if (
            record?.materialKind === 'neutral' &&
            PcbScene3dBoardAssemblyPresentation.#isLargeBoardCoverMesh(
                record,
                boardBounds
            )
        ) {
            record.object.visible = false
        }
    }

    /**
     * Resolves the app-level substrate color for board assembly meshes.
     * @param {{ surfaceColor?: number } | null | undefined} board Board dimensions.
     * @returns {number}
     */
    static #resolveSurfaceColor(board) {
        return PcbScene3dBoardMaterialPalette.resolveSurfaceColor(board, {
            hasBoardAssemblyModel: true
        })
    }

    /**
     * Applies display treatment to board substrate material.
     * @param {any | any[]} material Material or material list.
     * @param {number} color Hex color.
     * @returns {void}
     */
    static #applyMaterialColor(material, color) {
        ;(Array.isArray(material) ? material : [material])
            .filter(Boolean)
            .forEach((entry) => {
                if (typeof entry.color?.setHex === 'function') {
                    entry.color.setHex(color)
                } else {
                    entry.color = color
                }
                entry.needsUpdate = true
            })
    }

    /**
     * Resolves the imported board-substrate color before display overrides.
     * @param {{ materialKind: string, object: { material?: any | any[] } }[]} meshRecords Mesh records.
     * @returns {number | null}
     */
    static #resolveImportedSurfaceColor(meshRecords) {
        const substrateRecord = (Array.isArray(meshRecords) ? meshRecords : [])
            .find((record) => record?.materialKind === 'board')

        return PcbScene3dBoardAssemblyPresentation.#resolveMaterialColor(
            substrateRecord?.object?.material
        )
    }

    /**
     * Resolves a material color as a numeric hex value.
     * @param {any | any[]} material Material or material list.
     * @returns {number | null}
     */
    static #resolveMaterialColor(material) {
        for (const entry of Array.isArray(material) ? material : [material]) {
            if (typeof entry?.color?.getHex === 'function') {
                return entry.color.getHex()
            }

            const numericColor = Number(entry?.color)
            if (Number.isInteger(numericColor)) {
                return numericColor
            }
        }

        return null
    }

    /**
     * Centers an imported substrate's Z span on the app board plane so ECAD
     * copper and silkscreen overlays sit on the physical board faces.
     * @param {{ position?: { z?: number }, userData?: Record<string, any> }} modelGroup Loaded board assembly group.
     * @param {{ minZ?: number, maxZ?: number } | null} boardBounds Board envelope.
     * @returns {void}
     */
    static #centerSubstrateOnBoardPlane(modelGroup, boardBounds) {
        const minZ = Number(boardBounds?.minZ)
        const maxZ = Number(boardBounds?.maxZ)

        if (
            !modelGroup?.position ||
            !Number.isFinite(minZ) ||
            !Number.isFinite(maxZ) ||
            !(maxZ > minZ)
        ) {
            return
        }

        const zOffset = -((minZ + maxZ) / 2)
        modelGroup.position.z = Number(modelGroup.position.z || 0) + zOffset
        modelGroup.userData = modelGroup.userData || {}
        modelGroup.userData.scene3dBoardAssemblyZOffsetMil = zOffset
    }

    /**
     * Resolves one mesh material into a coarse presentation category.
     * @param {any | any[]} material Source material.
     * @returns {string}
     */
    static #resolveMaterialKind(material) {
        const rgb = PcbScene3dBoardAssemblyPresentation.#resolveMaterialRgb(
            (Array.isArray(material) ? material[0] : material)?.color
        )
        if (!rgb) {
            return ''
        }

        const min = Math.min(rgb.r, rgb.g, rgb.b)
        const max = Math.max(rgb.r, rgb.g, rgb.b)
        const average = (rgb.r + rgb.g + rgb.b) / 3
        const isNeutral = max - min <= 0.08
        const isBoardGreen = rgb.g > rgb.r * 1.35 && rgb.g > rgb.b * 1.35

        if (isBoardGreen) {
            return 'board'
        }

        if (isNeutral && average >= 0.18 && average <= 0.82) {
            return 'neutral'
        }

        return ''
    }

    /**
     * Returns true for coarse board-cover surfaces that obscure PCB detail.
     * @param {{ meshBounds: { minX: number, minY: number, maxX: number, maxY: number, sizeX: number, sizeY: number }, triangleCount: number }} record Mesh record.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number, areaMil: number } | null} boardBounds Board envelope.
     * @returns {boolean}
     */
    static #isLargeBoardCoverMesh(record, boardBounds) {
        if (
            !PcbScene3dBoardAssemblyPresentation.#isMostlyInsideBoard(
                record?.meshBounds,
                boardBounds
            )
        ) {
            return false
        }

        const meshArea =
            Number(record.meshBounds.sizeX || 0) *
            Number(record.meshBounds.sizeY || 0)
        const boardArea = Number(boardBounds?.areaMil || 0)

        return (
            PcbScene3dBoardAssemblyPresentation.#hasLargeBoardCoverArea(
                meshArea,
                boardArea
            ) ||
            PcbScene3dBoardAssemblyPresentation.#isCoarseLongBoardCoverMesh(
                record,
                boardBounds
            )
        )
    }

    /**
     * Returns true when one footprint covers a broad board area.
     * @param {number} meshArea Mesh footprint area.
     * @param {number} boardArea Board footprint area.
     * @returns {boolean}
     */
    static #hasLargeBoardCoverArea(meshArea, boardArea) {
        return (
            boardArea > 0 &&
            meshArea / boardArea >=
                PcbScene3dBoardAssemblyPresentation.#BOARD_COVER_AREA_RATIO
        )
    }

    /**
     * Returns true for thin low-detail shield walls that span much of a board.
     * @param {{ meshBounds: { sizeX: number, sizeY: number }, triangleCount: number }} record Mesh record.
     * @param {{ widthMil: number, heightMil: number }} boardBounds Board envelope.
     * @returns {boolean}
     */
    static #isCoarseLongBoardCoverMesh(record, boardBounds) {
        const triangleCount = Number(record?.triangleCount || 0)
        if (
            triangleCount <= 0 ||
            triangleCount >
                PcbScene3dBoardAssemblyPresentation.#COARSE_COVER_TRIANGLE_LIMIT
        ) {
            return false
        }

        const xSpanRatio =
            Number(record?.meshBounds?.sizeX || 0) /
            Math.max(Number(boardBounds?.widthMil || 0), 1)
        const ySpanRatio =
            Number(record?.meshBounds?.sizeY || 0) /
            Math.max(Number(boardBounds?.heightMil || 0), 1)

        return (
            xSpanRatio >=
                PcbScene3dBoardAssemblyPresentation
                    .#BOARD_COVER_LONG_SPAN_RATIO ||
            ySpanRatio >=
                PcbScene3dBoardAssemblyPresentation.#BOARD_COVER_LONG_SPAN_RATIO
        )
    }

    /**
     * Resolves board dimensions into a bounded area descriptor.
     * @param {{ widthMil?: number, heightMil?: number, thicknessMil?: number } | null | undefined} board Board dimensions.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number, minZ: number, maxZ: number, areaMil: number } | null}
     */
    static #normalizeBoardBounds(board) {
        const widthMil = Number(board?.widthMil || 0)
        const heightMil = Number(board?.heightMil || 0)
        const thicknessMil = Number(board?.thicknessMil || 0)

        if (!(widthMil > 0) || !(heightMil > 0)) {
            return null
        }

        return {
            minX: 0,
            minY: 0,
            maxX: widthMil,
            maxY: heightMil,
            widthMil,
            heightMil,
            minZ: thicknessMil > 0 ? -thicknessMil / 2 : 0,
            maxZ: thicknessMil > 0 ? thicknessMil / 2 : 0,
            areaMil: widthMil * heightMil
        }
    }

    /**
     * Resolves the board envelope from assembly substrate meshes when present.
     * @param {{ meshBounds: { minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number }, materialKind: string }[]} meshRecords Mesh records.
     * @param {{ widthMil?: number, heightMil?: number, thicknessMil?: number } | null | undefined} board Board dimensions.
     * @returns {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, widthMil: number, heightMil: number, areaMil: number } | null}
     */
    static #resolveBoardEnvelope(meshRecords, board) {
        const substrateBounds = PcbScene3dBoardAssemblyPresentation.#unionBounds(
            (Array.isArray(meshRecords) ? meshRecords : [])
                .filter((record) => record.materialKind === 'board')
                .map((record) => record.meshBounds)
        )

        if (substrateBounds) {
            return substrateBounds
        }

        return PcbScene3dBoardAssemblyPresentation.#normalizeBoardBounds(board)
    }

    /**
     * Builds one combined bounds descriptor.
     * @param {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number }[]} boundsList Bounds list.
     * @returns {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, widthMil: number, heightMil: number, areaMil: number } | null}
     */
    static #unionBounds(boundsList) {
        if (!boundsList.length) {
            return null
        }

        const bounds = boundsList.reduce(
            (nextBounds, meshBounds) => ({
                minX: Math.min(nextBounds.minX, meshBounds.minX),
                minY: Math.min(nextBounds.minY, meshBounds.minY),
                minZ: Math.min(nextBounds.minZ, meshBounds.minZ),
                maxX: Math.max(nextBounds.maxX, meshBounds.maxX),
                maxY: Math.max(nextBounds.maxY, meshBounds.maxY),
                maxZ: Math.max(nextBounds.maxZ, meshBounds.maxZ)
            }),
            {
                minX: Number.POSITIVE_INFINITY,
                minY: Number.POSITIVE_INFINITY,
                minZ: Number.POSITIVE_INFINITY,
                maxX: Number.NEGATIVE_INFINITY,
                maxY: Number.NEGATIVE_INFINITY,
                maxZ: Number.NEGATIVE_INFINITY
            }
        )
        const widthMil = bounds.maxX - bounds.minX
        const heightMil = bounds.maxY - bounds.minY

        if (!(widthMil > 0) || !(heightMil > 0)) {
            return null
        }

        return {
            ...bounds,
            widthMil,
            heightMil,
            areaMil: widthMil * heightMil
        }
    }

    /**
     * Returns true when a mesh footprint is contained in the board envelope.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number }} meshBounds Mesh bounds.
     * @param {{ minX: number, minY: number, maxX: number, maxY: number, widthMil: number, heightMil: number } | null} boardBounds Board dimensions.
     * @returns {boolean}
     */
    static #isMostlyInsideBoard(meshBounds, boardBounds) {
        if (!meshBounds || !boardBounds) {
            return false
        }

        const toleranceX = boardBounds.widthMil * 0.05
        const toleranceY = boardBounds.heightMil * 0.05

        return (
            meshBounds.minX >= boardBounds.minX - toleranceX &&
            meshBounds.maxX <= boardBounds.maxX + toleranceX &&
            meshBounds.minY >= boardBounds.minY - toleranceY &&
            meshBounds.maxY <= boardBounds.maxY + toleranceY
        )
    }

    /**
     * Resolves a mesh's source geometry bounds in mil.
     * @param {any} object Render object.
     * @returns {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, sizeX: number, sizeY: number, sizeZ: number } | null}
     */
    static #resolveMeshBoundsMil(object) {
        const positions = object?.geometry?.attributes?.position?.array
        if (!positions?.length) {
            return null
        }

        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let minZ = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        let maxZ = Number.NEGATIVE_INFINITY

        for (let index = 0; index < positions.length; index += 3) {
            const x = Number(positions[index] || 0) * 1000
            const y = Number(positions[index + 1] || 0) * 1000
            const z = Number(positions[index + 2] || 0) * 1000

            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            minZ = Math.min(minZ, z)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
            maxZ = Math.max(maxZ, z)
        }

        if (
            !Number.isFinite(minX) ||
            !Number.isFinite(minY) ||
            !Number.isFinite(minZ) ||
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY) ||
            !Number.isFinite(maxZ)
        ) {
            return null
        }

        return {
            minX,
            minY,
            minZ,
            maxX,
            maxY,
            maxZ,
            sizeX: maxX - minX,
            sizeY: maxY - minY,
            sizeZ: maxZ - minZ
        }
    }

    /**
     * Resolves an approximate triangle count for one mesh.
     * @param {any} object Render object.
     * @returns {number}
     */
    static #resolveTriangleCount(object) {
        const indexCount =
            Number(object?.geometry?.index?.count) ||
            Number(object?.geometry?.index?.array?.length) ||
            0

        if (indexCount > 0) {
            return Math.floor(indexCount / 3)
        }

        return Math.floor(
            Number(object?.geometry?.attributes?.position?.count || 0) / 3
        )
    }

    /**
     * Resolves a material color into normalized RGB components.
     * @param {any} color Material color.
     * @returns {{ r: number, g: number, b: number } | null}
     */
    static #resolveMaterialRgb(color) {
        if (
            Number.isFinite(Number(color?.r)) &&
            Number.isFinite(Number(color?.g)) &&
            Number.isFinite(Number(color?.b))
        ) {
            return {
                r: Number(color.r),
                g: Number(color.g),
                b: Number(color.b)
            }
        }

        if (Number.isInteger(color)) {
            return {
                r: ((color >> 16) & 255) / 255,
                g: ((color >> 8) & 255) / 255,
                b: (color & 255) / 255
            }
        }

        return null
    }

    /**
     * Traverses a model object tree, including test doubles without `traverse`.
     * @param {any} root Root object.
     * @param {(object: any) => void} visitor Visitor callback.
     * @returns {void}
     */
    static #traverseModelObjects(root, visitor) {
        if (!root) {
            return
        }

        if (typeof root.traverse === 'function') {
            root.traverse(visitor)
            return
        }

        visitor(root)
        ;(Array.isArray(root.children) ? root.children : []).forEach((child) =>
            PcbScene3dBoardAssemblyPresentation.#traverseModelObjects(
                child,
                visitor
            )
        )
    }
}
