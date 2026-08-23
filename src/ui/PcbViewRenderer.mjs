import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { PcbComponentSelectionModel } from '../core/PcbComponentSelectionModel.mjs'
import { EcadDocumentComponents } from '../core/ecad/EcadDocumentComponents.mjs'
import { PcbLayerVisibilityModel } from '../core/PcbLayerVisibilityModel.mjs'
import { PcbObjectOpacityCssRenderer } from '../core/PcbObjectOpacityCssRenderer.mjs'
import { PcbComponentSideAttributeRenderer } from './PcbComponentSideAttributeRenderer.mjs'
import { PcbComponentSelectionMarkerRenderer } from './PcbComponentSelectionMarkerRenderer.mjs'
import { PcbBaseSvgCacheKey } from './PcbBaseSvgCacheKey.mjs'
import { PcbDiagnosticFocusRenderer } from './PcbDiagnosticFocusRenderer.mjs'
import { PcbMechanicalDrawingsToggleRenderer } from './PcbMechanicalDrawingsToggleRenderer.mjs'
import { PcbMeasurementRenderer } from './PcbMeasurementRenderer.mjs'
import { PcbNetHighlightCssRenderer } from './PcbNetHighlightCssRenderer.mjs'
import { PcbViewGerberLayerSelection } from './PcbViewGerberLayerSelection.mjs'
import { PcbViewInteractionPreparation } from './PcbViewInteractionPreparation.mjs'
import { PcbViewportToolbarRenderer } from './PcbViewportToolbarRenderer.mjs'
import { SvgPanelChromeStripper } from './SvgPanelChromeStripper.mjs'
import { UiText } from './UiText.mjs'
import { ViewportInteractionGateRenderer } from './ViewportInteractionGateRenderer.mjs'

const PCB_VIEWPORT_TOOLBAR_CONTROLS_VISIBLE = false

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
     * @param {{ documentId?: string, gerberRenderMode?: string, gerberLayerId?: string, gerberLayerIds?: string[], measurement?: object, hoveredNetName?: string, showTraceLengths?: boolean, hoverFocusEnabled?: boolean, focusedDiagnosticId?: string }} [viewerOptions] Format-specific PCB view options.
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
        const gerberOptions = PcbViewGerberLayerSelection.resolve(
            documentModel,
            viewerOptions,
            hiddenLayers
        )
        const measurement = PcbMeasurementRenderer.normalize(
            viewerOptions.measurement
        )
        const hoveredNetName = String(viewerOptions.hoveredNetName || '').trim()
        const showTraceLengths = Boolean(viewerOptions.showTraceLengths)
        const hoverFocusEnabled = Boolean(viewerOptions.hoverFocusEnabled)
        const focusedDiagnosticId = String(
            viewerOptions.focusedDiagnosticId || ''
        ).trim()
        const toolbarControlsHidden = !PCB_VIEWPORT_TOOLBAR_CONTROLS_VISIBLE
        const interaction = PcbViewInteractionPreparation.prepare(
            documentModel,
            {
                toolbarVisible: !toolbarControlsHidden,
                measurementMode: measurement.mode,
                focusedDiagnosticId
            }
        )

        return (
            '<section class="pcb-view" data-pcb-view-active-side="' +
            normalizedSide +
            '" data-pcb-view-gerber-render-mode="' +
            PcbViewRenderer.#escapeHtml(gerberOptions.renderMode) +
            '" data-pcb-hover-net-name="' +
            PcbViewRenderer.#escapeHtml(hoveredNetName) +
            '" data-pcb-trace-length-visible="' +
            (showTraceLengths ? 'true' : 'false') +
            '" data-pcb-hover-focus-visible="' +
            (hoverFocusEnabled ? 'true' : 'false') +
            '" data-pcb-focused-diagnostic-id="' +
            PcbViewRenderer.#escapeHtml(focusedDiagnosticId) +
            '">' +
            '<div class="scene-3d__toolbar pcb-view__toolbar" aria-label="' +
            PcbViewRenderer.#escapeHtml(t('pcbView.boardSideAria')) +
            '">' +
            PcbViewRenderer.#renderSideButton('top', normalizedSide, t) +
            PcbViewRenderer.#renderSideButton('bottom', normalizedSide, t) +
            PcbMechanicalDrawingsToggleRenderer.render(
                documentModel,
                hiddenLayers,
                viewerOptions.documentId,
                t
            ) +
            PcbViewportToolbarRenderer.renderControls({
                documentModel,
                interactionModel: interaction?.model,
                hiddenObjects,
                measurementMode: measurement.mode,
                showTraceLengths,
                hoverFocusEnabled,
                focusedDiagnosticId,
                hidden: toolbarControlsHidden,
                translate: t
            }) +
            '</div>' +
            '<div class="pcb-view__content">' +
            PcbViewRenderer.#renderPcbSvg(
                documentModel,
                normalizedSide,
                hiddenLayers,
                hiddenObjects,
                selectedComponentKey,
                objectOpacities,
                gerberOptions,
                measurement,
                showTraceLengths,
                focusedDiagnosticId,
                t,
                interaction
            ) +
            ViewportInteractionGateRenderer.render(
                t('viewport.interactWithView')
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
     * @param {{ renderMode: string, layerId: string, layerIds: string[], side?: string }} gerberOptions Gerber render options.
     * @param {{ tool: string, mode: string, start: object | null, end: object | null }} measurement Measurement state.
     * @param {boolean} showTraceLengths Whether trace labels are visible.
     * @param {string} focusedDiagnosticId Focused diagnostic id.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {{ context: object | null, model: object } | null} interaction Prepared interaction data.
     * @returns {string}
     */
    static #renderPcbSvg(
        documentModel,
        side,
        hiddenLayers,
        hiddenObjects,
        selectedComponentKey,
        objectOpacities,
        gerberOptions,
        measurement,
        showTraceLengths,
        focusedDiagnosticId,
        translate,
        interaction
    ) {
        const renderSide = PcbViewRenderer.#resolveRenderSide(
            side,
            gerberOptions
        )
        const layerTargets = PcbViewRenderer.#resolveLayerVisibilityTargets(
            documentModel,
            hiddenLayers,
            renderSide
        )
        const componentMarkup = PcbViewRenderer.#renderBasePcbSvg(
            documentModel,
            renderSide,
            gerberOptions,
            interaction?.model ?? null,
            layerTargets.viewportAliases
        )
        const layerMarkup = PcbViewRenderer.#injectLayerVisibilityStyle(
            componentMarkup,
            layerTargets
        )
        const emphasizedMarkup =
            PcbViewRenderer.#injectInternalLayerEmphasisStyle(
                layerMarkup,
                PcbViewRenderer.#resolveInternalLayerEmphasis(
                    documentModel,
                    hiddenLayers,
                    renderSide
                )
            )
        const visibleMarkup = PcbViewRenderer.#injectObjectOpacityStyle(
            emphasizedMarkup,
            hiddenObjects,
            objectOpacities
        )
        const highlightedMarkup =
            PcbViewRenderer.#injectComponentHighlightStyle(
                visibleMarkup,
                selectedComponentKey
            )
        const netHighlightedMarkup =
            PcbViewRenderer.#injectNetHighlightStyle(highlightedMarkup)
        const traceLengthMarkup =
            PcbViewRenderer.#injectTraceLengthVisibilityStyle(
                netHighlightedMarkup,
                showTraceLengths
            )
        const markedMarkup = PcbComponentSelectionMarkerRenderer.render(
            traceLengthMarkup,
            documentModel,
            selectedComponentKey,
            renderSide
        )

        const measuredMarkup = PcbMeasurementRenderer.injectOverlay(
            markedMarkup,
            measurement,
            documentModel,
            translate,
            interaction?.model ?? null
        )
        return PcbDiagnosticFocusRenderer.inject(
            measuredMarkup,
            documentModel,
            focusedDiagnosticId,
            interaction
        )
    }

    /**
     * Renders or reuses the state-independent PCB SVG for one document side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @param {{ renderMode: string, layerId: string, layerIds: string[], side?: string }} gerberOptions Gerber render options.
     * @param {object | null} [interactionModel] Prepared interaction model.
     * @param {string[]} [hiddenLayerAliases] Renderer layer aliases excluded from viewport bounds.
     * @returns {string}
     */
    static #renderBasePcbSvg(
        documentModel,
        side,
        gerberOptions,
        interactionModel = null,
        hiddenLayerAliases = []
    ) {
        if (!PcbViewRenderer.#canCacheDocument(documentModel)) {
            return PcbViewRenderer.#createBasePcbSvg(
                documentModel,
                side,
                gerberOptions,
                interactionModel,
                hiddenLayerAliases
            )
        }

        let sideCache = PcbViewRenderer.#sideSvgCache.get(documentModel)
        if (!sideCache) {
            sideCache = new Map()
            PcbViewRenderer.#sideSvgCache.set(documentModel, sideCache)
        }

        const cacheKey = PcbBaseSvgCacheKey.resolve(
            side,
            gerberOptions,
            hiddenLayerAliases
        )
        const cachedMarkup = sideCache.get(cacheKey)
        if (cachedMarkup !== undefined) return cachedMarkup

        const markup = PcbViewRenderer.#createBasePcbSvg(
            documentModel,
            side,
            gerberOptions,
            interactionModel,
            hiddenLayerAliases
        )
        sideCache.set(cacheKey, markup)
        return markup
    }

    /**
     * Creates the state-independent PCB SVG for one document side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side Active board side.
     * @param {{ renderMode: string, layerId: string, layerIds?: string[], side?: string }} gerberOptions Gerber render options.
     * @param {object | null} [interactionModel] Prepared interaction model.
     * @param {string[]} [hiddenLayerAliases] Renderer layer aliases excluded from viewport bounds.
     * @returns {string}
     */
    static #createBasePcbSvg(
        documentModel,
        side,
        gerberOptions,
        interactionModel = null,
        hiddenLayerAliases = []
    ) {
        const markup = EcadRendererService.renderPcb(documentModel, {
            side,
            renderMode: gerberOptions.renderMode,
            layerId: gerberOptions.layerId,
            layerIds: gerberOptions.layerIds,
            hiddenLayers: hiddenLayerAliases
        })
        const netMarkup = PcbViewRenderer.#tagNetElements(markup)
        const components = EcadDocumentComponents.resolve(documentModel)
        const sideComponents = PcbViewRenderer.#resolveSideComponents(
            components,
            side
        )
        const componentMarkup = PcbViewRenderer.#tagComponentGroups(
            netMarkup,
            sideComponents
        )

        return SvgPanelChromeStripper.stripMetadataHeader(
            PcbComponentSideAttributeRenderer.render(
                componentMarkup,
                documentModel,
                components,
                interactionModel
            )
        )
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
     * @param {{ aliases: string[], drillCarrierAliases?: string[], selectors: string[] }} hiddenLayerTargets Layer targets to hide.
     * @returns {string}
     */
    static #injectLayerVisibilityStyle(markup, hiddenLayerTargets) {
        const drillCarrierAliases = new Set(
            (hiddenLayerTargets.drillCarrierAliases || []).map(String)
        )
        const aliases = [
            ...new Set((hiddenLayerTargets.aliases || []).map(String))
        ].filter((alias) => alias && !drillCarrierAliases.has(String(alias)))
        const drillAliases = [...drillCarrierAliases].filter(Boolean)
        const selectors = [
            ...new Set((hiddenLayerTargets.selectors || []).map(String))
        ].filter(Boolean)
        if (!aliases.length && !drillAliases.length && !selectors.length) {
            return markup
        }

        const rules = [
            ...aliases.flatMap((alias) =>
                PcbViewRenderer.#layerAliasSelectors(alias)
            ),
            ...drillAliases.flatMap((alias) =>
                PcbViewRenderer.#drillCarrierLayerSelectors(alias)
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
     * @returns {{ aliases: string[], drillCarrierAliases: string[], selectors: string[], viewportAliases: string[] }}
     */
    static #resolveLayerVisibilityTargets(documentModel, hiddenLayers, side) {
        if (!Array.isArray(hiddenLayers) || !hiddenLayers.length) {
            return {
                aliases: [],
                drillCarrierAliases: [],
                selectors: [],
                viewportAliases: []
            }
        }

        const aliases = PcbLayerVisibilityModel.resolveHiddenLayerAliases(
            documentModel,
            hiddenLayers
        )
        const hidden = new Set((hiddenLayers || []).map(String))
        const keepDrillHolesVisible = PcbViewRenderer.#hasVisibleCopperLayer(
            documentModel,
            hidden
        )
        const drillCarrierAliases = new Set()
        const viewportAliases = new Set()
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
                if (
                    keepDrillHolesVisible &&
                    PcbViewRenderer.#isDrillCarrierLayer(layer, key)
                ) {
                    PcbViewRenderer.#layerAliases(layer, key).forEach((alias) =>
                        drillCarrierAliases.add(alias)
                    )
                }
                if (
                    PcbLayerVisibilityModel.isMechanicalDrawingLayer(layer, key)
                ) {
                    PcbViewRenderer.#layerAliases(layer, key).forEach((alias) =>
                        viewportAliases.add(alias)
                    )
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

        return {
            aliases,
            drillCarrierAliases: [...drillCarrierAliases],
            selectors,
            viewportAliases: [...viewportAliases]
        }
    }

    /**
     * Injects SVG-local contrast overrides for isolated internal copper views.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {{ visibleCount: number, opacity: string, trackAlpha: string, fillAlpha: string } | null} emphasis Internal layer emphasis.
     * @returns {string}
     */
    static #injectInternalLayerEmphasisStyle(markup, emphasis) {
        if (!emphasis) return markup

        const rules =
            '.pcb-svg { --pcb-subsurface-track-color: rgba(112, 84, 62, ' +
            emphasis.trackAlpha +
            '); --pcb-subsurface-fill: rgba(114, 84, 62, ' +
            emphasis.fillAlpha +
            '); --pcb-subsurface-copper-fill: rgba(114, 84, 62, ' +
            emphasis.fillAlpha +
            '); }' +
            '.pcb-svg .pcb-copper--subsurface { opacity: ' +
            emphasis.opacity +
            '; }'

        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-internal-layer-emphasis-style" data-visible-internal-layers="' +
                PcbViewRenderer.#escapeHtml(String(emphasis.visibleCount)) +
                '">' +
                PcbViewRenderer.#escapeHtml(rules) +
                '</style>'
        )
    }

    /**
     * Resolves contrast settings for partially isolated internal copper views.
     * @param {object} documentModel Document model.
     * @param {string[]} hiddenLayers Hidden layer keys.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {{ visibleCount: number, opacity: string, trackAlpha: string, fillAlpha: string } | null}
     */
    static #resolveInternalLayerEmphasis(documentModel, hiddenLayers, side) {
        if (!Array.isArray(hiddenLayers) || !hiddenLayers.length) {
            return null
        }

        const hidden = new Set(hiddenLayers.map(String))
        const copperLayers = PcbLayerVisibilityModel.resolveLayers(
            documentModel
        )
            .map((layer, index) => ({
                layer,
                key: PcbLayerVisibilityModel.resolveLayerKey(layer, index)
            }))
            .filter(({ layer, key }) => {
                const text = PcbViewRenderer.#layerSearchText(layer, key)
                return (
                    PcbViewRenderer.#isCopperLayer(text) &&
                    !PcbViewRenderer.#isDrillCarrierLayer(layer, key)
                )
            })
        let hiddenCopperCount = 0
        let visibleInternalCount = 0
        let hasVisibleSurfaceCopper = false
        for (const { layer, key } of copperLayers) {
            const hiddenLayer = PcbViewRenderer.#layerAliases(layer, key).some(
                (alias) => hidden.has(alias)
            )
            if (hiddenLayer) {
                hiddenCopperCount += 1
                continue
            }
            const text = PcbViewRenderer.#layerSearchText(layer, key)
            if (PcbViewRenderer.#isSurfaceLayer(layer, text, side)) {
                hasVisibleSurfaceCopper = true
            } else {
                visibleInternalCount += 1
            }
        }
        if (
            !hiddenCopperCount ||
            hasVisibleSurfaceCopper ||
            !visibleInternalCount
        ) {
            return null
        }

        if (visibleInternalCount === 1) {
            return {
                visibleCount: 1,
                opacity: '0.95',
                trackAlpha: '0.78',
                fillAlpha: '0.16'
            }
        }

        return {
            visibleCount: visibleInternalCount,
            opacity: '0.72',
            trackAlpha: '0.48',
            fillAlpha: '0.1'
        }
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

        if (!PcbViewRenderer.#isCopperLayer(text)) {
            return []
        }
        if (PcbViewRenderer.#isStackLayer(layer)) {
            return []
        }
        if (PcbViewRenderer.#isSurfaceLayer(layer, text, side)) {
            return ['.pcb-copper--surface']
        }
        return ['.pcb-copper--subsurface']
    }

    /**
     * Returns true when at least one visible layer is copper.
     * @param {object} documentModel Document model.
     * @param {Set<string>} hidden Hidden layer keys.
     * @returns {boolean}
     */
    static #hasVisibleCopperLayer(documentModel, hidden) {
        return PcbLayerVisibilityModel.resolveLayers(documentModel).some(
            (layer, index) => {
                const key = PcbLayerVisibilityModel.resolveLayerKey(
                    layer,
                    index
                )
                const text = PcbViewRenderer.#layerSearchText(layer, key)
                return (
                    !PcbViewRenderer.#layerAliases(layer, key).some((alias) =>
                        hidden.has(alias)
                    ) &&
                    PcbViewRenderer.#isCopperLayer(text) &&
                    !PcbViewRenderer.#isDrillCarrierLayer(layer, key)
                )
            }
        )
    }

    /**
     * Builds exact SVG layer selectors for one layer alias.
     * @param {string} alias Layer alias.
     * @returns {string[]}
     */
    static #layerAliasSelectors(alias) {
        const escapedAlias = PcbViewRenderer.#escapeCssString(alias)
        const selectors = [
            "[data-layer='" + escapedAlias + "']",
            "[data-layer-name='" + escapedAlias + "']",
            "[data-layer-key='" + escapedAlias + "']",
            "[data-layer-display-name='" + escapedAlias + "']",
            "[data-layer-view-key='" + escapedAlias + "']",
            "[data-layer-view-display-name='" + escapedAlias + "']",
            "[data-layer-id='" + escapedAlias + "']"
        ]

        if (/^-?\d+$/.test(String(alias).trim())) {
            selectors.push(
                "[data-layer-key='L" + escapedAlias + "']",
                "[data-layer-view-key='L" + escapedAlias + "']"
            )
        }

        return selectors
    }

    /**
     * Builds selectors that hide drill-carrier copper while keeping holes open.
     * @param {string} alias Layer alias.
     * @returns {string[]}
     */
    static #drillCarrierLayerSelectors(alias) {
        return PcbViewRenderer.#layerAliasSelectors(alias).flatMap(
            (selector) => [
                selector + ':not(.pcb-via):not(.pcb-pad)',
                selector + '.pcb-via .pcb-via__pad',
                selector + '.pcb-pad .pcb-pad__ring'
            ]
        )
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
            layer?.legacyLayerId,
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
            .concat([layer?.type, layer?.kind, layer?.side, layer?.role])
            .filter((value) => value !== undefined && value !== null)
            .join(' ')
            .toLowerCase()
    }

    /**
     * Returns true for layers that carry shared drill holes and copper rings.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {boolean}
     */
    static #isDrillCarrierLayer(layer, layerKey) {
        const text = PcbViewRenderer.#layerSearchText(layer, layerKey)
        return (
            /\bmulti[-_\s]?layer\b|\bmultilayer\b|\ball[-_\s]?layers\b/.test(
                text
            ) || /\b(via|pad)\s+holes?\b/.test(text)
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
     * Returns true for explicit Altium layer-stack rows.
     * @param {any} layer Layer metadata.
     * @returns {boolean}
     */
    static #isStackLayer(layer) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return Number.isFinite(layerId) && layerId >= 0x01000000
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
            /\binternal\s+plane\b/.test(text) ||
            /\binternal[-_\s]*\d+\b/.test(text) ||
            /\binternal[-_\s]+layer\b/.test(text) ||
            /\binner[-_\s]*\d+\b/.test(text)
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
     * Injects SVG-local CSS for the optional trace length overlay.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {boolean} visible Whether trace length labels should be visible.
     * @returns {string}
     */
    static #injectTraceLengthVisibilityStyle(markup, visible) {
        const renderedMarkup = String(markup)
        if (visible || !renderedMarkup.includes('pcb-trace-lengths')) {
            return renderedMarkup
        }

        return renderedMarkup.replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-trace-length-visibility-style">.pcb-svg .pcb-trace-lengths { display: none; }</style>'
        )
    }

    /**
     * Adds stable component keys to grouped PCB component markup.
     * @param {string} markup Renderer-owned SVG markup.
     * @param {object[]} components Components rendered on the active side.
     * @returns {string}
     */
    static #tagComponentGroups(markup, components) {
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
     * @returns {string}
     */
    static #injectNetHighlightStyle(markup) {
        return String(markup).replace(
            /(<svg\b[^>]*>)/,
            '$1<style class="pcb-net-highlight-style">' +
                PcbViewRenderer.#escapeHtml(
                    PcbNetHighlightCssRenderer.render()
                ) +
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
     * @param {object[]} components All document component rows.
     * @param {'top' | 'bottom'} side Active board side.
     * @returns {object[]}
     */
    static #resolveSideComponents(components, side) {
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
     * Resolves the SVG render side for Gerber source-layer-only views.
     * @param {'top' | 'bottom'} activeSide Active toolbar side.
     * @param {{ side?: string }} gerberOptions Gerber render options.
     * @returns {'top' | 'bottom'}
     */
    static #resolveRenderSide(activeSide, gerberOptions) {
        return gerberOptions.side === 'bottom'
            ? 'bottom'
            : gerberOptions.side === 'top'
              ? 'top'
              : activeSide
    }

    /** @returns {'top' | 'bottom'} Normalized supported board-side name. */
    static #normalizeSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }

    /** @returns {string} Escaped CSS single-quoted string value. */
    static #escapeCssString(value) {
        return String(value).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
    }

    /** @returns {string} Escaped markup text. */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
