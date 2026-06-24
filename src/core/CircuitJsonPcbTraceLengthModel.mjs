import { CircuitJsonUnits } from 'circuitjson-toolkit'

/**
 * Builds routed-trace length inspection rows from PCB primitives.
 */
export class CircuitJsonPcbTraceLengthModel {
    /**
     * Builds total routed trace length labels.
     * @param {object[]} primitives Primitive rows.
     * @param {{ elementsByType: Map<string, object[]> }} [index] Element index.
     * @returns {object[]}
     */
    static build(primitives, index = null) {
        const traceRules = CircuitJsonPcbTraceLengthModel.#traceRules(index)
        const groups = new Map()
        for (const primitive of Array.isArray(primitives) ? primitives : []) {
            if (primitive.kind !== 'track') continue
            const id = String(
                primitive.source?.pcb_trace_id || primitive.id || ''
            ).split(':')[0]
            if (!id) continue

            const length = Math.hypot(
                primitive.x2 - primitive.x1,
                primitive.y2 - primitive.y1
            )
            const current = groups.get(id) || {
                id,
                netName: String(primitive.netName || ''),
                length: 0,
                point: { x: primitive.x1, y: primitive.y1 },
                layer: primitive.layer,
                side: primitive.side,
                sourceTraceId: String(
                    primitive.sourceTraceId ||
                        primitive.source?.source_trace_id ||
                        ''
                ),
                longest: -1
            }
            current.length += length
            if (length > current.longest) {
                current.longest = length
                current.point = {
                    x: (primitive.x1 + primitive.x2) / 2,
                    y: (primitive.y1 + primitive.y2) / 2
                }
                current.layer = primitive.layer
                current.side = primitive.side
            }
            groups.set(id, current)
        }

        return [...groups.values()].map((group) =>
            CircuitJsonPcbTraceLengthModel.#traceLengthRow(group, traceRules)
        )
    }

    /**
     * Resolves source trace display rules by source id.
     * @param {{ elementsByType: Map<string, object[]> } | null} index Element index.
     * @returns {Map<string, object>}
     */
    static #traceRules(index) {
        const rules = new Map()
        if (!index) return rules
        for (const sourceTrace of CircuitJsonPcbTraceLengthModel.#all(
            index,
            'source_trace'
        )) {
            const id = String(sourceTrace.source_trace_id || '').trim()
            if (!id) continue
            const maxLength = CircuitJsonUnits.optionalLength(
                sourceTrace.max_length ?? sourceTrace.maxLength
            )
            rules.set(id, {
                maxLength,
                displayName: String(
                    sourceTrace.display_name ||
                        sourceTrace.displayName ||
                        sourceTrace.name ||
                        id
                ).trim()
            })
        }
        return rules
    }

    /**
     * Builds one trace length row.
     * @param {object} group Grouped trace data.
     * @param {Map<string, object>} traceRules Source trace rules.
     * @returns {object}
     */
    static #traceLengthRow(group, traceRules) {
        const length = CircuitJsonPcbTraceLengthModel.#rounded(group.length)
        const rule = traceRules.get(group.sourceTraceId) || {}
        const maxLength =
            rule.maxLength === null || rule.maxLength === undefined
                ? null
                : CircuitJsonPcbTraceLengthModel.#rounded(rule.maxLength)
        const row = {
            id: group.id,
            netName: group.netName,
            length,
            point: {
                x: CircuitJsonPcbTraceLengthModel.#rounded(group.point.x),
                y: CircuitJsonPcbTraceLengthModel.#rounded(group.point.y)
            },
            layer: group.layer,
            side: group.side
        }
        if (maxLength !== null) {
            row.maxLength = maxLength
            row.displayName = String(rule.displayName || '').trim()
            row.overLimit = length > maxLength
        }
        row.label = CircuitJsonPcbTraceLengthModel.#traceLengthLabel(row)
        return row
    }

    /**
     * Builds a visible trace length label.
     * @param {object} row Trace length row.
     * @returns {string}
     */
    static #traceLengthLabel(row) {
        const length = CircuitJsonPcbTraceLengthModel.#formatLength(row.length)
        if (row.maxLength === undefined) return length + ' mm'

        const maxLength = CircuitJsonPcbTraceLengthModel.#formatLength(
            row.maxLength
        )
        const displayName = String(row.displayName || '').trim()
        return (
            length +
            ' / ' +
            maxLength +
            ' mm' +
            (displayName ? ' (' + displayName + ')' : '')
        )
    }

    /**
     * Returns indexed element rows.
     * @param {{ elementsByType: Map<string, object[]> }} index Element index.
     * @param {string} type Element type.
     * @returns {object[]}
     */
    static #all(index, type) {
        return index.elementsByType.get(type) || []
    }

    /**
     * Formats one length in millimeters.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #formatLength(value) {
        return Number(value).toFixed(2)
    }

    /**
     * Rounds a numeric value for deterministic model rows.
     * @param {number} value Numeric value.
     * @returns {number}
     */
    static #rounded(value) {
        return Number(Number(value).toFixed(6))
    }
}
