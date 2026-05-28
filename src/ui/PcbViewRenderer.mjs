import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'

/**
 * Renders the 2D PCB viewer chrome around the format-specific SVG.
 */
export class PcbViewRenderer {
    /**
     * Renders the PCB side toolbar and active board-side SVG.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} [side] Active board side.
     * @returns {string}
     */
    static render(documentModel, side = 'top') {
        const normalizedSide = PcbViewRenderer.#normalizeSide(side)

        return (
            '<section class="pcb-view" data-pcb-view-active-side="' +
            normalizedSide +
            '">' +
            '<div class="scene-3d__toolbar pcb-view__toolbar" aria-label="PCB board side">' +
            PcbViewRenderer.#renderSideButton('top', normalizedSide) +
            PcbViewRenderer.#renderSideButton('bottom', normalizedSide) +
            '</div>' +
            '<div class="pcb-view__content">' +
            EcadRendererService.renderPcb(documentModel, {
                side: normalizedSide
            }) +
            '</div>' +
            '</section>'
        )
    }

    /**
     * Renders one side selector button.
     * @param {'top' | 'bottom'} side Button side.
     * @param {'top' | 'bottom'} activeSide Active side.
     * @returns {string}
     */
    static #renderSideButton(side, activeSide) {
        const isActive = side === activeSide
        const label = side === 'bottom' ? 'Bottom' : 'Top'

        return (
            '<button class="scene-3d__preset pcb-view__side' +
            (isActive ? ' is-active' : '') +
            '" type="button" data-pcb-view-side="' +
            side +
            '" aria-pressed="' +
            (isActive ? 'true' : 'false') +
            '">' +
            label +
            '</button>'
        )
    }

    /**
     * Normalizes untrusted side input to the supported board-side names.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizeSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }
}
