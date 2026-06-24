import { CircuitJsonIndexer, CircuitJsonUnits } from 'circuitjson-toolkit'
import { CircuitJsonPcbCopperGeometry } from './CircuitJsonPcbCopperGeometry.mjs'

const VIRTUAL_LAYER_ORDER = [
    'top_silkscreen',
    'bottom_silkscreen',
    'top_fabrication',
    'bottom_fabrication',
    'top_courtyard',
    'bottom_courtyard',
    'top_soldermask',
    'bottom_soldermask',
    'top_paste',
    'bottom_paste',
    'keepouts',
    'cutouts',
    'diagnostics',
    'groups',
    'anchor_offsets',
    'trace_lengths',
    'ratsnest'
]

/**
 * Builds non-geometric inspection overlays for CircuitJSON PCB primitives.
 */
export class CircuitJsonPcbPrimitiveOverlays {
    /**
     * Builds virtual layers, diagnostics, and airwires.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @param {object[]} primitives Primitive rows.
     * @param {object} bounds Board bounds.
     * @param {{ groups?: object[], anchorOffsets?: object[] }} [groupModel] Group overlay rows.
     * @param {object[]} [extraDiagnostics] Precomputed diagnostic rows.
     * @returns {{ virtualLayers: object[], diagnostics: object[], airwires: object[] }}
     */
    static build(
        index,
        componentsByPcbId,
        primitives,
        bounds,
        groupModel = {},
        extraDiagnostics = []
    ) {
        const ports = CircuitJsonPcbPrimitiveOverlays.#ports(index)
        const diagnostics = [
            ...CircuitJsonPcbPrimitiveOverlays.#diagnostics(
                index,
                componentsByPcbId,
                bounds,
                primitives
            ),
            ...CircuitJsonPcbPrimitiveOverlays.#extraDiagnostics(
                extraDiagnostics,
                bounds
            ),
            ...CircuitJsonPcbPrimitiveOverlays.#clearanceDiagnostics(
                index,
                primitives
            )
        ]
        const airwires = CircuitJsonPcbPrimitiveOverlays.#airwires(ports)

        return {
            virtualLayers: CircuitJsonPcbPrimitiveOverlays.#virtualLayers({
                primitives,
                diagnostics,
                airwires,
                groups: groupModel.groups || [],
                anchorOffsets: groupModel.anchorOffsets || []
            }),
            diagnostics,
            airwires
        }
    }

    /**
     * Builds source-net-aware PCB port rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #ports(index) {
        const sourceNetNames =
            CircuitJsonPcbPrimitiveOverlays.#sourceNetNames(index)
        const sourcePortNetNames =
            CircuitJsonPcbPrimitiveOverlays.#sourcePortNetNames(
                index,
                sourceNetNames
            )

        return CircuitJsonPcbPrimitiveOverlays.#all(index, 'pcb_port')
            .map((port) => {
                const point = CircuitJsonPcbPrimitiveOverlays.#center(port)
                if (!point) return null
                const sourcePortId = String(port.source_port_id || '').trim()
                return {
                    id: String(port.pcb_port_id || '').trim(),
                    netName:
                        CircuitJsonPcbPrimitiveOverlays.#netName(port) ||
                        sourcePortNetNames.get(sourcePortId) ||
                        '',
                    point
                }
            })
            .filter(Boolean)
    }

    /**
     * Builds source net display names.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {Map<string, string>}
     */
    static #sourceNetNames(index) {
        return new Map(
            CircuitJsonPcbPrimitiveOverlays.#all(index, 'source_net')
                .map((net) => [
                    String(net.source_net_id || '').trim(),
                    String(
                        net.name || net.net || net.source_net_id || ''
                    ).trim()
                ])
                .filter(([id, name]) => id && name)
        )
    }

    /**
     * Builds source-port to source-net display-name lookup data.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, string>} sourceNetNames Source net names.
     * @returns {Map<string, string>}
     */
    static #sourcePortNetNames(index, sourceNetNames) {
        const names = new Map()
        for (const port of CircuitJsonPcbPrimitiveOverlays.#all(
            index,
            'source_port'
        )) {
            const portId = String(port.source_port_id || '').trim()
            if (!portId) continue
            const netId = CircuitJsonPcbPrimitiveOverlays.#firstString([
                port.source_net_id,
                ...(Array.isArray(port.source_net_ids)
                    ? port.source_net_ids
                    : []),
                ...(Array.isArray(port.connected_source_net_ids)
                    ? port.connected_source_net_ids
                    : [])
            ])
            const name =
                sourceNetNames.get(netId) ||
                CircuitJsonPcbPrimitiveOverlays.#netName(port)
            if (name) names.set(portId, name)
        }
        return names
    }

    /**
     * Builds diagnostic marker rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @param {object} bounds Board bounds.
     * @param {object[]} primitives Primitive rows.
     * @returns {object[]}
     */
    static #diagnostics(index, componentsByPcbId, bounds, primitives) {
        return CircuitJsonPcbPrimitiveOverlays.#elements(index)
            .filter((element) => {
                const type = String(element?.type || '').toLowerCase()
                return type.includes('error') || type.includes('warning')
            })
            .map((element, index) =>
                CircuitJsonPcbPrimitiveOverlays.#diagnostic(
                    element,
                    index,
                    componentsByPcbId,
                    bounds,
                    primitives
                )
            )
    }

    /**
     * Builds one diagnostic marker.
     * @param {object} element Diagnostic-like element.
     * @param {number} index Diagnostic index.
     * @param {Map<string, object>} componentsByPcbId Component lookup.
     * @param {object} bounds Board bounds.
     * @param {object[]} primitives Primitive rows.
     * @returns {object}
     */
    static #diagnostic(element, index, componentsByPcbId, bounds, primitives) {
        const component = componentsByPcbId.get(
            String(element.pcb_component_id || '').trim()
        )
        const relatedPrimitives =
            CircuitJsonPcbPrimitiveOverlays.#relatedPrimitives(
                element,
                primitives
            )
        const relatedBounds = CircuitJsonPcbPrimitiveOverlays.#mergeBounds(
            relatedPrimitives.map((primitive) => primitive.bounds)
        )
        const point = CircuitJsonPcbPrimitiveOverlays.#center(element) ||
            (relatedBounds
                ? CircuitJsonPcbPrimitiveOverlays.#boundsCenter(relatedBounds)
                : null) ||
            (component ? { x: component.x, y: component.y } : null) || {
                x: (bounds.minX + bounds.maxX) / 2,
                y: (bounds.minY + bounds.maxY) / 2
            }
        const severity = String(element.severity || '').toLowerCase()
        const type = String(element.type || '').toLowerCase()
        const isWarning = severity === 'warning' || type.includes('warning')

        const code = String(
            element.error_type ||
                element.warning_type ||
                element.code ||
                element.type ||
                ''
        )

        const diagnostic = {
            id:
                CircuitJsonIndexer.getElementId(element) ||
                'diagnostic:' + index,
            kind: isWarning ? 'warning' : 'error',
            severity: isWarning ? 'warning' : 'error',
            category: CircuitJsonPcbPrimitiveOverlays.#diagnosticCategory(code),
            code,
            message: String(element.message || 'PCB diagnostic.'),
            point,
            componentKey: String(component?.componentKey || ''),
            netName: CircuitJsonPcbPrimitiveOverlays.#netName(element)
        }
        if (relatedPrimitives.length) {
            diagnostic.bounds = relatedBounds
            diagnostic.relatedPrimitiveIds = relatedPrimitives
                .map((primitive) => primitive.id)
                .filter(Boolean)
        }
        return diagnostic
    }

    /**
     * Applies defaults to precomputed diagnostic rows.
     * @param {object[]} diagnostics Diagnostic rows.
     * @param {object} bounds Board bounds.
     * @returns {object[]}
     */
    static #extraDiagnostics(diagnostics, bounds) {
        return (diagnostics || []).map((diagnostic, index) => ({
            id: String(diagnostic.id || 'diagnostic:extra:' + index),
            kind: String(diagnostic.kind || 'warning'),
            severity: String(diagnostic.severity || 'warning'),
            category: String(diagnostic.category || 'general'),
            code: String(diagnostic.code || 'pcb_diagnostic'),
            message: String(diagnostic.message || 'PCB diagnostic.'),
            point:
                diagnostic.point ||
                CircuitJsonPcbPrimitiveOverlays.#boundsCenter(bounds),
            bounds: diagnostic.bounds || null,
            relatedPrimitiveIds: Array.isArray(diagnostic.relatedPrimitiveIds)
                ? diagnostic.relatedPrimitiveIds
                : [],
            componentKey: String(diagnostic.componentKey || ''),
            netName: String(diagnostic.netName || '')
        }))
    }

    /**
     * Builds generic copper clearance diagnostics when board rules are present.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {object[]} primitives Primitive rows.
     * @returns {object[]}
     */
    static #clearanceDiagnostics(index, primitives) {
        const minimum = CircuitJsonPcbPrimitiveOverlays.#minimumClearance(index)
        if (minimum === null || minimum <= 0) return []

        const copper = primitives.filter((primitive) =>
            CircuitJsonPcbPrimitiveOverlays.#isCopperPrimitive(primitive)
        )
        const diagnostics = []
        for (let leftIndex = 0; leftIndex < copper.length; leftIndex += 1) {
            for (
                let rightIndex = leftIndex + 1;
                rightIndex < copper.length;
                rightIndex += 1
            ) {
                const left = copper[leftIndex]
                const right = copper[rightIndex]
                if (left.netName === right.netName) continue
                if (
                    !CircuitJsonPcbPrimitiveOverlays.#sameClearanceLayer(
                        left,
                        right
                    )
                ) {
                    continue
                }
                const actual =
                    CircuitJsonPcbCopperGeometry.clearance(left, right) ??
                    CircuitJsonPcbPrimitiveOverlays.#boundsClearance(
                        left.bounds,
                        right.bounds
                    )
                if (actual >= minimum) continue
                diagnostics.push(
                    CircuitJsonPcbPrimitiveOverlays.#clearanceDiagnostic(
                        left,
                        right,
                        minimum,
                        actual,
                        diagnostics.length
                    )
                )
            }
        }
        return diagnostics
    }

    /**
     * Builds one copper clearance diagnostic.
     * @param {object} left First primitive.
     * @param {object} right Second primitive.
     * @param {number} minimum Minimum clearance.
     * @param {number} actual Actual clearance.
     * @param {number} index Diagnostic index.
     * @returns {object}
     */
    static #clearanceDiagnostic(left, right, minimum, actual, index) {
        const leftCenter = CircuitJsonPcbPrimitiveOverlays.#boundsCenter(
            left.bounds
        )
        const rightCenter = CircuitJsonPcbPrimitiveOverlays.#boundsCenter(
            right.bounds
        )
        const netName = [left.netName, right.netName].sort().join(' / ')

        return {
            id: 'clearance:' + index,
            kind: 'error',
            severity: 'error',
            category: 'clearance',
            code: 'pcb_copper_clearance',
            message:
                'Copper clearance is below the configured minimum for ' +
                netName +
                '.',
            point: {
                x: (leftCenter.x + rightCenter.x) / 2,
                y: (leftCenter.y + rightCenter.y) / 2
            },
            bounds: CircuitJsonPcbPrimitiveOverlays.#mergeBounds([
                left.bounds,
                right.bounds
            ]),
            relatedPrimitiveIds: [left.id, right.id].filter(Boolean).sort(),
            componentKey: '',
            netName,
            clearance: {
                minimum,
                actual: Number(actual.toFixed(6))
            }
        }
    }

    /**
     * Builds simple source connectivity airwires.
     * @param {object[]} ports PCB port rows.
     * @returns {object[]}
     */
    static #airwires(ports) {
        const byNet = new Map()
        for (const port of ports) {
            const netName = String(port.netName || '').trim()
            if (!netName) continue
            if (!byNet.has(netName)) byNet.set(netName, [])
            byNet.get(netName).push(port)
        }

        const lines = []
        for (const [netName, netPorts] of byNet) {
            const sorted = [...netPorts].sort((left, right) =>
                String(left.id).localeCompare(String(right.id))
            )
            for (let index = 1; index < sorted.length; index += 1) {
                lines.push({
                    id: 'airwire:' + netName + ':' + (index - 1),
                    netName,
                    start: { ...sorted[0].point },
                    end: { ...sorted[index].point }
                })
            }
        }
        return lines
    }

    /**
     * Builds virtual layer rows for detail and overlay primitives.
     * @param {{ primitives: object[], diagnostics: object[], airwires: object[], groups?: object[], anchorOffsets?: object[] }} model Model fragments.
     * @returns {object[]}
     */
    static #virtualLayers(model) {
        const keys = new Set()
        for (const primitive of model.primitives) {
            if (
                ['silkscreen', 'silkscreen_text', 'silkscreen_line'].includes(
                    primitive.kind
                )
            ) {
                keys.add(primitive.layer)
            }
            if (primitive.kind === 'fabrication') keys.add(primitive.layer)
            if (primitive.kind === 'courtyard') keys.add(primitive.layer)
            if (primitive.kind === 'solder-mask') keys.add(primitive.layer)
            if (primitive.kind === 'solder-paste') keys.add(primitive.layer)
            if (primitive.kind === 'keepout') keys.add('keepouts')
            if (primitive.kind === 'cutout') keys.add('cutouts')
            if (primitive.kind === 'track') keys.add('trace_lengths')
            if (String(primitive.netName || '').trim()) keys.add('ratsnest')
        }
        if (model.diagnostics.length) keys.add('diagnostics')
        if (model.groups?.length) keys.add('groups')
        if (model.anchorOffsets?.length) keys.add('anchor_offsets')
        if (model.airwires.length) keys.add('ratsnest')

        return VIRTUAL_LAYER_ORDER.filter((key) => keys.has(key)).map(
            (key) => ({
                key,
                id: key,
                layer: key,
                name: CircuitJsonPcbPrimitiveOverlays.#displayLayerName(key),
                side: CircuitJsonPcbPrimitiveOverlays.#side(key),
                type: 'drawing',
                sourceFormat: 'circuitjson'
            })
        )
    }

    /**
     * Returns indexed element rows by type.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {string} type Element type.
     * @returns {object[]}
     */
    static #all(index, type) {
        return index.elementsByType.get(type) || []
    }

    /**
     * Returns all indexed element rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {object[]}
     */
    static #elements(index) {
        return Array.from(index.elementsByType.values()).flat()
    }

    /**
     * Resolves the configured minimum copper clearance.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @returns {number | null}
     */
    static #minimumClearance(index) {
        for (const board of CircuitJsonPcbPrimitiveOverlays.#all(
            index,
            'pcb_board'
        )) {
            const value = CircuitJsonUnits.optionalLength(
                board.min_trace_clearance ??
                    board.minimum_trace_clearance ??
                    board.minimum_copper_clearance ??
                    board.minimumCopperClearance ??
                    board.minCopperClearance
            )
            if (value !== null) return value
        }
        return null
    }

    /**
     * Returns true when a primitive participates in copper spacing checks.
     * @param {object} primitive Primitive row.
     * @returns {boolean}
     */
    static #isCopperPrimitive(primitive) {
        return (
            ['pad', 'track', 'via', 'zone'].includes(primitive.kind) &&
            String(primitive.netName || '').trim() &&
            primitive.bounds
        )
    }

    /**
     * Resolves the positive distance between two axis-aligned bounds.
     * @param {object} left First bounds.
     * @param {object} right Second bounds.
     * @returns {number}
     */
    static #boundsClearance(left, right) {
        const gapX = Math.max(left.minX - right.maxX, right.minX - left.maxX, 0)
        const gapY = Math.max(left.minY - right.maxY, right.minY - left.maxY, 0)
        return Math.hypot(gapX, gapY)
    }

    /**
     * Returns true when two copper primitives should share clearance checks.
     * @param {object} left First primitive.
     * @param {object} right Second primitive.
     * @returns {boolean}
     */
    static #sameClearanceLayer(left, right) {
        if (left.kind === 'via' || right.kind === 'via') return true
        const leftLayer = String(left.layer || '').trim()
        const rightLayer = String(right.layer || '').trim()
        return !leftLayer || !rightLayer || leftLayer === rightLayer
    }

    /**
     * Finds primitives referenced by a diagnostic element.
     * @param {object} element Diagnostic element.
     * @param {object[]} primitives Primitive rows.
     * @returns {object[]}
     */
    static #relatedPrimitives(element, primitives) {
        const ids = [
            ['pcb_trace_id', element?.pcb_trace_id],
            ['pcb_smtpad_id', element?.pcb_smtpad_id],
            ['pcb_via_id', element?.pcb_via_id],
            ['pcb_plated_hole_id', element?.pcb_plated_hole_id],
            ['pcb_hole_id', element?.pcb_hole_id]
        ].filter(([_field, value]) => String(value || '').trim())
        if (!ids.length) return []
        return primitives.filter((primitive) =>
            ids.some(
                ([field, value]) =>
                    String(primitive.source?.[field] || '').trim() ===
                    String(value || '').trim()
            )
        )
    }

    /**
     * Resolves the center point of bounds.
     * @param {object} bounds Bounds record.
     * @returns {{ x: number, y: number }}
     */
    static #boundsCenter(bounds) {
        return {
            x: bounds.minX + bounds.width / 2,
            y: bounds.minY + bounds.height / 2
        }
    }

    /**
     * Merges bounds rows.
     * @param {object[]} rows Bounds rows.
     * @returns {object | null}
     */
    static #mergeBounds(rows) {
        const validRows = rows.filter(Boolean)
        if (!validRows.length) return null
        const minX = Math.min(...validRows.map((bounds) => bounds.minX))
        const minY = Math.min(...validRows.map((bounds) => bounds.minY))
        const maxX = Math.max(...validRows.map((bounds) => bounds.maxX))
        const maxY = Math.max(...validRows.map((bounds) => bounds.maxY))
        return {
            minX: CircuitJsonPcbPrimitiveOverlays.#round(minX),
            minY: CircuitJsonPcbPrimitiveOverlays.#round(minY),
            maxX: CircuitJsonPcbPrimitiveOverlays.#round(maxX),
            maxY: CircuitJsonPcbPrimitiveOverlays.#round(maxY),
            width: CircuitJsonPcbPrimitiveOverlays.#round(maxX - minX),
            height: CircuitJsonPcbPrimitiveOverlays.#round(maxY - minY)
        }
    }

    /**
     * Rounds one computed geometry value.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #round(value) {
        return Number(Number(value).toFixed(6))
    }

    /**
     * Resolves a center point.
     * @param {object} element Element row.
     * @returns {{ x: number, y: number } | null}
     */
    static #center(element) {
        return CircuitJsonUnits.optionalPoint(element?.center || element)
    }

    /**
     * Resolves a net name from common fields.
     * @param {object} element Element row.
     * @returns {string}
     */
    static #netName(element) {
        return String(
            element?.netName ??
                element?.net ??
                element?.net_name ??
                element?.source_net_name ??
                ''
        ).trim()
    }

    /**
     * Resolves a broad diagnostic category from a diagnostic code.
     * @param {string} code Diagnostic code.
     * @returns {string}
     */
    static #diagnosticCategory(code) {
        const text = String(code || '').toLowerCase()
        if (text.includes('clearance')) return 'clearance'
        if (text.includes('autorouting') || text.includes('trace_error')) {
            return 'routing'
        }
        if (text.includes('placement') || text.includes('outside_board')) {
            return 'placement'
        }
        if (
            text.includes('trace_missing') ||
            text.includes('missing_trace') ||
            text.includes('not_connected') ||
            text.includes('pin_missing_trace') ||
            text.includes('pin_must_be_connected')
        ) {
            return 'connectivity'
        }
        if (text.includes('layout')) return 'layout'
        if (text.includes('simulation')) return 'simulation'
        if (text.includes('footprint')) return 'footprint'
        if (
            text.includes('pin_defined') ||
            text.includes('pins_underspecified') ||
            text.includes('ground_pin') ||
            text.includes('power_pin')
        ) {
            return 'pin-definition'
        }
        if (
            text.includes('manufacturer_part') ||
            text.includes('missing_property') ||
            text.includes('property_ignored')
        ) {
            return 'metadata'
        }
        if (text.includes('manual_edit_conflict')) return 'edit-conflict'
        if (text.includes('configuration')) return 'configuration'
        return 'general'
    }

    /**
     * Resolves the first non-empty string.
     * @param {unknown[]} values Candidate values.
     * @returns {string}
     */
    static #firstString(values) {
        for (const value of values) {
            const text = String(value ?? '').trim()
            if (text) return text
        }
        return ''
    }

    /**
     * Resolves a side from a layer key.
     * @param {string} layer Layer key.
     * @returns {'top' | 'bottom' | ''}
     */
    static #side(layer) {
        const text = String(layer || '').toLowerCase()
        if (/\b(bottom|back)\b|\bb[._-]/u.test(text)) return 'bottom'
        if (/\b(top|front)\b|\bf[._-]/u.test(text)) return 'top'
        return ''
    }

    /**
     * Formats a virtual layer name.
     * @param {string} key Layer key.
     * @returns {string}
     */
    static #displayLayerName(key) {
        return String(key)
            .replaceAll('_', ' ')
            .replace(/\b\w/gu, (match) => match.toUpperCase())
    }
}
