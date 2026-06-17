/**
 * Converts KiCad WRL/VRML model units into the viewer's mil scene units.
 */
export class KicadScene3dWrlUnitScaleAdapter {
    static #WRL_UNIT_TO_MIL = 100

    /**
     * Applies KiCad WRL unit scaling to external model placements.
     * @param {object} sceneDescription Scene description.
     * @returns {object}
     */
    static apply(sceneDescription) {
        if (!KicadScene3dWrlUnitScaleAdapter.#isKiCadScene(sceneDescription)) {
            return sceneDescription
        }

        return {
            ...sceneDescription,
            components: Array.isArray(sceneDescription?.components)
                ? sceneDescription.components.map((component) =>
                      KicadScene3dWrlUnitScaleAdapter.#scalePlacement(component)
                  )
                : sceneDescription?.components,
            externalPlacements: Array.isArray(
                sceneDescription?.externalPlacements
            )
                ? sceneDescription.externalPlacements.map((placement) =>
                      KicadScene3dWrlUnitScaleAdapter.#scalePlacement(placement)
                  )
                : sceneDescription?.externalPlacements
        }
    }

    /**
     * Scales one placement when it references a WRL/VRML model.
     * @param {object} placement Scene component or explicit external placement.
     * @returns {object}
     */
    static #scalePlacement(placement) {
        if (
            !KicadScene3dWrlUnitScaleAdapter.#isWrlModel(
                placement?.externalModel
            )
        ) {
            return placement
        }

        return {
            ...placement,
            modelTransform:
                KicadScene3dWrlUnitScaleAdapter.#scaleModelTransform(
                    placement?.modelTransform
                )
        }
    }

    /**
     * Multiplies any KiCad-authored model scale by the WRL deci-inch factor.
     * @param {object | null | undefined} modelTransform Model transform.
     * @returns {object}
     */
    static #scaleModelTransform(modelTransform) {
        const transform = modelTransform || {}
        const scale = transform.scale || {}

        return {
            ...transform,
            scale: {
                x: KicadScene3dWrlUnitScaleAdapter.#scaledAxis(scale.x),
                y: KicadScene3dWrlUnitScaleAdapter.#scaledAxis(scale.y),
                z: KicadScene3dWrlUnitScaleAdapter.#scaledAxis(scale.z)
            }
        }
    }

    /**
     * Converts one optional scale axis to scene units.
     * @param {unknown} value Source scale axis.
     * @returns {number}
     */
    static #scaledAxis(value) {
        return (
            (Number(value ?? 1) || 1) *
            KicadScene3dWrlUnitScaleAdapter.#WRL_UNIT_TO_MIL
        )
    }

    /**
     * Checks whether the scene was built from KiCad source data.
     * @param {object} sceneDescription Scene description.
     * @returns {boolean}
     */
    static #isKiCadScene(sceneDescription) {
        const sourceFormat = String(sceneDescription?.sourceFormat || '')
            .trim()
            .toLowerCase()
        const coordinateSystem = String(
            sceneDescription?.coordinateSystem || ''
        )
            .trim()
            .toLowerCase()

        return sourceFormat === 'kicad' || coordinateSystem === 'kicad-3d-y-up'
    }

    /**
     * Checks whether one external model uses a KiCad VRML-family file.
     * @param {object | null | undefined} externalModel External model record.
     * @returns {boolean}
     */
    static #isWrlModel(externalModel) {
        const format = String(externalModel?.format || '')
            .trim()
            .toLowerCase()
        const fileName = String(
            externalModel?.relativePath || externalModel?.name || ''
        ).toLowerCase()

        return (
            format === 'wrl' ||
            format === 'vrml' ||
            /\.(?:wrl|vrml)$/iu.test(fileName)
        )
    }
}
