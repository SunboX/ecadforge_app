import { PcbScene3dExternalModels } from '../../../node_modules/pcb-scene3d-viewer/src/PcbScene3dExternalModels.mjs'
import { PcbScene3dExternalModelLoadOrder } from '../../../node_modules/pcb-scene3d-viewer/src/PcbScene3dExternalModelLoadOrder.mjs'
import { PcbScene3dModelBounds } from '../../../node_modules/pcb-scene3d-viewer/src/PcbScene3dModelBounds.mjs'

/**
 * Scopes the shared viewer's generic model seating away from KiCad
 * source-origin authoritative scenes.
 */
export class PcbScene3dModelBoundsPatch {
    static #BELOW_ORIGIN_MIN_GAP_MIL = 1
    static #isApplied = false
    static #altiumLoadDepth = 0
    static #sourceOriginLoadDepth = 0
    static #originalLoadIntoScene = null
    static #originalSeatOnMountPlane = null
    static #altiumPlacementContexts = []
    static #CONTACT_PAD_MARGIN_MIL = 8
    static #CONTACT_PAD_MIN_VERTEX_COUNT = 6
    static #CONTACT_PAD_MIN_OFFSET_MIL = 5
    static #SUPPORT_BUCKET_MIL = 5
    static #ZERO_PLANE_MIN_DOMINANCE = 1.5

    /**
     * Applies the patch once for the current JavaScript realm.
     * @returns {void}
     */
    static apply() {
        if (PcbScene3dModelBoundsPatch.#isApplied) {
            return
        }

        PcbScene3dModelBoundsPatch.#originalLoadIntoScene =
            PcbScene3dExternalModels.loadIntoScene
        PcbScene3dModelBoundsPatch.#originalSeatOnMountPlane =
            PcbScene3dModelBounds.seatOnMountPlane

        PcbScene3dExternalModels.loadIntoScene =
            PcbScene3dModelBoundsPatch.#loadIntoScene
        PcbScene3dModelBounds.seatOnMountPlane =
            PcbScene3dModelBoundsPatch.#seatOnMountPlane
        PcbScene3dModelBoundsPatch.#isApplied = true
    }

    /**
     * Loads models while marking KiCad source-origin scenes as authoritative.
     * @param {object} options External model load options.
     * @returns {Promise<string[]>}
     */
    static async #loadIntoScene(options) {
        const sceneDescription = options?.sceneDescription

        if (PcbScene3dModelBoundsPatch.#isSourceOriginScene(sceneDescription)) {
            PcbScene3dModelBoundsPatch.#sourceOriginLoadDepth += 1
            try {
                return await PcbScene3dModelBoundsPatch.#originalLoadIntoScene.call(
                    PcbScene3dExternalModels,
                    options
                )
            } finally {
                PcbScene3dModelBoundsPatch.#sourceOriginLoadDepth -= 1
            }
        }

        if (!PcbScene3dModelBoundsPatch.#isAltiumScene(sceneDescription)) {
            return await PcbScene3dModelBoundsPatch.#originalLoadIntoScene.call(
                PcbScene3dExternalModels,
                options
            )
        }

        PcbScene3dModelBoundsPatch.#altiumLoadDepth += 1
        PcbScene3dModelBoundsPatch.#altiumPlacementContexts.push({
            index: 0,
            placements:
                PcbScene3dModelBoundsPatch.#resolveExternalPlacements(
                    sceneDescription
                )
        })
        try {
            return await PcbScene3dModelBoundsPatch.#originalLoadIntoScene.call(
                PcbScene3dExternalModels,
                options
            )
        } finally {
            PcbScene3dModelBoundsPatch.#altiumPlacementContexts.pop()
            PcbScene3dModelBoundsPatch.#altiumLoadDepth -= 1
        }
    }

    /**
     * Keeps generic seating active except while KiCad source-origin model
     * placement is loading.
     * @param {any} THREE Three.js namespace.
     * @param {any} modelGroup Loaded model group.
     * @returns {void}
     */
    static #seatOnMountPlane(THREE, modelGroup) {
        if (PcbScene3dModelBoundsPatch.#sourceOriginLoadDepth > 0) {
            return
        }

        PcbScene3dModelBoundsPatch.#originalSeatOnMountPlane.call(
            PcbScene3dModelBounds,
            THREE,
            modelGroup
        )

        const altiumPlacement =
            PcbScene3dModelBoundsPatch.#altiumLoadDepth > 0
                ? PcbScene3dModelBoundsPatch.#nextAltiumPlacement()
                : null

        if (PcbScene3dModelBoundsPatch.#altiumLoadDepth > 0) {
            if (
                PcbScene3dModelBoundsPatch.#preferContactPadPlane(
                    THREE,
                    modelGroup,
                    altiumPlacement
                )
            ) {
                return
            }

            PcbScene3dModelBoundsPatch.#preferDominantZeroBodyPlane(
                THREE,
                modelGroup
            )
        }
    }

    /**
     * Seats mixed connector bodies by the source vertices above their SMT pad
     * contacts when generic mesh planes would leave those contacts floating.
     * @param {any} THREE Three.js namespace.
     * @param {any} modelGroup Loaded model group.
     * @param {object | null} placement Current Altium placement.
     * @returns {boolean}
     */
    static #preferContactPadPlane(THREE, modelGroup, placement) {
        const pads =
            PcbScene3dModelBoundsPatch.#resolveContactPadsInModelFrame(
                placement
            )
        if (!pads.length || !modelGroup?.position) {
            return false
        }

        const values = PcbScene3dModelBoundsPatch.#collectContactPadVertexZ(
            THREE,
            modelGroup,
            pads
        )
        if (
            values.length <
            PcbScene3dModelBoundsPatch.#CONTACT_PAD_MIN_VERTEX_COUNT
        ) {
            return false
        }

        const contactPlane = Math.min(...values)
        if (
            !Number.isFinite(contactPlane) ||
            Math.abs(contactPlane) <
                PcbScene3dModelBoundsPatch.#CONTACT_PAD_MIN_OFFSET_MIL
        ) {
            return false
        }

        modelGroup.position.z = -contactPlane
        modelGroup.updateMatrixWorld?.(true)
        return true
    }

    /**
     * Collects model-local Z values whose XY locations overlap hinted SMT
     * contact pads.
     * @param {any} THREE Three.js namespace.
     * @param {any} modelGroup Loaded model group.
     * @param {{ x: number, y: number, radius: number }[]} pads Contact pads.
     * @returns {number[]}
     */
    static #collectContactPadVertexZ(THREE, modelGroup, pads) {
        if (!THREE?.Vector3 || typeof modelGroup?.traverse !== 'function') {
            return []
        }

        modelGroup.updateMatrixWorld?.(true)
        modelGroup.parent?.updateMatrixWorld?.(true)
        const currentZ = Number(modelGroup?.position?.z || 0)
        const parentInverse =
            THREE?.Matrix4 && modelGroup.parent?.matrixWorld
                ? new THREE.Matrix4()
                      .copy(modelGroup.parent.matrixWorld)
                      .invert()
                : null
        const vertex = new THREE.Vector3()
        const values = []

        modelGroup.traverse((object) => {
            const position = object?.geometry?.attributes?.position
            if (!position || !object?.matrixWorld) {
                return
            }

            for (
                let index = 0;
                index < Number(position.count || 0);
                index += 1
            ) {
                vertex.fromBufferAttribute(position, index)
                vertex.applyMatrix4(object.matrixWorld)
                if (parentInverse) {
                    vertex.applyMatrix4(parentInverse)
                }
                if (
                    PcbScene3dModelBoundsPatch.#isInsideContactPad(vertex, pads)
                ) {
                    values.push(vertex.z - currentZ)
                }
            }
        })

        return values.filter((value) => Number.isFinite(value))
    }

    /**
     * Checks whether one transformed vertex sits over any contact pad hint.
     * @param {{ x: number, y: number }} vertex Transformed vertex.
     * @param {{ x: number, y: number, radius: number }[]} pads Contact pads.
     * @returns {boolean}
     */
    static #isInsideContactPad(vertex, pads) {
        return pads.some((pad) => {
            const radius = Math.max(Number(pad?.radius || 0), 0)

            return (
                Math.abs(Number(vertex?.x || 0) - Number(pad?.x || 0)) <=
                    radius &&
                Math.abs(Number(vertex?.y || 0) - Number(pad?.y || 0)) <= radius
            )
        })
    }

    /**
     * Transforms board-local contact pad hints into the model frame used
     * before the placement wrapper's orientation groups are applied.
     * @param {object | null} placement Current Altium placement.
     * @returns {{ x: number, y: number, radius: number }[]}
     */
    static #resolveContactPadsInModelFrame(placement) {
        const pads = Array.isArray(placement?.modelTransform?.contactPadsMil)
            ? placement.modelTransform.contactPadsMil
            : []
        if (!pads.length) {
            return []
        }

        const position = placement?.positionMil || {}
        const rootX = Number(position.x || 0)
        const rootY = Number(position.y || 0)
        const sourceScaleY =
            String(placement?.externalModel?.origin || '').toLowerCase() ===
            'embedded'
                ? -1
                : 1
        const radians = (-Number(placement?.rotationDeg || 0) * Math.PI) / 180
        const cos = Math.cos(radians)
        const sin = Math.sin(radians)

        return pads
            .map((pad) => {
                const x = Number(pad?.x || 0) - rootX
                const y = (Number(pad?.y || 0) - rootY) / sourceScaleY

                return {
                    x: x * cos - y * sin,
                    y: x * sin + y * cos,
                    radius:
                        Math.max(
                            Number(pad?.width || 0),
                            Number(pad?.depth || 0)
                        ) /
                            2 +
                        PcbScene3dModelBoundsPatch.#CONTACT_PAD_MARGIN_MIL
                }
            })
            .filter(
                (pad) =>
                    Number.isFinite(pad.x) &&
                    Number.isFinite(pad.y) &&
                    Number.isFinite(pad.radius) &&
                    pad.radius > 0
            )
    }

    /**
     * Seats non-tilted Altium bodies on a dense source-origin body plane when
     * smaller lower tabs would otherwise be mistaken for the mount surface.
     * @param {any} THREE Three.js namespace.
     * @param {any} modelGroup Loaded model group.
     * @returns {void}
     */
    static #preferDominantZeroBodyPlane(THREE, modelGroup) {
        if (!modelGroup?.position) {
            return
        }

        const currentMountPlane = -Number(modelGroup.position.z || 0)
        if (
            !Number.isFinite(currentMountPlane) ||
            currentMountPlane >=
                -PcbScene3dModelBoundsPatch.#BELOW_ORIGIN_MIN_GAP_MIL
        ) {
            return
        }

        const values = PcbScene3dModelBoundsPatch.#collectTransformedVertexZ(
            THREE,
            modelGroup
        )
        const bucketCounts = PcbScene3dModelBoundsPatch.#buildZBuckets(values)
        const currentBucket =
            PcbScene3dModelBoundsPatch.#bucketZ(currentMountPlane)
        const currentCount = Number(bucketCounts.get(currentBucket) || 0)
        const zeroCount = Number(bucketCounts.get(0) || 0)

        if (
            currentCount <= 0 ||
            zeroCount <
                currentCount *
                    PcbScene3dModelBoundsPatch.#ZERO_PLANE_MIN_DOMINANCE
        ) {
            return
        }

        modelGroup.position.z = 0
        modelGroup.updateMatrixWorld?.(true)
    }

    /**
     * Collects transformed vertex Z values before the current group Z is
     * applied.
     * @param {any} THREE Three.js namespace.
     * @param {any} modelGroup Loaded model group.
     * @returns {number[]}
     */
    static #collectTransformedVertexZ(THREE, modelGroup) {
        if (!THREE?.Vector3 || typeof modelGroup?.traverse !== 'function') {
            return []
        }

        modelGroup.updateMatrixWorld?.(true)
        modelGroup.parent?.updateMatrixWorld?.(true)
        const currentZ = Number(modelGroup?.position?.z || 0)
        const parentInverse =
            THREE?.Matrix4 && modelGroup.parent?.matrixWorld
                ? new THREE.Matrix4()
                      .copy(modelGroup.parent.matrixWorld)
                      .invert()
                : null
        const vertex = new THREE.Vector3()
        const values = []

        modelGroup.traverse((object) => {
            const position = object?.geometry?.attributes?.position
            if (!position || !object?.matrixWorld) {
                return
            }

            for (
                let index = 0;
                index < Number(position.count || 0);
                index += 1
            ) {
                vertex.fromBufferAttribute(position, index)
                vertex.applyMatrix4(object.matrixWorld)
                if (parentInverse) {
                    vertex.applyMatrix4(parentInverse)
                }
                values.push(vertex.z - currentZ)
            }
        })

        return values.filter((value) => Number.isFinite(value))
    }

    /**
     * Buckets transformed Z values by the seating support resolution.
     * @param {number[]} values Z values.
     * @returns {Map<number, number>}
     */
    static #buildZBuckets(values) {
        const buckets = new Map()

        ;(Array.isArray(values) ? values : []).forEach((value) => {
            const bucket = PcbScene3dModelBoundsPatch.#bucketZ(value)
            buckets.set(bucket, (buckets.get(bucket) || 0) + 1)
        })

        return buckets
    }

    /**
     * Resolves one Z value to a support bucket.
     * @param {number} value Z value.
     * @returns {number}
     */
    static #bucketZ(value) {
        return (
            Math.round(
                Number(value || 0) /
                    PcbScene3dModelBoundsPatch.#SUPPORT_BUCKET_MIL
            ) * PcbScene3dModelBoundsPatch.#SUPPORT_BUCKET_MIL
        )
    }

    /**
     * Resolves external placements in the same broad order as the shared
     * loader so seat-time patches can inspect placement metadata.
     * @param {object} sceneDescription Scene description.
     * @returns {object[]}
     */
    static #resolveExternalPlacements(sceneDescription) {
        if (sceneDescription?.boardAssemblyModel) {
            return []
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
                      PcbScene3dModelBoundsPatch.#buildFallbackPlacement(
                          component
                      )
                  )
            : []

        return PcbScene3dExternalModelLoadOrder.sort([
            ...explicitPlacements,
            ...fallbackPlacements
        ])
    }

    /**
     * Builds the fallback placement shape used by the shared loader.
     * @param {object} component Scene component.
     * @returns {object}
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
            modelTransform: component?.modelTransform || {},
            externalModel: component?.externalModel || null
        }
    }

    /**
     * Returns the next Altium placement being seated.
     * @returns {object | null}
     */
    static #nextAltiumPlacement() {
        const context =
            PcbScene3dModelBoundsPatch.#altiumPlacementContexts.at(-1)
        if (!context) {
            return null
        }

        const placement = context.placements[context.index] || null
        context.index += 1
        return placement
    }

    /**
     * Checks whether one scene uses KiCad source-origin model placement.
     * @param {object} sceneDescription Scene description.
     * @returns {boolean}
     */
    static #isSourceOriginScene(sceneDescription) {
        const sourceFormat = String(sceneDescription?.sourceFormat || '')
            .trim()
            .toLowerCase()

        return (
            sourceFormat === 'kicad' ||
            sceneDescription?.coordinateSystem === 'kicad-3d-y-up'
        )
    }

    /**
     * Checks whether one scene was parsed from Altium sources.
     * @param {object} sceneDescription Scene description.
     * @returns {boolean}
     */
    static #isAltiumScene(sceneDescription) {
        return (
            String(sceneDescription?.sourceFormat || '')
                .trim()
                .toLowerCase() === 'altium'
        )
    }
}
