import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { UiText } from './UiText.mjs'

/**
 * Renders the 2D PCB viewer chrome around the format-specific SVG.
 */
export class PcbViewRenderer {
    /**
     * Renders the PCB side toolbar and active board-side SVG.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} [side] Active board side.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static render(documentModel, side = 'top', translate = null) {
        const t = UiText.createTranslator(translate)
        const normalizedSide = PcbViewRenderer.#normalizeSide(side)

        return (
            '<section class="pcb-view" data-pcb-view-active-side="' +
            normalizedSide +
            '">' +
            '<div class="scene-3d__toolbar pcb-view__toolbar" aria-label="' +
            PcbViewRenderer.#escapeHtml(t('pcbView.boardSideAria')) +
            '">' +
            PcbViewRenderer.#renderSideButton('top', normalizedSide, t) +
            PcbViewRenderer.#renderSideButton('bottom', normalizedSide, t) +
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
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderSideButton(side, activeSide, translate) {
        const isActive = side === activeSide
        const label =
            side === 'bottom'
                ? translate('scene3d.bottom')
                : translate('scene3d.top')

        return (
            '<button class="scene-3d__preset pcb-view__side' +
            (isActive ? ' is-active' : '') +
            '" type="button" data-pcb-view-side="' +
            side +
            '" aria-pressed="' +
            (isActive ? 'true' : 'false') +
            '">' +
            PcbViewRenderer.#escapeHtml(label) +
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

    /**
     * Escapes markup text.
     * @param {string} value Raw text.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
