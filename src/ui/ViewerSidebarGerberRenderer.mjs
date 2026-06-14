/**
 * Renders Gerber-specific file controls inside the project sidebar.
 */
export class ViewerSidebarGerberRenderer {
    /**
     * Renders Gerber composite and source-file rows under the active package.
     * @param {{ id: string, documentModel: any }} entry Document entry.
     * @param {string | undefined} activeDocumentId Active document id.
     * @param {{ activeView?: string, gerberRenderSelections?: { [documentId: string]: { renderMode?: string, layerId?: string, layerIds?: string[] } } }} snapshot Viewer snapshot.
     * @returns {string}
     */
    static renderFileRows(entry, activeDocumentId, snapshot) {
        const documentId = String(entry?.id || '')
        const documentModel = entry?.documentModel || {}
        if (
            documentId !== String(activeDocumentId || '') ||
            String(snapshot?.activeView || '') !== 'pcb' ||
            !ViewerSidebarGerberRenderer.#isGerberDocument(documentModel)
        ) {
            return ''
        }

        const layers = ViewerSidebarGerberRenderer.#gerberLayers(documentModel)
        if (!layers.length) {
            return ''
        }

        const selection = ViewerSidebarGerberRenderer.#resolveSelection(
            snapshot,
            documentId,
            layers
        )

        return (
            '<div class="viewer-sidebar__gerber-files" role="group" aria-label="Gerber files">' +
            ViewerSidebarGerberRenderer.#renderCompositeRow(
                documentId,
                selection.renderMode !== 'separated'
            ) +
            layers
                .map((layer) =>
                    ViewerSidebarGerberRenderer.#renderLayerRow(
                        documentId,
                        layer,
                        selection
                    )
                )
                .join('') +
            '</div>'
        )
    }

    /**
     * Renders the composite Gerber stack row.
     * @param {string} documentId Document id.
     * @param {boolean} selected Whether composite rendering is active.
     * @returns {string}
     */
    static #renderCompositeRow(documentId, selected) {
        return (
            '<button class="viewer-sidebar__row viewer-sidebar__row--button viewer-sidebar__row--gerber-file' +
            (selected ? ' is-active' : '') +
            '" type="button" data-gerber-document-id="' +
            ViewerSidebarGerberRenderer.#escapeHtml(documentId) +
            '" data-gerber-render-mode="composite" aria-pressed="' +
            (selected ? 'true' : 'false') +
            '"><strong>Composite</strong><span>Gerber stack</span></button>'
        )
    }

    /**
     * Renders one Gerber source-file row.
     * @param {string} documentId Document id.
     * @param {object} layer Source layer.
     * @param {{ renderMode: string, layerId: string, layerIds: string[] }} selection Active selection.
     * @returns {string}
     */
    static #renderLayerRow(documentId, layer, selection) {
        const layerId = String(layer?.id || '')
        const selected =
            selection.renderMode === 'separated' &&
            layerId &&
            selection.layerIds.includes(layerId)
        const label = String(layer?.fileName || layer?.name || layerId)

        return (
            '<button class="viewer-sidebar__row viewer-sidebar__row--button viewer-sidebar__row--gerber-file' +
            (selected ? ' is-active' : '') +
            '" type="button" data-gerber-document-id="' +
            ViewerSidebarGerberRenderer.#escapeHtml(documentId) +
            '" data-gerber-render-mode="separated" data-gerber-layer-id="' +
            ViewerSidebarGerberRenderer.#escapeHtml(layerId) +
            '" aria-pressed="' +
            (selected ? 'true' : 'false') +
            '"><strong>' +
            ViewerSidebarGerberRenderer.#escapeHtml(label) +
            '</strong><span>' +
            ViewerSidebarGerberRenderer.#escapeHtml(
                ViewerSidebarGerberRenderer.#formatLayerDetail(layer)
            ) +
            '</span></button>'
        )
    }

    /**
     * Resolves the currently selected Gerber render row.
     * @param {{ gerberRenderSelections?: { [documentId: string]: { renderMode?: string, layerId?: string, layerIds?: string[] } } }} snapshot Viewer snapshot.
     * @param {string} documentId Document id.
     * @param {object[]} layers Source layers.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[] }}
     */
    static #resolveSelection(snapshot, documentId, layers) {
        const rawSelection = snapshot?.gerberRenderSelections?.[documentId]
        const requestedLayerIds = Array.isArray(rawSelection?.layerIds)
            ? rawSelection.layerIds.map(String).filter(Boolean)
            : []
        const requestedLayerId = String(rawSelection?.layerId || '')
        if (!requestedLayerIds.length && requestedLayerId) {
            requestedLayerIds.push(requestedLayerId)
        }
        const availableIds = new Set(
            layers.map((layer) => String(layer?.id || '')).filter(Boolean)
        )
        const layerIds = requestedLayerIds.filter((id) => availableIds.has(id))
        const layerId = layerIds[0] || String(layers[0]?.id || '')
        const renderMode =
            rawSelection?.renderMode === 'separated' && layerIds.length
                ? 'separated'
                : 'composite'

        return { renderMode, layerId, layerIds }
    }

    /**
     * Resolves selectable Gerber source layers.
     * @param {object} documentModel Document model.
     * @returns {object[]}
     */
    static #gerberLayers(documentModel) {
        return Array.isArray(documentModel?.pcb?.fabrication?.layers)
            ? documentModel.pcb.fabrication.layers.filter((layer) =>
                  Boolean(String(layer?.id || ''))
              )
            : []
    }

    /**
     * Returns true when the document has Gerber source layers.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isGerberDocument(documentModel) {
        return (
            documentModel?.sourceFormat === 'gerber' ||
            Array.isArray(documentModel?.pcb?.fabrication?.layers)
        )
    }

    /**
     * Formats one Gerber source layer detail label.
     * @param {object} layer Source layer.
     * @returns {string}
     */
    static #formatLayerDetail(layer) {
        const role = String(layer?.role || '')
            .replace(/-/g, ' ')
            .trim()
        return role || 'Gerber file'
    }

    /**
     * Escapes user-facing markup.
     * @param {string} value Raw string.
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
