import { KicadScene3dCopperTrackCutoutBuilder } from './KicadScene3dCopperTrackCutoutBuilder.mjs'
import { KicadScene3dPadShapeAdapter } from './KicadScene3dPadShapeAdapter.mjs'
import { KicadScene3dSilkscreenKeepoutAdapter } from './KicadScene3dSilkscreenKeepoutAdapter.mjs'
import { KicadScene3dSilkscreenSmoothingAdapter } from './KicadScene3dSilkscreenSmoothingAdapter.mjs'

const RENDER_TOP_COPPER_LAYER_ID = 1
const RENDER_BOTTOM_COPPER_LAYER_ID = 32
const RENDER_NON_OUTER_COPPER_LAYER_ID = -1

/**
 * Adapts KiCad scene detail to the shared 3D renderer contract.
 */
export class KicadScene3dCopperLayerAdapter {
    /**
     * Returns a scene description with KiCad outer routes mapped to renderer ids.
     * @param {object} sceneDescription KiCad 3D scene description.
     * @returns {object}
     */
    static apply(sceneDescription) {
        if (!KicadScene3dCopperLayerAdapter.#isKiCadScene(sceneDescription)) {
            return sceneDescription
        }

        const detail = sceneDescription?.detail || {}
        const mappedTracks = KicadScene3dCopperLayerAdapter.#mapPrimitives(
            Array.isArray(detail.tracks)
                ? detail.tracks
                : sceneDescription?.tracks
        )
        const pads = KicadScene3dPadShapeAdapter.apply(detail.pads)
        const tracks = KicadScene3dCopperTrackCutoutBuilder.splitTracks(
            mappedTracks,
            pads,
            detail.vias
        )
        const arcs = KicadScene3dCopperLayerAdapter.#mapPrimitives(detail.arcs)
        const silkscreen = KicadScene3dSilkscreenSmoothingAdapter.apply(
            KicadScene3dSilkscreenKeepoutAdapter.apply(
                detail.silkscreen,
                pads,
                detail.vias
            )
        )

        return {
            ...sceneDescription,
            pads,
            tracks,
            detail: {
                ...detail,
                pads,
                tracks,
                arcs,
                silkscreen
            }
        }
    }

    /**
     * Checks whether a scene uses KiCad route layer numbering.
     * @param {object} sceneDescription Scene description.
     * @returns {boolean}
     */
    static #isKiCadScene(sceneDescription) {
        return (
            String(sceneDescription?.sourceFormat || '')
                .trim()
                .toLowerCase() === 'kicad' ||
            sceneDescription?.coordinateSystem === 'kicad-3d-y-up'
        )
    }

    /**
     * Maps route primitives to the renderer's outer-copper layer ids.
     * @param {object[] | undefined} primitives Route primitive list.
     * @returns {object[]}
     */
    static #mapPrimitives(primitives) {
        return (primitives || []).map((primitive) =>
            KicadScene3dCopperLayerAdapter.#mapPrimitive(primitive)
        )
    }

    /**
     * Maps one route primitive while preserving its source KiCad layer id.
     * @param {object} primitive Route primitive.
     * @returns {object}
     */
    static #mapPrimitive(primitive) {
        const layerId =
            KicadScene3dCopperLayerAdapter.#resolveRendererLayerId(primitive)

        return {
            ...primitive,
            sourceLayerId:
                primitive?.sourceLayerId ?? primitive?.layerId ?? null,
            sourceLayerCode:
                primitive?.sourceLayerCode ?? primitive?.layerCode ?? null,
            layerId,
            layerCode: layerId
        }
    }

    /**
     * Resolves the renderer layer id for a KiCad route primitive.
     * @param {object} primitive Route primitive.
     * @returns {number}
     */
    static #resolveRendererLayerId(primitive) {
        if (KicadScene3dCopperLayerAdapter.#isFrontCopper(primitive)) {
            return RENDER_TOP_COPPER_LAYER_ID
        }

        if (KicadScene3dCopperLayerAdapter.#isBackCopper(primitive)) {
            return RENDER_BOTTOM_COPPER_LAYER_ID
        }

        return RENDER_NON_OUTER_COPPER_LAYER_ID
    }

    /**
     * Checks whether one route primitive belongs to KiCad front copper.
     * @param {object} primitive Route primitive.
     * @returns {boolean}
     */
    static #isFrontCopper(primitive) {
        const layerName = KicadScene3dCopperLayerAdapter.#layerName(primitive)
        if (layerName === 'F.CU') {
            return true
        }

        const side = KicadScene3dCopperLayerAdapter.#sideName(primitive)
        if (side === 'front' || side === 'top') {
            return true
        }

        return KicadScene3dCopperLayerAdapter.#sourceLayerId(primitive) === 0
    }

    /**
     * Checks whether one route primitive belongs to KiCad back copper.
     * @param {object} primitive Route primitive.
     * @returns {boolean}
     */
    static #isBackCopper(primitive) {
        const layerName = KicadScene3dCopperLayerAdapter.#layerName(primitive)
        if (layerName === 'B.CU') {
            return true
        }

        const side = KicadScene3dCopperLayerAdapter.#sideName(primitive)
        if (side === 'back' || side === 'bottom') {
            return true
        }

        return KicadScene3dCopperLayerAdapter.#sourceLayerId(primitive) === 31
    }

    /**
     * Resolves the original KiCad numeric layer id for one primitive.
     * @param {object} primitive Route primitive.
     * @returns {number | null}
     */
    static #sourceLayerId(primitive) {
        const value = primitive?.sourceLayerId ?? primitive?.layerId
        const layerId = Number(value)

        return Number.isFinite(layerId) ? layerId : null
    }

    /**
     * Resolves a normalized layer name.
     * @param {object} primitive Route primitive.
     * @returns {string}
     */
    static #layerName(primitive) {
        return String(primitive?.layer || primitive?.layerName || '')
            .trim()
            .toUpperCase()
    }

    /**
     * Resolves a normalized side name.
     * @param {object} primitive Route primitive.
     * @returns {string}
     */
    static #sideName(primitive) {
        return String(primitive?.side || primitive?.mountSide || '')
            .trim()
            .toLowerCase()
    }
}
