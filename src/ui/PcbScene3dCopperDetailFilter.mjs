/**
 * Filters 3D copper detail to match realistic KiCad solder-mask visibility.
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
            !PcbScene3dCopperDetailFilter.#usesKiCadRealisticMasking(
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
        return !PcbScene3dCopperDetailFilter.#usesKiCadRealisticMasking(
            sceneDescription
        )
    }

    /**
     * Checks whether one scene should use KiCad solder-mask visibility.
     * @param {object} sceneDescription 3D scene description.
     * @returns {boolean}
     */
    static #usesKiCadRealisticMasking(sceneDescription) {
        return (
            String(sceneDescription?.sourceFormat || '').toLowerCase() ===
                'kicad' ||
            sceneDescription?.coordinateSystem === 'kicad-3d-y-up'
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
}
