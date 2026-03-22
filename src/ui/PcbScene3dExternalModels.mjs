import { PcbScene3dMountRig } from './PcbScene3dMountRig.mjs'
import { PcbScene3dStepLoader } from './PcbScene3dStepLoader.mjs'

/**
 * Loads external 3D models into the Three.js PCB scene.
 */
export class PcbScene3dExternalModels {
    /**
     * Loads all available external models into the supplied group.
     * @param {{ three: any, sceneDescription: any, externalModelsGroup: any, isDisposed?: () => boolean, onPlacementGroup?: (placement: any, placementGroup: any) => void, stepLoader?: PcbScene3dStepLoader }} options
     * @returns {Promise<string[]>}
     */
    static async loadIntoScene(options) {
        const placements =
            PcbScene3dExternalModels.#resolvePlacements(
                options?.sceneDescription
            )
        const externalModelsGroup = options?.externalModelsGroup
        if (!placements.length || !externalModelsGroup || !options?.three) {
            return []
        }

        const diagnostics = []
        const ownsStepLoader = !options?.stepLoader
        const stepLoader = options?.stepLoader || new PcbScene3dStepLoader()

        try {
            for (const placement of placements) {
                try {
                    const loadedGroup =
                        await PcbScene3dExternalModels.#loadPlacementGroup(
                            options.three,
                            placement,
                            stepLoader
                        )
                    if (!loadedGroup || options?.isDisposed?.()) {
                        continue
                    }

                    externalModelsGroup.add(loadedGroup)
                    options?.onPlacementGroup?.(placement, loadedGroup)
                } catch (error) {
                    diagnostics.push(
                        'Could not load external model for ' +
                            String(placement?.designator || 'component') +
                            ': ' +
                            String(error?.message || error || 'Unknown error.')
                    )
                }
            }
        } finally {
            if (ownsStepLoader) {
                stepLoader.dispose?.()
            }
        }

        return diagnostics
    }

    /**
     * Resolves the external-model placements the runtime should render.
     * @param {{ components?: any[], externalPlacements?: any[] }} sceneDescription
     * @returns {any[]}
     */
    static #resolvePlacements(sceneDescription) {
        const explicitPlacements = Array.isArray(sceneDescription?.externalPlacements)
            ? sceneDescription.externalPlacements
            : []
        const explicitDesignators = new Set(
            explicitPlacements
                .map((placement) => String(placement?.designator || '').trim())
                .filter(Boolean)
        )
        const fallbackPlacements = Array.isArray(sceneDescription?.components)
            ? sceneDescription.components
                  .filter(
                      (component) =>
                          component?.externalModel &&
                          !explicitDesignators.has(
                              String(component?.designator || '').trim()
                          )
                  )
                  .map((component) =>
                      PcbScene3dExternalModels.#buildFallbackPlacement(component)
                  )
            : []

        return [...explicitPlacements, ...fallbackPlacements]
    }

    /**
     * Builds one legacy component placement into the explicit placement shape.
     * @param {{ designator?: string, mountSide?: string, rotationDeg?: number, positionMil?: { x?: number, y?: number, z?: number }, externalModel?: any }} component
     * @returns {any}
     */
    static #buildFallbackPlacement(component) {
        return {
            designator: String(component?.designator || 'component'),
            mountSide: String(component?.mountSide || 'top'),
            rotationDeg: Number(component?.rotationDeg || 0),
            positionMil: {
                x: Number(component?.positionMil?.x || 0),
                y: Number(component?.positionMil?.y || 0),
                z: Number(component?.positionMil?.z || 0)
            },
            bodyPositionMil: { x: 0, y: 0 },
            bodyRotationDeg: 0,
            modelTransform: {
                rotationDeg: { x: 0, y: 0, z: 0 },
                dzMil: 0
            },
            externalModel: component?.externalModel || null
        }
    }

    /**
     * Loads one model group for one resolved placement.
     * @param {any} THREE
     * @param {{ mountSide?: string, rotationDeg?: number, positionMil?: { x?: number, y?: number, z?: number }, modelTransform?: { rotationDeg?: { x?: number, y?: number, z?: number }, dzMil?: number }, externalModel?: any }} placement
     * @param {PcbScene3dStepLoader} stepLoader
     * @returns {Promise<any>}
     */
    static async #loadPlacementGroup(THREE, placement, stepLoader) {
        const model = placement?.externalModel
        if (!model) {
            throw new Error('Placement has no resolved model.')
        }

        let modelGroup
        if (model.format === 'wrl') {
            if (!model.file) {
                throw new Error('Resolved WRL model file is unavailable.')
            }

            modelGroup = await PcbScene3dExternalModels.#loadVrmlModel(model.file)
        } else if (model.format === 'step') {
            modelGroup = await PcbScene3dExternalModels.#loadStepModel(
                THREE,
                model,
                stepLoader
            )
        } else {
            throw new Error('Unsupported external model format.')
        }

        const mountRig = PcbScene3dMountRig.create(THREE, placement)
        const wrapperGroup = mountRig.rootGroup
        wrapperGroup.userData.scene3dSelection = {
            designator: String(placement?.designator || 'component'),
            sourceType: 'external-model'
        }
        const modelTransform = placement?.modelTransform || {}
        const modelRotation = modelTransform.rotationDeg || {}
        const dzMil = Number(modelTransform.dzMil || 0)
        modelGroup.position.z =
            String(placement?.mountSide || 'top').toLowerCase() === 'bottom'
                ? -dzMil
                : dzMil
        modelGroup.rotation.x =
            (Number(modelRotation.x || 0) * Math.PI) / 180
        modelGroup.rotation.y =
            (Number(modelRotation.y || 0) * Math.PI) / 180
        modelGroup.rotation.z =
            (Number(modelRotation.z || 0) * Math.PI) / 180
        mountRig.faceGroup.add(modelGroup)

        return wrapperGroup
    }

    /**
     * Loads one VRML model from a browser file.
     * @param {File | Blob} file
     * @returns {Promise<any>}
     */
    static async #loadVrmlModel(file) {
        const versionKey = new URL(import.meta.url).searchParams.get('v') || ''
        const [{ VRMLLoader }] = await Promise.all([
            import(
                '/vendor/three/examples/jsm/loaders/VRMLLoader.js' +
                    (versionKey ? '?v=' + encodeURIComponent(versionKey) : '')
            )
        ])
        const loader = new VRMLLoader()
        const objectUrl = URL.createObjectURL(file)

        try {
            return await new Promise((resolve, reject) => {
                loader.load(
                    objectUrl,
                    (loadedScene) => resolve(loadedScene),
                    undefined,
                    reject
                )
            })
        } finally {
            URL.revokeObjectURL(objectUrl)
        }
    }

    /**
     * Loads one STEP model and converts its meshes into Three objects.
     * @param {any} THREE
     * @param {any} model
     * @param {PcbScene3dStepLoader} stepLoader
     * @returns {Promise<any>}
     */
    static async #loadStepModel(THREE, model, stepLoader) {
        const loadedModel = Array.isArray(model?.preparedMeshPayloads)
            ? { meshPayloads: model.preparedMeshPayloads }
            : await stepLoader.loadModel(model)
        const group = new THREE.Group()
        group.scale.setScalar(1000)

        loadedModel.meshPayloads.forEach((meshPayload) => {
            const geometry = new THREE.BufferGeometry()
            geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(meshPayload.positions, 3)
            )
            geometry.setIndex(meshPayload.indices)

            if (meshPayload.normals.length) {
                geometry.setAttribute(
                    'normal',
                    new THREE.Float32BufferAttribute(meshPayload.normals, 3)
                )
            } else {
                geometry.computeVertexNormals()
            }
            geometry.computeBoundingSphere()

            const materials = PcbScene3dExternalModels.#buildStepMeshMaterials(
                THREE,
                geometry,
                meshPayload
            )
            const mesh = new THREE.Mesh(
                geometry,
                materials.length > 1 ? materials : materials[0]
            )
            group.add(mesh)
        })

        return group
    }

    /**
     * Builds the material set for one STEP mesh and assigns face-color groups
     * when the importer exposes them.
     * @param {any} THREE
     * @param {any} geometry
     * @param {{ color?: number[] | null, indices?: number[], faceColors?: { first: number, last: number, color: number[] | null }[] }} meshPayload
     * @returns {any[]}
     */
    static #buildStepMeshMaterials(THREE, geometry, meshPayload) {
        const defaultColor = PcbScene3dExternalModels.#resolveMeshColor(
            THREE,
            meshPayload?.color
        )
        const defaultMaterial =
            PcbScene3dExternalModels.#createStepMaterial(THREE, defaultColor)
        const faceColors = Array.isArray(meshPayload?.faceColors)
            ? meshPayload.faceColors.filter((faceColor) =>
                  PcbScene3dExternalModels.#isValidFaceColorRange(
                      faceColor,
                      meshPayload?.indices
                  )
              )
            : []

        if (!faceColors.length) {
            return [defaultMaterial]
        }

        const materials = [defaultMaterial]
        faceColors.forEach((faceColor) => {
            const resolvedColor =
                Array.isArray(faceColor?.color) && faceColor.color.length >= 3
                    ? PcbScene3dExternalModels.#resolveMeshColor(
                          THREE,
                          faceColor.color
                      )
                    : defaultColor

            materials.push(
                PcbScene3dExternalModels.#createStepMaterial(
                    THREE,
                    resolvedColor
                )
            )
        })

        PcbScene3dExternalModels.#applyFaceColorGroups(
            geometry,
            meshPayload?.indices || [],
            faceColors
        )

        return materials
    }

    /**
     * Creates one standard material for imported STEP geometry.
     * @param {any} THREE
     * @param {any} color
     * @returns {any}
     */
    static #createStepMaterial(THREE, color) {
        return new THREE.MeshStandardMaterial({
            color,
            roughness: 0.56,
            metalness: 0.14
        })
    }

    /**
     * Applies grouped material ranges for face-colored STEP triangles.
     * @param {any} geometry
     * @param {number[]} indices
     * @param {{ first: number, last: number }[]} faceColors
     * @returns {void}
     */
    static #applyFaceColorGroups(geometry, indices, faceColors) {
        const triangleCount = Math.floor((Array.isArray(indices) ? indices.length : 0) / 3)
        let triangleIndex = 0
        let faceColorIndex = 0

        while (triangleIndex < triangleCount) {
            const firstIndex = triangleIndex
            let lastIndex = triangleCount
            let materialIndex = 0

            if (faceColorIndex < faceColors.length) {
                const currentFaceColor = faceColors[faceColorIndex]

                if (triangleIndex < currentFaceColor.first) {
                    lastIndex = currentFaceColor.first
                } else {
                    lastIndex = Math.min(
                        currentFaceColor.last + 1,
                        triangleCount
                    )
                    materialIndex = faceColorIndex + 1
                    faceColorIndex += 1
                }
            }

            geometry.addGroup(
                firstIndex * 3,
                Math.max(lastIndex - firstIndex, 0) * 3,
                materialIndex
            )
            triangleIndex = lastIndex
        }
    }

    /**
     * Returns true when one face-color range overlaps valid triangle indices.
     * @param {{ first?: number, last?: number }} faceColor
     * @param {number[] | undefined} indices
     * @returns {boolean}
     */
    static #isValidFaceColorRange(faceColor, indices) {
        const first = Number(faceColor?.first)
        const last = Number(faceColor?.last)
        const triangleCount = Math.floor((Array.isArray(indices) ? indices.length : 0) / 3)

        return (
            Number.isInteger(first) &&
            Number.isInteger(last) &&
            first >= 0 &&
            last >= first &&
            first < triangleCount
        )
    }

    /**
     * Resolves one STEP mesh color into a Three-friendly color value.
     * @param {any} THREE
     * @param {number[] | null} color
     * @returns {any}
     */
    static #resolveMeshColor(THREE, color) {
        if (!Array.isArray(color) || color.length < 3) {
            return 0xc8c8c8
        }

        return new THREE.Color(
            Number(color[0] || 0),
            Number(color[1] || 0),
            Number(color[2] || 0)
        )
    }
}
