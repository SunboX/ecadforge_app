/**
 * Renders a reusable pointer shield for scroll-sensitive viewports.
 */
export class ViewportInteractionGateRenderer {
    /**
     * Renders an interaction gate overlay.
     * @param {string} label Accessible button label.
     * @returns {string}
     */
    static render(label) {
        const safeLabel = ViewportInteractionGateRenderer.#escapeHtml(label)

        return (
            '<div class="viewport-interaction-gate" hidden data-viewport-interaction-gate="locked">' +
            '<button class="viewport-interaction-gate__button" type="button" data-viewport-interaction-unlock="true" aria-label="' +
            safeLabel +
            '" title="' +
            safeLabel +
            '"><svg aria-hidden="true" viewBox="0 0 20 20" width="18" height="18">' +
            '<path d="M7.5 2.8v7"></path><path d="M7.5 9.8 6.2 8.5a1.4 1.4 0 0 0-2 2l3.2 3.2c.8.8 1.8 1.2 2.9 1.2h1.3a3.9 3.9 0 0 0 3.9-3.9V8.2a1.3 1.3 0 0 0-2.6 0"></path><path d="M10.1 8V6.5a1.3 1.3 0 0 0-2.6 0"></path><path d="M12.8 8.3V7.1a1.3 1.3 0 0 0-2.6 0"></path></svg></button>' +
            '</div>'
        )
    }

    /**
     * Escapes markup text.
     * @param {string} value Raw value.
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
