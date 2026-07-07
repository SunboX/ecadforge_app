import { EcadFormatRegistry } from '../core/ecad/EcadFormatRegistry.mjs'

/**
 * Resolves Gerber source-file rendering from PCB viewer state.
 */
export class PcbViewGerberLayerSelection {
    /**
     * Resolves the Gerber renderer options for the active layer state.
     * @param {object} documentModel Document model.
     * @param {{ gerberRenderMode?: string, gerberLayerId?: string, gerberLayerIds?: string[] }} viewerOptions View options.
     * @param {string[]} [hiddenLayers] Hidden layer keys.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[], side: string }}
     */
    static resolve(documentModel, viewerOptions = {}, hiddenLayers = []) {
        if (!PcbViewGerberLayerSelection.#isGerberDocument(documentModel)) {
            return { renderMode: '', layerId: '', layerIds: [], side: '' }
        }

        const layers = PcbViewGerberLayerSelection.#gerberLayers(documentModel)
        const requestedLayerIds =
            PcbViewGerberLayerSelection.#requestedLayerIds(viewerOptions)
        const validLayerIds =
            PcbViewGerberLayerSelection.#validLayerIds(layers, requestedLayerIds)

        if (viewerOptions.gerberRenderMode === 'separated') {
            return PcbViewGerberLayerSelection.#selection(
                validLayerIds.length
                    ? validLayerIds
                    : [String(layers[0]?.id || '')].filter(Boolean),
                'separated',
                layers
            )
        }

        const visibleLayerIds =
            PcbViewGerberLayerSelection.#visibleLayerIds(layers, hiddenLayers)
        if (visibleLayerIds?.length && visibleLayerIds.length < layers.length) {
            return PcbViewGerberLayerSelection.#selection(
                visibleLayerIds,
                'separated',
                layers
            )
        }

        return PcbViewGerberLayerSelection.#selection(
            validLayerIds.length
                ? validLayerIds
                : [String(layers[0]?.id || '')].filter(Boolean),
            'composite',
            layers
        )
    }

    /**
     * Returns selected source-layer ids from viewer options.
     * @param {{ gerberLayerId?: string, gerberLayerIds?: string[] }} viewerOptions View options.
     * @returns {string[]}
     */
    static #requestedLayerIds(viewerOptions) {
        const requested = Array.isArray(viewerOptions.gerberLayerIds)
            ? viewerOptions.gerberLayerIds.map(String).filter(Boolean)
            : []
        const requestedLayerId = String(viewerOptions.gerberLayerId || '')
        if (!requested.length && requestedLayerId) {
            requested.push(requestedLayerId)
        }
        return requested
    }

    /**
     * Returns requested ids that exist in the Gerber source layer list.
     * @param {object[]} layers Gerber source layers.
     * @param {string[]} requestedLayerIds Requested ids.
     * @returns {string[]}
     */
    static #validLayerIds(layers, requestedLayerIds) {
        const availableIds = new Set(
            layers.map((layer) => String(layer?.id || '')).filter(Boolean)
        )
        return requestedLayerIds.filter((layerId) =>
            availableIds.has(layerId)
        )
    }

    /**
     * Resolves source-layer ids left visible by generic layer visibility state.
     * @param {object[]} layers Gerber source layers.
     * @param {string[]} hiddenLayers Hidden layer keys.
     * @returns {string[] | null}
     */
    static #visibleLayerIds(layers, hiddenLayers) {
        if (!Array.isArray(hiddenLayers) || !hiddenLayers.length) return null

        const hidden = new Set(hiddenLayers.map(String))
        let matchedHiddenLayer = false
        const visible = layers.filter((layer) => {
            const hiddenLayer = PcbViewGerberLayerSelection.#layerAliases(
                layer
            ).some((alias) => hidden.has(alias))
            if (hiddenLayer) matchedHiddenLayer = true
            return !hiddenLayer
        })

        if (!matchedHiddenLayer) return null
        return visible.map((layer) => String(layer?.id || '')).filter(Boolean)
    }

    /**
     * Builds stable aliases for one Gerber source layer.
     * @param {object} layer Source layer.
     * @returns {string[]}
     */
    static #layerAliases(layer) {
        const values = [
            layer?.key,
            layer?.id,
            layer?.name,
            layer?.fileName,
            layer?.role
        ].filter((value) => value !== undefined && value !== null)
        return [
            ...new Set(
                values
                    .flatMap((value) => [
                        String(value),
                        PcbViewGerberLayerSelection.#baseName(value)
                    ])
                    .filter(Boolean)
            )
        ]
    }

    /**
     * Creates a renderer selection object from ordered layer ids.
     * @param {string[]} layerIds Ordered source-layer ids.
     * @param {'composite' | 'separated'} requestedMode Requested render mode.
     * @param {object[]} layers Available Gerber source layers.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[], side: string }}
     */
    static #selection(layerIds, requestedMode, layers) {
        const ids = layerIds.map(String).filter(Boolean)
        const renderMode =
            requestedMode === 'separated' && ids.length
                ? 'separated'
                : 'composite'
        return {
            renderMode,
            layerId: ids[0] || '',
            layerIds: ids,
            side: PcbViewGerberLayerSelection.#selectedSide(
                ids,
                layers,
                renderMode
            )
        }
    }

    /**
     * Resolves a side when separated source layers all point to one board face.
     * @param {string[]} layerIds Selected layer ids.
     * @param {object[]} layers Available Gerber source layers.
     * @param {string} renderMode Active render mode.
     * @returns {'top' | 'bottom' | ''}
     */
    static #selectedSide(layerIds, layers, renderMode) {
        if (renderMode !== 'separated' || !layerIds.length) return ''

        const layersById = new Map(
            layers.map((layer) => [String(layer?.id || ''), layer])
        )
        const sides = new Set(
            layerIds
                .map((layerId) =>
                    PcbViewGerberLayerSelection.#layerSide(
                        layersById.get(layerId)
                    )
                )
                .filter((side) => side === 'top' || side === 'bottom')
        )

        return sides.size === 1 ? [...sides][0] : ''
    }

    /**
     * Resolves one Gerber source layer side from normalized metadata.
     * @param {object | undefined} layer Source layer.
     * @returns {'top' | 'bottom' | ''}
     */
    static #layerSide(layer) {
        const side = String(layer?.side || '').toLowerCase()
        if (side === 'top' || side === 'bottom') return side

        const role = String(layer?.role || '').toLowerCase()
        if (role.includes('bottom') || role.startsWith('bot')) return 'bottom'
        if (role.includes('top')) return 'top'

        return ''
    }

    /**
     * Resolves Gerber source layers.
     * @param {object} documentModel Document model.
     * @returns {object[]}
     */
    static #gerberLayers(documentModel) {
        return Array.isArray(documentModel?.pcb?.fabrication?.layers)
            ? documentModel.pcb.fabrication.layers
            : []
    }

    /**
     * Returns true when a document is a Gerber fabrication document.
     * @param {object} documentModel Document model.
     * @returns {boolean}
     */
    static #isGerberDocument(documentModel) {
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ===
            'gerber'
        )
    }

    /**
     * Resolves a basename alias from a path-like layer identifier.
     * @param {unknown} value Path-like value.
     * @returns {string}
     */
    static #baseName(value) {
        const text = String(value || '').replace(/\\+/gu, '/')
        return text.split('/').filter(Boolean).pop() || text
    }
}
