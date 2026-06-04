import { PcbScene3dBoardAssemblyPresentation } from './PcbScene3dBoardAssemblyPresentation.mjs'
import { PcbScene3dBoardAssemblyPlacement } from './PcbScene3dBoardAssemblyPlacement.mjs'
import { PcbScene3dExternalModelLoadOrder } from './PcbScene3dExternalModelLoadOrder.mjs'
import { PcbScene3dMountRig } from './PcbScene3dMountRig.mjs'
import { PcbScene3dStepLoader } from './PcbScene3dStepLoader.mjs'
import { PcbScene3dViewCompensation } from './PcbScene3dViewCompensation.mjs'

/**
 * Loads external 3D models into the Three.js PCB scene.
 */
export class PcbScene3dExternalModels {
    /**
     * Loads all available external models into the supplied group.
     * @param {{ three: any, sceneDescription: any, externalModelsGroup: any, modelViewScale?: { x?: number, y?: number, z?: number }, isDisposed?: () => boolean, onPlacementGroup?: (placement: any, placementGroup: any) => void, stepLoader?: PcbScene3dStepLoader }} options
     * @returns {Promise<string[]>}
     */
    static async loadIntoScene(options) {
        const placements = PcbScene3dExternalModelLoadOrder.sort(
            PcbScene3dExternalModels.#resolvePlacements(
                options?.sceneDescription
            )
        )
        const externalModelsGroup = options?.externalModelsGroup
        if (!placements.length || !externalModelsGroup || !options?.three) {
            return []
        }

        const diagnostics = []
        const ownsStepLoader = !options?.stepLoader
        const stepLoader = options?.stepLoader || new PcbScene3dStepLoader()
        const cachedModelGroups = new Map()
        let processedPlacements = 0

        try {
            for (const placement of placements) {
                if (options?.isDisposed?.()) {
                    break
                }

                try {
                    const loadedGroup =
                        await PcbScene3dExternalModels.#loadPlacementGroup(
                            options.three,
                            placement,
                            stepLoader,
                            cachedModelGroups,
                            options?.modelViewScale
                        )
                    if (!loadedGroup || options?.isDisposed?.()) {
                        continue
                    }

                    externalModelsGroup.add(loadedGroup)
                    options?.onPlacementGroup?.(placement, loadedGroup)
                    processedPlacements += 1
                    if (processedPlacements % 12 === 0) {
                        await PcbScene3dExternalModels.#yieldToMainThread()
                    }
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
     * Applies the active view mirror compensation to loaded model geometry.
     * @param {any} externalModelsGroup Root group containing placed models.
     * @param {{ x?: number, y?: number, z?: number } | null | undefined} viewScale Active scene view scale.
     * @returns {void}
     */
    static applyViewCompensation(externalModelsGroup, viewScale) {
        PcbScene3dViewCompensation.apply(externalModelsGroup, viewScale)
    }

    /**
     * Resolves the external-model placements the runtime should render.
     * @param {{ board?: { widthMil?: number, heightMil?: number, thicknessMil?: number }, boardAssemblyModel?: any, components?: any[], externalPlacements?: any[] }} sceneDescription
     * @returns {any[]}
     */
    static #resolvePlacements(sceneDescription) {
        const boardAssemblyPlacement =
            PcbScene3dBoardAssemblyPlacement.build(sceneDescription)
        if (boardAssemblyPlacement) {
            return [boardAssemblyPlacement]
        }

        const explicitPlacements = Array.isArray(
            sceneDescription?.externalPlacements
        )
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
                      PcbScene3dExternalModels.#buildFallbackPlacement(
                          component
                      )
                  )
            : []

        return [...explicitPlacements, ...fallbackPlacements]
    }

    /**
     * Builds one legacy component placement into the explicit placement shape.
     * @param {{ designator?: string, mountSide?: string, rotationDeg?: number, positionMil?: { x?: number, y?: number, z?: number }, modelTransform?: object, externalModel?: any }} component
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
            modelTransform: PcbScene3dExternalModels.#normalizeModelTransform(
                component?.modelTransform
            ),
            externalModel: component?.externalModel || null
        }
    }

    /**
     * Loads one model group for one resolved placement.
     * @param {any} THREE
     * @param {{ mountSide?: string, rotationDeg?: number, positionMil?: { x?: number, y?: number, z?: number }, modelTransform?: object, externalModel?: any }} placement
     * @param {PcbScene3dStepLoader} stepLoader
     * @param {Map<string, any>} cachedModelGroups
     * @param {{ x?: number, y?: number, z?: number } | null | undefined} modelViewScale Active scene view scale.
     * @returns {Promise<any>}
     */
    static async #loadPlacementGroup(
        THREE,
        placement,
        stepLoader,
        cachedModelGroups,
        modelViewScale
    ) {
        const model = placement?.externalModel
        if (!model) {
            throw new Error('Placement has no resolved model.')
        }

        const templateGroup =
            await PcbScene3dExternalModels.#loadCachedModelGroup(
                THREE,
                model,
                stepLoader,
                cachedModelGroups
            )

        return PcbScene3dExternalModels.#buildPlacementWrapper(
            THREE,
            placement,
            PcbScene3dExternalModels.#cloneModelGroup(templateGroup),
            modelViewScale
        )
    }

    /**
     * Loads or reuses one model template group for repeated placements that
     * resolve to the same source identity.
     * @param {any} THREE
     * @param {any} model
     * @param {PcbScene3dStepLoader} stepLoader
     * @param {Map<string, any>} cachedModelGroups
     * @returns {Promise<any>}
     */
    static async #loadCachedModelGroup(
        THREE,
        model,
        stepLoader,
        cachedModelGroups
    ) {
        const identity = PcbScene3dExternalModels.#resolveModelIdentity(model)
        if (cachedModelGroups.has(identity)) {
            return cachedModelGroups.get(identity)
        }

        const modelGroup = await PcbScene3dExternalModels.#loadModelGroup(
            THREE,
            model,
            stepLoader
        )
        cachedModelGroups.set(identity, modelGroup)

        return modelGroup
    }

    /**
     * Loads one raw model group without placement-specific mount transforms.
     * @param {any} THREE
     * @param {any} model
     * @param {PcbScene3dStepLoader} stepLoader
     * @returns {Promise<any>}
     */
    static async #loadModelGroup(THREE, model, stepLoader) {
        if (model.format === 'wrl') {
            if (!model.file) {
                throw new Error('Resolved WRL model file is unavailable.')
            }

            return PcbScene3dExternalModels.#loadVrmlModel(model.file)
        }

        if (model.format === 'step') {
            return PcbScene3dExternalModels.#loadStepModel(
                THREE,
                model,
                stepLoader
            )
        }

        throw new Error('Unsupported external model format.')
    }

    /**
     * Wraps one loaded model group in its placement-specific mount rig.
     * @param {any} THREE
     * @param {{ mountSide?: string, modelTransform?: object, designator?: string }} placement
     * @param {any} modelGroup
     * @param {{ x?: number, y?: number, z?: number } | null | undefined} modelViewScale Active scene view scale.
     * @returns {any}
     */
    static #buildPlacementWrapper(
        THREE,
        placement,
        modelGroup,
        modelViewScale
    ) {
        if (PcbScene3dExternalModels.#isBoardAssemblyPlacement(placement)) {
            return PcbScene3dExternalModels.#buildBoardAssemblyWrapper(
                THREE,
                placement,
                modelGroup
            )
        }

        const mountRig = PcbScene3dMountRig.create(THREE, placement)
        const wrapperGroup = mountRig.rootGroup
        const viewCompensationGroup = new THREE.Group()
        wrapperGroup.userData.scene3dSelection = {
            designator: String(placement?.designator || 'component'),
            sourceType: 'external-model'
        }
        viewCompensationGroup.userData.scene3dViewCompensation = true
        viewCompensationGroup.userData.scene3dSourceFrameScale =
            PcbScene3dExternalModels.#resolveSourceFrameScale(placement)
        viewCompensationGroup.userData.scene3dViewCompensationAxes =
            PcbScene3dExternalModels.#resolveViewCompensationAxes(placement)
        PcbScene3dViewCompensation.applyToGroup(
            viewCompensationGroup,
            modelViewScale
        )
        PcbScene3dExternalModels.#wrapPlacementOrientation(
            wrapperGroup,
            mountRig.orientationGroup,
            viewCompensationGroup
        )
        const modelTransform = placement?.modelTransform || {}
        const modelRotation = modelTransform.rotationDeg || {}
        const modelOffset =
            PcbScene3dExternalModels.#resolveModelOffset(modelTransform)
        const sourceOriginAdjustment =
            PcbScene3dExternalModels.#resolveEmbeddedSourceOriginAdjustment(
                placement,
                modelGroup,
                modelRotation
            )
        const adjustedModelRotation = {
            x:
                Number(modelRotation.x || 0) +
                sourceOriginAdjustment.rotationDeg.x,
            y:
                Number(modelRotation.y || 0) +
                sourceOriginAdjustment.rotationDeg.y,
            z:
                Number(modelRotation.z || 0) +
                sourceOriginAdjustment.rotationDeg.z
        }
        modelGroup.position.set(
            modelOffset.x + sourceOriginAdjustment.offset.x,
            modelOffset.y + sourceOriginAdjustment.offset.y,
            modelOffset.z + sourceOriginAdjustment.offset.z
        )
        PcbScene3dExternalModels.#applyModelRotation(
            THREE,
            modelGroup,
            adjustedModelRotation
        )
        PcbScene3dExternalModels.#applyModelScale(
            modelGroup,
            PcbScene3dExternalModels.#resolveModelScale(modelTransform)
        )
        mountRig.faceGroup.add(modelGroup)

        return wrapperGroup
    }

    /**
     * Wraps a full board assembly model in board-local scene coordinates.
     * @param {any} THREE
     * @param {{ positionMil?: { x?: number, y?: number, z?: number }, board?: { widthMil?: number, heightMil?: number, thicknessMil?: number } }} placement
     * @param {any} modelGroup
     * @returns {any}
     */
    static #buildBoardAssemblyWrapper(THREE, placement, modelGroup) {
        const wrapperGroup = new THREE.Group()
        const positionMil = placement?.positionMil || {}

        PcbScene3dBoardAssemblyPresentation.apply(modelGroup, placement?.board)
        wrapperGroup.position.set(
            Number(positionMil.x || 0),
            Number(positionMil.y || 0),
            Number(positionMil.z || 0)
        )
        wrapperGroup.userData.scene3dPlacementType = 'board-assembly'
        wrapperGroup.add(modelGroup)

        return wrapperGroup
    }

    /**
     * Checks whether one placement represents a full board assembly model.
     * @param {{ sourceType?: string, externalModel?: { origin?: string } }} placement
     * @returns {boolean}
     */
    static #isBoardAssemblyPlacement(placement) {
        return (
            String(placement?.sourceType || '').toLowerCase() ===
                'board-assembly' ||
            String(placement?.externalModel?.origin || '').toLowerCase() ===
                'board-assembly'
        )
    }

    /**
     * Places view compensation before footprint orientation so scene mirrors
     * cancel globally instead of reflecting each rotated model locally.
     * @param {any} wrapperGroup Placement root group.
     * @param {any} orientationGroup Placement orientation group.
     * @param {any} viewCompensationGroup View compensation group.
     * @returns {void}
     */
    static #wrapPlacementOrientation(
        wrapperGroup,
        orientationGroup,
        viewCompensationGroup
    ) {
        if (
            typeof wrapperGroup?.remove === 'function' &&
            typeof wrapperGroup?.add === 'function'
        ) {
            wrapperGroup.remove(orientationGroup)
            wrapperGroup.add(viewCompensationGroup)
        } else if (Array.isArray(wrapperGroup?.children)) {
            const orientationIndex = wrapperGroup.children.indexOf(
                orientationGroup
            )
            if (orientationIndex !== -1) {
                wrapperGroup.children.splice(
                    orientationIndex,
                    1,
                    viewCompensationGroup
                )
            }
        }

        viewCompensationGroup.add(orientationGroup)
    }

    /**
     * Resolves the model source-frame scale applied before footprint rotation.
     * @param {{ externalModel?: { origin?: string } }} placement Placement metadata.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveSourceFrameScale(placement) {
        if (!PcbScene3dExternalModels.#isEmbeddedExternalModel(placement)) {
            return { x: 1, y: 1, z: 1 }
        }

        return { x: 1, y: -1, z: 1 }
    }

    /**
     * Resolves view compensation axes for one placement wrapper.
     * @param {{ externalModel?: { origin?: string } }} placement Placement metadata.
     * @returns {{ x?: boolean, y?: boolean, z?: boolean }}
     */
    static #resolveViewCompensationAxes(placement) {
        if (!PcbScene3dExternalModels.#isEmbeddedExternalModel(placement)) {
            return {}
        }

        return { x: false, y: false, z: false }
    }

    /**
     * Checks whether a placement uses an embedded Altium model source frame.
     * @param {{ externalModel?: { origin?: string } }} placement Placement metadata.
     * @returns {boolean}
     */
    static #isEmbeddedExternalModel(placement) {
        return (
            String(placement?.externalModel?.origin || '').toLowerCase() ===
            'embedded'
        )
    }

    /**
     * Adjusts embedded Altium models whose source geometry is authored with a
     * strong Z-origin bias. A signed X tilt lays those models flat correctly,
     * but source Z becomes lateral board Y. Strongly asymmetric source centers
     * also need an in-plane flip while preserving the body-origin offset
     * already encoded by the source geometry.
     * @param {{ externalModel?: { origin?: string } }} placement Placement metadata.
     * @param {{ userData?: { scene3dSourceBoundsMil?: { centerX?: number, centerZ?: number, sizeX?: number, sizeY?: number, sizeZ?: number } } }} modelGroup Loaded model group.
     * @param {{ x?: number }} modelRotation Model-local rotation.
     * @returns {{ offset: { x: number, y: number, z: number }, rotationDeg: { x: number, y: number, z: number } }}
     */
    static #resolveEmbeddedSourceOriginAdjustment(
        placement,
        modelGroup,
        modelRotation
    ) {
        const bounds = modelGroup?.userData?.scene3dSourceBoundsMil || null
        const centerX = Number(bounds?.centerX || 0)
        const centerZ = Number(bounds?.centerZ || 0)
        const maxDimension = Math.max(
            Math.abs(Number(bounds?.sizeX || 0)),
            Math.abs(Number(bounds?.sizeY || 0)),
            Math.abs(Number(bounds?.sizeZ || 0))
        )

        if (
            String(placement?.externalModel?.origin || '').toLowerCase() !==
                'embedded' ||
            PcbScene3dExternalModels.#normalizeAngle(modelRotation?.x) !==
                270 ||
            !Number.isFinite(centerX) ||
            !Number.isFinite(centerZ) ||
            !Number.isFinite(maxDimension) ||
            maxDimension <= 0 ||
            Math.abs(centerZ) <= maxDimension * 0.2
        ) {
            return PcbScene3dExternalModels.#emptySourceOriginAdjustment()
        }

        if (Math.abs(centerX) > maxDimension * 0.2) {
            return {
                offset: { x: 0, y: 0, z: 0 },
                rotationDeg: { x: 0, y: 0, z: 180 }
            }
        }

        return {
            offset: { x: 0, y: centerZ * 2, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 }
        }
    }

    /**
     * Returns the neutral embedded-source adjustment shape.
     * @returns {{ offset: { x: number, y: number, z: number }, rotationDeg: { x: number, y: number, z: number } }}
     */
    static #emptySourceOriginAdjustment() {
        return {
            offset: { x: 0, y: 0, z: 0 },
            rotationDeg: { x: 0, y: 0, z: 0 }
        }
    }

    /**
     * Normalizes one angle into [0, 360).
     * @param {number | string | undefined} angle Source angle.
     * @returns {number}
     */
    static #normalizeAngle(angle) {
        const normalized = Number(angle || 0) % 360

        return normalized < 0 ? normalized + 360 : normalized
    }

    /**
     * Applies KiCad's 3D model rotation order to one loaded model group.
     * @param {any} THREE Three.js namespace.
     * @param {any} modelGroup Loaded model group.
     * @param {{ x?: number, y?: number, z?: number }} modelRotation Model rotation.
     * @returns {void}
     */
    static #applyModelRotation(THREE, modelGroup, modelRotation) {
        const x = (-Number(modelRotation.x || 0) * Math.PI) / 180
        const y = (-Number(modelRotation.y || 0) * Math.PI) / 180
        const z = (-Number(modelRotation.z || 0) * Math.PI) / 180

        if (THREE?.Matrix4 && modelGroup?.quaternion?.setFromRotationMatrix) {
            const rotationMatrix = new THREE.Matrix4()
                .makeRotationZ(z)
                .multiply(new THREE.Matrix4().makeRotationY(y))
                .multiply(new THREE.Matrix4().makeRotationX(x))

            modelGroup.quaternion.setFromRotationMatrix(rotationMatrix)
            return
        }

        if (!modelGroup?.rotation) {
            return
        }

        modelGroup.rotation.x = x
        modelGroup.rotation.y = y
        modelGroup.rotation.z = z
    }

    /**
     * Normalizes optional model transform metadata.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {{ rotationDeg: { x: number, y: number, z: number }, offsetMil: { x: number, y: number, z: number }, dxMil: number, dyMil: number, dzMil: number, scale: { x: number, y: number, z: number } }}
     */
    static #normalizeModelTransform(modelTransform) {
        const offsetMil =
            PcbScene3dExternalModels.#resolveModelOffset(modelTransform)

        return {
            rotationDeg: {
                x: Number(modelTransform?.rotationDeg?.x || 0),
                y: Number(modelTransform?.rotationDeg?.y || 0),
                z: Number(modelTransform?.rotationDeg?.z || 0)
            },
            offsetMil,
            dxMil: offsetMil.x,
            dyMil: offsetMil.y,
            dzMil: offsetMil.z,
            scale: PcbScene3dExternalModels.#resolveModelScale(modelTransform)
        }
    }

    /**
     * Resolves model offset from current and legacy transform shapes.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveModelOffset(modelTransform) {
        const offsetMil = modelTransform?.offsetMil || {}

        return {
            x: Number(offsetMil.x ?? modelTransform?.dxMil ?? 0),
            y: Number(offsetMil.y ?? modelTransform?.dyMil ?? 0),
            z: Number(offsetMil.z ?? modelTransform?.dzMil ?? 0)
        }
    }

    /**
     * Resolves model scale from current and legacy transform shapes.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {{ x: number, y: number, z: number }}
     */
    static #resolveModelScale(modelTransform) {
        const scale = modelTransform?.scale || {}

        return {
            x: Number(scale.x ?? 1) || 1,
            y: Number(scale.y ?? 1) || 1,
            z: Number(scale.z ?? 1) || 1
        }
    }

    /**
     * Applies model scale while preserving importer unit conversion already on
     * the loaded group.
     * @param {any} modelGroup Loaded model group.
     * @param {{ x: number, y: number, z: number }} scale Placement scale.
     * @returns {void}
     */
    static #applyModelScale(modelGroup, scale) {
        if (!modelGroup?.scale) {
            return
        }

        modelGroup.scale.x *= scale.x
        modelGroup.scale.y *= scale.y
        modelGroup.scale.z *= scale.z
    }

    /**
     * Clones one cached model template so per-placement transforms do not
     * mutate the shared base geometry.
     * @param {any} modelGroup
     * @returns {any}
     */
    static #cloneModelGroup(modelGroup) {
        if (typeof modelGroup?.clone === 'function') {
            return modelGroup.clone(true)
        }

        return modelGroup
    }

    /**
     * Resolves one stable cache key for repeated placements of the same model.
     * @param {{ origin?: string, sourceStream?: string, relativePath?: string, name?: string, checksum?: number | null, format?: string }} model
     * @returns {string}
     */
    static #resolveModelIdentity(model) {
        if (String(model?.origin || '') === 'embedded') {
            return [
                'embedded',
                String(model?.sourceStream || ''),
                String(model?.name || ''),
                String(model?.checksum || ''),
                String(model?.format || '')
            ].join('::')
        }

        return [
            'session',
            String(model?.relativePath || ''),
            String(model?.name || ''),
            String(model?.format || '')
        ].join('::')
    }

    /**
     * Yields control back to the browser during long model-placement runs so
     * large boards do not monopolize the main thread.
     * @returns {Promise<void>}
     */
    static async #yieldToMainThread() {
        if (typeof requestAnimationFrame === 'function') {
            await new Promise((resolve) => {
                requestAnimationFrame(() => resolve())
            })
            return
        }

        await new Promise((resolve) => {
            setTimeout(resolve, 0)
        })
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
                '/node_modules/three/examples/jsm/loaders/VRMLLoader.js' +
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
        const sourceBounds =
            PcbScene3dExternalModels.#measureSourceBoundsMil(
                loadedModel.meshPayloads
            )
        group.scale.setScalar(1000)
        if (sourceBounds) {
            group.userData.scene3dSourceBoundsMil = sourceBounds
        }

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
     * Measures raw STEP mesh bounds in mil before the group-level unit scale is
     * applied.
     * @param {{ positions?: number[] }[]} meshPayloads STEP mesh payloads.
     * @returns {{ minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number, centerX: number, centerY: number, centerZ: number, sizeX: number, sizeY: number, sizeZ: number } | null}
     */
    static #measureSourceBoundsMil(meshPayloads) {
        let minX = Number.POSITIVE_INFINITY
        let minY = Number.POSITIVE_INFINITY
        let minZ = Number.POSITIVE_INFINITY
        let maxX = Number.NEGATIVE_INFINITY
        let maxY = Number.NEGATIVE_INFINITY
        let maxZ = Number.NEGATIVE_INFINITY

        ;(Array.isArray(meshPayloads) ? meshPayloads : []).forEach(
            (meshPayload) => {
                ;(Array.isArray(meshPayload?.positions)
                    ? meshPayload.positions
                    : []
                ).forEach((value, index) => {
                    const numericValue = Number(value || 0) * 1000

                    if (index % 3 === 0) {
                        minX = Math.min(minX, numericValue)
                        maxX = Math.max(maxX, numericValue)
                    } else if (index % 3 === 1) {
                        minY = Math.min(minY, numericValue)
                        maxY = Math.max(maxY, numericValue)
                    } else {
                        minZ = Math.min(minZ, numericValue)
                        maxZ = Math.max(maxZ, numericValue)
                    }
                })
            }
        )

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
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2,
            centerZ: (minZ + maxZ) / 2,
            sizeX: maxX - minX,
            sizeY: maxY - minY,
            sizeZ: maxZ - minZ
        }
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
        const defaultMaterial = PcbScene3dExternalModels.#createStepMaterial(
            THREE,
            defaultColor
        )
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
        const triangleCount = Math.floor(
            (Array.isArray(indices) ? indices.length : 0) / 3
        )
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
        const triangleCount = Math.floor(
            (Array.isArray(indices) ? indices.length : 0) / 3
        )

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
            Number(color[0] || 0), Number(color[1] || 0), Number(color[2] || 0)
        )
    }
}
