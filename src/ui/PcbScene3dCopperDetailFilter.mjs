/**
 * Filters 3D copper detail to match realistic solder-mask visibility.
 */
export class PcbScene3dCopperDetailFilter {
    /**
     * Resolves the copper detail that should be visible in the 3D viewport.
     * @param {object} sceneDescription 3D scene description.
     * @returns {object}
     */
    static resolve(sceneDescription) {
        const detail = sceneDescription?.detail || {}

        if (
            !PcbScene3dCopperDetailFilter.#usesRealisticMasking(
                sceneDescription
            )
        ) {
            return detail
        }

        return {
            ...detail,
            tracks: PcbScene3dCopperDetailFilter.#filterMaskOpenPrimitives(
                detail.tracks
            ),
            arcs: PcbScene3dCopperDetailFilter.#filterMaskOpenPrimitives(
                detail.arcs
            ),
            copperTexts: PcbScene3dCopperDetailFilter.#filterMaskOpenPrimitives(
                detail.copperTexts
            ),
            vias: PcbScene3dCopperDetailFilter.#filterExposedVias(detail.vias)
        }
    }

    /**
     * Checks whether standalone via annuli should be rendered.
     * @param {object} sceneDescription 3D scene description.
     * @returns {boolean}
     */
    static shouldRenderStandaloneVias(sceneDescription) {
        return !PcbScene3dCopperDetailFilter.#usesRealisticMasking(
            sceneDescription
        )
    }

    /**
     * Checks whether one scene should use solder-mask visibility.
     * @param {object} sceneDescription 3D scene description.
     * @returns {boolean}
     */
    static #usesRealisticMasking(sceneDescription) {
        const sourceFormat = String(sceneDescription?.sourceFormat || '')
            .trim()
            .toLowerCase()

        if (sourceFormat === 'altium' || sourceFormat === 'kicad') {
            return true
        }

        if (sceneDescription?.coordinateSystem === 'kicad-3d-y-up') {
            return true
        }

        return PcbScene3dCopperDetailFilter.#hasExplicitMaskMetadata(
            sceneDescription?.detail
        )
    }

    /**
     * Checks whether parsed copper detail carries explicit solder-mask data.
     * @param {object | undefined} detail Scene detail.
     * @returns {boolean}
     */
    static #hasExplicitMaskMetadata(detail) {
        return [
            detail?.tracks,
            detail?.arcs,
            detail?.copperTexts,
            detail?.vias,
            detail?.pads
        ].some((primitives) =>
            (primitives || []).some((primitive) =>
                PcbScene3dCopperDetailFilter.#hasMaskMetadata(primitive)
            )
        )
    }

    /**
     * Keeps copper primitives only when the source declares a mask opening.
     * @param {any[] | undefined} primitives Copper primitive list.
     * @returns {any[]}
     */
    static #filterMaskOpenPrimitives(primitives) {
        return (primitives || []).filter((primitive) =>
            PcbScene3dCopperDetailFilter.#hasMaskOpening(primitive)
        )
    }

    /**
     * Keeps vias only when they are explicitly not tented.
     * @param {any[] | undefined} vias Via list.
     * @returns {any[]}
     */
    static #filterExposedVias(vias) {
        return (vias || []).filter((via) => {
            return via?.isTentingTop === false || via?.isTentingBottom === false
        })
    }

    /**
     * Checks whether a copper primitive should break through solder mask.
     * @param {object} primitive Copper primitive.
     * @returns {boolean}
     */
    static #hasMaskOpening(primitive) {
        if (primitive?.hasSolderMask === true) {
            return true
        }

        if (primitive?.solderMaskOpening === true) {
            return true
        }

        return (
            Number.isFinite(Number(primitive?.solderMaskExpansion)) &&
            Number(primitive?.solderMaskExpansion) !== 0
        )
    }

    /**
     * Checks whether one primitive declares any solder-mask visibility field.
     * @param {object} primitive Copper primitive.
     * @returns {boolean}
     */
    static #hasMaskMetadata(primitive) {
        return [
            'hasSolderMask',
            'solderMaskOpening',
            'solderMaskExpansion',
            'hasTopSolderMaskOpening',
            'hasBottomSolderMaskOpening',
            'isTentingTop',
            'isTentingBottom'
        ].some((fieldName) =>
            Object.prototype.hasOwnProperty.call(primitive || {}, fieldName)
        )
    }
}
