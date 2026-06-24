import assert from 'node:assert/strict'
import test from 'node:test'

import { SpiceSimulationWorkerHandler } from '../../src/core/simulation/SpiceSimulationWorkerHandler.mjs'

test('SpiceSimulationWorkerHandler returns success responses for simulation requests', async () => {
    const response = await SpiceSimulationWorkerHandler.handleMessage({
        type: 'spice:simulate',
        requestId: 'request_1',
        spiceString: `
Vmain out 0 DC 1.8
.PRINT TRAN V(out)
.tran 1ms 2ms
.END
`
    })

    assert.equal(response.type, 'spice:success')
    assert.equal(response.requestId, 'request_1')
    assert.deepEqual(response.diagnostics, [])
    assert.deepEqual(response.simulationCircuitJson[0], {
        type: 'simulation_experiment',
        simulation_experiment_id: 'simulation_experiment_0',
        name: 'SPICE transient analysis',
        experiment_type: 'spice_transient_analysis'
    })
    assert.deepEqual(
        response.simulationCircuitJson.slice(1),
        response.simulationResultCircuitJson
    )
    assert.deepEqual(response.simulationResultCircuitJson, [
        {
            type: 'simulation_transient_voltage_graph',
            simulation_experiment_id: 'simulation_experiment_0',
            simulation_transient_voltage_graph_id: 'simulation_graph_0_out',
            name: 'out',
            voltage_levels: [1.8, 1.8, 1.8],
            timestamps_ms: [0, 1, 2],
            start_time_ms: 0,
            time_per_step: 1,
            end_time_ms: 2,
            source_probe_id: undefined,
            source_probe_name: undefined,
            source_node_name: undefined,
            reference_node_name: undefined
        }
    ])
    assert.deepEqual(response.graphSummary, {
        graphCount: 1,
        voltageGraphCount: 1,
        currentGraphCount: 0,
        graphs: [
            {
                id: 'simulation_graph_0_out',
                graphType: 'voltage',
                name: 'out',
                pointCount: 3,
                startTimeMs: 0,
                endTimeMs: 2,
                timePerStepMs: 1,
                min: 1.8,
                max: 1.8,
                firstValue: 1.8,
                lastValue: 1.8
            }
        ]
    })
})

test('SpiceSimulationWorkerHandler ignores unrelated worker messages', async () => {
    const response = await SpiceSimulationWorkerHandler.handleMessage({
        type: 'parse:file',
        requestId: 'request_2'
    })

    assert.equal(response, null)
})
