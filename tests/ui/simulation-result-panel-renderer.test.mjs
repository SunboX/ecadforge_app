import assert from 'node:assert/strict'
import test from 'node:test'
import { SimulationResultPanelRenderer } from '../../src/ui/SimulationResultPanelRenderer.mjs'

/**
 * Builds fake transient graph results.
 * @returns {object[]}
 */
function createGraphs() {
    return [
        {
            type: 'simulation_transient_voltage_graph',
            simulation_transient_voltage_graph_id: 'simulation_graph_vout',
            name: 'VOUT',
            voltage_levels: [0, 1.2, 3.3],
            timestamps_ms: [0, 1, 2],
            start_time_ms: 0,
            end_time_ms: 2,
            time_per_step: 1
        },
        {
            type: 'simulation_transient_current_graph',
            simulation_transient_current_graph_id: 'simulation_graph_iload',
            name: 'I_LOAD',
            current_levels: [0.01, 0.02, 0.015],
            timestamps_ms: [0, 1, 2],
            start_time_ms: 0,
            end_time_ms: 2,
            time_per_step: 1
        }
    ]
}

/**
 * Verifies transient simulation graph elements render as compact SVG charts.
 */
test('SimulationResultPanelRenderer renders transient graph panels', () => {
    const html = SimulationResultPanelRenderer.render({
        simulationResultCircuitJson: createGraphs()
    })

    assert.match(html, /viewer-sidebar__simulation-results/)
    assert.match(html, /Simulation results/)
    assert.match(html, /data-simulation-graph-id="simulation_graph_vout"/)
    assert.match(html, /data-simulation-graph-type="voltage"/)
    assert.match(html, /VOUT/)
    assert.match(html, /3\.3 V/)
    assert.match(html, /data-simulation-graph-id="simulation_graph_iload"/)
    assert.match(html, /data-simulation-graph-type="current"/)
    assert.match(html, /20 mA/)
    assert.match(html, /<polyline[^>]+points="/)
})

/**
 * Verifies simulation source and probe metadata render alongside graphs.
 */
test('SimulationResultPanelRenderer renders simulation setup summaries', () => {
    const html = SimulationResultPanelRenderer.render({
        simulationCircuitJson: [
            {
                type: 'simulation_experiment',
                simulation_experiment_id: 'experiment_1',
                name: 'Startup'
            },
            {
                type: 'simulation_voltage_source',
                simulation_voltage_source_id: 'vsrc_1',
                name: 'VIN',
                source_type: 'dc',
                voltage: 5
            },
            {
                type: 'simulation_current_source',
                simulation_current_source_id: 'isrc_1',
                name: 'LOAD',
                source_type: 'ac',
                current: 0.02
            },
            {
                type: 'simulation_voltage_probe',
                simulation_voltage_probe_id: 'probe_vout',
                name: 'VOUT'
            },
            {
                type: 'simulation_current_probe',
                simulation_current_probe_id: 'probe_iload',
                name: 'ILOAD'
            }
        ],
        simulationResultCircuitJson: createGraphs()
    })

    assert.match(html, /Simulation setup/)
    assert.match(html, /data-simulation-source-id="vsrc_1"/)
    assert.match(html, /VIN/)
    assert.match(html, /DC/)
    assert.match(html, /5 V/)
    assert.match(html, /data-simulation-source-id="isrc_1"/)
    assert.match(html, /AC/)
    assert.match(html, /20 mA/)
    assert.match(html, /data-simulation-probe-id="probe_vout"/)
    assert.match(html, /data-simulation-probe-id="probe_iload"/)
})

/**
 * Verifies simulation model and endpoint mapping metadata remains visible.
 */
test('SimulationResultPanelRenderer renders model and endpoint mappings', () => {
    const html = SimulationResultPanelRenderer.render({
        simulationCircuitJson: [
            {
                type: 'simulation_spice_subcircuit',
                simulation_spice_subcircuit_id: 'model_amp',
                name: 'AMP_MODEL',
                pin_names: ['IN', 'OUT', 'VCC'],
                port_map: {
                    IN: 'source_port_in',
                    OUT: 'source_port_out'
                }
            },
            {
                type: 'simulation_voltage_source',
                simulation_voltage_source_id: 'vsrc_1',
                name: 'VIN',
                source_type: 'dc',
                voltage: 5,
                positive_source_port_id: 'source_port_vin',
                negative_source_port_id: 'source_port_gnd'
            },
            {
                type: 'simulation_voltage_probe',
                simulation_voltage_probe_id: 'probe_vout',
                name: 'VOUT',
                positive_source_port_id: 'source_port_out',
                negative_source_port_id: 'source_port_gnd'
            }
        ]
    })

    assert.match(html, /data-simulation-spice-subcircuit-id="model_amp"/)
    assert.match(html, /AMP_MODEL/)
    assert.match(html, /3 pins/)
    assert.match(html, /IN -&gt; source_port_in/)
    assert.match(html, /source_port_vin -&gt; source_port_gnd/)
    assert.match(html, /source_port_out -&gt; source_port_gnd/)
})

/**
 * Verifies oscilloscope trace display metadata renders beside simulation data.
 */
test('SimulationResultPanelRenderer renders oscilloscope trace display metadata', () => {
    const html = SimulationResultPanelRenderer.render({
        simulationCircuitJson: [
            {
                type: 'simulation_oscilloscope_trace',
                simulation_oscilloscope_trace_id: 'scope_trace_vout',
                simulation_transient_voltage_graph_id: 'simulation_graph_vout',
                display_name: 'Scope VOUT',
                color: '#ff3366',
                display_center_value: 1.65,
                display_center_offset_divs: 0.5,
                volts_per_div: 1
            },
            {
                type: 'simulation_oscilloscope_trace',
                simulation_oscilloscope_trace_id: 'scope_trace_iload',
                simulation_current_probe_id: 'probe_iload',
                display_name: 'Load current',
                amps_per_div: 0.01
            }
        ],
        simulationResultCircuitJson: createGraphs()
    })

    assert.match(html, /viewer-sidebar__simulation-scope-traces/)
    assert.match(
        html,
        /data-simulation-oscilloscope-trace-id="scope_trace_vout"/
    )
    assert.match(
        html,
        /data-simulation-oscilloscope-reference-id="simulation_graph_vout"/
    )
    assert.match(html, /style="--simulation-trace-color:#ff3366"/)
    assert.match(html, /Scope VOUT/)
    assert.match(html, /1 V\/div/)
    assert.match(html, /center 1\.65 V/)
    assert.match(html, /\+0\.5 div/)
    assert.match(
        html,
        /data-simulation-oscilloscope-trace-id="scope_trace_iload"/
    )
    assert.match(html, /10 mA\/div/)
})
