import { CircuitJsonDocumentContext } from 'circuitjson-toolkit'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Reuses one shared CircuitJSON request context across app services.
 */
export class EcadCircuitJsonContext {
    static #contexts = new WeakMap()

    /**
     * Returns a prepared context with any requested indexes added lazily.
     * @param {unknown} documentModel CircuitJSON document input.
     * @param {{ indexes?: string[] }} [options] Requested shared indexes.
     * @returns {CircuitJsonDocumentContext}
     */
    static prepare(documentModel, options = {}) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            throw new TypeError(
                'Expected a canonical or source-neutral CircuitJSON document.'
            )
        }

        let context = EcadCircuitJsonContext.#contexts.get(documentModel)
        if (!context) {
            context = CircuitJsonDocumentContext.prepare(documentModel)
            EcadCircuitJsonContext.#contexts.set(documentModel, context)
            EcadCircuitJsonContext.#contexts.set(context, context)
        }
        return CircuitJsonDocumentContext.prepare(context, options)
    }
}
