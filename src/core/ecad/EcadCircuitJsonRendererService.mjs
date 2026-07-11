import {
    BomTableRenderer,
    PcbInteractionIndex,
    PcbSvgRenderer,
    SchematicSvgRenderer
} from 'circuitjson-toolkit'
import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadDocumentBom } from './EcadDocumentBom.mjs'

/**
 * Routes all source-neutral app rendering through one reusable CircuitJSON
 * context and interaction index.
 */
export class EcadCircuitJsonRendererService {
    static #interactionIndexes = new WeakMap()

    /**
     * Renders a canonical schematic.
     * @param {unknown} documentModel CircuitJSON document input.
     * @param {object} [options] Canonical render options.
     * @returns {string}
     */
    static renderSchematic(documentModel, options = {}) {
        return SchematicSvgRenderer.render(
            EcadCircuitJsonContext.prepare(documentModel),
            options
        )
    }

    /**
     * Renders a canonical PCB.
     * @param {unknown} documentModel CircuitJSON document input.
     * @param {object} [options] Canonical render options.
     * @returns {string}
     */
    static renderPcb(documentModel, options = {}) {
        return PcbSvgRenderer.render(
            EcadCircuitJsonContext.prepare(documentModel),
            options
        )
    }

    /**
     * Returns ordered interaction candidates for one board point.
     * @param {unknown} documentModel CircuitJSON document input.
     * @param {{ x: number, y: number }} point Board-space point.
     * @param {object} [options] Canonical interaction options.
     * @returns {object[]}
     */
    static hitTestPcb(documentModel, point, options = {}) {
        return EcadCircuitJsonRendererService.#interactionIndex(
            documentModel
        ).hitTest(point, options)
    }

    /**
     * Returns physical and virtual CircuitJSON PCB layers.
     * @param {unknown} documentModel CircuitJSON document input.
     * @returns {{ physicalLayers: object[], virtualLayers: object[] }}
     */
    static resolvePcbInteractionLayers(documentModel) {
        return EcadCircuitJsonRendererService.#interactionIndex(
            documentModel
        ).resolveLayers()
    }

    /**
     * Renders canonical BOM rows.
     * @param {unknown} documentModel CircuitJSON document input.
     * @param {object} [options] Canonical render options.
     * @returns {string}
     */
    static renderBom(documentModel, options = {}) {
        return BomTableRenderer.render(
            EcadCircuitJsonContext.prepare(documentModel),
            options
        )
    }

    /**
     * Builds app-localizable grouped BOM rows from the shared model.
     * @param {unknown} documentModel CircuitJSON document input.
     * @returns {object[]}
     */
    static buildBomRows(documentModel) {
        return EcadDocumentBom.resolve(documentModel)
    }

    /**
     * Returns a reused shared interaction index.
     * @param {unknown} documentModel CircuitJSON document input.
     * @returns {PcbInteractionIndex}
     */
    static #interactionIndex(documentModel) {
        const context = EcadCircuitJsonContext.prepare(documentModel)
        let index =
            EcadCircuitJsonRendererService.#interactionIndexes.get(context)
        if (!index) {
            index = PcbInteractionIndex.create(context)
            EcadCircuitJsonRendererService.#interactionIndexes.set(
                context,
                index
            )
        }
        return index
    }
}
