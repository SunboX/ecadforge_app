import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'

const PCB_LAYER_SWATCH_COLORS = {
    footprint: 'rgba(66, 93, 112, 0.72)',
    subsurface: 'rgba(15, 116, 108, 0.56)',
    surface: 'rgba(199, 82, 45, 0.92)'
}

const GERBER_LAYER_ROLE_LABELS = {
    'top-paste': 'Top Paste',
    'top-silkscreen': 'Top Silk',
    'top-soldermask': 'Top Solder',
    'top-copper': 'Top Layer',
    'bottom-copper': 'Bot Layer',
    'bottom-soldermask': 'Bot Solder',
    'bottom-silkscreen': 'Bot Silk',
    'bottom-paste': 'Bot Paste',
    'board-outline': 'Outline',
    'drill-map': 'Drl Drawing'
}

const PRESETS = [
    ['all', 'sidebar.presetAll'],
    ['front', 'sidebar.presetFront'],
    ['back', 'sidebar.presetBack'],
    ['copper', 'sidebar.presetCopper'],
    ['drawings', 'sidebar.presetDrawings']
]

const LAYER_GROUPS = [
    ['copper', 'sidebar.layerGroupCopper'],
    ['solder-mask', 'sidebar.layerGroupSolderMask'],
    ['paste-mask', 'sidebar.layerGroupPasteMask'],
    ['adhesive', 'sidebar.layerGroupAdhesive'],
    ['silkscreen', 'sidebar.layerGroupSilkscreen'],
    ['mechanical', 'sidebar.layerGroupMechanical'],
    ['drawings', 'sidebar.layerGroupDrawings'],
    ['user', 'sidebar.layerGroupUser'],
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
                      documentModel,
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
     * @param {any} documentModel Active document model.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLayerBrowser(
        layers,
        documentModel,
        documentId,
        hiddenPcbLayers,
        translate
    ) {
        const rows = layers.map((layer, index) =>
            ViewerSidebarLayerRenderer.#buildLayerRow(
                layer,
                index,
                documentModel,
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
     * @param {any} documentModel Active document model.
     * @param {string} documentId Active document id.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @returns {{ color: string, documentId: string, group: string, key: string, name: string, order: number, search: string, visible: boolean }}
     */
    static #buildLayerRow(
        layer,
        index,
        documentModel,
        documentId,
        hiddenPcbLayers
    ) {
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
        const name = ViewerSidebarLayerRenderer.#resolveLayerName(
            layer,
            key,
            documentModel
        )
        const search = ViewerSidebarLayerRenderer.#layerSearchText(layer, key)
        const group = ViewerSidebarLayerRenderer.#resolveLayerGroup(layer, key)

        return {
            color,
            documentId,
            group,
            key,
            name,
            order: ViewerSidebarLayerRenderer.#resolveLayerOrder(
                layer,
                key,
                group,
                index
            ),
            search: ViewerSidebarLayerRenderer.#buildLayerSearchText(
                name,
                search
            ),
            visible
        }
    }

    /**
     * Builds the user-facing layer row label.
     * @param {any} layer Layer metadata.
     * @param {string} key Stable layer key.
     * @param {any} documentModel Active document model.
     * @returns {string}
     */
    static #resolveLayerName(layer, key, documentModel) {
        const displayName = String(layer?.displayName || '').trim()
        if (displayName) return displayName

        const gerberName = ViewerSidebarLayerRenderer.#resolveGerberLayerName(
            layer,
            key,
            documentModel
        )
        if (gerberName) return gerberName

        return String(layer?.name || key)
    }

    /**
     * Resolves standard Gerber fabrication roles to familiar board layer names.
     * @param {any} layer Layer metadata.
     * @param {string} key Stable layer key.
     * @param {any} documentModel Active document model.
     * @returns {string}
     */
    static #resolveGerberLayerName(layer, key, documentModel) {
        if (!ViewerSidebarLayerRenderer.#isGerberLayer(layer, documentModel)) {
            return ''
        }

        const role = String(layer?.role || '')
            .trim()
            .toLowerCase()
        if (role === 'plated-drill' || role === 'nonplated-drill') {
            return ViewerSidebarLayerRenderer.#isSlotLayer(layer, key)
                ? 'Slot'
                : 'Drl'
        }
        if (GERBER_LAYER_ROLE_LABELS[role]) {
            return GERBER_LAYER_ROLE_LABELS[role]
        }

        return ViewerSidebarLayerRenderer.#baseName(
            layer?.name || layer?.fileName || key
        )
    }

    /**
     * Returns true when a row came from a Gerber fabrication source layer.
     * @param {any} layer Layer metadata.
     * @param {any} documentModel Active document model.
     * @returns {boolean}
     */
    static #isGerberLayer(layer, documentModel) {
        const sourceFormat = String(
            layer?.sourceFormat || documentModel?.sourceFormat || ''
        ).toLowerCase()
        if (sourceFormat === 'gerber') return true

        const sourceName = String(layer?.name || layer?.fileName || '')
        return (
            /\.g(?:tl|bl|to|bo|ts|bs|tp|bp|ko|m\d*)$/iu.test(sourceName) ||
            /\.drl$|(?:round|slot)[-_\s]?holes?\.txt$/iu.test(sourceName)
        )
    }

    /**
     * Returns true when a drill layer represents routed slots.
     * @param {any} layer Layer metadata.
     * @param {string} key Stable layer key.
     * @returns {boolean}
     */
    static #isSlotLayer(layer, key) {
        return /\bslot[-_\s]?holes?\b|\bslots?\b/iu.test(
            [key, layer?.name, layer?.fileName, layer?.displayName, layer?.id]
                .filter((value) => value !== undefined && value !== null)
                .join(' ')
        )
    }

    /**
     * Returns the final path segment for fallback fabrication layer labels.
     * @param {unknown} value Raw path-like value.
     * @returns {string}
     */
    static #baseName(value) {
        const text = String(value || '').replace(/\\+/gu, '/')
        return text.split('/').filter(Boolean).pop() || text
    }

    /**
     * Builds searchable text that includes the rendered label and source data.
     * @param {string} name Rendered layer label.
     * @param {string} sourceText Source metadata search text.
     * @returns {string}
     */
    static #buildLayerSearchText(name, sourceText) {
        return [name, sourceText].filter(Boolean).join(' ').toLowerCase()
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
     * @param {{ color: string, documentId: string, group: string, key: string, name: string, order: number, search: string, visible: boolean }[]} rows Layer rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLayerGroups(rows, translate) {
        return LAYER_GROUPS.map(([groupKey, labelKey]) =>
            ViewerSidebarLayerRenderer.#renderLayerGroup(
                groupKey,
                translate(labelKey),
                rows,
                translate
            )
        ).join('')
    }

    /**
     * Renders one layer group.
     * @param {string} groupKey Group key.
     * @param {string} groupLabel Group label.
     * @param {{ color: string, documentId: string, group: string, key: string, name: string, order: number, search: string, visible: boolean }[]} rows Layer rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLayerGroup(groupKey, groupLabel, rows, translate) {
        const groupRows = rows
            .filter((row) => row.group === groupKey)
            .sort((left, right) => left.order - right.order)
        if (!groupRows.length) return ''

        const groupVisible = groupRows.some((row) => row.visible)
        const hiddenClass = groupVisible ? '' : ' is-hidden'
        const groupKeys = groupRows.map((row) => row.key)
        const groupDocumentId = groupRows[0]?.documentId || ''
        const onlyActionLabel = translate('sidebar.layerOnly')
        const onlyLabel = ViewerSidebarLayerRenderer.#formatMessage(
            translate('sidebar.layerOnlyGroupTitle'),
            { group: groupLabel }
        )
        const toggleLabel = ViewerSidebarLayerRenderer.#formatMessage(
            translate('sidebar.layerToggleGroupTitle'),
            { group: groupLabel }
        )

        return (
            '<details class="viewer-sidebar__component-group viewer-sidebar__layer-group' +
            hiddenClass +
            '" data-layer-group="' +
            ViewerSidebarLayerRenderer.#escapeHtml(groupKey) +
            '" open><summary class="viewer-sidebar__layer-group-summary"><span class="viewer-sidebar__layer-group-disclosure" aria-hidden="true">' +
            ViewerSidebarLayerRenderer.#renderDisclosureIcon() +
            '</span><h4>' +
            ViewerSidebarLayerRenderer.#escapeHtml(groupLabel) +
            '</h4><button class="viewer-sidebar__layer-only viewer-sidebar__layer-group-only" type="button" ' +
            ViewerSidebarLayerRenderer.#renderLayerOnlyAttributes(
                groupKeys[0],
                groupDocumentId,
                groupKeys
            ) +
            ' title="' +
            ViewerSidebarLayerRenderer.#escapeHtml(onlyLabel) +
            '" aria-label="' +
            ViewerSidebarLayerRenderer.#escapeHtml(onlyLabel) +
            '">' +
            ViewerSidebarLayerRenderer.#escapeHtml(onlyActionLabel) +
            '</button><button class="viewer-sidebar__layer-visibility viewer-sidebar__component-copy viewer-sidebar__layer-group-visibility" type="button" ' +
            ViewerSidebarLayerRenderer.#renderLayerToggleAttributes(
                groupKeys[0],
                groupVisible,
                groupDocumentId,
                groupKeys
            ) +
            ' title="' +
            ViewerSidebarLayerRenderer.#escapeHtml(toggleLabel) +
            '" aria-label="' +
            ViewerSidebarLayerRenderer.#escapeHtml(toggleLabel) +
            '"><span class="viewer-sidebar__visibility-icon" aria-hidden="true">' +
            ViewerSidebarLayerRenderer.#renderVisibilityIcon(groupVisible) +
            '</span></button></summary><div class="viewer-sidebar__component-list viewer-sidebar__layer-list">' +
            groupRows
                .map((row) =>
                    ViewerSidebarLayerRenderer.#renderLayerRow(row, translate)
                )
                .join('') +
            '</div></details>'
        )
    }

    /**
     * Renders the disclosure icon for collapsible layer groups.
     * @returns {string}
     */
    static #renderDisclosureIcon() {
        return (
            '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">' +
            '<path d="m9 6 6 6-6 6" /></svg>'
        )
    }

    /**
     * Renders one layer visibility row.
     * @param {{ color: string, documentId: string, key: string, name: string, search: string, visible: boolean }} row Layer row.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLayerRow(row, translate) {
        const hiddenClass = row.visible ? '' : ' is-hidden'
        const attributes =
            ViewerSidebarLayerRenderer.#renderLayerToggleAttributes(
                row.key,
                row.visible,
                row.documentId,
                [row.key]
            )
        const onlyAttributes =
            ViewerSidebarLayerRenderer.#renderLayerOnlyAttributes(
                row.key,
                row.documentId,
                [row.key]
            )
        const onlyActionLabel = translate('sidebar.layerOnly')
        const actionLabel = ViewerSidebarLayerRenderer.#formatMessage(
            translate('sidebar.layerToggleTitle'),
            { layer: row.name }
        )
        const onlyLabel = ViewerSidebarLayerRenderer.#formatMessage(
            translate('sidebar.layerOnlyTitle'),
            { layer: row.name }
        )

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
            '</strong></button><button class="viewer-sidebar__layer-only' +
            hiddenClass +
            '" type="button" ' +
            onlyAttributes +
            ' title="' +
            ViewerSidebarLayerRenderer.#escapeHtml(onlyLabel) +
            '" aria-label="' +
            ViewerSidebarLayerRenderer.#escapeHtml(onlyLabel) +
            '">' +
            ViewerSidebarLayerRenderer.#escapeHtml(onlyActionLabel) +
            '</button><button class="viewer-sidebar__layer-visibility viewer-sidebar__component-copy" type="button" ' +
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
     * Applies simple named placeholders to translated sidebar labels.
     * @param {string} template Message template.
     * @param {{ [name: string]: string }} values Placeholder values.
     * @returns {string}
     */
    static #formatMessage(template, values) {
        return String(template || '').replace(
            /\{([a-zA-Z0-9_-]+)\}/g,
            (_match, key) => String(values?.[key] ?? '')
        )
    }

    /**
     * Renders shared layer "only" attributes.
     * @param {string} key Primary layer key.
     * @param {string} documentId Active document id.
     * @param {string[]} layerKeys Layer keys included by the action.
     * @returns {string}
     */
    static #renderLayerOnlyAttributes(key, documentId, layerKeys) {
        return (
            'data-pcb-layer-action="only" data-pcb-layer-key="' +
            ViewerSidebarLayerRenderer.#escapeHtml(key) +
            '" ' +
            ViewerSidebarLayerRenderer.#renderLayerKeysAttribute(layerKeys) +
            ' data-document-id="' +
            ViewerSidebarLayerRenderer.#escapeHtml(documentId) +
            '"'
        )
    }

    /**
     * Renders shared layer visibility toggle attributes.
     * @param {string} key Stable layer key.
     * @param {boolean} visible Whether the layer is visible.
     * @param {string} documentId Active document id.
     * @param {string[]} layerKeys Layer keys included by the action.
     * @returns {string}
     */
    static #renderLayerToggleAttributes(
        key,
        visible,
        documentId,
        layerKeys = [key]
    ) {
        return (
            'data-pcb-layer-action="toggle" data-pcb-layer-key="' +
            ViewerSidebarLayerRenderer.#escapeHtml(key) +
            '" data-pcb-layer-visible="' +
            (visible ? 'true' : 'false') +
            '" data-document-id="' +
            ViewerSidebarLayerRenderer.#escapeHtml(documentId) +
            '" ' +
            ViewerSidebarLayerRenderer.#renderLayerKeysAttribute(layerKeys) +
            ' aria-pressed="' +
            (visible ? 'true' : 'false') +
            '"'
        )
    }

    /**
     * Renders a JSON encoded layer key list attribute.
     * @param {string[]} layerKeys Layer keys included by the action.
     * @returns {string}
     */
    static #renderLayerKeysAttribute(layerKeys) {
        const json = JSON.stringify((layerKeys || []).map(String))
        return (
            'data-pcb-layer-keys="' +
            ViewerSidebarLayerRenderer.#escapeHtml(json) +
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
     * Resolves the display group for a layer from fabrication-family metadata.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {string}
     */
    static #resolveLayerGroup(layer, layerKey) {
        const text = ViewerSidebarLayerRenderer.#layerSearchText(
            layer,
            layerKey
        )

        if (ViewerSidebarLayerRenderer.#isSolderMaskLayer(text)) {
            return 'solder-mask'
        }
        if (ViewerSidebarLayerRenderer.#isPasteMaskLayer(text)) {
            return 'paste-mask'
        }
        if (ViewerSidebarLayerRenderer.#isAdhesiveLayer(text)) {
            return 'adhesive'
        }
        if (ViewerSidebarLayerRenderer.#isSilkscreenLayer(text)) {
            return 'silkscreen'
        }
        if (ViewerSidebarLayerRenderer.#isCopperLayer(text)) {
            return 'copper'
        }
        if (ViewerSidebarLayerRenderer.#isMechanicalLayer(text)) {
            return 'mechanical'
        }
        if (ViewerSidebarLayerRenderer.#isDrawingLayer(text)) {
            return 'drawings'
        }
        if (ViewerSidebarLayerRenderer.#isUserLayer(text)) {
            return 'user'
        }

        return 'other'
    }

    /**
     * Resolves a stable order within one display group.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @param {string} group Display group key.
     * @param {number} index Source layer index.
     * @returns {number}
     */
    static #resolveLayerOrder(layer, layerKey, group, index) {
        const text = ViewerSidebarLayerRenderer.#layerSearchText(
            layer,
            layerKey
        )
        const tieBreak = index / 10000

        if (group === 'copper') {
            if (ViewerSidebarLayerRenderer.#isTopCopperLayer(layer, text)) {
                return tieBreak
            }
            const internalNumber =
                ViewerSidebarLayerRenderer.#internalLayerNumber(text)
            if (internalNumber !== null) {
                return 100 + internalNumber + tieBreak
            }
            if (ViewerSidebarLayerRenderer.#isBottomCopperLayer(layer, text)) {
                return 10000 + tieBreak
            }
            return 5000 + tieBreak
        }

        if (
            group === 'solder-mask' ||
            group === 'paste-mask' ||
            group === 'adhesive' ||
            group === 'silkscreen'
        ) {
            return ViewerSidebarLayerRenderer.#surfaceSideOrder(text) + tieBreak
        }

        if (group === 'mechanical') {
            return (
                ViewerSidebarLayerRenderer.#mechanicalLayerOrder(text) +
                tieBreak
            )
        }

        if (group === 'other') {
            return ViewerSidebarLayerRenderer.#otherLayerOrder(text) + tieBreak
        }

        return index
    }

    /**
     * Returns an ordering number for top, middle, and bottom fabrication rows.
     * @param {string} text Normalized layer text.
     * @returns {number}
     */
    static #surfaceSideOrder(text) {
        if (/\b(front|top)\b|\bf[._-]/.test(text)) return 0
        if (/\b(back|bottom)\b|\bb[._-]/.test(text)) return 1000
        return 500
    }

    /**
     * Returns an ordering number for common mechanical layer roles.
     * @param {string} text Normalized layer text.
     * @returns {number}
     */
    static #mechanicalLayerOrder(text) {
        const mechanical = text.match(/\bmechanical\s+(\d+)\b/)
        if (mechanical) {
            const number = Number(mechanical[1])
            return Number.isFinite(number) ? number : 0
        }
        if (/\bassembly\b/.test(text)) {
            return 1000 + ViewerSidebarLayerRenderer.#surfaceSideOrder(text)
        }
        if (/\b(courtyard|crtyd)\b/.test(text)) {
            return 2000 + ViewerSidebarLayerRenderer.#surfaceSideOrder(text)
        }
        if (/\bdimension\b/.test(text)) {
            return 3000 + ViewerSidebarLayerRenderer.#surfaceSideOrder(text)
        }
        if (/\bfab\b/.test(text)) {
            return 4000 + ViewerSidebarLayerRenderer.#surfaceSideOrder(text)
        }
        return 5000 + ViewerSidebarLayerRenderer.#surfaceSideOrder(text)
    }

    /**
     * Returns an ordering number for common utility layers.
     * @param {string} text Normalized layer text.
     * @returns {number}
     */
    static #otherLayerOrder(text) {
        if (/\bmulti[-\s]?layer\b/.test(text)) return 0
        if (/\bdrill\s+guide\b/.test(text)) return 100
        if (/\bkeep[-\s]?out\b/.test(text)) return 200
        if (/\bdrill\s+drawing\b/.test(text)) return 300
        return 1000
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
            layer?.displayName,
            layer?.name,
            layer?.fileName,
            layer?.layer,
            layer?.type,
            layer?.kind,
            layer?.side,
            layer?.role,
            layer?.id,
            layer?.layerId,
            layer?.legacyLayerId,
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

        return (
            /\b(assembly|courtyard|crtyd|dimension|drawing|drawings|dwg|fab|legend|mask|mechanical|overlay|paste|silk|silkscreen|silks|solder)\b/.test(
                text
            ) ||
            ViewerSidebarLayerRenderer.#isAdhesiveLayer(text) ||
            ViewerSidebarLayerRenderer.#isDrawingLayer(text)
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
        return ViewerSidebarLayerRenderer.#isTopCopperLayer(layer, text)
    }

    /**
     * Returns true for layers rendered as the far-side copper color.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isSubsurfaceLayer(layer, text) {
        return (
            ViewerSidebarLayerRenderer.#isBottomCopperLayer(layer, text) ||
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
        return (
            /\b(cu|copper)\b/.test(text) ||
            /(^|[._\-\s])cu($|[._\-\s])/.test(text) ||
            /\b(top|bottom)\s+layer\b/.test(text) ||
            /\bmid[-\s]?layer\b/.test(text) ||
            /\binternal\s+plane\b/.test(text) ||
            /\binternal[-_\s]*\d+\b/.test(text) ||
            /\binternal[-_\s]+layer\b/.test(text) ||
            /\binner[-_\s]*\d+\b/.test(text)
        )
    }

    /**
     * Returns true for top copper layers.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isTopCopperLayer(layer, text) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return (
            layerId === 1 ||
            layerId === 0x01000001 ||
            /\btop\s+layer\b|\btop[-_\s]?copper\b|\bf[._-]cu\b|\bfront\s+copper\b/.test(
                text
            )
        )
    }

    /**
     * Returns true for bottom copper layers.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isBottomCopperLayer(layer, text) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return (
            layerId === 32 ||
            layerId === 0x0100ffff ||
            /\bbottom\s+layer\b|\bbot\s+layer\b|\bbottom[-_\s]?copper\b|\bb[._-]cu\b|\bback\s+copper\b/.test(
                text
            )
        )
    }

    /**
     * Returns the internal copper layer number, if present.
     * @param {string} text Normalized layer text.
     * @returns {number | null}
     */
    static #internalLayerNumber(text) {
        const match = text.match(
            /\b(?:inner|internal|mid[-\s]?layer|internal\s+plane)[-_\s]*(\d+)\b/
        )
        if (!match) return null
        const number = Number(match[1])
        return Number.isFinite(number) ? number : null
    }

    /**
     * Returns true for solder mask rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isSolderMaskLayer(text) {
        return /\bsolder[-_\s]?mask\b|\b(top|bottom)\s+solder\b|(^|[._\-\s])mask($|[._\-\s])/.test(
            text
        )
    }

    /**
     * Returns true for paste mask rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isPasteMaskLayer(text) {
        return /\bpaste[-_\s]?mask\b|\b(top|bottom)\s+paste\b|(^|[._\-\s])paste($|[._\-\s])/.test(
            text
        )
    }

    /**
     * Returns true for adhesive rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isAdhesiveLayer(text) {
        return /\badhes(?:ive)?\b|(^|[._\-\s])adhes($|[._\-\s])/.test(text)
    }

    /**
     * Returns true for silkscreen rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isSilkscreenLayer(text) {
        return /\b(silk|silkscreen|silks|overlay|legend)\b/.test(text)
    }

    /**
     * Returns true for board drawing and documentation rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isDrawingLayer(text) {
        return (
            /(^|[\s])(?:dwgs|cmts|eco\d+)\.user($|[\s])/.test(text) ||
            /(^|[\s])edge\.cuts($|[\s])/.test(text) ||
            /(^|[\s])margin($|[\s])/.test(text) ||
            /(^|[\s])user\.(?:drawings?|comments?|eco\d+|margin)($|[\s])/.test(
                text
            )
        )
    }

    /**
     * Returns true for mechanical/documentation rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isMechanicalLayer(text) {
        return /\b(mechanical|mech|assembly|courtyard|crtyd|dimension|fab)\b/.test(
            text
        )
    }

    /**
     * Returns true for custom numbered user rows.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isUserLayer(text) {
        return /(^|[\s])user[._-]?\d+\b/.test(text)
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
