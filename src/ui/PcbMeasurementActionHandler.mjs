import {
    PcbBoundsSelectionModel,
    PcbCandidateSelectionModel
} from 'circuitjson-toolkit/renderers'
import { PcbMeasurementSnapshotExporter } from './PcbMeasurementSnapshotExporter.mjs'

const MEASUREMENT_FOCUS_PADDING_FACTOR = 1.6

/**
 * Handles completed PCB bounds measurement workflow actions.
 */
export class PcbMeasurementActionHandler {
    /**
     * Handles one completed measurement action.
     * @param {{ action?: string, bounds?: object }} change Action change.
     * @param {{ documentModel?: object, markup?: string, documentRef?: Document | null, side?: string, hiddenLayers?: string[], hiddenObjects?: string[], downloadBytes?: ((fileName: string, bytes: Uint8Array, contentType: string) => void) | null, focusBounds?: ((bounds: { x: number, y: number, width: number, height: number }, options?: { paddingFactor?: number }) => void) | null, emitCandidates?: ((point: object, candidates: object[], selectedCandidate: object | null, source: string) => void) | null, emitComponent?: ((candidate: object | null) => void) | null, emitNet?: ((candidate: object | null) => void) | null }} [options] Action dependencies.
     * @returns {boolean}
     */
    static handle(change, options = {}) {
        const action = String(change?.action || '')
        const bounds = PcbBoundsSelectionModel.normalizeBounds(change?.bounds)
        if (!action || !bounds) return false

        if (action === 'zoom') {
            options.focusBounds?.(
                PcbMeasurementActionHandler.#viewportBounds(bounds),
                { paddingFactor: MEASUREMENT_FOCUS_PADDING_FACTOR }
            )
            return true
        }

        if (action === 'select') {
            PcbMeasurementActionHandler.#selectBounds(bounds, options)
            return true
        }

        if (action === 'export-svg') {
            return PcbMeasurementSnapshotExporter.exportSvg({
                markup: options.markup || '',
                bounds,
                fileBase: PcbMeasurementSnapshotExporter.fileBase(
                    options.documentModel
                ),
                downloadBytes: options.downloadBytes
            })
        }

        if (action === 'export-png') {
            void PcbMeasurementSnapshotExporter.exportPng({
                documentRef: options.documentRef || null,
                markup: options.markup || '',
                bounds,
                fileBase: PcbMeasurementSnapshotExporter.fileBase(
                    options.documentModel
                ),
                downloadBytes: options.downloadBytes
            })
            return true
        }

        return false
    }

    /**
     * Selects candidate data contained by measured bounds.
     * @param {object} bounds Normalized board-space bounds.
     * @param {object} options Action dependencies.
     * @returns {void}
     */
    static #selectBounds(bounds, options) {
        const selection = PcbBoundsSelectionModel.resolve(
            options.documentModel,
            bounds,
            {
                side: options.side,
                hiddenLayers: options.hiddenLayers,
                hiddenObjects: options.hiddenObjects
            }
        )
        options.emitCandidates?.(
            selection.point || PcbMeasurementActionHandler.#boundsCenter(bounds),
            selection.candidates,
            selection.selectedCandidate,
            'bounds'
        )
        options.emitComponent?.(
            PcbCandidateSelectionModel.componentCandidate(selection.candidates)
        )
        options.emitNet?.(
            PcbCandidateSelectionModel.netCandidate(selection.candidates)
        )
    }

    /**
     * Converts normalized min/max bounds into viewport bounds.
     * @param {object} bounds Normalized bounds.
     * @returns {{ x: number, y: number, width: number, height: number }}
     */
    static #viewportBounds(bounds) {
        return {
            x: Number(bounds.minX),
            y: Number(bounds.minY),
            width: Number(bounds.width),
            height: Number(bounds.height)
        }
    }

    /**
     * Resolves the center of normalized bounds.
     * @param {object} bounds Normalized bounds.
     * @returns {{ x: number, y: number }}
     */
    static #boundsCenter(bounds) {
        return {
            x: (Number(bounds.minX) + Number(bounds.maxX)) / 2,
            y: (Number(bounds.minY) + Number(bounds.maxY)) / 2
        }
    }
}
