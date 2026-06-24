import assert from 'node:assert/strict'
import test from 'node:test'

import { SpiceSimulationWorkerClient } from '../../src/core/simulation/SpiceSimulationWorkerClient.mjs'

/**
 * Worker double for simulation client tests.
 */
class FakeWorker {
    /** @type {Map<string, Set<(event: any) => void>>} */
    #listeners

    /** @type {object[]} */
    messages

    /** @type {boolean} */
    terminated

    constructor() {
        this.#listeners = new Map()
        this.messages = []
        this.terminated = false
    }

    /**
     * Adds one listener for a worker event type.
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    addEventListener(type, listener) {
        if (!this.#listeners.has(type)) {
            this.#listeners.set(type, new Set())
        }
        this.#listeners.get(type)?.add(listener)
    }

    /**
     * Removes one listener for a worker event type.
     * @param {string} type Event type.
     * @param {(event: any) => void} listener Event listener.
     * @returns {void}
     */
    removeEventListener(type, listener) {
        this.#listeners.get(type)?.delete(listener)
    }

    /**
     * Records one worker message.
     * @param {object} payload Worker payload.
     * @returns {void}
     */
    postMessage(payload) {
        this.messages.push(payload)
    }

    /**
     * Emits one worker message.
     * @param {object} data Message data.
     * @returns {void}
     */
    emitMessage(data) {
        this.#emit('message', { data })
    }

    /**
     * Emits one worker error.
     * @param {string} message Error message.
     * @returns {void}
     */
    emitError(message) {
        this.#emit('error', { message })
    }

    /**
     * Marks the worker as terminated.
     * @returns {void}
     */
    terminate() {
        this.terminated = true
    }

    /**
     * Emits one event to all listeners for the event type.
     * @param {string} type Event type.
     * @param {object} event Event object.
     * @returns {void}
     */
    #emit(type, event) {
        for (const listener of this.#listeners.get(type) || []) {
            listener(event)
        }
    }
}

test('SpiceSimulationWorkerClient posts requests and resolves matching responses', async () => {
    const worker = new FakeWorker()
    const client = new SpiceSimulationWorkerClient({
        workerFactory: () => worker
    })
    const pending = client.simulate('Vmain out 0 DC 3.3')

    assert.equal(worker.messages.length, 1)
    assert.equal(worker.messages[0].type, 'spice:simulate')
    assert.equal(worker.messages[0].spiceString, 'Vmain out 0 DC 3.3')
    assert.match(worker.messages[0].requestId, /^spice_request_/)

    worker.emitMessage({
        type: 'spice:success',
        requestId: worker.messages[0].requestId,
        simulationResultCircuitJson: [],
        simulationCircuitJson: [
            {
                type: 'simulation_experiment',
                simulation_experiment_id: 'simulation_experiment_0',
                name: 'SPICE transient analysis',
                experiment_type: 'spice_transient_analysis'
            }
        ],
        graphSummary: {
            graphCount: 0,
            voltageGraphCount: 0,
            currentGraphCount: 0,
            graphs: []
        },
        diagnostics: []
    })

    assert.deepEqual(await pending, {
        simulationResultCircuitJson: [],
        simulationCircuitJson: [
            {
                type: 'simulation_experiment',
                simulation_experiment_id: 'simulation_experiment_0',
                name: 'SPICE transient analysis',
                experiment_type: 'spice_transient_analysis'
            }
        ],
        graphSummary: {
            graphCount: 0,
            voltageGraphCount: 0,
            currentGraphCount: 0,
            graphs: []
        },
        diagnostics: []
    })
})

test('SpiceSimulationWorkerClient rejects matching error responses', async () => {
    const worker = new FakeWorker()
    const client = new SpiceSimulationWorkerClient({
        workerFactory: () => worker
    })
    const pending = client.simulate('broken')

    worker.emitMessage({
        type: 'spice:error',
        requestId: worker.messages[0].requestId,
        message: 'Simulation failed'
    })

    await assert.rejects(pending, /Simulation failed/)
})

test('SpiceSimulationWorkerClient terminates owned workers on dispose', () => {
    const worker = new FakeWorker()
    const client = new SpiceSimulationWorkerClient({
        workerFactory: () => worker
    })

    client.simulate('Vmain out 0 DC 3.3').catch(() => {})
    client.dispose()

    assert.equal(worker.terminated, true)
})
