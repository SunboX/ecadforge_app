import { CircuitJsonUnits } from 'circuitjson-toolkit'
import { CircuitJsonPcbPrimitiveGeometry } from './CircuitJsonPcbPrimitiveGeometry.mjs'

/**
 * Builds PCB group rows and group-anchor overlays from element arrays.
 */
export class CircuitJsonPcbPrimitiveGroups {
    /**
     * Builds group metadata and decorated primitive rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {object[]} primitives Primitive rows.
     * @param {object[]} components Component rows.
     * @returns {{ primitives: object[], groups: object[], anchorOffsets: object[] }}
     */
    static build(index, primitives, components) {
        const groups = CircuitJsonPcbPrimitiveGroups.#groups(
            index,
            primitives,
            components
        )
        const componentGroups =
            CircuitJsonPcbPrimitiveGroups.#componentGroupIds(components)
        return {
            primitives: primitives.map((primitive) =>
                CircuitJsonPcbPrimitiveGroups.#withGroupIds(
                    primitive,
                    index,
                    componentGroups
                )
            ),
            groups,
            anchorOffsets: CircuitJsonPcbPrimitiveGroups.#anchorOffsets(
                groups,
                components
            )
        }
    }

    /**
     * Builds PCB group rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {object[]} primitives Primitive rows.
     * @param {object[]} components Component rows.
     * @returns {object[]}
     */
    static #groups(index, primitives, components) {
        return CircuitJsonPcbPrimitiveGroups.#all(index, 'pcb_group')
            .map((group) =>
                CircuitJsonPcbPrimitiveGroups.#groupRow(
                    group,
                    primitives,
                    components
                )
            )
            .filter(Boolean)
    }

    /**
     * Builds one group row.
     * @param {object} group Source group element.
     * @param {object[]} primitives Primitive rows.
     * @param {object[]} components Component rows.
     * @returns {object | null}
     */
    static #groupRow(group, primitives, components) {
        const id = String(group.pcb_group_id || '').trim()
        if (!id) return null
        const componentIds = components
            .filter(
                (component) =>
                    String(component.pcb_group_id || '').trim() === id
            )
            .map((component) => component.pcbComponentId)
            .filter(Boolean)
        return {
            id,
            type: 'pcb_group',
            name: String(group.name || id),
            bounds: CircuitJsonPcbPrimitiveGroups.#groupBounds(
                group,
                primitives
            ),
            sourceGroupId: String(group.source_group_id || '').trim(),
            subcircuitId: String(group.subcircuit_id || '').trim(),
            componentIds,
            memberIds: CircuitJsonPcbPrimitiveGroups.#memberIds(
                id,
                primitives,
                componentIds
            ),
            anchor: CircuitJsonUnits.optionalPoint(group.anchor_position),
            depth: Number.isFinite(Number(group.depth)) ? Number(group.depth) : 0
        }
    }

    /**
     * Resolves group bounds from explicit size or grouped primitives.
     * @param {object} group Group element.
     * @param {object[]} primitives Primitive rows.
     * @returns {object | null}
     */
    static #groupBounds(group, primitives) {
        const center = CircuitJsonUnits.optionalPoint(group.center || group)
        const size = CircuitJsonUnits.optionalSize(group.size || group)
        if (center && size) {
            return CircuitJsonPcbPrimitiveGeometry.centerBounds(
                center,
                size.width,
                size.height
            )
        }

        return CircuitJsonPcbPrimitiveGeometry.mergedPrimitiveBounds(
            primitives.filter(
                (primitive) =>
                    String(primitive.source?.pcb_group_id || '').trim() ===
                    String(group.pcb_group_id || '').trim()
            )
        )
    }

    /**
     * Builds member ids from components and primitives.
     * @param {string} groupId Group id.
     * @param {object[]} primitives Primitive rows.
     * @param {string[]} componentIds Component ids.
     * @returns {string[]}
     */
    static #memberIds(groupId, primitives, componentIds) {
        const ids = [...componentIds]
        for (const primitive of primitives) {
            if (String(primitive.source?.pcb_group_id || '').trim() !== groupId) {
                continue
            }
            if (primitive.id && !ids.includes(primitive.id)) {
                ids.push(primitive.id)
            }
        }
        return ids
    }

    /**
     * Builds group ids for each component id.
     * @param {object[]} components Component rows.
     * @returns {Map<string, string[]>}
     */
    static #componentGroupIds(components) {
        return new Map(
            components.map((component) => [
                String(component.pcbComponentId || ''),
                CircuitJsonPcbPrimitiveGroups.#unique(component.groupIds || [])
            ])
        )
    }

    /**
     * Decorates one primitive with group and subcircuit ids.
     * @param {object} primitive Primitive row.
     * @param {{ sourceComponentById?: Map<string, object> }} index Element index.
     * @param {Map<string, string[]>} componentGroups Component group lookup.
     * @returns {object}
     */
    static #withGroupIds(primitive, index, componentGroups) {
        const sourceComponent = index.sourceComponentById?.get(
            String(primitive.component?.source_component_id || '').trim()
        )
        const groupIds = CircuitJsonPcbPrimitiveGroups.#unique([
            ...(primitive.groupIds || []),
            primitive.source?.pcb_group_id,
            primitive.source?.source_group_id,
            primitive.component?.pcb_group_id,
            primitive.component?.positioned_relative_to_pcb_group_id,
            primitive.component?.source_group_id,
            primitive.component?.sourceGroupId,
            sourceComponent?.source_group_id,
            ...(componentGroups.get(String(primitive.componentId || '')) || [])
        ])
        const subcircuitIds = CircuitJsonPcbPrimitiveGroups.#unique([
            ...(primitive.subcircuitIds || []),
            primitive.source?.subcircuit_id,
            primitive.source?.subcircuitId,
            primitive.component?.subcircuit_id,
            primitive.component?.subcircuitId,
            ...(primitive.component?.subcircuitIds || []),
            sourceComponent?.subcircuit_id
        ])
        return {
            ...primitive,
            groupIds,
            subcircuitIds
        }
    }

    /**
     * Builds visual anchor offsets for grouped component placements.
     * @param {object[]} groups Group rows.
     * @param {object[]} components Component rows.
     * @returns {object[]}
     */
    static #anchorOffsets(groups, components) {
        return groups.flatMap((group) => {
            if (!group.anchor) return []
            return group.componentIds.flatMap((componentId) => {
                const component = components.find(
                    (row) => row.pcbComponentId === componentId
                )
                if (!component) return []
                return [
                    {
                        id: 'anchor-offset:' + group.id + ':' + componentId,
                        kind: 'group-anchor-offset',
                        sourceId: group.id,
                        targetId: componentId,
                        targetType: 'component',
                        start: group.anchor,
                        end: { x: component.x, y: component.y },
                        label: component.componentKey
                    }
                ]
            })
        })
    }

    /**
     * Returns indexed elements by type.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {string} type Element type.
     * @returns {object[]}
     */
    static #all(index, type) {
        return index.elementsByType.get(type) || []
    }

    /**
     * Resolves unique non-empty strings.
     * @param {unknown[]} values Candidate values.
     * @returns {string[]}
     */
    static #unique(values) {
        return [...new Set(values.map((value) => String(value || '').trim()))]
            .filter(Boolean)
            .sort((left, right) => {
                const leftPcb = left.startsWith('pcb_') ? 0 : 1
                const rightPcb = right.startsWith('pcb_') ? 0 : 1
                return leftPcb - rightPcb || left.localeCompare(right)
            })
    }
}
