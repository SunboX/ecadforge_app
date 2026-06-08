import {
    PcbScene3dBuilder as AltiumScene3dBuilder,
    PcbScene3dModelRegistry as AltiumScene3dModelRegistry,
    PcbScene3dScenePreparator as AltiumScene3dScenePreparator
} from 'altium-toolkit/scene3d'
import {
    PcbScene3dBuilder as KicadScene3dBuilder,
    PcbScene3dModelRegistry as KicadScene3dModelRegistry,
    PcbScene3dScenePreparator as KicadScene3dScenePreparator
} from 'kicad-toolkit/scene3d'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

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

        return EcadScene3dService.#isKiCad(documentModel)
            ? KicadScene3dBuilder.build(documentModel, options)
            : AltiumScene3dBuilder.build(documentModel, options)
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

        return EcadScene3dService.#isKiCad(documentModel)
            ? KicadScene3dScenePreparator.prepare(documentModel, options)
            : AltiumScene3dScenePreparator.prepare(documentModel, options)
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

        if (EcadScene3dService.#isKiCad(documentModel)) {
            return KicadScene3dModelRegistry.create(sessionAssets || [])
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
     * Returns true for standards-native CircuitJSON document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isCircuitJson(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'circuitjson'
        )
    }
}
