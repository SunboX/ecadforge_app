import {
    PcbScene3dBuilder as AltiumScene3dBuilder,
    PcbScene3dModelRegistry as AltiumScene3dModelRegistry,
    PcbScene3dScenePreparator as AltiumScene3dScenePreparator
} from 'altium-toolkit/scene3d'
import {
    PcbScene3dBuilder as KicadScene3dBuilder,
    PcbScene3dScenePreparator as KicadScene3dScenePreparator
} from 'kicad-toolkit/scene3d'
import {
    PcbScene3dBuilder as GerberScene3dBuilder,
    PcbScene3dScenePreparator as GerberScene3dScenePreparator
} from 'gerber-toolkit/scene3d'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'
import { KicadScene3dCopperLayerAdapter } from './KicadScene3dCopperLayerAdapter.mjs'
import { KicadScene3dBoardOutlineAdapter } from './KicadScene3dBoardOutlineAdapter.mjs'
import { KicadScene3dModelRegistryAdapter } from './KicadScene3dModelRegistryAdapter.mjs'
import { KicadScene3dSilkscreenSmoothingAdapter } from './KicadScene3dSilkscreenSmoothingAdapter.mjs'
import { KicadScene3dWrlUnitScaleAdapter } from './KicadScene3dWrlUnitScaleAdapter.mjs'
import { PcbFootprintPadAxisNormalizer } from './PcbFootprintPadAxisNormalizer.mjs'

/**
 * Chooses format-specific 3D scene builders.
 */
export class EcadScene3dService {
    /**
     * Builds a scene description.
     * @param {object} documentModel Document model.
     * @param {object} [options] Scene options.
     * @returns {object}
     */
    static build(documentModel, options = {}) {
        if (EcadScene3dService.#isCircuitJson(documentModel)) {
            return documentModel
        }

        if (EcadScene3dService.#isGerber(documentModel)) {
            return KicadScene3dSilkscreenSmoothingAdapter.applyScene(
                GerberScene3dBuilder.build(documentModel, options)
            )
        }

        if (EcadScene3dService.#isKiCad(documentModel)) {
            const sceneDocumentModel =
                PcbFootprintPadAxisNormalizer.apply(documentModel)
            return KicadScene3dWrlUnitScaleAdapter.apply(
                KicadScene3dCopperLayerAdapter.apply(
                    KicadScene3dBuilder.build(
                        KicadScene3dBoardOutlineAdapter.apply(
                            sceneDocumentModel
                        ),
                        EcadScene3dService.#kicadSceneOptions(options)
                    )
                )
            )
        }

        const sceneDocumentModel =
            PcbFootprintPadAxisNormalizer.apply(documentModel)
        return AltiumScene3dBuilder.build(sceneDocumentModel, options)
    }

    /**
     * Prepares a scene description asynchronously.
     * @param {object} documentModel Document model.
     * @param {object} [options] Scene options.
     * @returns {Promise<object>}
     */
    static async prepare(documentModel, options = {}) {
        if (EcadScene3dService.#isCircuitJson(documentModel)) {
            return documentModel
        }

        if (EcadScene3dService.#isGerber(documentModel)) {
            return KicadScene3dSilkscreenSmoothingAdapter.applyScene(
                await GerberScene3dScenePreparator.prepare(
                    documentModel,
                    options
                )
            )
        }

        if (EcadScene3dService.#isKiCad(documentModel)) {
            const sceneDocumentModel =
                PcbFootprintPadAxisNormalizer.apply(documentModel)
            return KicadScene3dWrlUnitScaleAdapter.apply(
                KicadScene3dCopperLayerAdapter.apply(
                    await KicadScene3dScenePreparator.prepare(
                        KicadScene3dBoardOutlineAdapter.apply(
                            sceneDocumentModel
                        ),
                        EcadScene3dService.#kicadSceneOptions(options)
                    )
                )
            )
        }

        const sceneDocumentModel =
            PcbFootprintPadAxisNormalizer.apply(documentModel)
        return AltiumScene3dScenePreparator.prepare(sceneDocumentModel, options)
    }

    /**
     * Creates the model registry expected by the chosen scene builder.
     * @param {object} documentModel Document model.
     * @param {object[]} sessionAssets Session assets.
     * @returns {object}
     */
    static createModelRegistry(documentModel, sessionAssets) {
        if (EcadScene3dService.#isCircuitJson(documentModel)) {
            return null
        }

        if (EcadScene3dService.#isGerber(documentModel)) {
            return null
        }

        if (EcadScene3dService.#isKiCad(documentModel)) {
            return new KicadScene3dModelRegistryAdapter(sessionAssets || [])
        }

        return AltiumScene3dModelRegistry.create(
            sessionAssets || [],
            Array.isArray(documentModel?.pcb?.embeddedModels)
                ? documentModel.pcb.embeddedModels
                : []
        )
    }

    /**
     * Returns true for KiCad document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isKiCad(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        )
    }

    /**
     * Builds KiCad scene options with the app's stricter model registry.
     * @param {object} options Scene options.
     * @returns {object}
     */
    static #kicadSceneOptions(options) {
        return {
            ...options,
            modelRegistry:
                options?.modelRegistry ||
                new KicadScene3dModelRegistryAdapter(
                    options?.sessionAssets || []
                )
        }
    }

    /**
     * Returns true for standards-native CircuitJSON document models.
     * @param {object | object[]} documentModel Document model.
     * @returns {boolean}
     */
    static #isCircuitJson(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'circuitjson'
        )
    }

    /**
     * Returns true for Gerber fabrication document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isGerber(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'gerber'
        )
    }
}
