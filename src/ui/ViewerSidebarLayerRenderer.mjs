import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'

const PCB_LAYER_SWATCH_COLORS = {
    footprint: 'rgba(66, 93, 112, 0.72)',
    subsurface: 'rgba(15, 116, 108, 0.56)',
    surface: 'rgba(199, 82, 45, 0.92)'
}

const PRESETS = [
    ['all', 'sidebar.presetAll'],
    ['front', 'sidebar.presetFront'],
    ['back', 'sidebar.presetBack'],
    ['copper', 'sidebar.presetCopper'],
    ['drawings', 'sidebar.presetDrawings']
]

/**
 * Renders PCB layer visibility controls for the viewer sidebar.
 */
export class ViewerSidebarLayerRenderer {
    /**
     * Renders the layer panel.
     * @param {{ activeDocumentId?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, documentModel?: any }} snapshot Viewer snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static render(snapshot, translate) {
        const documentModel = snapshot?.documentModel || null
        const layers = PcbLayerVisibilityModel.resolveLayers(documentModel)
        const documentId = String(snapshot?.activeDocumentId || '')

        return (
            ViewerSidebarLayerRenderer.#renderPanelHeader(
                translate('sidebar.layers')
            ) +
            (layers.length
                ? '<div class="viewer-sidebar__list">' +
                  layers
                      .map((layer, index) =>
                          ViewerSidebarLayerRenderer.#renderLayerRow(
                              layer,
                              index,
                              documentId,
                              snapshot?.hiddenPcbLayers || {}
                          )
                      )
                      .join('') +
                  '</div>' +
                  ViewerSidebarLayerRenderer.#renderPresetList(
                      documentId,
                      translate
                  )
                : ViewerSidebarLayerRenderer.#renderEmpty(
                      translate('sidebar.noLayers')
                  ))
        )
    }

    /**
     * Renders one layer visibility row.
     * @param {any} layer Layer metadata.
     * @param {number} index Layer index.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @returns {string}
     */
    static #renderLayerRow(layer, index, documentId, hiddenPcbLayers) {
        const key = PcbLayerVisibilityModel.resolveLayerKey(layer, index)
        const color = ViewerSidebarLayerRenderer.#resolveLayerSwatchColor(
            layer,
            key
        )
        const visible = !PcbLayerVisibilityModel.isLayerHidden(
            hiddenPcbLayers,
            documentId,
            key
        )
        const name = String(layer?.name || key)

        return (
            '<button class="viewer-sidebar__row viewer-sidebar__row--layer' +
            (visible ? '' : ' is-hidden') +
            '" type="button" data-pcb-layer-key="' +
            ViewerSidebarLayerRenderer.#escapeHtml(key) +
            '" data-pcb-layer-visible="' +
            (visible ? 'true' : 'false') +
            '" data-document-id="' +
            ViewerSidebarLayerRenderer.#escapeHtml(documentId) +
            '" aria-pressed="' +
            (visible ? 'true' : 'false') +
            '">' +
            '<span class="viewer-sidebar__visibility-icon" aria-hidden="true">' +
            ViewerSidebarLayerRenderer.#renderVisibilityIcon(visible) +
            '</span><span class="viewer-sidebar__swatch" style="--sidebar-swatch: ' +
            ViewerSidebarLayerRenderer.#escapeHtml(color) +
            '"></span><strong>' +
            ViewerSidebarLayerRenderer.#escapeHtml(name) +
            '</strong></button>'
        )
    }

    /**
     * Renders preset buttons for common layer visibility sets.
     * @param {string} documentId Active document id.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderPresetList(documentId, translate) {
        return (
            '<div class="viewer-sidebar__section"><h4>' +
            ViewerSidebarLayerRenderer.#escapeHtml(
                translate('sidebar.presets')
            ) +
            '</h4><div class="viewer-sidebar__chips">' +
            PRESETS.map(
                ([preset, key]) =>
                    '<button class="viewer-sidebar__chip" type="button" data-pcb-layer-preset="' +
                    preset +
                    '" data-document-id="' +
                    ViewerSidebarLayerRenderer.#escapeHtml(documentId) +
                    '">' +
                    ViewerSidebarLayerRenderer.#escapeHtml(translate(key)) +
                    '</button>'
            ).join('') +
            '</div></div>'
        )
    }

    /**
     * Renders a panel heading.
     * @param {string} title Panel title.
     * @returns {string}
     */
    static #renderPanelHeader(title) {
        return (
            '<header class="viewer-sidebar__panel-header"><h3>' +
            ViewerSidebarLayerRenderer.#escapeHtml(title) +
            '</h3></header>'
        )
    }

    /**
     * Renders an empty panel message.
     * @param {string} message Empty message.
     * @returns {string}
     */
    static #renderEmpty(message) {
        return (
            '<p class="viewer-sidebar__empty">' +
            ViewerSidebarLayerRenderer.#escapeHtml(message) +
            '</p>'
        )
    }

    /**
     * Resolves the sidebar swatch color from the app PCB renderer palette.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {string}
     */
    static #resolveLayerSwatchColor(layer, layerKey) {
        const text = ViewerSidebarLayerRenderer.#layerSearchText(
            layer,
            layerKey
        )
        if (ViewerSidebarLayerRenderer.#isFootprintLayer(layer, text)) {
            return PCB_LAYER_SWATCH_COLORS.footprint
        }
        if (ViewerSidebarLayerRenderer.#isSubsurfaceLayer(layer, text)) {
            return PCB_LAYER_SWATCH_COLORS.subsurface
        }
        if (ViewerSidebarLayerRenderer.#isSurfaceLayer(layer, text)) {
            return PCB_LAYER_SWATCH_COLORS.surface
        }
        if (ViewerSidebarLayerRenderer.#isCopperLayer(text)) {
            return PCB_LAYER_SWATCH_COLORS.subsurface
        }

        return String(layer?.color || PCB_LAYER_SWATCH_COLORS.footprint)
    }

    /**
     * Builds normalized text for layer palette classification.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {string}
     */
    static #layerSearchText(layer, layerKey) {
        return [
            layerKey,
            layer?.name,
            layer?.layer,
            layer?.type,
            layer?.kind,
            layer?.side,
            layer?.id,
            layer?.layerId,
            layer?.number
        ]
            .filter((value) => value !== undefined && value !== null)
            .join(' ')
            .toLowerCase()
    }

    /**
     * Returns true for layer types rendered with footprint/detail color.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isFootprintLayer(layer, text) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        if ([33, 34].includes(layerId)) {
            return true
        }

        return /\b(assembly|courtyard|crtyd|dimension|drawing|drawings|dwg|fab|legend|mask|mechanical|overlay|paste|silk|silkscreen|silks)\b/.test(
            text
        )
    }

    /**
     * Returns true for layers rendered as the near-side copper color.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isSurfaceLayer(layer, text) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return layerId === 1 || /\b(front|top)\b|\bf[._-]/.test(text)
    }

    /**
     * Returns true for layers rendered as the far-side copper color.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isSubsurfaceLayer(layer, text) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return (
            layerId === 32 ||
            /\b(back|bottom|internal|plane)\b|\bb[._-]|\bmid[-\s]?layer\b/.test(
                text
            )
        )
    }

    /**
     * Returns true for copper or routing layer names.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isCopperLayer(text) {
        return /\b(cu|copper)\b|\blayer\b/.test(text)
    }

    /**
     * Renders an eye icon for layer visibility state.
     * @param {boolean} visible Whether the layer is visible.
     * @returns {string}
     */
    static #renderVisibilityIcon(visible) {
        const slash = visible ? '' : '<path d="M4 4l16 16" />'
        return (
            '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" />' +
            '<circle cx="12" cy="12" r="2.5" />' +
            slash +
            '</svg>'
        )
    }

    /**
     * Escapes text for safe HTML insertion.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
