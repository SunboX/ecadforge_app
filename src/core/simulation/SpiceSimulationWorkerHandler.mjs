import { SpiceSimulationService } from 'circuitjson-toolkit'

/**
 * Handles worker messages for local SPICE simulation requests.
 */
export class SpiceSimulationWorkerHandler {
    /**
     * Handles one worker payload and returns a response payload.
     * @param {object} payload Worker request payload.
     * @returns {Promise<object | null>}
     */
    static async handleMessage(payload = {}) {
        if (payload?.type !== 'spice:simulate') {
            return null
        }

        const requestId = String(payload.requestId || '')

        try {
            const result = await SpiceSimulationService.simulate(
                String(payload.spiceString || '')
            )

            return {
                type: 'spice:success',
                requestId,
                ...result
            }
        } catch (error) {
            return {
                type: 'spice:error',
                requestId,
                message:
                    error instanceof Error
                        ? error.message
                        : 'SPICE simulation worker failed.'
            }
        }
    }
}
