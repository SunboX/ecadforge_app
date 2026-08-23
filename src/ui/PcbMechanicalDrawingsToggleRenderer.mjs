import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'

/**
 * Renders the aggregate PCB mechanical-drawings visibility control.
 */
export class PcbMechanicalDrawingsToggleRenderer {
    /**
     * Renders a checkbox for the document's drawing-layer group.
     * @param {object} documentModel Document model.
     * @param {string[]} hiddenLayers Hidden layer keys.
     * @param {string | undefined} documentId Active document id.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static render(documentModel, hiddenLayers, documentId, translate) {
        if (!String(documentId || '')) return ''
        const layerKeys =
            PcbLayerVisibilityModel.resolveTechnicalDrawingLayerKeys(
                documentModel
            )
        if (!layerKeys.length) return ''
        const hidden = new Set((hiddenLayers || []).map(String))
        const visible = layerKeys.every((layerKey) => !hidden.has(layerKey))

        return (
            '<label class="pcb-view__mechanical-drawings">' +
            '<input type="checkbox" data-document-id="' +
            PcbMechanicalDrawingsToggleRenderer.#escapeHtml(
                String(documentId || '')
            ) +
            '" data-pcb-mechanical-drawings="true" data-pcb-layer-action="toggle" data-pcb-layer-key="' +
            PcbMechanicalDrawingsToggleRenderer.#escapeHtml(layerKeys[0]) +
            '" data-pcb-layer-keys="' +
            PcbMechanicalDrawingsToggleRenderer.#escapeHtml(
                JSON.stringify(layerKeys)
            ) +
            '" data-pcb-layer-visible="' +
            (visible ? 'true' : 'false') +
            '"' +
            (visible ? ' checked' : '') +
            ' />' +
            '<span>' +
            PcbMechanicalDrawingsToggleRenderer.#escapeHtml(
                translate('pcbView.mechanicalDrawings')
            ) +
            '</span></label>'
        )
    }

    /**
     * Escapes one HTML text or attribute value.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;')
    }
}
