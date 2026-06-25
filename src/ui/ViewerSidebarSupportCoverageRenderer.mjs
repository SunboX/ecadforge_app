/**
 * Renders parsed element coverage metadata in the sidebar overview.
 */
export class ViewerSidebarSupportCoverageRenderer {
    /**
     * Renders support coverage markup.
     * @param {object | null | undefined} supportMatrix Support matrix metadata.
     * @returns {string}
     */
    static render(supportMatrix) {
        const totals = supportMatrix?.totals || null
        const rows = Array.isArray(supportMatrix?.rows)
            ? supportMatrix.rows
            : []
        if (!totals || !rows.length) return ''

        const gaps = ViewerSidebarSupportCoverageRenderer.#gapRows(rows)
        const variantGaps =
            ViewerSidebarSupportCoverageRenderer.#variantGapRows(
                supportMatrix?.variantRows
            )

        return (
            '<section class="viewer-sidebar__support-coverage">' +
            '<header><h4>Format coverage</h4><span>' +
            ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                String(totals.presentElementTypes || 0)
            ) +
            ' present</span><span>' +
            ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                String(totals.renderedElementTypes || 0)
            ) +
            ' rendered</span><span>' +
            ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                String(totals.presentVariantValues || 0)
            ) +
            ' variants</span></header>' +
            ViewerSidebarSupportCoverageRenderer.#renderGapList(gaps) +
            ViewerSidebarSupportCoverageRenderer.#renderVariantGapList(
                variantGaps
            ) +
            '</section>'
        )
    }

    /**
     * Returns present rows that are preserved or only partially supported.
     * @param {object[]} rows Support matrix rows.
     * @returns {object[]}
     */
    static #gapRows(rows) {
        return rows
            .filter((row) => row?.present)
            .filter((row) =>
                Object.values(row.capabilities || {}).some((capability) =>
                    ['metadata', 'metadata-only', 'not-supported'].includes(
                        String(capability || '')
                    )
                )
            )
            .slice(0, 6)
    }

    /**
     * Returns present variant rows with partial or metadata support.
     * @param {object[] | undefined} rows Variant coverage rows.
     * @returns {object[]}
     */
    static #variantGapRows(rows) {
        return (Array.isArray(rows) ? rows : [])
            .filter((row) => row?.present)
            .filter(
                (row) =>
                    !['rendered', 'grouped'].includes(String(row.status || ''))
            )
            .slice(0, 6)
    }

    /**
     * Renders coverage gap rows.
     * @param {object[]} rows Gap rows.
     * @returns {string}
     */
    static #renderGapList(rows) {
        if (!rows.length) {
            return '<p class="viewer-sidebar__support-coverage-empty">No present coverage gaps.</p>'
        }

        return (
            '<ul>' +
            rows
                .map(
                    (row) =>
                        '<li><strong>' +
                        ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                            row.type
                        ) +
                        '</strong><span>' +
                        ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                            ViewerSidebarSupportCoverageRenderer.#note(row)
                        ) +
                        '</span></li>'
                )
                .join('') +
            '</ul>'
        )
    }

    /**
     * Renders variant coverage gap rows.
     * @param {object[]} rows Gap rows.
     * @returns {string}
     */
    static #renderVariantGapList(rows) {
        if (!rows.length) return ''
        return (
            '<ul class="viewer-sidebar__support-coverage-variants">' +
            rows
                .map(
                    (row) =>
                        '<li><strong>' +
                        ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                            String(row.type || '') +
                                '.' +
                                String(row.group || '')
                        ) +
                        '</strong><span>' +
                        ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                            String(row.value || '')
                        ) +
                        '</span><span>' +
                        ViewerSidebarSupportCoverageRenderer.#escapeHtml(
                            String(row.note || 'Preserved as metadata.')
                        ) +
                        '</span></li>'
                )
                .join('') +
            '</ul>'
        )
    }

    /**
     * Resolves one short support note.
     * @param {object} row Support matrix row.
     * @returns {string}
     */
    static #note(row) {
        if (Array.isArray(row?.notes) && row.notes.length) {
            return String(row.notes[0] || '')
        }
        const capabilities = Object.entries(row?.capabilities || {})
            .map(([key, value]) => key + ': ' + value)
            .join(', ')
        return capabilities || 'Preserved as metadata.'
    }

    /**
     * Escapes text for HTML.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
    }
}
