import {
    AltiumExtensionResolver,
    BomTableRenderer as AltiumBomTableRenderer,
    preparePcbSideResolvedRenderModel as prepareAltiumPcbSideResolvedRenderModel,
    AltiumPcbBottomViewMirror,
    PcbFootprintPadAxisNormalizer as AltiumPcbFootprintPadAxisNormalizer,
    PcbInteractionIndex as AltiumPcbInteractionIndex,
    PcbInteractionLayerModel as AltiumPcbInteractionLayerModel,
    PcbSvgRenderer as AltiumPcbSvgRenderer,
    SchematicSvgRenderer as AltiumSchematicSvgRenderer
} from 'altium-toolkit/extensions'
import {
    BomTableRenderer as KicadBomTableRenderer,
    KicadExtensionResolver,
    KicadPcbRenderOutlineAdapter,
    PcbFootprintPadAxisNormalizer as KicadPcbFootprintPadAxisNormalizer,
    PcbInteractionIndex as KicadPcbInteractionIndex,
    PcbInteractionLayerModel as KicadPcbInteractionLayerModel,
    PcbSvgRenderer as KicadPcbSvgRenderer,
    SchematicSvgRenderer as KicadSchematicSvgRenderer
} from 'kicad-toolkit/extensions'
import {
    GerberPcbSvgRenderer,
    PcbInteractionIndex as GerberPcbInteractionIndex,
    PcbInteractionLayerModel as GerberPcbInteractionLayerModel
} from 'gerber-toolkit/extensions'
import { PcbComponentSelectionModel } from '../PcbComponentSelectionModel.mjs'
import { EcadCircuitJsonRendererService } from './EcadCircuitJsonRendererService.mjs'
import { EcadDocumentBom } from './EcadDocumentBom.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'
import { EcadGerberFabrication } from './EcadGerberFabrication.mjs'
import { EcadLocalizedBomRenderer } from './EcadLocalizedBomRenderer.mjs'

/**
 * Chooses format-specific renderers for normalized document models.
 */
export class EcadRendererService {
    static #schematicSvgCache = new WeakMap()
    static #pcbSvgCache = new WeakMap()
    static #pcbInteractionIndexCache = new WeakMap()

    /**
     * Resolves the native PCB renderer model retained by a canonical document.
     * Historical native models and formats without a retained native extension
     * pass through unchanged.
     * @param {object} documentModel Document model.
     * @returns {object}
     */
    static resolvePcbNativeModel(documentModel) {
        return (
            EcadGerberFabrication.nativeDocument(documentModel) ||
            AltiumExtensionResolver.nativeModel(documentModel) ||
            KicadExtensionResolver.nativeModel(documentModel) ||
            documentModel
        )
    }

    /**
     * Renders a schematic document.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static renderSchematic(documentModel) {
        const altiumDocument =
            AltiumExtensionResolver.nativeModel(documentModel)
        if (altiumDocument) {
            return EcadRendererService.#renderCached(
                EcadRendererService.#schematicSvgCache,
                documentModel,
                'schematic',
                () =>
                    AltiumSchematicSvgRenderer.render(
                        altiumDocument,
                        EcadRendererService.#altiumSchematicRenderOptions(
                            altiumDocument
                        )
                    )
            )
        }
        const kicadDocument = KicadExtensionResolver.nativeModel(documentModel)
        if (kicadDocument) {
            return EcadRendererService.#renderCached(
                EcadRendererService.#schematicSvgCache,
                documentModel,
                'schematic',
                () => KicadSchematicSvgRenderer.render(kicadDocument)
            )
        }
        if (EcadRendererService.#isCircuitJson(documentModel)) {
            return EcadRendererService.#renderCached(
                EcadRendererService.#schematicSvgCache,
                documentModel,
                'schematic',
                () =>
                    EcadCircuitJsonRendererService.renderSchematic(
                        documentModel
                    )
            )
        }
        return EcadRendererService.#renderCached(
            EcadRendererService.#schematicSvgCache,
            documentModel,
            'schematic',
            () =>
                EcadRendererService.#isKiCad(documentModel)
                    ? KicadSchematicSvgRenderer.render(documentModel)
                    : AltiumSchematicSvgRenderer.render(
                          documentModel,
                          EcadRendererService.#altiumSchematicRenderOptions(
                              documentModel
                          )
                      )
        )
    }
    /**
     * Renders a PCB document.
     * @param {object} documentModel Document model.
     * @param {{ side?: 'top' | 'bottom', renderMode?: string, layerId?: string, layerIds?: string[], hiddenLayers?: (string | number)[] }} [options] PCB render options.
     * @returns {string}
     */
    static renderPcb(documentModel, options = {}) {
        const side = EcadRendererService.#normalizePcbSide(options.side)
        const renderKey = EcadRendererService.#pcbRenderCacheKey(side, options)
        const gerberDocument =
            EcadGerberFabrication.nativeDocument(documentModel)
        if (gerberDocument) {
            return EcadRendererService.#renderCached(
                EcadRendererService.#pcbSvgCache,
                documentModel,
                renderKey,
                () =>
                    EcadRendererService.#renderGerberPcb(
                        gerberDocument,
                        options,
                        side
                    )
            )
        }
        const altiumDocument =
            AltiumExtensionResolver.nativeModel(documentModel)
        if (altiumDocument) {
            const renderDocumentModel =
                AltiumPcbFootprintPadAxisNormalizer.apply(altiumDocument)
            return EcadRendererService.#renderCached(
                EcadRendererService.#pcbSvgCache,
                documentModel,
                renderKey,
                () =>
                    EcadRendererService.#renderAltiumPcb(
                        renderDocumentModel,
                        side,
                        options
                    )
            )
        }
        const kicadDocument = KicadExtensionResolver.nativeModel(documentModel)
        if (kicadDocument) {
            const renderDocumentModel =
                KicadPcbFootprintPadAxisNormalizer.apply(kicadDocument)
            return EcadRendererService.#renderCached(
                EcadRendererService.#pcbSvgCache,
                documentModel,
                renderKey,
                () =>
                    EcadRendererService.#renderKicadPcb(
                        renderDocumentModel,
                        side
                    )
            )
        }
        if (EcadRendererService.#isCircuitJson(documentModel)) {
            return EcadRendererService.#renderCached(
                EcadRendererService.#pcbSvgCache,
                documentModel,
                side,
                () =>
                    EcadCircuitJsonRendererService.renderPcb(documentModel, {
                        side
                    })
            )
        }

        const renderDocumentModel =
            EcadRendererService.#normalizePcbPadAxes(documentModel)
        return EcadRendererService.#renderCached(
            EcadRendererService.#pcbSvgCache,
            documentModel,
            renderKey,
            () =>
                EcadRendererService.#isGerber(documentModel)
                    ? EcadRendererService.#renderGerberPcb(
                          renderDocumentModel,
                          options,
                          side
                      )
                    : EcadRendererService.#isKiCad(documentModel)
                      ? EcadRendererService.#renderKicadPcb(
                            renderDocumentModel,
                            side
                        )
                      : EcadRendererService.#renderAltiumPcb(
                            renderDocumentModel,
                            side,
                            options
                        )
        )
    }
    /**
     * Returns prioritized PCB interaction candidates for a board-space point.
     * @param {object} documentModel Document model.
     * @param {{ x?: unknown, y?: unknown }} point Board-space point.
     * @param {{ side?: 'top' | 'bottom', hiddenLayers?: string[], hiddenObjects?: string[], tolerance?: number, renderMode?: string, layerId?: string, layerIds?: string[] }} [options] Hit-test options.
     * @returns {object[]}
     */
    static hitTestPcb(documentModel, point, options = {}) {
        const side = EcadRendererService.#normalizePcbSide(options.side)
        const gerberDocument =
            EcadGerberFabrication.nativeDocument(documentModel)
        if (gerberDocument) {
            return EcadRendererService.#withResolvedPcbComponentKeys(
                gerberDocument,
                GerberPcbInteractionIndex.hitTestItems(
                    EcadRendererService.#pcbInteractionItems(
                        gerberDocument,
                        GerberPcbInteractionIndex
                    ),
                    point,
                    options
                )
            )
        }
        const altiumDocument =
            AltiumExtensionResolver.nativeModel(documentModel)
        if (altiumDocument) {
            const hitTestDocumentModel =
                AltiumPcbFootprintPadAxisNormalizer.apply(altiumDocument)
            return EcadRendererService.#withResolvedPcbComponentKeys(
                hitTestDocumentModel,
                AltiumPcbInteractionIndex.hitTestItems(
                    EcadRendererService.#pcbInteractionItems(
                        hitTestDocumentModel,
                        AltiumPcbInteractionIndex
                    ),
                    point,
                    { ...options, side }
                )
            )
        }
        const kicadDocument = KicadExtensionResolver.nativeModel(documentModel)
        if (kicadDocument) {
            const hitTestDocumentModel =
                KicadPcbFootprintPadAxisNormalizer.apply(kicadDocument)
            return EcadRendererService.#withResolvedPcbComponentKeys(
                hitTestDocumentModel,
                KicadPcbInteractionIndex.hitTestItems(
                    EcadRendererService.#pcbInteractionItems(
                        hitTestDocumentModel,
                        KicadPcbInteractionIndex
                    ),
                    point,
                    {
                        ...options,
                        side: side === 'bottom' ? 'back' : 'front'
                    }
                )
            )
        }
        if (EcadRendererService.#isCircuitJson(documentModel)) {
            return EcadCircuitJsonRendererService.hitTestPcb(
                documentModel,
                point,
                {
                    side,
                    hiddenLayers: options.hiddenLayers,
                    hiddenObjects: options.hiddenObjects,
                    tolerance: options.tolerance
                }
            )
        }

        const isKiCad = EcadRendererService.#isKiCad(documentModel)
        const hitTestDocumentModel =
            EcadRendererService.#normalizePcbPadAxes(documentModel)
        if (EcadRendererService.#isGerber(documentModel)) {
            return EcadRendererService.#withResolvedPcbComponentKeys(
                hitTestDocumentModel,
                GerberPcbInteractionIndex.hitTestItems(
                    EcadRendererService.#pcbInteractionItems(
                        hitTestDocumentModel,
                        GerberPcbInteractionIndex
                    ),
                    point,
                    options
                )
            )
        }

        const interactionIndex = isKiCad
            ? KicadPcbInteractionIndex
            : AltiumPcbInteractionIndex
        const hitTestOptions = isKiCad
            ? {
                  ...options,
                  side: side === 'bottom' ? 'back' : 'front'
              }
            : {
                  ...options,
                  side
              }

        return EcadRendererService.#withResolvedPcbComponentKeys(
            hitTestDocumentModel,
            interactionIndex.hitTestItems(
                EcadRendererService.#pcbInteractionItems(
                    hitTestDocumentModel,
                    interactionIndex
                ),
                point,
                hitTestOptions
            )
        )
    }
    /**
     * Returns physical and virtual PCB interaction layers.
     * @param {object} documentModel Document model.
     * @returns {{ physicalLayers: object[], virtualLayers: object[] }}
     */
    static resolvePcbInteractionLayers(documentModel) {
        const gerberDocument =
            EcadGerberFabrication.nativeDocument(documentModel)
        if (gerberDocument) {
            return GerberPcbInteractionLayerModel.resolve(gerberDocument)
        }
        const altiumDocument =
            AltiumExtensionResolver.nativeModel(documentModel)
        if (altiumDocument) {
            return AltiumPcbInteractionLayerModel.resolve(altiumDocument)
        }
        const kicadDocument = KicadExtensionResolver.nativeModel(documentModel)
        if (kicadDocument) {
            return KicadPcbInteractionLayerModel.resolve(kicadDocument)
        }
        if (EcadRendererService.#isCircuitJson(documentModel)) {
            return EcadCircuitJsonRendererService.resolvePcbInteractionLayers(
                documentModel
            )
        }

        if (EcadRendererService.#isGerber(documentModel)) {
            return GerberPcbInteractionLayerModel.resolve(documentModel)
        }

        return EcadRendererService.#isKiCad(documentModel)
            ? KicadPcbInteractionLayerModel.resolve(documentModel)
            : AltiumPcbInteractionLayerModel.resolve(documentModel)
    }
    /**
     * Renders BOM rows.
     * @param {object} documentModel Document model.
     * @param {{ selectedComponentKey?: string, translate?: ((key: string) => string) | null }} [options] BOM render options.
     * @returns {string}
     */
    static renderBom(documentModel, options = {}) {
        const rows = EcadDocumentBom.resolve(documentModel)
        const translate = options.translate || null
        if (typeof translate === 'function') {
            return EcadLocalizedBomRenderer.render(rows, {
                isKiCad: EcadRendererService.#isKiCad(documentModel),
                translate,
                selectedComponentKey: options.selectedComponentKey
            })
        }

        if (EcadRendererService.#isCircuitJson(documentModel)) {
            return EcadCircuitJsonRendererService.renderBom(documentModel)
        }

        return EcadRendererService.#isKiCad(documentModel)
            ? KicadBomTableRenderer.render(rows)
            : AltiumBomTableRenderer.render(rows)
    }
    /**
     * Returns true for KiCad document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isKiCad(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'kicad'
        )
    }
    /**
     * Returns true for Gerber document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isGerber(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'gerber'
        )
    }
    /**
     * Returns true for standards-shaped element-array document models.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isCircuitJson(documentModel) {
        return EcadFormatRegistry.isCircuitJsonDocument(documentModel)
    }
    /**
     * Applies the format-owned rectangular pad axis normalization.
     * @param {object} documentModel Document model.
     * @returns {object}
     */
    static #normalizePcbPadAxes(documentModel) {
        return EcadRendererService.#isKiCad(documentModel)
            ? KicadPcbFootprintPadAxisNormalizer.apply(documentModel)
            : AltiumPcbFootprintPadAxisNormalizer.apply(documentModel)
    }
    /**
     * Builds Altium schematic renderer options from document context.
     * @param {object} documentModel Document model.
     * @returns {{ projectParameters?: Record<string, string | number | boolean | null | undefined> }}
     */
    static #altiumSchematicRenderOptions(documentModel) {
        const projectParameters = documentModel?.projectParameters || null

        return projectParameters && Object.keys(projectParameters).length
            ? { projectParameters }
            : {}
    }
    /**
     * Returns cached PCB interaction items for one document and toolkit index.
     * @param {object} documentModel Document model.
     * @param {{ build: (documentModel: object) => object[] }} interactionIndex Toolkit interaction index class.
     * @returns {object[]}
     */
    static #pcbInteractionItems(documentModel, interactionIndex) {
        let indexesByToolkit =
            EcadRendererService.#pcbInteractionIndexCache.get(documentModel)
        if (!indexesByToolkit) {
            indexesByToolkit = new Map()
            EcadRendererService.#pcbInteractionIndexCache.set(
                documentModel,
                indexesByToolkit
            )
        }

        if (!indexesByToolkit.has(interactionIndex)) {
            indexesByToolkit.set(
                interactionIndex,
                interactionIndex.build(documentModel)
            )
        }

        return indexesByToolkit.get(interactionIndex)
    }
    /**
     * Restores component keys for toolkit candidates backed by owned primitives.
     * @param {object} documentModel Document model.
     * @param {object[]} candidates Hit-test candidates.
     * @returns {object[]}
     */
    static #withResolvedPcbComponentKeys(documentModel, candidates) {
        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        if (!components.length || !Array.isArray(candidates)) {
            return candidates
        }

        return candidates.map((candidate) => {
            if (EcadRendererService.#candidateComponentKey(candidate)) {
                return candidate
            }

            const component = EcadRendererService.#componentForPcbPrimitive(
                candidate?.source,
                components
            )
            if (!component) return candidate

            const componentIndex = components.indexOf(component)
            const componentKey = PcbComponentSelectionModel.resolveComponentKey(
                component,
                componentIndex
            )
            if (!componentKey) return candidate

            return {
                ...candidate,
                componentKey,
                componentId: componentKey
            }
        })
    }
    /**
     * Returns an existing component key from one hit-test candidate.
     * @param {object | null | undefined} candidate Hit-test candidate.
     * @returns {string}
     */
    static #candidateComponentKey(candidate) {
        return String(
            candidate?.componentKey ?? candidate?.componentId ?? ''
        ).trim()
    }
    /**
     * Resolves the component that owns one PCB primitive.
     * @param {object | null | undefined} primitive Source primitive.
     * @param {object[]} components PCB components.
     * @returns {object | null}
     */
    static #componentForPcbPrimitive(primitive, components) {
        const rawComponentIndex =
            primitive?.componentIndex ?? primitive?.ownerIndex
        if (
            rawComponentIndex === undefined ||
            rawComponentIndex === null ||
            rawComponentIndex === ''
        ) {
            return null
        }

        const componentIndex = Number(rawComponentIndex)
        if (!Number.isInteger(componentIndex)) return null

        return (
            components.find((component) => {
                const rawIndex = component?.componentIndex
                return (
                    rawIndex !== undefined &&
                    rawIndex !== null &&
                    rawIndex !== '' &&
                    Number(rawIndex) === componentIndex
                )
            }) ||
            components[componentIndex] ||
            null
        )
    }
    /**
     * Renders or returns cached renderer output for one document/key pair.
     * @param {WeakMap<object, Map<string, string>>} cache Renderer output cache.
     * @param {object} documentModel Parsed document model.
     * @param {string} key Render variant key.
     * @param {() => string} render Renderer callback.
     * @returns {string}
     */
    static #renderCached(cache, documentModel, key, render) {
        if (!EcadRendererService.#canCacheDocument(documentModel)) {
            return render()
        }

        let documentCache = cache.get(documentModel)
        if (!documentCache) {
            documentCache = new Map()
            cache.set(documentModel, documentCache)
        }

        const cachedMarkup = documentCache.get(key)
        if (cachedMarkup !== undefined) return cachedMarkup

        const markup = render()
        documentCache.set(key, markup)
        return markup
    }
    /**
     * Returns true when a parsed document can be used as a weak cache key.
     * @param {unknown} documentModel Document candidate.
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
     * Renders KiCad PCB SVG with an app-scoped marker class for palette fixes.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @returns {string}
     */
    static #renderKicadPcb(documentModel, side) {
        const normalizedDocument =
            EcadRendererService.#normalizePcbPadAxes(documentModel)
        const renderModel = EcadRendererService.#withRenderableKicadBoardBounds(
            KicadPcbRenderOutlineAdapter.apply(normalizedDocument)
        )

        if (!renderModel) {
            return EcadRendererService.#renderNormalizedPcb(
                normalizedDocument,
                side,
                'pcb-svg--kicad'
            )
        }

        const markup = KicadPcbSvgRenderer.render(renderModel, {
            includeOppositeCopper: true,
            side: side === 'bottom' ? 'back' : 'front'
        })

        return EcadRendererService.#withPcbSvgClasses(
            markup,
            'pcb-svg--app-palette',
            'pcb-svg--kicad',
            side === 'bottom' ? 'pcb-svg--bottom' : 'pcb-svg--top'
        )
    }
    /**
     * Renders normalized PCB SVG for the requested side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @param {string} formatClass Format-specific SVG modifier class.
     * @param {{ hiddenLayers?: (string | number)[] }} [options] Altium render options.
     * @returns {string}
     */
    static #renderNormalizedPcb(
        documentModel,
        side,
        formatClass,
        options = {}
    ) {
        const sideResolvedModel = prepareAltiumPcbSideResolvedRenderModel(
            documentModel,
            {
                includeOppositeCopper: true,
                side: side === 'bottom' ? 'back' : 'front'
            }
        )
        const renderModel =
            side === 'bottom'
                ? AltiumPcbBottomViewMirror.apply(sideResolvedModel)
                : sideResolvedModel
        const markup = EcadRendererService.#withPcbSvgClasses(
            AltiumPcbSvgRenderer.render(renderModel, {
                side,
                hiddenLayers: options.hiddenLayers
            }),
            'pcb-svg--app-palette',
            formatClass,
            side === 'bottom' ? 'pcb-svg--bottom' : 'pcb-svg--top'
        )

        if (side !== 'bottom') return markup

        return markup.replace(
            'Top-facing composite view',
            'Bottom-facing composite view'
        )
    }
    /**
     * Renders Altium PCB SVG for the requested side through the normalized
     * model adapter exported by the toolkit.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @param {{ hiddenLayers?: (string | number)[] }} [options] Altium render options.
     * @returns {string}
     */
    static #renderAltiumPcb(documentModel, side, options = {}) {
        return EcadRendererService.#renderNormalizedPcb(
            documentModel,
            side,
            'pcb-svg--altium',
            options
        )
    }
    /**
     * Renders Gerber PCB SVG through the fabrication renderer.
     * @param {object} documentModel Document model.
     * @param {{ renderMode?: string, layerId?: string, layerIds?: string[], hiddenLayers?: (string | number)[] }} options Render options.
     * @param {'top' | 'bottom'} side PCB side.
     * @returns {string}
     */
    static #renderGerberPcb(documentModel, options, side) {
        return EcadRendererService.#withPcbSvgClasses(
            GerberPcbSvgRenderer.render(documentModel, {
                renderMode: options.renderMode,
                layerId: options.layerId,
                layerIds: options.layerIds,
                side
            }),
            'pcb-svg--app-palette',
            'pcb-svg--gerber',
            side === 'bottom' ? 'pcb-svg--bottom' : 'pcb-svg--top'
        )
    }
    /**
     * Returns a KiCad document model with bounds acceptable to the native SVG renderer.
     * @param {object} documentModel Document model.
     * @returns {object | null}
     */
    static #withRenderableKicadBoardBounds(documentModel) {
        const kicadBoard = documentModel?.pcb?.kicadBoard
        if (!kicadBoard) return null

        const bounds = EcadRendererService.#normalizeKicadBounds(
            kicadBoard.bounds
        )
        if (!bounds) return null

        return {
            ...documentModel,
            pcb: {
                ...documentModel.pcb,
                kicadBoard: {
                    ...kicadBoard,
                    bounds
                }
            }
        }
    }
    /**
     * Completes and validates KiCad board bounds before passing them to the toolkit.
     * @param {object | null | undefined} bounds Bounds candidate.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } | null}
     */
    static #normalizeKicadBounds(bounds) {
        const minX = Number(bounds?.minX)
        const minY = Number(bounds?.minY)
        let maxX = Number(bounds?.maxX)
        let maxY = Number(bounds?.maxY)
        let width = Number(bounds?.width)
        let height = Number(bounds?.height)

        if (!Number.isFinite(minX) || !Number.isFinite(minY)) return null

        if (!Number.isFinite(maxX) && Number.isFinite(width)) {
            maxX = minX + Math.max(width, 0.001)
        }

        if (!Number.isFinite(maxY) && Number.isFinite(height)) {
            maxY = minY + Math.max(height, 0.001)
        }

        if (
            !Number.isFinite(maxX) ||
            !Number.isFinite(maxY) ||
            maxX < minX ||
            maxY < minY
        ) {
            return null
        }

        width = Number.isFinite(width)
            ? Math.max(width, 0.001)
            : Math.max(maxX - minX, 0.001)
        height = Number.isFinite(height)
            ? Math.max(height, 0.001)
            : Math.max(maxY - minY, 0.001)

        return {
            ...bounds,
            minX,
            minY,
            maxX,
            maxY,
            width,
            height
        }
    }
    /**
     * Adds app-level PCB SVG modifier classes without changing renderer markup
     * internals.
     * @param {string} markup Renderer output markup.
     * @param {...string} classNames SVG class names to append.
     * @returns {string}
     */
    static #withPcbSvgClasses(markup, ...classNames) {
        const classes = classNames.filter(Boolean).join(' ')

        return String(markup).replace(
            /class="([^"]*\bpcb-svg\b[^"]*)"/,
            (_match, existingClasses) =>
                'class="' +
                existingClasses +
                (classes ? ' ' + classes : '') +
                '"'
        )
    }
    /**
     * Builds a PCB render cache key from side and format-specific options.
     * @param {'top' | 'bottom'} side PCB side.
     * @param {{ renderMode?: string, layerId?: string, layerIds?: string[] }} options Render options.
     * @returns {string}
     */
    static #pcbRenderCacheKey(side, options) {
        return [
            side,
            String(options.renderMode || ''),
            String(options.layerId || ''),
            (Array.isArray(options.layerIds) ? options.layerIds : [])
                .map(String)
                .join(','),
            (Array.isArray(options.hiddenLayers) ? options.hiddenLayers : [])
                .map(String)
                .join(',')
        ].join('|')
    }
    /**
     * Normalizes the app-level PCB side option.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizePcbSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }
}
