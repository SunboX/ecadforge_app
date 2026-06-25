/**
 * Renders transient simulation graph elements as compact sidebar charts.
 */
export class SimulationResultPanelRenderer {
    static #chartWidth = 160
    static #chartHeight = 56
    static #chartPadding = 6

    /**
     * Renders simulation results from a parsed document or worker result.
     * @param {object | object[]} source Parsed document or simulation result.
     * @returns {string}
     */
    static render(source) {
        const graphs = SimulationResultPanelRenderer.#graphs(source)
        const setup = SimulationResultPanelRenderer.#setup(source)
        if (
            !graphs.length &&
            !setup.sources.length &&
            !setup.probes.length &&
            !setup.spiceSubcircuits.length &&
            !setup.scopeTraces.length
        ) {
            return ''
        }

        return (
            SimulationResultPanelRenderer.#renderSetup(setup) +
            '<section class="viewer-sidebar__simulation-results">' +
            '<header><h4>Simulation results</h4><span>' +
            SimulationResultPanelRenderer.#escapeHtml(String(graphs.length)) +
            ' graph' +
            (graphs.length === 1 ? '' : 's') +
            '</span></header>' +
            graphs
                .map((graph) =>
                    SimulationResultPanelRenderer.#renderGraph(graph)
                )
                .join('') +
            '</section>'
        )
    }

    /**
     * Renders simulation setup metadata.
     * @param {{ experiments: object[], sources: object[], probes: object[], spiceSubcircuits: object[], scopeTraces: object[] }} setup Setup rows.
     * @returns {string}
     */
    static #renderSetup(setup) {
        if (
            !setup.sources.length &&
            !setup.probes.length &&
            !setup.spiceSubcircuits.length &&
            !setup.scopeTraces.length
        ) {
            return ''
        }
        return (
            '<section class="viewer-sidebar__simulation-setup">' +
            '<header><h4>Simulation setup</h4><span>' +
            SimulationResultPanelRenderer.#escapeHtml(
                SimulationResultPanelRenderer.#setupSummary(setup)
            ) +
            '</span></header>' +
            SimulationResultPanelRenderer.#renderExperiments(
                setup.experiments
            ) +
            SimulationResultPanelRenderer.#renderSpiceSubcircuits(
                setup.spiceSubcircuits
            ) +
            setup.sources
                .map((source) =>
                    SimulationResultPanelRenderer.#renderSource(source)
                )
                .join('') +
            SimulationResultPanelRenderer.#renderProbes(setup.probes) +
            SimulationResultPanelRenderer.#renderScopeTraces(
                setup.scopeTraces
            ) +
            '</section>'
        )
    }

    /**
     * Renders simulation experiment labels.
     * @param {object[]} experiments Experiment rows.
     * @returns {string}
     */
    static #renderExperiments(experiments) {
        if (!experiments.length) return ''
        return (
            '<div class="viewer-sidebar__simulation-experiments">' +
            experiments
                .map(
                    (experiment) =>
                        '<span data-simulation-experiment-id="' +
                        SimulationResultPanelRenderer.#escapeHtml(
                            SimulationResultPanelRenderer.#elementId(experiment)
                        ) +
                        '">' +
                        SimulationResultPanelRenderer.#escapeHtml(
                            experiment.name ||
                                SimulationResultPanelRenderer.#elementId(
                                    experiment
                                )
                        ) +
                        '</span>'
                )
                .join('') +
            '</div>'
        )
    }

    /**
     * Builds a compact setup section summary.
     * @param {{ sources: object[], scopeTraces: object[], probes: object[], spiceSubcircuits: object[] }} setup Setup rows.
     * @returns {string}
     */
    static #setupSummary(setup) {
        if (setup.sources.length) {
            return (
                String(setup.sources.length) +
                ' source' +
                (setup.sources.length === 1 ? '' : 's')
            )
        }
        if (setup.scopeTraces.length) {
            return (
                String(setup.scopeTraces.length) +
                ' trace' +
                (setup.scopeTraces.length === 1 ? '' : 's')
            )
        }
        if (setup.probes.length) {
            return (
                String(setup.probes.length) +
                ' probe' +
                (setup.probes.length === 1 ? '' : 's')
            )
        }
        return (
            String(setup.spiceSubcircuits.length) +
            ' model' +
            (setup.spiceSubcircuits.length === 1 ? '' : 's')
        )
    }

    /**
     * Renders one simulation source row.
     * @param {object} source Source element.
     * @returns {string}
     */
    static #renderSource(source) {
        const id = SimulationResultPanelRenderer.#elementId(source)
        const kind = SimulationResultPanelRenderer.#sourceKind(source)
        const connection =
            SimulationResultPanelRenderer.#connectionSummary(source)
        return (
            '<article class="viewer-sidebar__simulation-source" data-simulation-source-id="' +
            SimulationResultPanelRenderer.#escapeHtml(id) +
            '" data-simulation-source-kind="' +
            SimulationResultPanelRenderer.#escapeHtml(kind.toLowerCase()) +
            '"><strong>' +
            SimulationResultPanelRenderer.#escapeHtml(source.name || id) +
            '</strong><span>' +
            SimulationResultPanelRenderer.#escapeHtml(kind) +
            '</span><span>' +
            SimulationResultPanelRenderer.#escapeHtml(
                SimulationResultPanelRenderer.#sourceValue(source)
            ) +
            '</span>' +
            (connection
                ? '<span>' +
                  SimulationResultPanelRenderer.#escapeHtml(connection) +
                  '</span>'
                : '') +
            '</article>'
        )
    }

    /**
     * Renders SPICE subcircuit model summaries.
     * @param {object[]} models Model rows.
     * @returns {string}
     */
    static #renderSpiceSubcircuits(models) {
        if (!models.length) return ''
        return (
            '<div class="viewer-sidebar__simulation-models">' +
            models
                .map((model) =>
                    SimulationResultPanelRenderer.#renderSpiceSubcircuit(model)
                )
                .join('') +
            '</div>'
        )
    }

    /**
     * Renders one SPICE subcircuit model row.
     * @param {object} model Model element.
     * @returns {string}
     */
    static #renderSpiceSubcircuit(model) {
        const id = SimulationResultPanelRenderer.#elementId(model)
        const pins = SimulationResultPanelRenderer.#subcircuitPins(model)
        const mappings =
            SimulationResultPanelRenderer.#subcircuitMappings(model)
        return (
            '<article class="viewer-sidebar__simulation-model" data-simulation-spice-subcircuit-id="' +
            SimulationResultPanelRenderer.#escapeHtml(id) +
            '"><strong>' +
            SimulationResultPanelRenderer.#escapeHtml(model.name || id) +
            '</strong><span>' +
            SimulationResultPanelRenderer.#escapeHtml(String(pins.length)) +
            ' pin' +
            (pins.length === 1 ? '' : 's') +
            '</span>' +
            mappings
                .map(
                    (mapping) =>
                        '<code>' +
                        SimulationResultPanelRenderer.#escapeHtml(mapping) +
                        '</code>'
                )
                .join('') +
            '</article>'
        )
    }

    /**
     * Renders simulation probe chips.
     * @param {object[]} probes Probe rows.
     * @returns {string}
     */
    static #renderProbes(probes) {
        if (!probes.length) return ''
        return (
            '<div class="viewer-sidebar__simulation-probes">' +
            probes
                .map(
                    (probe) =>
                        '<span data-simulation-probe-id="' +
                        SimulationResultPanelRenderer.#escapeHtml(
                            SimulationResultPanelRenderer.#elementId(probe)
                        ) +
                        '" data-simulation-probe-type="' +
                        SimulationResultPanelRenderer.#escapeHtml(
                            SimulationResultPanelRenderer.#probeType(probe)
                        ) +
                        '">' +
                        SimulationResultPanelRenderer.#escapeHtml(
                            probe.name ||
                                SimulationResultPanelRenderer.#elementId(probe)
                        ) +
                        (SimulationResultPanelRenderer.#connectionSummary(probe)
                            ? ' ' +
                              SimulationResultPanelRenderer.#escapeHtml(
                                  SimulationResultPanelRenderer.#connectionSummary(
                                      probe
                                  )
                              )
                            : '') +
                        '</span>'
                )
                .join('') +
            '</div>'
        )
    }

    /**
     * Renders oscilloscope trace display metadata.
     * @param {object[]} traces Oscilloscope trace rows.
     * @returns {string}
     */
    static #renderScopeTraces(traces) {
        if (!traces.length) return ''
        return (
            '<div class="viewer-sidebar__simulation-scope-traces">' +
            traces
                .map((trace) =>
                    SimulationResultPanelRenderer.#renderScopeTrace(trace)
                )
                .join('') +
            '</div>'
        )
    }

    /**
     * Renders one oscilloscope trace row.
     * @param {object} trace Oscilloscope trace row.
     * @returns {string}
     */
    static #renderScopeTrace(trace) {
        const id = SimulationResultPanelRenderer.#elementId(trace)
        const reference = SimulationResultPanelRenderer.#scopeReference(trace)
        const graphType = SimulationResultPanelRenderer.#scopeGraphType(trace)
        const color = String(trace.color || '').trim()
        const style = color
            ? ' style="--simulation-trace-color:' +
              SimulationResultPanelRenderer.#escapeHtml(color) +
              '"'
            : ''
        const labels = [
            SimulationResultPanelRenderer.#scopeScale(trace, graphType),
            SimulationResultPanelRenderer.#scopeCenter(trace, graphType),
            SimulationResultPanelRenderer.#scopeOffset(trace)
        ].filter(Boolean)

        return (
            '<article class="viewer-sidebar__simulation-scope-trace" data-simulation-oscilloscope-trace-id="' +
            SimulationResultPanelRenderer.#escapeHtml(id) +
            '" data-simulation-oscilloscope-reference-id="' +
            SimulationResultPanelRenderer.#escapeHtml(reference) +
            '" data-simulation-oscilloscope-trace-type="' +
            SimulationResultPanelRenderer.#escapeHtml(graphType) +
            '"' +
            style +
            '><strong>' +
            SimulationResultPanelRenderer.#escapeHtml(
                trace.display_name || trace.displayName || trace.name || id
            ) +
            '</strong>' +
            labels
                .map(
                    (label) =>
                        '<span>' +
                        SimulationResultPanelRenderer.#escapeHtml(label) +
                        '</span>'
                )
                .join('') +
            '</article>'
        )
    }

    /**
     * Renders one graph card.
     * @param {object} graph Transient graph element.
     * @returns {string}
     */
    static #renderGraph(graph) {
        const graphType = SimulationResultPanelRenderer.#graphType(graph)
        const graphId = SimulationResultPanelRenderer.#graphId(graph)
        const values = SimulationResultPanelRenderer.#values(graph)
        const summary = SimulationResultPanelRenderer.#summary(
            values,
            graphType
        )

        return (
            '<article class="viewer-sidebar__simulation-graph" data-simulation-graph-id="' +
            SimulationResultPanelRenderer.#escapeHtml(graphId) +
            '" data-simulation-graph-type="' +
            SimulationResultPanelRenderer.#escapeHtml(graphType) +
            '">' +
            '<div class="viewer-sidebar__simulation-graph-header"><strong>' +
            SimulationResultPanelRenderer.#escapeHtml(graph.name || graphId) +
            '</strong><span>' +
            SimulationResultPanelRenderer.#escapeHtml(summary) +
            '</span></div>' +
            '<svg viewBox="0 0 ' +
            SimulationResultPanelRenderer.#chartWidth +
            ' ' +
            SimulationResultPanelRenderer.#chartHeight +
            '" role="img" aria-label="' +
            SimulationResultPanelRenderer.#escapeHtml(graph.name || graphId) +
            '">' +
            '<polyline points="' +
            SimulationResultPanelRenderer.#escapeHtml(
                SimulationResultPanelRenderer.#polylinePoints(graph, values)
            ) +
            '"></polyline></svg>' +
            '</article>'
        )
    }

    /**
     * Extracts transient graph elements from known result containers.
     * @param {object | object[]} source Parsed document or simulation result.
     * @returns {object[]}
     */
    static #graphs(source) {
        const graphs = SimulationResultPanelRenderer.#elementGroups(source)
            .filter(Array.isArray)
            .flat()
            .filter((element) =>
                SimulationResultPanelRenderer.#isTransientGraph(element)
            )
        const seen = new Set()

        return graphs.filter((graph) => {
            const key =
                SimulationResultPanelRenderer.#graphType(graph) +
                ':' +
                SimulationResultPanelRenderer.#graphId(graph)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    /**
     * Extracts simulation setup metadata.
     * @param {object | object[]} source Parsed document or simulation result.
     * @returns {{ experiments: object[], sources: object[], probes: object[], spiceSubcircuits: object[], scopeTraces: object[] }}
     */
    static #setup(source) {
        const elements = SimulationResultPanelRenderer.#elementGroups(source)
            .filter(Array.isArray)
            .flat()
        return {
            experiments: SimulationResultPanelRenderer.#dedupe(
                elements.filter(
                    (element) => element?.type === 'simulation_experiment'
                )
            ),
            sources: SimulationResultPanelRenderer.#dedupe(
                elements.filter((element) =>
                    SimulationResultPanelRenderer.#isSimulationSource(element)
                )
            ),
            probes: SimulationResultPanelRenderer.#dedupe(
                elements.filter((element) =>
                    SimulationResultPanelRenderer.#isSimulationProbe(element)
                )
            ),
            spiceSubcircuits: SimulationResultPanelRenderer.#dedupe(
                elements.filter(
                    (element) => element?.type === 'simulation_spice_subcircuit'
                )
            ),
            scopeTraces: SimulationResultPanelRenderer.#dedupe(
                elements.filter(
                    (element) =>
                        element?.type === 'simulation_oscilloscope_trace'
                )
            )
        }
    }

    /**
     * Returns known element containers from a parsed result.
     * @param {object | object[]} source Parsed document or simulation result.
     * @returns {unknown[]}
     */
    static #elementGroups(source) {
        return [
            source,
            source?.elements,
            source?.simulationResultCircuitJson,
            source?.simulationCircuitJson,
            source?.simulation?.simulationResultCircuitJson,
            source?.simulation?.simulationCircuitJson
        ]
    }

    /**
     * Returns true when an element is a transient graph.
     * @param {object} element Candidate element.
     * @returns {boolean}
     */
    static #isTransientGraph(element) {
        return (
            element?.type === 'simulation_transient_voltage_graph' ||
            element?.type === 'simulation_transient_current_graph'
        )
    }

    /**
     * Returns true when an element is a simulation source.
     * @param {object} element Candidate element.
     * @returns {boolean}
     */
    static #isSimulationSource(element) {
        return (
            element?.type === 'simulation_voltage_source' ||
            element?.type === 'simulation_current_source'
        )
    }

    /**
     * Returns true when an element is a simulation probe.
     * @param {object} element Candidate element.
     * @returns {boolean}
     */
    static #isSimulationProbe(element) {
        return (
            element?.type === 'simulation_voltage_probe' ||
            element?.type === 'simulation_current_probe'
        )
    }

    /**
     * Resolves a graph id.
     * @param {object} graph Transient graph element.
     * @returns {string}
     */
    static #graphId(graph) {
        return String(
            graph.simulation_transient_voltage_graph_id ||
                graph.simulation_transient_current_graph_id ||
                graph.name ||
                'simulation_graph'
        )
    }

    /**
     * Resolves graph type.
     * @param {object} graph Transient graph element.
     * @returns {'voltage' | 'current'}
     */
    static #graphType(graph) {
        return graph?.type === 'simulation_transient_current_graph'
            ? 'current'
            : 'voltage'
    }

    /**
     * Resolves a simulation element id.
     * @param {object} element Simulation element.
     * @returns {string}
     */
    static #elementId(element) {
        return String(
            element.simulation_experiment_id ||
                element.simulation_voltage_source_id ||
                element.simulation_current_source_id ||
                element.simulation_oscilloscope_trace_id ||
                element.simulation_voltage_probe_id ||
                element.simulation_current_probe_id ||
                element.simulation_spice_subcircuit_id ||
                element.name ||
                'simulation_element'
        )
    }

    /**
     * Resolves a display source kind.
     * @param {object} source Source element.
     * @returns {string}
     */
    static #sourceKind(source) {
        return (
            String(source.source_type || source.sourceType || source.kind || '')
                .trim()
                .toUpperCase() || 'SOURCE'
        )
    }

    /**
     * Resolves a display source value.
     * @param {object} source Source element.
     * @returns {string}
     */
    static #sourceValue(source) {
        if (source.type === 'simulation_current_source') {
            return SimulationResultPanelRenderer.#formatValue(
                Number(source.current ?? source.current_amps ?? 0),
                'current'
            )
        }
        return SimulationResultPanelRenderer.#formatValue(
            Number(source.voltage ?? source.voltage_volts ?? 0),
            'voltage'
        )
    }

    /**
     * Resolves a probe type.
     * @param {object} probe Probe element.
     * @returns {'current' | 'voltage'}
     */
    static #probeType(probe) {
        return probe?.type === 'simulation_current_probe'
            ? 'current'
            : 'voltage'
    }

    /**
     * Builds a compact endpoint summary for simulation rows.
     * @param {object} element Simulation element.
     * @returns {string}
     */
    static #connectionSummary(element) {
        const positive = SimulationResultPanelRenderer.#firstString([
            element.positive_source_port_id,
            element.positiveSourcePortId,
            element.positive_port_id,
            element.positive_net_id,
            element.source_port_id
        ])
        const negative = SimulationResultPanelRenderer.#firstString([
            element.negative_source_port_id,
            element.negativeSourcePortId,
            element.negative_port_id,
            element.negative_net_id,
            element.reference_source_port_id
        ])
        if (positive && negative) return positive + ' -> ' + negative
        return positive || negative
    }

    /**
     * Resolves the referenced graph or probe id for a scope trace.
     * @param {object} trace Oscilloscope trace row.
     * @returns {string}
     */
    static #scopeReference(trace) {
        return SimulationResultPanelRenderer.#firstString([
            trace.simulation_transient_voltage_graph_id,
            trace.simulation_transient_current_graph_id,
            trace.simulation_voltage_probe_id,
            trace.simulation_current_probe_id
        ])
    }

    /**
     * Resolves the value type represented by a scope trace.
     * @param {object} trace Oscilloscope trace row.
     * @returns {'current' | 'voltage'}
     */
    static #scopeGraphType(trace) {
        return trace.simulation_transient_current_graph_id ||
            trace.simulation_current_probe_id ||
            trace.amps_per_div !== undefined
            ? 'current'
            : 'voltage'
    }

    /**
     * Formats the scope units-per-division label.
     * @param {object} trace Oscilloscope trace row.
     * @param {'current' | 'voltage'} graphType Graph type.
     * @returns {string}
     */
    static #scopeScale(trace, graphType) {
        const value =
            graphType === 'current' ? trace.amps_per_div : trace.volts_per_div
        if (value === undefined) return ''
        return (
            SimulationResultPanelRenderer.#formatValue(Number(value), graphType) +
            '/div'
        )
    }

    /**
     * Formats the scope center value label.
     * @param {object} trace Oscilloscope trace row.
     * @param {'current' | 'voltage'} graphType Graph type.
     * @returns {string}
     */
    static #scopeCenter(trace, graphType) {
        if (trace.display_center_value === undefined) return ''
        return (
            'center ' +
            SimulationResultPanelRenderer.#formatValue(
                Number(trace.display_center_value),
                graphType
            )
        )
    }

    /**
     * Formats the scope center offset label.
     * @param {object} trace Oscilloscope trace row.
     * @returns {string}
     */
    static #scopeOffset(trace) {
        if (trace.display_center_offset_divs === undefined) return ''
        const value = Number(trace.display_center_offset_divs)
        if (!Number.isFinite(value)) return ''
        const sign = value > 0 ? '+' : ''
        return sign + SimulationResultPanelRenderer.#formatNumber(value) + ' div'
    }

    /**
     * Resolves a subcircuit pin list.
     * @param {object} model Model element.
     * @returns {string[]}
     */
    static #subcircuitPins(model) {
        const pins = Array.isArray(model.pin_names)
            ? model.pin_names
            : Array.isArray(model.pins)
              ? model.pins
              : []
        return pins
            .map((pin) =>
                String(pin?.name ?? pin?.pin_name ?? pin ?? '').trim()
            )
            .filter(Boolean)
    }

    /**
     * Resolves subcircuit pin mapping labels.
     * @param {object} model Model element.
     * @returns {string[]}
     */
    static #subcircuitMappings(model) {
        const map =
            model.port_map ||
            model.portMap ||
            model.pin_map ||
            model.pinMap ||
            model.pin_mappings
        if (map && typeof map === 'object' && !Array.isArray(map)) {
            return Object.entries(map)
                .map(([pin, target]) => pin + ' -> ' + String(target || ''))
                .filter((label) => !label.endsWith(' -> '))
        }
        if (Array.isArray(map)) {
            return map
                .map((entry) => {
                    const pin = String(entry.pin || entry.name || '').trim()
                    const target = String(
                        entry.source_port_id || entry.target || entry.port || ''
                    ).trim()
                    return pin && target ? pin + ' -> ' + target : ''
                })
                .filter(Boolean)
        }
        return []
    }

    /**
     * Returns the first non-empty string in a list.
     * @param {unknown[]} values Candidate values.
     * @returns {string}
     */
    static #firstString(values) {
        return (
            values.map((value) => String(value || '').trim()).find(Boolean) ||
            ''
        )
    }

    /**
     * Resolves graph values.
     * @param {object} graph Transient graph element.
     * @returns {number[]}
     */
    static #values(graph) {
        const values =
            SimulationResultPanelRenderer.#graphType(graph) === 'current'
                ? graph.current_levels
                : graph.voltage_levels
        return Array.isArray(values) ? values.map(Number) : []
    }

    /**
     * Builds the graph summary label.
     * @param {number[]} values Graph values.
     * @param {'voltage' | 'current'} graphType Graph type.
     * @returns {string}
     */
    static #summary(values, graphType) {
        const finiteValues = values.filter(Number.isFinite)
        if (!finiteValues.length) return 'No samples'
        const max = Math.max(...finiteValues)
        return SimulationResultPanelRenderer.#formatValue(max, graphType)
    }

    /**
     * Formats one graph value.
     * @param {number} value Numeric value.
     * @param {'voltage' | 'current'} graphType Graph type.
     * @returns {string}
     */
    static #formatValue(value, graphType) {
        if (graphType === 'current') {
            if (Math.abs(value) < 1) {
                return (
                    SimulationResultPanelRenderer.#formatNumber(value * 1000) +
                    ' mA'
                )
            }
            return SimulationResultPanelRenderer.#formatNumber(value) + ' A'
        }
        return SimulationResultPanelRenderer.#formatNumber(value) + ' V'
    }

    /**
     * Builds SVG polyline points for one graph.
     * @param {object} graph Transient graph element.
     * @param {number[]} values Graph values.
     * @returns {string}
     */
    static #polylinePoints(graph, values) {
        const times = Array.isArray(graph.timestamps_ms)
            ? graph.timestamps_ms.map(Number)
            : values.map((_value, index) => index)
        const finiteValues = values.filter(Number.isFinite)
        if (!finiteValues.length) return ''

        const minTime = Math.min(...times.filter(Number.isFinite), 0)
        const maxTime = Math.max(...times.filter(Number.isFinite), minTime + 1)
        const minValue = Math.min(...finiteValues)
        const maxValue = Math.max(...finiteValues)
        const innerWidth =
            SimulationResultPanelRenderer.#chartWidth -
            SimulationResultPanelRenderer.#chartPadding * 2
        const innerHeight =
            SimulationResultPanelRenderer.#chartHeight -
            SimulationResultPanelRenderer.#chartPadding * 2

        return values
            .map((value, index) => {
                const time = Number.isFinite(times[index])
                    ? times[index]
                    : index
                const x =
                    SimulationResultPanelRenderer.#chartPadding +
                    ((time - minTime) / Math.max(maxTime - minTime, 1)) *
                        innerWidth
                const y =
                    SimulationResultPanelRenderer.#chartPadding +
                    (1 -
                        (value - minValue) / Math.max(maxValue - minValue, 1)) *
                        innerHeight
                return (
                    SimulationResultPanelRenderer.#formatNumber(x) +
                    ',' +
                    SimulationResultPanelRenderer.#formatNumber(y)
                )
            })
            .join(' ')
    }

    /**
     * Formats a number for display or SVG output.
     * @param {number} value Numeric value.
     * @returns {string}
     */
    static #formatNumber(value) {
        const number = Number(value)
        if (!Number.isFinite(number)) return '0'
        return String(Math.round(number * 1_000_000) / 1_000_000)
    }

    /**
     * Removes duplicate simulation rows by type and id.
     * @param {object[]} rows Candidate rows.
     * @returns {object[]}
     */
    static #dedupe(rows) {
        const seen = new Set()
        return rows.filter((row) => {
            const key =
                String(row?.type || '') +
                ':' +
                SimulationResultPanelRenderer.#elementId(row)
            if (seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    /**
     * Escapes text for HTML.
     * @param {unknown} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('"', '&quot;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
    }
}
