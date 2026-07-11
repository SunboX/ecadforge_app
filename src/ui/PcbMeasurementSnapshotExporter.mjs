import { EcadDocumentType } from '../core/ecad/EcadDocumentType.mjs'

/**
 * Exports clipped snapshots from the currently rendered PCB SVG.
 */
export class PcbMeasurementSnapshotExporter {
    /**
     * Exports a clipped SVG snapshot.
     * @param {{ markup: string, bounds: object, fileBase: string, downloadBytes?: ((fileName: string, bytes: Uint8Array, contentType: string) => void) | null }} options Export options.
     * @returns {boolean}
     */
    static exportSvg(options) {
        const svg = PcbMeasurementSnapshotExporter.clippedSvgMarkup(
            options?.markup,
            options?.bounds
        )
        if (!svg || typeof options?.downloadBytes !== 'function') return false

        options.downloadBytes(
            PcbMeasurementSnapshotExporter.#fileName(options.fileBase, 'svg'),
            new TextEncoder().encode(svg),
            'image/svg+xml'
        )
        return true
    }

    /**
     * Exports a clipped PNG snapshot when browser raster APIs are available.
     * @param {{ documentRef?: Document | null, windowRef?: Window | null, markup: string, bounds: object, fileBase: string, downloadBytes?: ((fileName: string, bytes: Uint8Array, contentType: string) => void) | null }} options Export options.
     * @returns {Promise<boolean>}
     */
    static async exportPng(options) {
        const svg = PcbMeasurementSnapshotExporter.clippedSvgMarkup(
            options?.markup,
            options?.bounds
        )
        const documentRef = options?.documentRef || globalThis.document || null
        const windowRef =
            options?.windowRef || documentRef?.defaultView || globalThis
        if (
            !svg ||
            typeof options?.downloadBytes !== 'function' ||
            typeof Blob !== 'function' ||
            typeof URL === 'undefined' ||
            typeof windowRef.Image !== 'function' ||
            typeof documentRef?.createElement !== 'function'
        ) {
            return false
        }

        const image = new windowRef.Image()
        const url = URL.createObjectURL(
            new Blob([svg], { type: 'image/svg+xml' })
        )
        try {
            await PcbMeasurementSnapshotExporter.#loadImage(image, url)
            const canvas = documentRef.createElement('canvas')
            const size = PcbMeasurementSnapshotExporter.#pngSize(options.bounds)
            canvas.width = size.width
            canvas.height = size.height
            const context = canvas.getContext?.('2d')
            if (!context || typeof context.drawImage !== 'function') {
                return false
            }
            context.drawImage(image, 0, 0, size.width, size.height)
            const blob =
                await PcbMeasurementSnapshotExporter.#canvasBlob(canvas)
            if (!blob) return false

            const bytes = new Uint8Array(await blob.arrayBuffer())
            options.downloadBytes(
                PcbMeasurementSnapshotExporter.#fileName(
                    options.fileBase,
                    'png'
                ),
                bytes,
                'image/png'
            )
            return true
        } finally {
            URL.revokeObjectURL(url)
        }
    }

    /**
     * Returns clipped SVG markup with a bounds-sized viewBox.
     * @param {string} markup Source markup containing a PCB SVG.
     * @param {{ minX?: unknown, minY?: unknown, maxX?: unknown, maxY?: unknown }} bounds Clip bounds.
     * @returns {string}
     */
    static clippedSvgMarkup(markup, bounds) {
        const normalizedBounds = PcbMeasurementSnapshotExporter.#bounds(bounds)
        if (!normalizedBounds) return ''

        const svg = PcbMeasurementSnapshotExporter.#extractSvg(markup)
        if (!svg) return ''

        const viewBox = [
            normalizedBounds.minX,
            normalizedBounds.minY,
            normalizedBounds.width,
            normalizedBounds.height
        ]
            .map((value) => PcbMeasurementSnapshotExporter.#number(value))
            .join(' ')
        const withViewBox = svg.includes(' viewBox=')
            ? svg.replace(/\sviewBox="[^"]*"/, ' viewBox="' + viewBox + '"')
            : svg.replace('<svg ', '<svg viewBox="' + viewBox + '" ')

        return withViewBox.includes(' xmlns=')
            ? withViewBox
            : withViewBox.replace(
                  '<svg ',
                  '<svg xmlns="http://www.w3.org/2000/svg" '
              )
    }

    /**
     * Resolves a safe file-name base from a document model.
     * @param {object | object[] | null | undefined} documentModel Document model.
     * @returns {string}
     */
    static fileBase(documentModel) {
        const rawName = String(
            EcadDocumentType.fileName(documentModel) || 'board'
        )
            .split(/[\\/]/u)
            .pop()
            .replace(/\.[^.]+$/u, '')
        const normalized = rawName
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/gu, '-')
            .replace(/^-+|-+$/gu, '')
        return normalized || 'board'
    }

    /**
     * Extracts the first rendered PCB SVG from markup.
     * @param {string} markup Source markup.
     * @returns {string}
     */
    static #extractSvg(markup) {
        const match = String(markup || '').match(
            /<svg\b(?=[^>]*\bclass="[^"]*\bpcb-svg\b[^"]*")[\s\S]*?<\/svg>/u
        )
        return match ? match[0] : ''
    }

    /**
     * Normalizes clip bounds.
     * @param {object | null | undefined} bounds Bounds candidate.
     * @returns {{ minX: number, minY: number, maxX: number, maxY: number, width: number, height: number } | null}
     */
    static #bounds(bounds) {
        const minX = PcbMeasurementSnapshotExporter.#finite(bounds?.minX)
        const minY = PcbMeasurementSnapshotExporter.#finite(bounds?.minY)
        const maxX = PcbMeasurementSnapshotExporter.#finite(bounds?.maxX)
        const maxY = PcbMeasurementSnapshotExporter.#finite(bounds?.maxY)
        if ([minX, minY, maxX, maxY].some((value) => value === null)) {
            return null
        }

        const left = Math.min(minX, maxX)
        const right = Math.max(minX, maxX)
        const top = Math.min(minY, maxY)
        const bottom = Math.max(minY, maxY)
        return {
            minX: left,
            minY: top,
            maxX: right,
            maxY: bottom,
            width: Math.max(right - left, 0.001),
            height: Math.max(bottom - top, 0.001)
        }
    }

    /**
     * Resolves a PNG canvas size for bounds.
     * @param {object} bounds Clip bounds.
     * @returns {{ width: number, height: number }}
     */
    static #pngSize(bounds) {
        const normalizedBounds = PcbMeasurementSnapshotExporter.#bounds(bounds)
        const width = Math.max(normalizedBounds?.width || 1, 0.001)
        const height = Math.max(normalizedBounds?.height || 1, 0.001)
        const scale = Math.min(1600 / Math.max(width, height), 600)
        return {
            width: Math.max(Math.round(width * scale), 1),
            height: Math.max(Math.round(height * scale), 1)
        }
    }

    /**
     * Waits for an image to load.
     * @param {HTMLImageElement} image Image element.
     * @param {string} url Object URL.
     * @returns {Promise<void>}
     */
    static #loadImage(image, url) {
        return new Promise((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('PNG export image failed.'))
            image.src = url
        })
    }

    /**
     * Resolves a PNG blob from a canvas.
     * @param {HTMLCanvasElement} canvas Canvas element.
     * @returns {Promise<Blob | null>}
     */
    static #canvasBlob(canvas) {
        if (typeof canvas.toBlob !== 'function') return Promise.resolve(null)
        return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
    }

    /**
     * Builds a bounds export file name.
     * @param {string} fileBase Base name.
     * @param {string} extension File extension.
     * @returns {string}
     */
    static #fileName(fileBase, extension) {
        return (
            (String(fileBase || '').trim() || 'board') + '-bounds.' + extension
        )
    }

    /**
     * Formats a compact SVG number.
     * @param {number} value Number.
     * @returns {string}
     */
    static #number(value) {
        return Number(Number(value).toFixed(6)).toString()
    }

    /**
     * Converts a value to a finite number or null.
     * @param {unknown} value Numeric candidate.
     * @returns {number | null}
     */
    static #finite(value) {
        if (value === undefined || value === null || value === '') return null
        const number = Number(value)
        return Number.isFinite(number) ? number : null
    }
}
