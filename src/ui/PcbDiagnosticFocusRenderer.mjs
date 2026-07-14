import { PcbDiagnosticFocusModel } from 'circuitjson-toolkit/extensions'

/**
 * Injects persistent PCB diagnostic focus and related-primitive preview styles.
 */
export class PcbDiagnosticFocusRenderer {
    /**
     * Injects focus preview styling for one diagnostic id.
     * @param {string} markup SVG markup.
     * @param {object} documentModel Parsed document model.
     * @param {string} diagnosticId Focused diagnostic id.
     * @param {{ context?: object | null, model?: object | null } | null} [interaction] Prepared interaction data.
     * @returns {string}
     */
    static inject(markup, documentModel, diagnosticId, interaction = null) {
        const id = String(diagnosticId || '').trim()
        if (!id) return markup

        const focusModel = interaction?.model
            ? PcbDiagnosticFocusModel.buildPrepared(
                  interaction.context || documentModel,
                  interaction.model
              )
            : PcbDiagnosticFocusModel.build(documentModel)
        const focus = focusModel.get(id)
        if (!focus) return markup

        const markerSelector =
            ".pcb-svg [data-pcb-diagnostic-id='" +
            PcbDiagnosticFocusRenderer.#escapeCssString(id) +
            "']"
        const relatedSelectors = (focus.relatedPrimitiveIds || [])
            .map((primitiveId) =>
                PcbDiagnosticFocusRenderer.#primitiveSelector(primitiveId)
            )
            .filter(Boolean)
        const rules =
            markerSelector +
            ' { opacity: 1 !important; filter: drop-shadow(0 0 1.6px rgba(239, 68, 68, 0.78)) drop-shadow(0 0 4px rgba(239, 68, 68, 0.36)); }' +
            (relatedSelectors.length
                ? relatedSelectors.join(',') +
                  ' { opacity: 1 !important; filter: drop-shadow(0 0 1.4px rgba(27, 191, 227, 0.72)); }'
                : '')

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-diagnostic-related-preview" data-pcb-diagnostic-related-preview="true">' +
                PcbDiagnosticFocusRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Builds a selector for one related primitive id.
     * @param {string} primitiveId Related primitive id.
     * @returns {string}
     */
    static #primitiveSelector(primitiveId) {
        const id = String(primitiveId || '').trim()
        if (!id) return ''
        return (
            ".pcb-svg [data-pcb-primitive-id='" +
            PcbDiagnosticFocusRenderer.#escapeCssString(id) +
            "']"
        )
    }

    /**
     * Escapes a CSS single-quoted string value.
     * @param {string} value Raw value.
     * @returns {string}
     */
    static #escapeCssString(value) {
        return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
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
