import { UiText } from './UiText.mjs'

/**
 * Renders the interactive 3D scene shell.
 */
export class Scene3dRenderer {
    /**
     * Renders the interactive 3D scene shell.
     * @param {{ pcb?: { boardOutline: { widthMil: number, heightMil: number }, components: { designator: string }[] }, bom: { quantity: number }[] }} documentModel
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static render(documentModel, translate = null) {
        const t = UiText.createTranslator(translate)
        const pcb = documentModel?.pcb
        if (!pcb) {
            return (
                '<section class="viewer-empty">' +
                Scene3dRenderer.#escapeHtml(t('scene3d.noPcb')) +
                '</section>'
            )
        }

        const widthMil = Math.round(pcb.boardOutline.widthMil || 0)
        const heightMil = Math.round(pcb.boardOutline.heightMil || 0)
        const componentCount = pcb.components.length
        const bomRows = documentModel?.bom?.length || 0

        return (
            '<section class="scene-3d"><header class="svg-panel__header"><h3>' +
            Scene3dRenderer.#escapeHtml(t('scene3d.title')) +
            '</h3><p>' +
            widthMil +
            ' x ' +
            heightMil +
            ' ' +
            Scene3dRenderer.#escapeHtml(t('scene3d.boardEnvelopeSuffix')) +
            '</p></header>' +
            '<div class="scene-3d__toolbar" aria-label="' +
            Scene3dRenderer.#escapeHtml(t('scene3d.toolbarAria')) +
            '">' +
            '<button class="scene-3d__preset" type="button" data-scene-3d-preset="top">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.top')) +
            '</button>' +
            '<button class="scene-3d__preset" type="button" data-scene-3d-preset="bottom">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.bottom')) +
            '</button>' +
            '<button class="scene-3d__preset" type="button" data-scene-3d-preset="isometric">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.isometric')) +
            '</button>' +
            '<button class="scene-3d__preset scene-3d__action" type="button" data-scene-3d-export="models-zip">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.downloadModelsZip')) +
            '</button>' +
            '</div>' +
            '<div class="scene-3d__stage">' +
            '<div class="scene-3d__viewport" aria-label="' +
            Scene3dRenderer.#escapeHtml(t('scene3d.interactiveViewAria')) +
            '">' +
            '<div class="scene-3d__canvas-mount" data-scene-3d-viewport></div>' +
            '<div class="scene-3d__loading" data-scene-3d-loading aria-live="polite">' +
            '<div class="scene-3d__loading-content"><div class="viewer-loading__pulse"></div><p>' +
            Scene3dRenderer.#escapeHtml(t('scene3d.loading')) +
            '</p></div></div>' +
            '</div>' +
            '<aside class="scene-3d__controls" aria-label="' +
            Scene3dRenderer.#escapeHtml(t('scene3d.controlsAria')) +
            '">' +
            '<label class="scene-3d__toggle"><input type="checkbox" checked data-scene-3d-toggle="external-models" />' +
            Scene3dRenderer.#escapeHtml(t('scene3d.externalModels')) +
            '</label>' +
            '<label class="scene-3d__toggle"><input type="checkbox" data-scene-3d-toggle="fallback-bodies" />' +
            Scene3dRenderer.#escapeHtml(t('scene3d.fallbackBodies')) +
            '</label>' +
            '<label class="scene-3d__toggle"><input type="checkbox" checked data-scene-3d-toggle="copper" />' +
            Scene3dRenderer.#escapeHtml(t('scene3d.copperDetail')) +
            '</label>' +
            '<section class="scene-3d__selection" aria-live="polite"><h4 class="scene-3d__selection-title">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.componentInspector')) +
            '</h4><p class="scene-3d__selection-empty">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.inspectPrompt')) +
            '</p></section>' +
            '</aside>' +
            '</div>' +
            '<div class="scene-3d__diagnostics" aria-live="polite">' +
            Scene3dRenderer.#escapeHtml(t('scene3d.companionModelsHint')) +
            '</div>' +
            '<dl class="scene-3d__stats"><div><dt>' +
            Scene3dRenderer.#escapeHtml(t('scene3d.footprint')) +
            '</dt><dd>' +
            widthMil +
            ' x ' +
            heightMil +
            ' mil</dd></div><div><dt>' +
            Scene3dRenderer.#escapeHtml(t('scene3d.placements')) +
            '</dt><dd>' +
            componentCount +
            ' ' +
            Scene3dRenderer.#escapeHtml(t('scene3d.componentsSuffix')) +
            '</dd></div><div><dt>' +
            Scene3dRenderer.#escapeHtml(t('scene3d.bomGroups')) +
            '</dt><dd>' +
            bomRows +
            '</dd></div></dl></section>'
        )
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
