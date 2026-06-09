import {
    BomTableRenderer as AltiumBomTableRenderer,
    preparePcbSideResolvedRenderModel as prepareAltiumPcbSideResolvedRenderModel,
    PcbInteractionIndex as AltiumPcbInteractionIndex,
    PcbInteractionLayerModel as AltiumPcbInteractionLayerModel,
    PcbSvgRenderer as AltiumPcbSvgRenderer,
    SchematicSvgRenderer as AltiumSchematicSvgRenderer
} from 'altium-toolkit/renderers'
import {
    BomTableRenderer as KicadBomTableRenderer,
    PcbInteractionIndex as KicadPcbInteractionIndex,
    PcbInteractionLayerModel as KicadPcbInteractionLayerModel,
    PcbSvgRenderer as KicadPcbSvgRenderer,
    SchematicSvgRenderer as KicadSchematicSvgRenderer
} from 'kicad-toolkit/renderers'
import { AltiumPcbBottomViewMirror } from './AltiumPcbBottomViewMirror.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

const BOM_TRANSLATION_FALLBACKS = {
    'bom.designators': 'Designators',
    'bom.empty': 'No BOM rows were recovered from this file.',
    'bom.pattern': 'Pattern',
    'bom.quantity': 'Qty',
    'bom.source': 'Source',
    'bom.value': 'Value',
    'preview.groupedRows': 'grouped rows',
    'view.bom': 'BOM'
}

/**
 * Chooses format-specific renderers for normalized document models.
 */
export class EcadRendererService {
    static #pcbInteractionIndexCache = new WeakMap()

    /**
     * Renders a schematic document.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static renderSchematic(documentModel) {
        EcadRendererService.#assertRendererBackedDocument(documentModel)
        return EcadRendererService.#isKiCad(documentModel)
            ? KicadSchematicSvgRenderer.render(documentModel)
            : AltiumSchematicSvgRenderer.render(documentModel)
    }

    /**
     * Renders a PCB document.
     * @param {object} documentModel Document model.
     * @param {{ side?: 'top' | 'bottom' }} [options] PCB render options.
     * @returns {string}
     */
    static renderPcb(documentModel, options = {}) {
        EcadRendererService.#assertRendererBackedDocument(documentModel)
        const side = EcadRendererService.#normalizePcbSide(options.side)
        return EcadRendererService.#isKiCad(documentModel)
            ? EcadRendererService.#renderKicadPcb(documentModel, side)
            : EcadRendererService.#renderAltiumPcb(documentModel, side)
    }

    /**
     * Returns prioritized PCB interaction candidates for a board-space point.
     * @param {object} documentModel Document model.
     * @param {{ x?: unknown, y?: unknown }} point Board-space point.
     * @param {{ side?: 'top' | 'bottom', hiddenLayers?: string[], hiddenObjects?: string[], tolerance?: number }} [options] Hit-test options.
     * @returns {object[]}
     */
    static hitTestPcb(documentModel, point, options = {}) {
        EcadRendererService.#assertRendererBackedDocument(documentModel)
        const side = EcadRendererService.#normalizePcbSide(options.side)
        const isKiCad = EcadRendererService.#isKiCad(documentModel)
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

        return interactionIndex.hitTestItems(
            EcadRendererService.#pcbInteractionItems(
                documentModel,
                interactionIndex
            ),
            point,
            hitTestOptions
        )
    }

    /**
     * Returns physical and virtual PCB interaction layers.
     * @param {object} documentModel Document model.
     * @returns {{ physicalLayers: object[], virtualLayers: object[] }}
     */
    static resolvePcbInteractionLayers(documentModel) {
        EcadRendererService.#assertRendererBackedDocument(documentModel)
        return EcadRendererService.#isKiCad(documentModel)
            ? KicadPcbInteractionLayerModel.resolve(documentModel)
            : AltiumPcbInteractionLayerModel.resolve(documentModel)
    }

    /**
     * Renders BOM rows.
     * @param {object} documentModel Document model.
     * @param {{ translate?: ((key: string) => string) | null }} [options] BOM render options.
     * @returns {string}
     */
    static renderBom(documentModel, options = {}) {
        const rows = documentModel?.bom || []
        const translate = options.translate || null
        if (typeof translate === 'function') {
            return EcadRendererService.#renderLocalizedBom(
                documentModel,
                rows,
                translate
            )
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
     * Throws when a document only supports the standards-native 3D path.
     * @param {object} documentModel Document model.
     * @returns {void}
     */
    static #assertRendererBackedDocument(documentModel) {
        if (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'circuitjson'
        ) {
            throw new Error(
                'CircuitJSON documents are rendered through the 3D scene runtime.'
            )
        }
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
     * Renders BOM rows with app-localized table chrome.
     * @param {object} documentModel Document model.
     * @param {object[]} rows BOM rows.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLocalizedBom(documentModel, rows, translate) {
        const normalizedRows = Array.isArray(rows) ? rows : []
        const isKiCad = EcadRendererService.#isKiCad(documentModel)

        if (!normalizedRows.length) {
            return EcadRendererService.#renderLocalizedBomEmpty(
                isKiCad,
                translate
            )
        }

        const tableMarkup = EcadRendererService.#renderLocalizedBomTable(
            normalizedRows,
            EcadRendererService.#resolveBomColumnKeys(isKiCad),
            translate
        )

        if (isKiCad) {
            return tableMarkup
        }

        return (
            '<section class="bom-panel"><header class="bom-panel__header"><h3>' +
            EcadRendererService.#escapeHtml(
                EcadRendererService.#translateBom(translate, 'view.bom')
            ) +
            '</h3><p>' +
            normalizedRows.length +
            ' ' +
            EcadRendererService.#escapeHtml(
                EcadRendererService.#translateBom(
                    translate,
                    'preview.groupedRows'
                )
            ) +
            '</p></header>' +
            tableMarkup +
            '</section>'
        )
    }

    /**
     * Renders an empty BOM message with the source-format wrapper class.
     * @param {boolean} isKiCad Whether the document uses the KiCad renderer shape.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLocalizedBomEmpty(isKiCad, translate) {
        const className = isKiCad ? 'bom-empty' : 'altium-renderer-empty'

        return (
            '<section class="' +
            className +
            '">' +
            EcadRendererService.#escapeHtml(
                EcadRendererService.#translateBom(translate, 'bom.empty')
            ) +
            '</section>'
        )
    }

    /**
     * Renders the localized BOM table element.
     * @param {object[]} rows BOM rows.
     * @param {string[]} columnKeys Ordered column keys.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLocalizedBomTable(rows, columnKeys, translate) {
        let headerMarkup = ''
        let bodyMarkup = ''

        for (const columnKey of columnKeys) {
            headerMarkup += EcadRendererService.#renderLocalizedBomHeaderCell(
                columnKey,
                translate
            )
        }

        for (const row of rows) {
            bodyMarkup += EcadRendererService.#renderLocalizedBomRow(
                row,
                columnKeys
            )
        }

        return (
            '<table class="bom-table"><thead><tr>' +
            headerMarkup +
            '</tr></thead><tbody>' +
            bodyMarkup +
            '</tbody></table>'
        )
    }

    /**
     * Renders one localized BOM header cell.
     * @param {string} columnKey BOM column key.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {string}
     */
    static #renderLocalizedBomHeaderCell(columnKey, translate) {
        return (
            '<th>' +
            EcadRendererService.#escapeHtml(
                EcadRendererService.#translateBom(translate, 'bom.' + columnKey)
            ) +
            '</th>'
        )
    }

    /**
     * Renders one BOM row using the requested column order.
     * @param {object} row BOM row.
     * @param {string[]} columnKeys Ordered column keys.
     * @returns {string}
     */
    static #renderLocalizedBomRow(row, columnKeys) {
        let cellMarkup = ''

        for (const columnKey of columnKeys) {
            cellMarkup +=
                '<td>' +
                EcadRendererService.#escapeHtml(
                    EcadRendererService.#readBomCellValue(row, columnKey)
                ) +
                '</td>'
        }

        return '<tr>' + cellMarkup + '</tr>'
    }

    /**
     * Reads one BOM row cell value.
     * @param {object} row BOM row.
     * @param {string} columnKey BOM column key.
     * @returns {string}
     */
    static #readBomCellValue(row, columnKey) {
        if (columnKey === 'designators') {
            return Array.isArray(row?.designators)
                ? row.designators.join(', ')
                : ''
        }

        if (columnKey === 'quantity') {
            return String(row?.quantity || row?.designators?.length || 0)
        }

        return String(row?.[columnKey] || '')
    }

    /**
     * Returns the renderer-compatible BOM column order.
     * @param {boolean} isKiCad Whether the document uses the KiCad renderer shape.
     * @returns {string[]}
     */
    static #resolveBomColumnKeys(isKiCad) {
        return isKiCad
            ? ['designators', 'quantity', 'value', 'pattern', 'source']
            : ['designators', 'quantity', 'pattern', 'value', 'source']
    }

    /**
     * Translates one BOM UI key with an English fallback.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} key Message key.
     * @returns {string}
     */
    static #translateBom(translate, key) {
        const value = translate(key)
        if (!value || value === key) {
            return BOM_TRANSLATION_FALLBACKS[key] || key
        }

        return value
    }

    /**
     * Renders KiCad PCB SVG with an app-scoped marker class for palette fixes.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @returns {string}
     */
    static #renderKicadPcb(documentModel, side) {
        const renderModel =
            EcadRendererService.#withRenderableKicadBoardBounds(documentModel)

        if (!renderModel) {
            return EcadRendererService.#renderNormalizedPcb(
                documentModel,
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
            'pcb-svg--kicad'
        )
    }

    /**
     * Renders normalized PCB SVG for the requested side.
     * @param {object} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @param {string} formatClass Format-specific SVG modifier class.
     * @returns {string}
     */
    static #renderNormalizedPcb(documentModel, side, formatClass) {
        const sideResolvedModel = prepareAltiumPcbSideResolvedRenderModel(
            documentModel,
            { side: side === 'bottom' ? 'back' : 'front' }
        )
        const renderModel =
            side === 'bottom'
                ? AltiumPcbBottomViewMirror.apply(sideResolvedModel)
                : sideResolvedModel
        const markup = EcadRendererService.#withPcbSvgClasses(
            AltiumPcbSvgRenderer.render(renderModel),
            'pcb-svg--app-palette',
            formatClass,
            side === 'bottom' ? 'pcb-svg--bottom' : 'pcb-svg--top'
        )

        if (side !== 'bottom') {
            return markup
        }

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
     * @returns {string}
     */
    static #renderAltiumPcb(documentModel, side) {
        return EcadRendererService.#renderNormalizedPcb(
            documentModel,
            side,
            'pcb-svg--altium'
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
            'class="pcb-svg"',
            'class="pcb-svg ' + classes + '"'
        )
    }

    /**
     * Escapes text for safe insertion into renderer-owned HTML.
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

    /**
     * Normalizes the app-level PCB side option.
     * @param {unknown} side Requested side.
     * @returns {'top' | 'bottom'}
     */
    static #normalizePcbSide(side) {
        return side === 'bottom' ? 'bottom' : 'top'
    }
}
