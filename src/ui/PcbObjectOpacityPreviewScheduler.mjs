import { PcbObjectOpacityCssRenderer } from '../core/PcbObjectOpacityCssRenderer.mjs'

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg'
const OBJECT_OPACITY_PREVIEW_STYLE_CLASS = 'pcb-object-opacity-preview-style'
const MODE_DEFERRED_PREVIEW = 'deferred-preview'
const MODE_COMMIT_ONLY = 'commit-only'

/**
 * Coalesces live PCB object opacity previews so slider input stays responsive.
 */
export class PcbObjectOpacityPreviewScheduler {
    static MODE_DEFERRED_PREVIEW = MODE_DEFERRED_PREVIEW
    static MODE_COMMIT_ONLY = MODE_COMMIT_ONLY

    #cancelFrame
    #cssRenderer
    #frameId = null
    #framePending = false
    #frameScheduler
    #mode
    #pendingPreview = null
    #requestId = 0
    #worker = null
    #workerTargets = new Map()
    #workerUsable = false

    /**
     * @param {object} [options] Scheduler options.
     * @param {(hiddenObjectKeys: string[], objectOpacities: { [objectKey: string]: number }) => string} [options.cssRenderer] CSS render callback.
     * @param {(callback: FrameRequestCallback | Function) => number | NodeJS.Timeout} [options.frameScheduler] Frame scheduling callback.
     * @param {(frameId: number | NodeJS.Timeout | null) => void} [options.cancelFrame] Frame cancellation callback.
     * @param {string} [options.mode] Preview mode.
     * @param {boolean} [options.useWorker] Whether to use worker CSS rendering.
     * @param {(workerUrl: URL) => Worker | null} [options.workerFactory] Worker creation callback.
     * @param {URL} [options.workerUrl] Worker module URL.
     */
    constructor({
        cssRenderer = PcbObjectOpacityCssRenderer.render,
        frameScheduler = PcbObjectOpacityPreviewScheduler
            .#defaultFrameScheduler,
        cancelFrame = PcbObjectOpacityPreviewScheduler.#defaultCancelFrame,
        mode = MODE_DEFERRED_PREVIEW,
        useWorker = true,
        workerFactory = PcbObjectOpacityPreviewScheduler.#defaultWorkerFactory,
        workerUrl = new URL(
            './PcbObjectOpacityPreviewWorker.mjs',
            import.meta.url
        )
    } = {}) {
        this.#cssRenderer = cssRenderer
        this.#frameScheduler = frameScheduler
        this.#cancelFrame = cancelFrame
        this.#mode = PcbObjectOpacityPreviewScheduler.#normalizeMode(mode)
        this.#worker =
            useWorker === false
                ? null
                : PcbObjectOpacityPreviewScheduler.#createWorker(
                      workerFactory,
                      workerUrl
                  )
        this.#workerUsable = Boolean(this.#worker)
        this.#bindWorker()
    }

    /**
     * Returns the current live preview mode.
     * @returns {string}
     */
    get mode() {
        return this.#mode
    }

    /**
     * Updates the live preview mode.
     * @param {string} value Preview mode.
     */
    set mode(value) {
        this.#mode = PcbObjectOpacityPreviewScheduler.#normalizeMode(value)
    }

    /**
     * Requests a live opacity preview for one object category.
     * @param {HTMLElement | null} mount Sidebar mount node.
     * @param {any} input Range input node.
     * @param {string} objectKey Object category key.
     * @param {number} opacity Opacity percentage.
     * @returns {void}
     */
    preview(mount, input, objectKey, opacity) {
        PcbObjectOpacityPreviewScheduler.#updateOpacityLabel(input, opacity)
        if (this.#mode === MODE_COMMIT_ONLY) return

        const svg = mount?.ownerDocument?.querySelector?.('.pcb-view .pcb-svg')
        if (!svg || typeof svg.querySelector !== 'function') return

        const normalizedObjectKey = String(objectKey || '')
        if (!normalizedObjectKey) return

        this.#pendingPreview = {
            objectKey: normalizedObjectKey,
            opacity:
                PcbObjectOpacityPreviewScheduler.#normalizeOpacity(opacity),
            svg
        }
        this.#scheduleFrame()
    }

    /**
     * Cancels any pending preview work.
     * @returns {void}
     */
    dispose() {
        if (this.#framePending) {
            this.#cancelFrame(this.#frameId)
        }
        this.#frameId = null
        this.#framePending = false
        this.#pendingPreview = null
        this.#disableWorker()
    }

    /**
     * Schedules the latest pending preview on the next frame.
     * @returns {void}
     */
    #scheduleFrame() {
        if (this.#framePending) return

        this.#framePending = true
        this.#frameId = this.#frameScheduler(() => {
            this.#frameId = null
            this.#framePending = false
            this.#applyLatestPreview()
        })
    }

    /**
     * Applies the latest queued preview style to the active SVG.
     * @returns {void}
     */
    #applyLatestPreview() {
        const preview = this.#pendingPreview
        this.#pendingPreview = null
        if (!preview) return

        if (this.#postWorkerPreview(preview)) return

        const css = this.#cssRenderer([], {
            [preview.objectKey]: preview.opacity
        })
        this.#applyPreviewCss(preview.svg, css)
    }

    /**
     * Posts one preview render to the worker when available.
     * @param {{ objectKey: string, opacity: number, svg: any }} preview Preview request.
     * @returns {boolean}
     */
    #postWorkerPreview(preview) {
        if (
            !this.#workerUsable ||
            !this.#worker ||
            typeof this.#worker.postMessage !== 'function'
        ) {
            return false
        }

        const requestId = this.#requestId + 1
        this.#requestId = requestId
        this.#workerTargets.clear()
        this.#workerTargets.set(requestId, preview.svg)

        try {
            this.#worker.postMessage({
                objectKey: preview.objectKey,
                opacity: preview.opacity,
                requestId
            })
            return true
        } catch {
            this.#disableWorker()
            return false
        }
    }

    /**
     * Handles one worker response.
     * @param {{ data?: { requestId?: number, css?: string, error?: string } }} event Worker message event.
     * @returns {void}
     */
    #handleWorkerMessage(event) {
        const data = event?.data || {}
        const requestId = Number(data.requestId)
        const svg = this.#workerTargets.get(requestId)
        if (!svg) return

        this.#workerTargets.delete(requestId)
        if (data.error) {
            this.#disableWorker()
            return
        }

        this.#applyPreviewCss(svg, String(data.css || ''))
    }

    /**
     * Applies CSS to the preview style node.
     * @param {any} svg Active PCB SVG node.
     * @param {string} css Preview CSS.
     * @returns {void}
     */
    #applyPreviewCss(svg, css) {
        if (!css) return

        const style = PcbObjectOpacityPreviewScheduler.#resolvePreviewStyle(svg)
        if (!style) return

        style.textContent = css
    }

    /**
     * Wires worker message handlers.
     * @returns {void}
     */
    #bindWorker() {
        if (!this.#worker) return

        if (typeof this.#worker.addEventListener === 'function') {
            this.#worker.addEventListener('message', (event) => {
                this.#handleWorkerMessage(event)
            })
            this.#worker.addEventListener('error', () => {
                this.#disableWorker()
            })
            return
        }

        this.#worker.onmessage = (event) => {
            this.#handleWorkerMessage(event)
        }
        this.#worker.onerror = () => {
            this.#disableWorker()
        }
    }

    /**
     * Disables worker preview rendering.
     * @returns {void}
     */
    #disableWorker() {
        this.#workerUsable = false
        this.#workerTargets.clear()
        this.#worker?.terminate?.()
        this.#worker = null
    }

    /**
     * Updates the visible percentage label next to a live range input.
     * @param {any} input Range input node.
     * @param {number} opacity Opacity percentage.
     * @returns {void}
     */
    static #updateOpacityLabel(input, opacity) {
        const label = input
            ?.closest?.('.viewer-sidebar__object-slider')
            ?.querySelector?.('.viewer-sidebar__object-opacity-value')
        if (label) {
            label.textContent =
                String(
                    Math.round(
                        PcbObjectOpacityPreviewScheduler.#normalizeOpacity(
                            opacity
                        )
                    )
                ) + '%'
        }
    }

    /**
     * Resolves or creates the temporary SVG style used for live previews.
     * @param {any} svg Active PCB SVG node.
     * @returns {any}
     */
    static #resolvePreviewStyle(svg) {
        const selector = 'style.' + OBJECT_OPACITY_PREVIEW_STYLE_CLASS
        const existing = svg.querySelector?.(selector)
        if (existing) return existing

        const documentNode = svg.ownerDocument || globalThis.document
        const style = documentNode?.createElementNS?.(SVG_NAMESPACE, 'style')
        if (!style) return null

        style.setAttribute?.('class', OBJECT_OPACITY_PREVIEW_STYLE_CLASS)
        svg.appendChild?.(style)
        return style
    }

    /**
     * Normalizes preview modes.
     * @param {string} mode Raw preview mode.
     * @returns {string}
     */
    static #normalizeMode(mode) {
        return mode === MODE_COMMIT_ONLY
            ? MODE_COMMIT_ONLY
            : MODE_DEFERRED_PREVIEW
    }

    /**
     * Normalizes live slider percentages.
     * @param {unknown} opacity Raw opacity.
     * @returns {number}
     */
    static #normalizeOpacity(opacity) {
        const numeric = Number(opacity)
        if (!Number.isFinite(numeric)) return 100
        return Math.min(100, Math.max(0, numeric))
    }

    /**
     * Schedules work for the next animation frame with a timeout fallback.
     * @param {FrameRequestCallback | Function} callback Scheduled callback.
     * @returns {number | NodeJS.Timeout}
     */
    static #defaultFrameScheduler(callback) {
        if (typeof globalThis.requestAnimationFrame === 'function') {
            return globalThis.requestAnimationFrame(callback)
        }
        return globalThis.setTimeout(callback, 0)
    }

    /**
     * Cancels a default scheduled frame.
     * @param {number | NodeJS.Timeout | null} frameId Scheduled frame id.
     * @returns {void}
     */
    static #defaultCancelFrame(frameId) {
        if (frameId === null || frameId === undefined) return
        if (typeof globalThis.cancelAnimationFrame === 'function') {
            globalThis.cancelAnimationFrame(frameId)
            return
        }
        globalThis.clearTimeout?.(frameId)
    }

    /**
     * Creates the default module worker when the platform supports it.
     * @param {URL} workerUrl Worker module URL.
     * @returns {Worker | null}
     */
    static #defaultWorkerFactory(workerUrl) {
        if (typeof globalThis.Worker !== 'function') return null
        return new globalThis.Worker(workerUrl, { type: 'module' })
    }

    /**
     * Creates a worker and handles unsupported environments.
     * @param {(workerUrl: URL) => Worker | null} workerFactory Worker factory.
     * @param {URL} workerUrl Worker module URL.
     * @returns {Worker | null}
     */
    static #createWorker(workerFactory, workerUrl) {
        try {
            return workerFactory(workerUrl)
        } catch {
            return null
        }
    }
}
