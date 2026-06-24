import { EcadRendererService } from './ecad/EcadRendererService.mjs'

/**
 * Renders PCB top and bottom SVG artwork as GLTF texture data URIs.
 */
export class PcbAssemblyBoardTextureRenderer {
    /**
     * Renders board-face texture images for a document model.
     * @param {object | object[]} documentModel Document model.
     * @param {{ renderer?: { renderPcb?: (documentModel: object | object[], options?: object) => string }, imageFormat?: string, resolution?: number, showNotes?: boolean, svgToPng?: (markup: string, options?: object) => string | Uint8Array | Promise<string | Uint8Array> }} [options] Render options.
     * @returns {Promise<{ top?: string, bottom?: string } | null>}
     */
    static async render(documentModel, options = {}) {
        const renderer = options.renderer || EcadRendererService
        const top = await PcbAssemblyBoardTextureRenderer.#renderSide(
            renderer,
            documentModel,
            'top',
            options
        )
        const bottom = await PcbAssemblyBoardTextureRenderer.#renderSide(
            renderer,
            documentModel,
            'bottom',
            options
        )
        const textures = {}
        if (top) textures.top = top
        if (bottom) textures.bottom = bottom

        return Object.keys(textures).length ? textures : null
    }

    /**
     * Renders one board side and encodes it as an SVG data URI.
     * @param {{ renderPcb?: (documentModel: object | object[], options?: object) => string }} renderer PCB renderer.
     * @param {object | object[]} documentModel Document model.
     * @param {'top' | 'bottom'} side PCB side.
     * @param {{ imageFormat?: string, resolution?: number, showNotes?: boolean, svgToPng?: (markup: string, options?: object) => string | Uint8Array | Promise<string | Uint8Array> }} options Render options.
     * @returns {Promise<string>}
     */
    static async #renderSide(renderer, documentModel, side, options) {
        if (typeof renderer?.renderPcb !== 'function') {
            return ''
        }

        try {
            const markup = renderer.renderPcb(documentModel, {
                side,
                showNotes: options.showNotes === true
            })
            if (PcbAssemblyBoardTextureRenderer.#shouldRenderPng(options)) {
                return await PcbAssemblyBoardTextureRenderer.#pngDataUri(
                    markup,
                    side,
                    options
                )
            }
            return PcbAssemblyBoardTextureRenderer.#svgDataUri(markup)
        } catch {
            return ''
        }
    }

    /**
     * Returns true when callers requested PNG texture conversion.
     * @param {{ imageFormat?: string }} options Render options.
     * @returns {boolean}
     */
    static #shouldRenderPng(options) {
        return String(options?.imageFormat || '').toLowerCase() === 'png'
    }

    /**
     * Converts one SVG side to a PNG data URI, falling back to SVG on failure.
     * @param {string} markup SVG markup.
     * @param {'top' | 'bottom'} side PCB side.
     * @param {{ resolution?: number, svgToPng?: (markup: string, options?: object) => string | Uint8Array | Promise<string | Uint8Array> }} options Render options.
     * @returns {Promise<string>}
     */
    static async #pngDataUri(markup, side, options) {
        try {
            const resolution =
                PcbAssemblyBoardTextureRenderer.#textureResolution(options)
            const conversionOptions = {
                side,
                width: resolution,
                height: resolution,
                resolution
            }
            const converted =
                typeof options?.svgToPng === 'function'
                    ? await options.svgToPng(markup, conversionOptions)
                    : await PcbAssemblyBoardTextureRenderer.#canvasPngDataUri(
                          markup,
                          conversionOptions
                      )
            return (
                PcbAssemblyBoardTextureRenderer.#normalizePngDataUri(
                    converted
                ) || PcbAssemblyBoardTextureRenderer.#svgDataUri(markup)
            )
        } catch {
            return PcbAssemblyBoardTextureRenderer.#svgDataUri(markup)
        }
    }

    /**
     * Converts SVG markup to PNG with browser canvas APIs when available.
     * @param {string} markup SVG markup.
     * @param {{ width: number, height: number }} options Raster dimensions.
     * @returns {Promise<string>}
     */
    static async #canvasPngDataUri(markup, options) {
        if (
            typeof document === 'undefined' ||
            typeof Image === 'undefined' ||
            typeof Blob === 'undefined' ||
            typeof URL === 'undefined'
        ) {
            return ''
        }

        return await new Promise((resolve) => {
            const image = new Image()
            const objectUrl = URL.createObjectURL(
                new Blob([String(markup || '')], {
                    type: 'image/svg+xml;charset=utf-8'
                })
            )
            image.onload = () => {
                try {
                    const canvas = document.createElement('canvas')
                    canvas.width = options.width
                    canvas.height = options.height
                    const context = canvas.getContext('2d')
                    context?.drawImage(
                        image,
                        0,
                        0,
                        options.width,
                        options.height
                    )
                    resolve(canvas.toDataURL('image/png'))
                } catch {
                    resolve('')
                } finally {
                    URL.revokeObjectURL(objectUrl)
                }
            }
            image.onerror = () => {
                URL.revokeObjectURL(objectUrl)
                resolve('')
            }
            image.src = objectUrl
        })
    }

    /**
     * Normalizes texture resolution to a positive pixel count.
     * @param {{ resolution?: number }} options Render options.
     * @returns {number}
     */
    static #textureResolution(options) {
        const resolution = Number(options?.resolution)
        const rounded =
            Number.isFinite(resolution) && resolution > 0
                ? Math.round(resolution)
                : 1024
        return Math.min(Math.max(rounded, 64), 4096)
    }

    /**
     * Normalizes converter output into a PNG data URI.
     * @param {string | Uint8Array} converted Converter output.
     * @returns {string}
     */
    static #normalizePngDataUri(converted) {
        if (typeof converted === 'string') {
            return converted.startsWith('data:image/png') ? converted : ''
        }

        if (!(converted instanceof Uint8Array)) {
            return ''
        }

        return (
            'data:image/png;base64,' +
            PcbAssemblyBoardTextureRenderer.#base64(converted)
        )
    }

    /**
     * Encodes SVG markup as a base64 image data URI.
     * @param {string} markup SVG markup.
     * @returns {string}
     */
    static #svgDataUri(markup) {
        const text = String(markup || '').trim()
        if (!text) {
            return ''
        }

        return (
            'data:image/svg+xml;base64,' +
            PcbAssemblyBoardTextureRenderer.#base64(
                new TextEncoder().encode(text)
            )
        )
    }

    /**
     * Encodes bytes as base64 in Node and browser runtimes.
     * @param {Uint8Array} bytes Source bytes.
     * @returns {string}
     */
    static #base64(bytes) {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(bytes).toString('base64')
        }

        let binary = ''
        for (let index = 0; index < bytes.length; index += 8192) {
            binary += String.fromCharCode(...bytes.slice(index, index + 8192))
        }
        return btoa(binary)
    }
}
