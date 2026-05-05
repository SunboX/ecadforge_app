import { PcbScene3dScenePreparator } from '@sunbox/altium-toolkit/scene3d'

/**
 * Dedicated worker entrypoint for 3D scene preprocessing.
 */
class PcbScene3dWorkerRuntime {
    /**
     * Handles one worker message.
     * @param {{ data?: { type?: string, requestId?: string, documentModel?: any, sessionAssets?: any[] } }} event
     * @returns {Promise<void>}
     */
    static async handleMessage(event) {
        const payload = event?.data || {}
        if (payload?.type !== 'scene3d:prepare') {
            return
        }

        const requestId = String(payload?.requestId || '')

        try {
            const sceneDescription =
                await PcbScene3dScenePreparator.prepare(
                    payload?.documentModel || {},
                    {
                        sessionAssets: payload?.sessionAssets || []
                    }
                )

            globalThis.postMessage({
                type: 'scene3d:success',
                requestId,
                sceneDescription
            })
        } catch (error) {
            globalThis.postMessage({
                type: 'scene3d:error',
                requestId,
                message: String(
                    error?.message || error || '3D scene prep failed.'
                )
            })
        }
    }
}

globalThis.addEventListener('message', (event) => {
    PcbScene3dWorkerRuntime.handleMessage(event)
})
