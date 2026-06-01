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

        const copperTextMaskMatcher =
            PcbScene3dCopperDetailFilter.#buildCopperTextMaskMatcher(
                sceneDescription
            )

        return {
            ...detail,
            tracks: PcbScene3dCopperDetailFilter.#filterMaskOpenPrimitives(
                detail.tracks
            ),
            arcs: PcbScene3dCopperDetailFilter.#filterMaskOpenPrimitives(
                detail.arcs
            ),
            copperTexts: PcbScene3dCopperDetailFilter.#filterMaskOpenPrimitives(
                detail.copperTexts,
                copperTextMaskMatcher
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
     * @param {((primitive: object) => boolean) | null} [maskMatcher]
     * @returns {any[]}
     */
    static #filterMaskOpenPrimitives(primitives, maskMatcher = null) {
        return (primitives || []).filter((primitive) =>
            PcbScene3dCopperDetailFilter.#hasMaskOpening(
                primitive,
                maskMatcher
            )
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
     * @param {((primitive: object) => boolean) | null} [maskMatcher]
     * @returns {boolean}
     */
    static #hasMaskOpening(primitive, maskMatcher = null) {
        if (primitive?.hasSolderMask === true) {
            return true
        }

        if (primitive?.solderMaskOpening === true) {
            return true
        }

        if (
            Number.isFinite(Number(primitive?.solderMaskExpansion)) &&
            Number(primitive?.solderMaskExpansion) !== 0
        ) {
            return true
        }

        return typeof maskMatcher === 'function'
            ? maskMatcher(primitive)
            : false
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

    /**
     * Builds a same-position lookup for KiCad mask-layer text openings.
     * @param {object} sceneDescription Scene description.
     * @returns {((primitive: object) => boolean) | null}
     */
    static #buildCopperTextMaskMatcher(sceneDescription) {
        if (
            !PcbScene3dCopperDetailFilter.#isKiCadScene(sceneDescription) ||
            !Array.isArray(sceneDescription?.texts)
        ) {
            return null
        }

        const maskTextKeys = new Set()
        sceneDescription.texts
            .filter((text) =>
                PcbScene3dCopperDetailFilter.#isMaskLayerText(text)
            )
            .forEach((text) => {
                PcbScene3dCopperDetailFilter.#textMatchKeys(
                    text,
                    sceneDescription
                ).forEach((key) => maskTextKeys.add(key))
            })

        if (!maskTextKeys.size) {
            return null
        }

        return (primitive) =>
            maskTextKeys.has(
                PcbScene3dCopperDetailFilter.#textMatchKey(
                    primitive,
                    primitive?.y
                )
            )
    }

    /**
     * Checks whether one scene uses KiCad scene coordinate conventions.
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
     * Checks whether one text primitive belongs to a solder-mask layer.
     * @param {object} text Text primitive.
     * @returns {boolean}
     */
    static #isMaskLayerText(text) {
        const layer = String(text?.layer || '').trim().toUpperCase()
        return layer === 'F.MASK' || layer === 'B.MASK'
    }

    /**
     * Converts scene text Y back to source board Y for KiCad y-up scenes.
     * @param {object} text Scene text primitive.
     * @param {object} sceneDescription Scene description.
     * @returns {number}
     */
    static #sourceYForSceneText(text, sceneDescription) {
        const y = Number(text?.y || 0)
        const centerY = Number(sceneDescription?.board?.centerY)

        if (
            sceneDescription?.coordinateSystem === 'kicad-3d-y-up' &&
            Number.isFinite(centerY)
        ) {
            return centerY * 2 - y
        }

        return y
    }

    /**
     * Builds tolerant keys for matching paired KiCad copper and mask text.
     * @param {object} text Text primitive.
     * @param {object} sceneDescription Scene description.
     * @returns {string[]}
     */
    static #textMatchKeys(text, sceneDescription) {
        return PcbScene3dCopperDetailFilter.#uniqueValues([
            text?.y,
            PcbScene3dCopperDetailFilter.#sourceYForSceneText(
                text,
                sceneDescription
            )
        ]).flatMap((y) =>
            PcbScene3dCopperDetailFilter.#uniqueValues([
                text?.rotation,
                PcbScene3dCopperDetailFilter.#sourceRotationForSceneText(
                    text,
                    sceneDescription
                )
            ]).map((rotation) =>
                PcbScene3dCopperDetailFilter.#textMatchKey(text, y, rotation)
            )
        )
    }

    /**
     * Builds a tolerant key for matching paired KiCad copper and mask text.
     * @param {object} text Text primitive.
     * @param {number | string | undefined} y Candidate Y coordinate.
     * @param {number | string | undefined} rotation Candidate rotation.
     * @returns {string}
     */
    static #textMatchKey(text, y, rotation = text?.rotation) {
        return [
            PcbScene3dCopperDetailFilter.#textSide(text),
            PcbScene3dCopperDetailFilter.#roundCoordinate(text?.x),
            PcbScene3dCopperDetailFilter.#roundCoordinate(y),
            PcbScene3dCopperDetailFilter.#roundCoordinate(rotation),
            text?.mirrored ? 'mirrored' : 'normal',
            String(text?.value ?? text?.text ?? '').trim()
        ].join('|')
    }

    /**
     * Converts scene text rotation back to source board rotation.
     * @param {object} text Scene text primitive.
     * @param {object} sceneDescription Scene description.
     * @returns {number}
     */
    static #sourceRotationForSceneText(text, sceneDescription) {
        const rotation = Number(text?.rotation || 0)

        if (sceneDescription?.coordinateSystem === 'kicad-3d-y-up') {
            return ((-rotation % 360) + 360) % 360
        }

        return rotation
    }

    /**
     * Returns unique candidates after coordinate rounding.
     * @param {Array<number | string | undefined>} values Candidate values.
     * @returns {Array<number | string | undefined>}
     */
    static #uniqueValues(values) {
        const seen = new Set()
        const output = []

        values.forEach((value) => {
            const key = PcbScene3dCopperDetailFilter.#roundCoordinate(value)
            if (seen.has(key)) {
                return
            }

            seen.add(key)
            output.push(value)
        })

        return output
    }

    /**
     * Resolves one text primitive to the app's top/bottom side names.
     * @param {object} text Text primitive.
     * @returns {'top' | 'bottom' | ''}
     */
    static #textSide(text) {
        const layer = String(text?.layer || '').trim().toUpperCase()
        if (layer.startsWith('B.')) {
            return 'bottom'
        }

        if (layer.startsWith('F.')) {
            return 'top'
        }

        const side = String(text?.side || '').trim().toLowerCase()
        if (side === 'back' || side === 'bottom') {
            return 'bottom'
        }

        if (side === 'front' || side === 'top') {
            return 'top'
        }

        return ''
    }

    /**
     * Rounds coordinates to avoid float noise in KiCad mm-to-mil conversion.
     * @param {number | string | undefined} value Coordinate value.
     * @returns {number}
     */
    static #roundCoordinate(value) {
        return Math.round(Number(value || 0) * 1000) / 1000
    }
}
