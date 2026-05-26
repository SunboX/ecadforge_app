/**
 * Renders the compact summary cards below the viewer.
 */
export class SummaryCardRenderer {
    /**
     * Renders summary cards for the current document, or the default cards when
     * no document is loaded.
     * @param {any} documentModel
     * @returns {string}
     */
    static render(documentModel) {
        return SummaryCardRenderer.#buildCards(documentModel)
            .map((card) => SummaryCardRenderer.#renderCard(card))
            .join('')
    }

    /**
     * Builds summary card definitions.
     * @param {any} documentModel
     * @returns {{ icon: string, label: string, value: string }[]}
     */
    static #buildCards(documentModel) {
        if (!documentModel) {
            return [
                {
                    icon: 'status',
                    label: 'Status',
                    value: 'Waiting for file'
                },
                {
                    icon: 'formats',
                    label: 'Formats',
                    value: 'Altium, KiCad'
                },
                {
                    icon: 'parser',
                    label: 'Parser',
                    value: 'Client-side JS'
                },
                {
                    icon: 'views',
                    label: 'Views',
                    value: '5 tabs ready'
                }
            ]
        }

        if (documentModel.kind === 'schematic') {
            return [
                {
                    icon: 'components',
                    label: 'Components',
                    value: String(documentModel.summary.componentCount || 0)
                },
                {
                    icon: 'graphics',
                    label: 'Graphics',
                    value: String(documentModel.summary.lineCount || 0)
                },
                {
                    icon: 'texts',
                    label: 'Texts',
                    value: String(documentModel.summary.textCount || 0)
                },
                {
                    icon: 'bom',
                    label: 'BOM groups',
                    value: String(documentModel.summary.bomRowCount || 0)
                }
            ]
        }

        return [
            {
                icon: 'placements',
                label: 'Placements',
                value: String(documentModel.summary.componentCount || 0)
            },
            {
                icon: 'layers',
                label: 'Layers',
                value: String(documentModel.summary.layerCount || 0)
            },
            {
                icon: 'outline',
                label: 'Outline segments',
                value: String(documentModel.summary.outlineSegmentCount || 0)
            },
            {
                icon: 'envelope',
                label: 'Board envelope',
                value:
                    String(documentModel.summary.boardWidthMil || 0) +
                    ' x ' +
                    String(documentModel.summary.boardHeightMil || 0) +
                    ' mil'
            }
        ]
    }

    /**
     * Renders one summary card.
     * @param {{ icon: string, label: string, value: string }} card
     * @returns {string}
     */
    static #renderCard(card) {
        return (
            '<article class="summary-card" data-summary-icon="' +
            SummaryCardRenderer.#escapeHtml(card.icon) +
            '">' +
            '<span class="summary-card__icon" aria-hidden="true">' +
            SummaryCardRenderer.#renderIcon(card.icon) +
            '</span>' +
            '<span class="summary-card__content">' +
            '<span class="summary-card__label" title="' +
            SummaryCardRenderer.#escapeHtml(card.label) +
            '">' +
            SummaryCardRenderer.#escapeHtml(card.label) +
            '</span>' +
            '<strong title="' +
            SummaryCardRenderer.#escapeHtml(card.value) +
            '">' +
            SummaryCardRenderer.#escapeHtml(card.value) +
            '</strong>' +
            '</span>' +
            '</article>'
        )
    }

    /**
     * Renders one Lucide-style icon.
     * @param {string} icon
     * @returns {string}
     */
    static #renderIcon(icon) {
        const icons = {
            status: '<circle cx="12" cy="12" r="8" /><path d="M12 7v5l3 2" />',
            formats:
                '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M12 12 4 7.5" /><path d="m12 12 8-4.5" /><path d="M12 12v9" />',
            parser: '<path d="m10 8-4 4 4 4" /><path d="m14 8 4 4-4 4" />',
            views: '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="3" />',
            components:
                '<rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M4 10h3" /><path d="M4 14h3" /><path d="M17 10h3" /><path d="M17 14h3" /><path d="M10 4v3" /><path d="M14 4v3" /><path d="M10 17v3" /><path d="M14 17v3" />',
            graphics:
                '<path d="M4 18 9 6l4 8 2-4 5 8" /><path d="M4 18h16" />',
            texts: '<path d="M4 6h16" /><path d="M9 6v12" /><path d="M15 6v12" /><path d="M7 18h10" />',
            bom: '<path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" />',
            placements:
                '<circle cx="12" cy="12" r="7" /><path d="M12 3v4" /><path d="M12 17v4" /><path d="M3 12h4" /><path d="M17 12h4" /><circle cx="12" cy="12" r="1.5" />',
            layers:
                '<path d="m12 3 8 4.5-8 4.5-8-4.5L12 3z" /><path d="m4 12 8 4.5 8-4.5" /><path d="m4 16.5 8 4.5 8-4.5" />',
            outline:
                '<rect x="5" y="5" width="14" height="14" rx="3" /><path d="M9 5V3" /><path d="M15 19v2" /><path d="M19 9h2" /><path d="M3 15h2" />',
            envelope:
                '<circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" />'
        }

        return (
            '<svg class="icon" viewBox="0 0 24 24">' +
            (icons[icon] || icons.status) +
            '</svg>'
        )
    }

    /**
     * Escapes markup text.
     * @param {string} value
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
