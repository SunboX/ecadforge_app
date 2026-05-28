import {
    BomTableRenderer as AltiumBomTableRenderer,
    preparePcbSideResolvedRenderModel as prepareAltiumPcbSideResolvedRenderModel,
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
     * @param {{ side?: 'top' | 'bottom' }} [options] PCB render options.
     * @returns {string}
     */
    static renderPcb(documentModel, options = {}) {
        const side = EcadRendererService.#normalizePcbSide(options.side)
        return EcadRendererService.#isKiCad(documentModel)
            ? EcadRendererService.#renderKicadPcb(documentModel, side)
            : EcadRendererService.#renderAltiumPcb(documentModel, side)
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
     * @param {'top' | 'bottom'} side PCB side.
     * @returns {string}
     */
    static #renderKicadPcb(documentModel, side) {
        return KicadPcbSvgRenderer.render(documentModel, {
            includeOppositeCopper: true,
            side: side === 'bottom' ? 'back' : 'front'
        }).replace('class="pcb-svg"', 'class="pcb-svg pcb-svg--kicad"')
    }

    /**
     * Renders Altium PCB SVG for the requested side through the side-resolved
     * model adapter exported by the toolkit.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @returns {string}
     */
    static #renderAltiumPcb(documentModel, side) {
        const renderModel = prepareAltiumPcbSideResolvedRenderModel(
            documentModel,
            { side: side === 'bottom' ? 'back' : 'front' }
        )
        const markup = AltiumPcbSvgRenderer.render(renderModel)

        if (side !== 'bottom') {
            return markup
        }

        return markup.replace(
            'Top-facing composite view',
            'Bottom-facing composite view'
        )
    }

    /**
     * Normalizes the app-level PCB side option.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizePcbSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }
}
