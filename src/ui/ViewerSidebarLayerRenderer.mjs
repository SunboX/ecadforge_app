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

const LAYER_GROUPS = [
    ['front', 'sidebar.front'],
    ['back', 'sidebar.back'],
    ['other', 'sidebar.otherSide']
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
                ? ViewerSidebarLayerRenderer.#renderLayerBrowser(
                      layers,
                      documentId,
                      snapshot?.hiddenPcbLayers || {},
                      translate
                  )
                : ViewerSidebarLayerRenderer.#renderEmpty(
                      translate('sidebar.noLayers')
                  ))
        )
    }

    /**
     * Renders searchable, grouped layer controls.
     * @param {any[]} layers Layer metadata.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLayerBrowser(
        layers,
        documentId,
        hiddenPcbLayers,
        translate
    ) {
        const rows = layers.map((layer, index) =>
            ViewerSidebarLayerRenderer.#buildLayerRow(
                layer,
                index,
                documentId,
                hiddenPcbLayers
            )
        )

        return (
            ViewerSidebarLayerRenderer.#renderSearch(translate) +
            ViewerSidebarLayerRenderer.#renderLayerGroups(rows, translate) +
            ViewerSidebarLayerRenderer.#renderPresetList(documentId, translate)
        )
    }

    /**
     * Builds one normalized layer row.
     * @param {any} layer Layer metadata.
     * @param {number} index Layer index.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @returns {{ color: string, documentId: string, group: string, key: string, name: string, search: string, visible: boolean }}
     */
    static #buildLayerRow(layer, index, documentId, hiddenPcbLayers) {
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
        const search = ViewerSidebarLayerRenderer.#layerSearchText(layer, key)

        return {
            color,
            documentId,
            group: ViewerSidebarLayerRenderer.#resolveLayerGroup(layer, key),
            key,
            name,
            search,
            visible
        }
    }

    /**
     * Renders the search field.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderSearch(translate) {
        const label = translate('sidebar.searchLayers')

        return (
            '<label class="viewer-sidebar__search"><span class="sr-only">' +
            ViewerSidebarLayerRenderer.#escapeHtml(label) +
            '</span><svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>' +
            '<input type="search" data-layer-filter placeholder="' +
            ViewerSidebarLayerRenderer.#escapeHtml(
                translate('sidebar.search')
            ) +
            '" aria-label="' +
            ViewerSidebarLayerRenderer.#escapeHtml(label) +
            '"></label>'
        )
    }

    /**
     * Renders all non-empty layer groups.
     * @param {{ color: string, documentId: string, group: string, key: string, name: string, search: string, visible: boolean }[]} rows Layer rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLayerGroups(rows, translate) {
        return LAYER_GROUPS.map(([groupKey, labelKey]) =>
            ViewerSidebarLayerRenderer.#renderLayerGroup(
                groupKey,
                translate(labelKey),
                rows
            )
        ).join('')
    }

    /**
     * Renders one layer group.
     * @param {string} groupKey Group key.
     * @param {string} groupLabel Group label.
     * @param {{ color: string, documentId: string, group: string, key: string, name: string, search: string, visible: boolean }[]} rows Layer rows.
     * @returns {string}
     */
    static #renderLayerGroup(groupKey, groupLabel, rows) {
        const groupRows = rows.filter((row) => row.group === groupKey)
        if (!groupRows.length) return ''

        return (
            '<div class="viewer-sidebar__component-group" data-layer-group="' +
            ViewerSidebarLayerRenderer.#escapeHtml(groupKey) +
            '"><h4>' +
            ViewerSidebarLayerRenderer.#escapeHtml(groupLabel) +
            '</h4><div class="viewer-sidebar__component-list viewer-sidebar__layer-list">' +
            groupRows
                .map((row) =>
                    ViewerSidebarLayerRenderer.#renderLayerRow(row)
                )
                .join('') +
            '</div></div>'
        )
    }

    /**
     * Renders one layer visibility row.
     * @param {{ color: string, documentId: string, key: string, name: string, search: string, visible: boolean }} row Layer row.
     * @returns {string}
     */
    static #renderLayerRow(row) {
        const hiddenClass = row.visible ? '' : ' is-hidden'
        const attributes =
            ViewerSidebarLayerRenderer.#renderLayerToggleAttributes(
                row.key,
                row.visible,
                row.documentId
            )
        const actionLabel = 'Toggle layer visibility: ' + row.name

        return (
            '<div class="viewer-sidebar__layer-row-shell' +
            hiddenClass +
            '" data-layer-search="' +
            ViewerSidebarLayerRenderer.#escapeHtml(row.search) +
            '"><button class="viewer-sidebar__row viewer-sidebar__row--layer' +
            hiddenClass +
            '" type="button" ' +
            attributes +
            '><span class="viewer-sidebar__swatch" style="--sidebar-swatch: ' +
            ViewerSidebarLayerRenderer.#escapeHtml(row.color) +
            '"></span><strong>' +
            ViewerSidebarLayerRenderer.#escapeHtml(row.name) +
            '</strong></button><button class="viewer-sidebar__layer-visibility viewer-sidebar__component-copy" type="button" ' +
            attributes +
            ' title="' +
            ViewerSidebarLayerRenderer.#escapeHtml(actionLabel) +
            '" aria-label="' +
            ViewerSidebarLayerRenderer.#escapeHtml(actionLabel) +
            '"><span class="viewer-sidebar__visibility-icon" aria-hidden="true">' +
            ViewerSidebarLayerRenderer.#renderVisibilityIcon(row.visible) +
            '</span></button></div>'
        )
    }

    /**
     * Renders shared layer visibility toggle attributes.
     * @param {string} key Stable layer key.
     * @param {boolean} visible Whether the layer is visible.
     * @param {string} documentId Active document id.
     * @returns {string}
     */
    static #renderLayerToggleAttributes(key, visible, documentId) {
        return (
            'data-pcb-layer-key="' +
            ViewerSidebarLayerRenderer.#escapeHtml(key) +
            '" data-pcb-layer-visible="' +
            (visible ? 'true' : 'false') +
            '" data-document-id="' +
            ViewerSidebarLayerRenderer.#escapeHtml(documentId) +
            '" aria-pressed="' +
            (visible ? 'true' : 'false') +
            '"'
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
     * Resolves the display group for a layer from generic side metadata.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {string}
     */
    static #resolveLayerGroup(layer, layerKey) {
        const text = ViewerSidebarLayerRenderer.#layerSearchText(
            layer,
            layerKey
        )
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        if (
            layerId === 32 ||
            layerId === 34 ||
            /\b(back|bottom)\b|\bb[._-]/.test(text)
        ) {
            return 'back'
        }
        if (
            layerId === 1 ||
            layerId === 33 ||
            /\b(front|top)\b|\bf[._-]/.test(text)
        ) {
            return 'front'
        }

        return 'other'
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
