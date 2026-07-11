import { EcadCircuitJsonContext } from './EcadCircuitJsonContext.mjs'
import { EcadFormatRegistry } from './EcadFormatRegistry.mjs'

/**
 * Projects canonical source and placement elements into sidebar component rows.
 */
export class EcadDocumentComponents {
    /**
     * Returns component rows appropriate for the document's primary view.
     * @param {unknown} documentModel Loaded document.
     * @returns {object[]} Component rows.
     */
    static resolve(documentModel) {
        if (!EcadFormatRegistry.isCircuitJsonDocument(documentModel)) {
            if (Array.isArray(documentModel?.pcb?.components)) {
                return documentModel.pcb.components
            }
            return Array.isArray(documentModel?.schematic?.components)
                ? documentModel.schematic.components
                : []
        }

        const context = EcadCircuitJsonContext.prepare(documentModel, {
            indexes: ['elements']
        })
        return context.getOrCreateDerived('document', 'components-v1', () => {
            const index = context.getIndex('elements')
            const sourceById = new Map(
                (index.elementsByType.get('source_component') || []).map(
                    (component) => [component.source_component_id, component]
                )
            )
            if (index.elementsByType.has('pcb_component')) {
                return (index.elementsByType.get('pcb_component') || []).map(
                    (component, position) =>
                        EcadDocumentComponents.#pcbRow(
                            component,
                            sourceById.get(component.source_component_id),
                            position
                        )
                )
            }
            return EcadDocumentComponents.#sourceRows(index, sourceById)
        })
    }

    /**
     * Builds one PCB placement row with source metadata.
     * @param {object} component PCB component element.
     * @param {object | undefined} source Source component element.
     * @param {number} position Stable component position.
     * @returns {object} Projected component row.
     */
    static #pcbRow(component, source, position) {
        const designator = String(
            source?.name ||
                component?.name ||
                component?.pcb_component_id ||
                'Component ' + (position + 1)
        )
        const layer = EcadDocumentComponents.#layerName(component?.layer)
        return {
            designator,
            reference: designator,
            refdes: designator,
            name: designator,
            pcbComponentId: String(component?.pcb_component_id || ''),
            sourceComponentId: String(component?.source_component_id || ''),
            layer,
            side: layer,
            mountSide: layer,
            pattern: EcadDocumentComponents.#pattern(component, source),
            footprint: EcadDocumentComponents.#pattern(component, source),
            source: EcadDocumentComponents.#sourceLabel(source),
            value: EcadDocumentComponents.#value(source),
            mpn: String(source?.manufacturer_part_number || ''),
            description: String(source?.description || '')
        }
    }

    /**
     * Builds source rows used by schematic and BOM views.
     * @param {object} index Prepared element index.
     * @param {Map<string, object>} sourceById Source components by id.
     * @returns {object[]} Projected source rows.
     */
    static #sourceRows(index, sourceById) {
        const schematicSourceIds = new Set(
            [
                ...(index.elementsByType.get('schematic_component') || []),
                ...(index.elementsByType.get('schematic_symbol') || [])
            ]
                .map((component) => component?.source_component_id)
                .filter(Boolean)
        )
        const sources = schematicSourceIds.size
            ? [...schematicSourceIds]
                  .map((id) => sourceById.get(id))
                  .filter(Boolean)
            : [...sourceById.values()]
        return sources.map((source) => {
            const designator = String(
                source?.name || source?.source_component_id || ''
            )
            return {
                designator,
                reference: designator,
                refdes: designator,
                name: designator,
                sourceComponentId: String(source?.source_component_id || ''),
                pattern: EcadDocumentComponents.#pattern(null, source),
                footprint: EcadDocumentComponents.#pattern(null, source),
                source: EcadDocumentComponents.#sourceLabel(source),
                value: EcadDocumentComponents.#value(source),
                mpn: String(source?.manufacturer_part_number || ''),
                description: String(source?.description || '')
            }
        })
    }

    /**
     * Resolves a normalized layer name.
     * @param {unknown} layer Layer value.
     * @returns {string} Layer name.
     */
    static #layerName(layer) {
        return String(
            layer && typeof layer === 'object' ? layer.name || '' : layer || ''
        )
    }

    /**
     * Resolves package or footprint text.
     * @param {object | null} component PCB component element.
     * @param {object | undefined} source Source component element.
     * @returns {string} Package text.
     */
    static #pattern(component, source) {
        return String(
            component?.metadata?.kicad_footprint?.footprintName ||
                source?.footprint ||
                source?.footprint_name ||
                source?.ftype ||
                ''
        )
    }

    /**
     * Resolves manufacturer or source text.
     * @param {object | undefined} source Source component element.
     * @returns {string} Source label.
     */
    static #sourceLabel(source) {
        return String(
            source?.manufacturer_part_number ||
                source?.supplier_part_number ||
                source?.ftype ||
                ''
        )
    }

    /**
     * Resolves the first displayable electrical value.
     * @param {object | undefined} source Source component element.
     * @returns {string} Component value.
     */
    static #value(source) {
        return String(
            source?.value ??
                source?.resistance ??
                source?.capacitance ??
                source?.inductance ??
                source?.frequency ??
                source?.voltage ??
                ''
        )
    }
}
