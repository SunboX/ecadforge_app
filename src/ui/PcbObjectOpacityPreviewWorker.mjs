import { PcbObjectOpacityCssRenderer } from '../core/PcbObjectOpacityCssRenderer.mjs'

/**
 * Handles opacity preview render requests inside the worker.
 */
class PcbObjectOpacityPreviewWorker {
    /**
     * Binds worker message handling.
     * @returns {void}
     */
    static bind() {
        globalThis.addEventListener?.('message', (event) => {
            PcbObjectOpacityPreviewWorker.handlePreviewRequest(event)
        })
    }

    /**
     * Handles one opacity preview render request.
     * @param {MessageEvent} event Worker message event.
     * @returns {void}
     */
    static handlePreviewRequest(event) {
        const data = event?.data || {}
        const requestId = data.requestId

        try {
            const objectKey = String(data.objectKey || '')
            const opacity = Number(data.opacity ?? 100)
            const css = PcbObjectOpacityCssRenderer.render([], {
                [objectKey]: opacity
            })

            PcbObjectOpacityPreviewWorker.postPreviewResponse({
                css,
                requestId
            })
        } catch (error) {
            PcbObjectOpacityPreviewWorker.postPreviewResponse({
                error: String(error?.message || error),
                requestId
            })
        }
    }

    /**
     * Posts a preview response to the main thread.
     * @param {{ requestId: unknown, css?: string, error?: string }} response Preview response.
     * @returns {void}
     */
    static postPreviewResponse(response) {
        globalThis.postMessage?.(response)
    }
}

PcbObjectOpacityPreviewWorker.bind()
