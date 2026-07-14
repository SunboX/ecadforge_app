import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { EcadCircuitJsonContext } from '../core/ecad/EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'

/**
 * Prepares one PCB interaction model for all consumers in a view render.
 */
export class PcbViewInteractionPreparation {
    /**
     * Reuses the app-owned canonical context when interaction data is needed.
     * @param {unknown} documentModel Active PCB document.
     * @param {{ toolbarVisible?: boolean, measurementMode?: string, focusedDiagnosticId?: string }} [options] Active interaction features.
     * @returns {{ context: object | null, model: object } | null} Prepared interaction data.
     */
    static prepare(documentModel, options = {}) {
        if (!PcbViewInteractionPreparation.#isRequired(options)) return null

        const context = EcadFormatRegistry.isCircuitJsonDocument(documentModel)
            ? EcadCircuitJsonContext.prepare(documentModel)
            : null
        return {
            context,
            model: PcbInteractionPrimitiveModel.build(context || documentModel)
        }
    }

    /**
     * Returns true when a visible or active consumer needs primitives.
     * @param {{ toolbarVisible?: boolean, measurementMode?: string, focusedDiagnosticId?: string }} options Active interaction features.
     * @returns {boolean} Whether primitive preparation is required.
     */
    static #isRequired(options) {
        return Boolean(
            options?.toolbarVisible ||
            String(options?.measurementMode || '').trim() ||
            String(options?.focusedDiagnosticId || '').trim()
        )
    }
}
