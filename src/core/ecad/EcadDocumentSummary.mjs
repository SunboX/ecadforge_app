import { CircuitJsonUnits } from 'circuitjson-toolkit'
import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadDocumentBom } from './EcadDocumentBom.mjs'
import { EcadDocumentComponents } from './EcadDocumentComponents.mjs'
import { EcadDocumentType } from './EcadDocumentType.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Builds cached display metrics directly from canonical CircuitJSON elements.
 */
export class EcadDocumentSummary {
    /**
     * Returns display metrics for a canonical or native document.
     * @param {unknown} documentModel Loaded document.
     * @returns {object} Summary metrics.
     */
    static resolve(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            return EcadDocumentSummary.#native(documentModel)
        }

        const context = EcadCircuitJsonContext.prepare(documentModel, {
            indexes: ['elements']
        })
        return context.getOrCreateDerived('document', 'summary-v1', () => {
            const index = context.getIndex('elements')
            const byType = index.elementsByType
            const board = (byType.get('pcb_board') || [])[0] || null
            const sheet = (byType.get('schematic_sheet') || [])[0] || null
            const kind = EcadDocumentType.kind(documentModel)
            const componentCount =
                EcadDocumentComponents.resolve(documentModel).length
            return {
                kind,
                fileName: EcadDocumentType.fileName(documentModel),
                title: EcadDocumentSummary.#title(documentModel),
                componentCount,
                placementCount: (byType.get('pcb_component') || []).length,
                bomGroupCount: EcadDocumentBom.resolve(documentModel).length,
                layerCount: EcadDocumentSummary.#layerCount(
                    context.model,
                    board
                ),
                trackCount: (byType.get('pcb_trace') || []).length,
                viaCount: (byType.get('pcb_via') || []).length,
                padCount:
                    (byType.get('pcb_smtpad') || []).length +
                    (byType.get('pcb_plated_hole') || []).length,
                outlineSegmentCount:
                    EcadDocumentSummary.#outlineSegmentCount(board),
                lineSegmentCount:
                    (byType.get('schematic_line') || []).length +
                    (byType.get('schematic_trace') || []).length,
                pinCount: (byType.get('schematic_port') || []).length,
                textCount: EcadDocumentSummary.#textCount(byType),
                boardWidthMil: CircuitJsonUnits.mmToMil(board?.width),
                boardHeightMil: CircuitJsonUnits.mmToMil(board?.height),
                sheetSize: EcadDocumentSummary.#sheetSize(sheet)
            }
        })
    }

    /**
     * Preserves native summary semantics while normalizing common names.
     * @param {unknown} documentModel Native document.
     * @returns {object} Summary metrics.
     */
    static #native(documentModel) {
        const summary = documentModel?.summary || {}
        const pcb = documentModel?.pcb || {}
        const schematic = documentModel?.schematic || {}
        return {
            ...summary,
            kind: EcadDocumentType.kind(documentModel),
            fileName: EcadDocumentType.fileName(documentModel),
            title:
                summary.title ||
                documentModel?.title ||
                EcadDocumentType.fileName(documentModel),
            componentCount:
                summary.componentCount ??
                EcadDocumentComponents.resolve(documentModel).length,
            placementCount: Array.isArray(pcb.components)
                ? pcb.components.length
                : 0,
            bomGroupCount:
                summary.bomGroupCount ??
                summary.bomRowCount ??
                EcadDocumentBom.resolve(documentModel).length,
            boardWidthMil:
                summary.boardWidthMil ?? pcb.boardOutline?.widthMil ?? 0,
            boardHeightMil:
                summary.boardHeightMil ?? pcb.boardOutline?.heightMil ?? 0,
            sheetSize: schematic.sheet?.size || schematic.sheet?.paper || ''
        }
    }

    /**
     * Resolves a stable display title from canonical source metadata.
     * @param {unknown} documentModel Canonical document.
     * @returns {string} Display title.
     */
    static #title(documentModel) {
        const fileName = EcadDocumentType.fileName(documentModel)
        return String(
            documentModel?.source?.title ||
                documentModel?.source?.projectName ||
                fileName ||
                ''
        )
    }

    /**
     * Counts physical layers without constructing renderer geometry.
     * @param {object[]} model Canonical elements.
     * @param {object | null} board Board element.
     * @returns {number} Physical layer count.
     */
    static #layerCount(model, board) {
        const layers = new Set()
        for (const element of model) {
            EcadDocumentSummary.#addLayer(layers, element?.layer)
            for (const layer of Array.isArray(element?.layers)
                ? element.layers
                : []) {
                EcadDocumentSummary.#addLayer(layers, layer)
            }
            for (const point of Array.isArray(element?.route)
                ? element.route
                : []) {
                EcadDocumentSummary.#addLayer(layers, point?.layer)
            }
        }
        const declared = Number(board?.num_layers)
        const boardDefault = board ? 2 : 0
        return Math.max(
            layers.size,
            Number.isSafeInteger(declared) && declared > 0
                ? declared
                : boardDefault
        )
    }

    /**
     * Adds a normalized string or object layer name.
     * @param {Set<string>} layers Collected layer names.
     * @param {unknown} value Layer value.
     * @returns {void}
     */
    static #addLayer(layers, value) {
        const layer = String(
            value && typeof value === 'object' ? value.name || '' : value || ''
        ).trim()
        if (layer) layers.add(layer)
    }

    /**
     * Counts explicit or rectangular board outline segments.
     * @param {object | null} board Board element.
     * @returns {number} Segment count.
     */
    static #outlineSegmentCount(board) {
        if (Array.isArray(board?.outline) && board.outline.length > 1) {
            return board.outline.length
        }
        return board?.width && board?.height ? 4 : 0
    }

    /**
     * Counts canonical display text elements.
     * @param {Map<string, object[]>} byType Elements grouped by type.
     * @returns {number} Text element count.
     */
    static #textCount(byType) {
        return [
            'pcb_copper_text',
            'pcb_fabrication_note_text',
            'pcb_note_text',
            'pcb_silkscreen_text',
            'pcb_text',
            'schematic_text'
        ].reduce((sum, type) => sum + (byType.get(type) || []).length, 0)
    }

    /**
     * Formats canonical schematic sheet dimensions.
     * @param {object | null} sheet Schematic sheet element.
     * @returns {string} Sheet size label.
     */
    static #sheetSize(sheet) {
        const width = CircuitJsonUnits.optionalLength(sheet?.width)
        const height = CircuitJsonUnits.optionalLength(sheet?.height)
        return width && height ? `${width} x ${height} mm` : ''
    }
}
