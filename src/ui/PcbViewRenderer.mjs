import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'
import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'
import { PcbObjectOpacityCssRenderer } from '../core/PcbObjectOpacityCssRenderer.mjs'
import { PcbComponentSelectionMarkerRenderer } from './PcbComponentSelectionMarkerRenderer.mjs'
import { SvgPanelChromeStripper } from './SvgPanelChromeStripper.mjs'
import { UiText } from './UiText.mjs'

/**
 * Renders the 2D PCB viewer chrome around the format-specific SVG.
 */
export class PcbViewRenderer {
    /** @type {WeakMap<object, Map<string, string>>} */
    static #sideSvgCache = new WeakMap()

    /**
     * Renders the PCB side toolbar and active board-side SVG.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} [side] Active board side.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @param {string[]} [hiddenLayers] Hidden layer keys.
     * @param {string[]} [hiddenObjects] Hidden object category keys.
     * @param {string} [selectedComponentKey] Selected component key.
     * @param {{ [objectKey: string]: number }} [objectOpacities] Object opacity map.
     * @param {string} [selectedNetName] Selected net name.
     * @param {{ gerberRenderMode?: string, gerberLayerId?: string, gerberLayerIds?: string[] }} [viewerOptions] Format-specific PCB view options.
     * @returns {string}
     */
    static render(
        documentModel,
        side = 'top',
        translate = null,
        hiddenLayers = [],
        hiddenObjects = [],
        selectedComponentKey = '',
        objectOpacities = {},
        selectedNetName = '',
        viewerOptions = {}
    ) {
        const t = UiText.createTranslator(translate)
        const normalizedSide = PcbViewRenderer.#normalizeSide(side)
        const gerberOptions = PcbViewRenderer.#resolveGerberOptions(
            documentModel,
            viewerOptions
        )

        return (
            '<section class="pcb-view" data-pcb-view-active-side="' +
            normalizedSide +
            '" data-pcb-view-gerber-render-mode="' +
            PcbViewRenderer.#escapeHtml(gerberOptions.renderMode) +
            '">' +
            '<div class="scene-3d__toolbar pcb-view__toolbar" aria-label="' +
            PcbViewRenderer.#escapeHtml(t('pcbView.boardSideAria')) +
            '">' +
            PcbViewRenderer.#renderSideButton('top', normalizedSide, t) +
            PcbViewRenderer.#renderSideButton('bottom', normalizedSide, t) +
            '</div>' +
            '<div class="pcb-view__content">' +
            PcbViewRenderer.#renderPcbSvg(
                documentModel,
                normalizedSide,
                hiddenLayers,
                hiddenObjects,
                selectedComponentKey,
                objectOpacities,
                selectedNetName,
                gerberOptions
            ) +
            '</div>' +
            '</section>'
        )
    }

    /**
     * Renders SVG-local CSS rules for object opacity categories.
     * @param {string[]} hiddenObjectKeys Hidden object category keys.
     * @param {{ [objectKey: string]: number }} objectOpacities Object opacity map.
     * @returns {string}
     */
    static renderObjectOpacityCss(hiddenObjectKeys = [], objectOpacities = {}) {
        return PcbObjectOpacityCssRenderer.render(
            hiddenObjectKeys,
            objectOpacities
        )
    }

    /**
     * Renders the PCB SVG with visibility styles applied.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @param {string[]} hiddenLayers Hidden layer keys.
     * @param {string[]} hiddenObjects Hidden object category keys.
     * @param {string} selectedComponentKey Selected component key.
     * @param {{ [objectKey: string]: number }} objectOpacities Object opacity map.
     * @param {string} selectedNetName Selected net name.
     * @param {{ renderMode: string, layerId: string, layerIds: string[] }} gerberOptions Gerber render options.
     * @returns {string}
     */
    static #renderPcbSvg(
        documentModel,
        side,
        hiddenLayers,
        hiddenObjects,
        selectedComponentKey,
        objectOpacities,
        selectedNetName,
        gerberOptions
    ) {
        const componentMarkup = PcbViewRenderer.#renderBasePcbSvg(
            documentModel,
            side,
            gerberOptions
        )
        const layerTargets = PcbViewRenderer.#resolveLayerVisibilityTargets(
            documentModel,
            hiddenLayers,
            side
        )
        const layerMarkup = PcbViewRenderer.#injectLayerVisibilityStyle(
            componentMarkup,
            layerTargets
        )
        const visibleMarkup = PcbViewRenderer.#injectObjectOpacityStyle(
            layerMarkup,
            hiddenObjects,
            objectOpacities
        )
        const highlightedMarkup =
            PcbViewRenderer.#injectComponentHighlightStyle(
                visibleMarkup,
                selectedComponentKey
            )
        const netHighlightedMarkup = PcbViewRenderer.#injectNetHighlightStyle(
            highlightedMarkup,
            selectedNetName
        )
        const markedMarkup = PcbComponentSelectionMarkerRenderer.render(
            netHighlightedMarkup,
            documentModel,
            selectedComponentKey,
            side
        )

        return markedMarkup
    }

    /**
     * Renders or reuses the state-independent PCB SVG for one document side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @param {{ renderMode: string, layerId: string, layerIds: string[] }} gerberOptions Gerber render options.
     * @returns {string}
     */
    static #renderBasePcbSvg(documentModel, side, gerberOptions) {
        if (!PcbViewRenderer.#canCacheDocument(documentModel)) {
            return PcbViewRenderer.#createBasePcbSvg(
                documentModel,
                side,
                gerberOptions
            )
        }

        let sideCache = PcbViewRenderer.#sideSvgCache.get(documentModel)
        if (!sideCache) {
            sideCache = new Map()
            PcbViewRenderer.#sideSvgCache.set(documentModel, sideCache)
        }

        const cacheKey = PcbViewRenderer.#baseSvgCacheKey(side, gerberOptions)
        const cachedMarkup = sideCache.get(cacheKey)
        if (cachedMarkup !== undefined) return cachedMarkup

        const markup = PcbViewRenderer.#createBasePcbSvg(
            documentModel,
            side,
            gerberOptions
        )
        sideCache.set(cacheKey, markup)
        return markup
    }

    /**
     * Creates the state-independent PCB SVG for one document side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @param {{ renderMode: string, layerId: string }} gerberOptions Gerber render options.
     * @returns {string}
     */
    static #createBasePcbSvg(documentModel, side, gerberOptions) {
        const markup = EcadRendererService.renderPcb(documentModel, {
            side,
            renderMode: gerberOptions.renderMode,
            layerId: gerberOptions.layerId,
            layerIds: gerberOptions.layerIds
        })
        const netMarkup = PcbViewRenderer.#tagNetElements(markup)
        const componentMarkup = PcbViewRenderer.#tagComponentGroups(
            netMarkup,
            documentModel,
            side
        )

        return SvgPanelChromeStripper.stripMetadataHeader(componentMarkup)
    }

    /**
     * Returns true when a document can be used as a weak cache key.
     * @param {unknown} documentModel Document model candidate.
     * @returns {boolean}
     */
    static #canCacheDocument(documentModel) {
        return (
            documentModel !== null &&
            (typeof documentModel === 'object' ||
                typeof documentModel === 'function')
        )
    }

    /**
     * Injects SVG-local CSS rules for hidden data-layer values.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {{ aliases: string[], selectors: string[] }} hiddenLayerTargets Layer targets to hide.
     * @returns {string}
     */
    static #injectLayerVisibilityStyle(markup, hiddenLayerTargets) {
        const aliases = [
            ...new Set((hiddenLayerTargets.aliases || []).map(String))
        ].filter(Boolean)
        const selectors = [
            ...new Set((hiddenLayerTargets.selectors || []).map(String))
        ].filter(Boolean)
        if (!aliases.length && !selectors.length) {
            return markup
        }

        const rules = [
            ...aliases.map(
                (alias) =>
                    "[data-layer='" +
                    PcbViewRenderer.#escapeCssString(alias) +
                    "']"
            ),
            ...selectors
        ]
            .map((selector) => '.pcb-svg ' + selector + ' { display: none; }')
            .join('')

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-layer-visibility-style">' +
                PcbViewRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Resolves layer aliases and class selectors used by supported PCB SVGs.
     * @param {object} documentModel Document model.
     * @param {string[]} hiddenLayers Hidden layer keys.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {{ aliases: string[], selectors: string[] }}
     */
    static #resolveLayerVisibilityTargets(documentModel, hiddenLayers, side) {
        if (!Array.isArray(hiddenLayers) || !hiddenLayers.length) {
            return { aliases: [], selectors: [] }
        }

        const aliases = PcbLayerVisibilityModel.resolveHiddenLayerAliases(
            documentModel,
            hiddenLayers
        )
        const hidden = new Set((hiddenLayers || []).map(String))
        const selectors = []
        PcbLayerVisibilityModel.resolveLayers(documentModel).forEach(
            (layer, index) => {
                const key = PcbLayerVisibilityModel.resolveLayerKey(
                    layer,
                    index
                )
                if (
                    !PcbViewRenderer.#layerAliases(layer, key).some((alias) =>
                        hidden.has(alias)
                    )
                ) {
                    return
                }
                selectors.push(
                    ...PcbViewRenderer.#resolveRenderedLayerSelectors(
                        layer,
                        key,
                        side
                    )
                )
            }
        )

        return { aliases, selectors }
    }

    /**
     * Resolves renderer class selectors for one layer.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {string[]}
     */
    static #resolveRenderedLayerSelectors(layer, layerKey, side) {
        const text = PcbViewRenderer.#layerSearchText(layer, layerKey)
        if (layer?.sourceFormat === 'gerber') {
            return [
                "[data-layer-id='" +
                    PcbViewRenderer.#escapeCssString(layer?.id || layerKey) +
                    "']"
            ]
        }

        if (PcbViewRenderer.#isFootprintLayer(layer, text)) {
            return ['.pcb-footprints', '.pcb-texts']
        }
        if (!PcbViewRenderer.#isCopperLayer(text)) {
            return []
        }
        if (PcbViewRenderer.#isSurfaceLayer(layer, text, side)) {
            return ['.pcb-copper--surface']
        }
        return ['.pcb-copper--subsurface']
    }

    /**
     * Returns common layer aliases.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {string[]}
     */
    static #layerAliases(layer, layerKey) {
        return [
            layerKey,
            layer?.name,
            layer?.layer,
            layer?.id,
            layer?.layerId,
            layer?.number
        ]
            .filter((value) => value !== undefined && value !== null)
            .map(String)
    }

    /**
     * Builds normalized text for layer classification.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {string}
     */
    static #layerSearchText(layer, layerKey) {
        return PcbViewRenderer.#layerAliases(layer, layerKey)
            .concat([layer?.type, layer?.kind, layer?.side])
            .filter((value) => value !== undefined && value !== null)
            .join(' ')
            .toLowerCase()
    }

    /**
     * Returns true for layer types rendered as detail artwork.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isFootprintLayer(layer, text) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return (
            [33, 34].includes(layerId) ||
            /\b(assembly|courtyard|crtyd|dimension|drawing|drawings|dwg|fab|legend|mask|mechanical|overlay|paste|silk|silkscreen|silks)\b/.test(
                text
            )
        )
    }

    /**
     * Returns true when a copper layer renders as the active surface group.
     * @param {any} layer Layer metadata.
     * @param {string} text Normalized layer text.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {boolean}
     */
    static #isSurfaceLayer(layer, text, side) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        const isTop = layerId === 1 || /\b(front|top)\b|\bf[._-]/.test(text)
        const isBottom =
            layerId === 32 || /\b(back|bottom)\b|\bb[._-]/.test(text)
        return side === 'bottom' ? isBottom : isTop
    }

    /**
     * Returns true for copper/routing layers.
     * @param {string} text Normalized layer text.
     * @returns {boolean}
     */
    static #isCopperLayer(text) {
        return (
            /\b(cu|copper)\b/.test(text) ||
            /\b(top|bottom)\s+layer\b/.test(text) ||
            /\bmid[-\s]?layer\b/.test(text) ||
            /\binternal\s+plane\b/.test(text)
        )
    }

    /**
     * Injects SVG-local CSS rules for object opacity categories.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {string[]} hiddenObjectKeys Hidden object category keys.
     * @param {{ [objectKey: string]: number }} objectOpacities Object opacity map.
     * @returns {string}
     */
    static #injectObjectOpacityStyle(
        markup,
        hiddenObjectKeys,
        objectOpacities
    ) {
        const rules = PcbViewRenderer.renderObjectOpacityCss(
            hiddenObjectKeys,
            objectOpacities
        )
        if (!rules) return markup

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-object-opacity-style">' +
                PcbViewRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Adds stable component keys to grouped PCB component markup.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {string}
     */
    static #tagComponentGroups(markup, documentModel, side) {
        const components = PcbViewRenderer.#resolveSideComponents(
            documentModel,
            side
        )
        if (!components.length) return String(markup)

        let componentIndex = 0
        return String(markup).replace(
            /<g class="[^"]*\bpcb-component\b[^"]*"[^>]*>/g,
            (match) => {
                if (match.includes('data-component-key=')) return match
                const key = PcbComponentSelectionModel.resolveComponentKey(
                    components[componentIndex],
                    componentIndex
                )
                componentIndex += 1
                if (!key) return match
                return match.replace(
                    '<g ',
                    '<g data-component-key="' +
                        PcbViewRenderer.#escapeHtml(key) +
                        '" '
                )
            }
        )
    }

    /**
     * Adds app-owned net-name attributes to rendered PCB primitives.
     * @param {string} markup Renderer-owned SVG markup.
     * @returns {string}
     */
    static #tagNetElements(markup) {
        return String(markup).replace(
            /<([a-zA-Z][a-zA-Z0-9:-]*)\b(?=[^>]*\bdata-net="([^"]+)")[^>]*>/g,
            (match, _tagName, netName) => {
                if (match.includes('data-pcb-net-name=')) return match
                return match.replace(
                    /^<([a-zA-Z][a-zA-Z0-9:-]*)\b/,
                    '<$1 data-pcb-net-name="' +
                        PcbViewRenderer.#escapeHtml(netName) +
                        '"'
                )
            }
        )
    }

    /**
     * Injects SVG-local CSS rules for selected net highlighting.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {string} selectedNetName Selected net name.
     * @returns {string}
     */
    static #injectNetHighlightStyle(markup, selectedNetName) {
        const key = String(selectedNetName || '').trim()
        if (!key) return markup

        const netName = PcbViewRenderer.#escapeCssString(key)
        const rules =
            '.pcb-svg [data-pcb-net-name] {' +
            ' transition: opacity 120ms ease, filter 120ms ease, stroke 120ms ease, fill 120ms ease; }' +
            ".pcb-svg [data-pcb-net-name='" +
            netName +
            "'] { opacity: 1 !important; filter: drop-shadow(0 0 1.4px rgba(27, 191, 227, 0.68)) drop-shadow(0 0 3px rgba(27, 191, 227, 0.32)); }" +
            ".pcb-svg [data-pcb-net-name='" +
            netName +
            "'] { stroke: rgba(27, 191, 227, 0.94) !important; }" +
            ".pcb-svg [data-pcb-net-name='" +
            netName +
            "'][fill]:not([fill='none']) { fill: rgba(27, 191, 227, 0.38) !important; }"

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-net-highlight-style">' +
                PcbViewRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Injects SVG-local CSS rules for selected component highlighting.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {string} selectedComponentKey Selected component key.
     * @returns {string}
     */
    static #injectComponentHighlightStyle(markup, selectedComponentKey) {
        const key = String(selectedComponentKey || '').trim()
        if (!key) return markup

        const componentKey = PcbViewRenderer.#escapeCssString(key)
        const footprintPrefix = PcbViewRenderer.#escapeCssString(
            'footprint:' + key + ':'
        )
        const rules =
            '.pcb-svg [data-footprint-id], .pcb-svg [data-component-key] {' +
            ' transition: opacity 120ms ease, filter 120ms ease; }' +
            ".pcb-svg [data-footprint-id]:not([data-footprint-id^='" +
            footprintPrefix +
            "']), .pcb-svg [data-component-key]:not([data-component-key='" +
            componentKey +
            "']) { opacity: 0.28; }" +
            ".pcb-svg [data-footprint-id^='" +
            footprintPrefix +
            "'], .pcb-svg [data-component-key='" +
            componentKey +
            "'] { opacity: 1 !important; filter: drop-shadow(0 0 1.4px rgba(27, 191, 227, 0.68)) drop-shadow(0 0 3px rgba(27, 191, 227, 0.32)); }" +
            '.pcb-svg .pcb-component-selection-marker { pointer-events: none; }' +
            '.pcb-svg .pcb-component-selection-marker__outline { fill: none; stroke: transparent; stroke-width: 0; }' +
            '.pcb-svg .pcb-component-selection-marker__fill { fill: rgba(27, 191, 227, 0.52); stroke: transparent; stroke-width: 0; vector-effect: non-scaling-stroke; filter: drop-shadow(0 0 1.4px rgba(27, 191, 227, 0.62)); }'

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-component-highlight-style">' +
                PcbViewRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Returns the component subset rendered for the active board side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {object[]}
     */
    static #resolveSideComponents(documentModel, side) {
        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        const classified = components.map((component) => ({
            component,
            side: PcbComponentSelectionModel.resolveComponentSide(component)
        }))
        const hasClassifiedSide = classified.some((entry) => entry.side)
        const filtered = classified
            .filter((entry) => {
                return entry.side ? entry.side === side : side === 'top'
            })
            .map((entry) => entry.component)

        return filtered.length || hasClassifiedSide ? filtered : components
    }

    /**
     * Renders one side selector button.
     * @param {'top' | 'bottom'} side Button side.
     * @param {'top' | 'bottom'} activeSide Active side.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderSideButton(side, activeSide, translate) {
        const isActive = side === activeSide
        const label =
            side === 'bottom'
                ? translate('scene3d.bottom')
                : translate('scene3d.top')

        return (
            '<button class="scene-3d__preset pcb-view__side' +
            (isActive ? ' is-active' : '') +
            '" type="button" data-pcb-view-side="' +
            side +
            '" aria-pressed="' +
            (isActive ? 'true' : 'false') +
            '">' +
            PcbViewRenderer.#escapeHtml(label) +
            '</button>'
        )
    }

    /**
     * Resolves Gerber render options from the document and caller options.
     * @param {object} documentModel Document model.
     * @param {{ gerberRenderMode?: string, gerberLayerId?: string, gerberLayerIds?: string[] }} viewerOptions View options.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[] }}
     */
    static #resolveGerberOptions(documentModel, viewerOptions) {
        if (!PcbViewRenderer.#isGerberDocument(documentModel)) {
            return { renderMode: '', layerId: '', layerIds: [] }
        }

        const layers = PcbViewRenderer.#gerberLayers(documentModel)
        const requestedLayerIds = Array.isArray(viewerOptions.gerberLayerIds)
            ? viewerOptions.gerberLayerIds.map(String).filter(Boolean)
            : []
        const requestedLayerId = String(viewerOptions.gerberLayerId || '')
        if (!requestedLayerIds.length && requestedLayerId) {
            requestedLayerIds.push(requestedLayerId)
        }
        const validLayerIds = requestedLayerIds.filter((layerId) =>
            layers.some((layer) => String(layer?.id || '') === layerId)
        )
        const layerIds = validLayerIds.length
            ? validLayerIds
            : [String(layers[0]?.id || '')].filter(Boolean)
        const layerId = layerIds[0] || ''
        const renderMode =
            viewerOptions.gerberRenderMode === 'separated' && layerIds.length
                ? 'separated'
                : 'composite'

        return { renderMode, layerId, layerIds }
    }

    /**
     * Resolves Gerber source layers.
     * @param {object} documentModel Document model.
     * @returns {object[]}
     */
    static #gerberLayers(documentModel) {
        return Array.isArray(documentModel?.pcb?.fabrication?.layers)
            ? documentModel.pcb.fabrication.layers
            : []
    }

    /**
     * Returns true when a document is a Gerber fabrication document.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isGerberDocument(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'gerber'
        )
    }

    /**
     * Builds a cache key for base PCB SVG markup.
     * @param {'top' | 'bottom'} side Active side.
     * @param {{ renderMode: string, layerId: string, layerIds: string[] }} gerberOptions Gerber render options.
     * @returns {string}
     */
    static #baseSvgCacheKey(side, gerberOptions) {
        return [
            side,
            String(gerberOptions.renderMode || ''),
            String(gerberOptions.layerId || ''),
            (gerberOptions.layerIds || []).join(',')
        ].join('|')
    }

    /**
     * Normalizes untrusted side input to the supported board-side names.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizeSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
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
