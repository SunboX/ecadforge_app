import { SpiceSimulationWorkerHandler } from '../core/simulation/SpiceSimulationWorkerHandler.mjs'

/**
 * Runtime entrypoint for the SPICE simulation worker.
 */
class SpiceSimulationWorkerRuntime {
    /**
     * Installs worker event listeners.
     * @returns {void}
     */
    static install() {
        globalThis.addEventListener(
            'message',
            SpiceSimulationWorkerRuntime.handleMessageEvent
        )
    }

    /**
     * Handles one worker message event.
     * @param {MessageEvent} event Worker message event.
     * @returns {Promise<void>}
     */
    static async handleMessageEvent(event) {
        const response = await SpiceSimulationWorkerHandler.handleMessage(
            event?.data || {}
        )

        if (response) {
            globalThis.postMessage(response)
        }
    }
}

SpiceSimulationWorkerRuntime.install()
