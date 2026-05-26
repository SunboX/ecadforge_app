import {
    BomTableRenderer as AltiumBomTableRenderer,
    PcbSvgRenderer as AltiumPcbSvgRenderer,
    SchematicSvgRenderer as AltiumSchematicSvgRenderer
} from 'altium-toolkit/renderers'
import {
    BomTableRenderer as KicadBomTableRenderer,
    PcbSvgRenderer as KicadPcbSvgRenderer,
    SchematicSvgRenderer as KicadSchematicSvgRenderer
} from 'kicad-toolkit/renderers'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Chooses format-specific renderers for normalized document models.
 */
export class EcadRendererService {
    /**
     * Renders a schematic document.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static renderSchematic(documentModel) {
        return EcadRendererService.#isKiCad(documentModel)
            ? KicadSchematicSvgRenderer.render(documentModel)
            : AltiumSchematicSvgRenderer.render(documentModel)
    }

    /**
     * Renders a PCB document.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static renderPcb(documentModel) {
        return EcadRendererService.#isKiCad(documentModel)
            ? EcadRendererService.#renderKicadPcb(documentModel)
            : AltiumPcbSvgRenderer.render(documentModel)
    }

    /**
     * Renders BOM rows.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static renderBom(documentModel) {
        const rows = documentModel?.bom || []
        return EcadRendererService.#isKiCad(documentModel)
            ? KicadBomTableRenderer.render(rows)
            : AltiumBomTableRenderer.render(rows)
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
     * Renders KiCad PCB SVG with an app-scoped marker class for palette fixes.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static #renderKicadPcb(documentModel) {
        return KicadPcbSvgRenderer.render(documentModel).replace(
            'class="pcb-svg"',
            'class="pcb-svg pcb-svg--kicad"'
        )
    }
}
