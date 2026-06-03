import { EcadRendererService } from './ecad/EcadRendererService.mjs'

/**
 * Resolves PCB layer visibility metadata shared by sidebar and PCB rendering.
 */
export class PcbLayerVisibilityModel {
    /**
     * Resolves layer records from supported PCB model shapes.
     * @param {any} documentModel Active document model.
     * @returns {any[]}
     */
    static resolveLayers(documentModel) {
        return PcbLayerVisibilityModel.resolveLayerGroups(documentModel)
            .physicalLayers
    }

    /**
     * Resolves physical board layers and virtual render-control layers.
     * @param {any} documentModel Active document model.
     * @returns {{ physicalLayers: any[], virtualLayers: any[] }}
     */
    static resolveLayerGroups(documentModel) {
        if (documentModel?.pcb) {
            const interactionGroups =
                PcbLayerVisibilityModel.#resolveInteractionLayerGroups(
                    documentModel
                )
            if (
                interactionGroups.physicalLayers.length ||
                interactionGroups.virtualLayers.length
            ) {
                return interactionGroups
            }
        }

        return {
            physicalLayers:
                PcbLayerVisibilityModel.#resolveLegacyPhysicalLayers(
                    documentModel
                ),
            virtualLayers: []
        }
    }

    /**
     * Resolves toolkit-provided interaction layer groups.
     * @param {any} documentModel Active document model.
     * @returns {{ physicalLayers: any[], virtualLayers: any[] }}
     */
    static #resolveInteractionLayerGroups(documentModel) {
        try {
            const groups =
                EcadRendererService.resolvePcbInteractionLayers(documentModel)
            return {
                physicalLayers: Array.isArray(groups?.physicalLayers)
                    ? groups.physicalLayers
                    : [],
                virtualLayers: Array.isArray(groups?.virtualLayers)
                    ? groups.virtualLayers
                    : []
            }
        } catch (_error) {
            return {
                physicalLayers: [],
                virtualLayers: []
            }
        }
    }

    /**
     * Resolves legacy physical layer rows directly from the document model.
     * @param {any} documentModel Active document model.
     * @returns {any[]}
     */
    static #resolveLegacyPhysicalLayers(documentModel) {
        if (
            Array.isArray(documentModel?.pcb?.layers) &&
            documentModel.pcb.layers.length
        ) {
            return documentModel.pcb.layers
        }

        if (
            Array.isArray(documentModel?.pcb?.primitiveLayers) &&
            documentModel.pcb.primitiveLayers.length
        ) {
            return documentModel.pcb.primitiveLayers
        }

        return []
    }

    /**
     * Returns a stable layer key for state and DOM events.
     * @param {any} layer Layer metadata.
     * @param {number} index Layer index.
     * @returns {string}
     */
    static resolveLayerKey(layer, index) {
        return String(
            layer?.key ??
                layer?.name ??
                layer?.label ??
                layer?.layer ??
                layer?.id ??
                layer?.layerId ??
                layer?.number ??
                'Layer ' + (index + 1)
        )
    }

    /**
     * Returns true when the given layer key is currently hidden.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @param {string} documentId Active document id.
     * @param {string} layerKey Layer key.
     * @returns {boolean}
     */
    static isLayerHidden(hiddenPcbLayers, documentId, layerKey) {
        const hidden = PcbLayerVisibilityModel.resolveHiddenKeys(
            hiddenPcbLayers,
            documentId
        )
        return hidden.has(String(layerKey || ''))
    }

    /**
     * Resolves hidden layer keys for one document.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @param {string} documentId Active document id.
     * @returns {Set<string>}
     */
    static resolveHiddenKeys(hiddenPcbLayers, documentId) {
        const values = hiddenPcbLayers?.[documentId]
        return new Set(Array.isArray(values) ? values.map(String) : [])
    }

    /**
     * Applies one layer visibility change to a hidden-layer map.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Current map.
     * @param {string} documentId Target document id.
     * @param {string} layerKey Target layer key.
     * @param {boolean} visible Whether the layer should be visible.
     * @returns {{ [documentId: string]: string[] }}
     */
    static withLayerVisibility(hiddenPcbLayers, documentId, layerKey, visible) {
        const normalizedDocumentId = String(documentId || '')
        const normalizedLayerKey = String(layerKey || '')
        if (!normalizedDocumentId || !normalizedLayerKey) {
            return PcbLayerVisibilityModel.#cloneMap(hiddenPcbLayers)
        }

        const next = PcbLayerVisibilityModel.#cloneMap(hiddenPcbLayers)
        const hidden = PcbLayerVisibilityModel.resolveHiddenKeys(
            next,
            normalizedDocumentId
        )
        if (visible) {
            hidden.delete(normalizedLayerKey)
        } else {
            hidden.add(normalizedLayerKey)
        }
        PcbLayerVisibilityModel.#writeHiddenKeys(
            next,
            normalizedDocumentId,
            hidden
        )

        return next
    }

    /**
     * Applies one visibility preset to a hidden-layer map.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Current map.
     * @param {string} documentId Target document id.
     * @param {any} documentModel Active document model.
     * @param {string} preset Preset id.
     * @returns {{ [documentId: string]: string[] }}
     */
    static withPreset(hiddenPcbLayers, documentId, documentModel, preset) {
        const next = PcbLayerVisibilityModel.#cloneMap(hiddenPcbLayers)
        const normalizedDocumentId = String(documentId || '')
        if (!normalizedDocumentId) {
            return next
        }

        const hidden = PcbLayerVisibilityModel.#hiddenKeysForPreset(
            documentModel,
            preset
        )
        PcbLayerVisibilityModel.#writeHiddenKeys(
            next,
            normalizedDocumentId,
            hidden
        )

        return next
    }

    /**
     * Resolves layer aliases that may appear in renderer-owned data-layer attrs.
     * @param {any} documentModel Active document model.
     * @param {string[]} hiddenLayerKeys Hidden state keys.
     * @returns {string[]}
     */
    static resolveHiddenLayerAliases(documentModel, hiddenLayerKeys) {
        const hidden = new Set((hiddenLayerKeys || []).map(String))
        const aliases = new Set(hidden)
        PcbLayerVisibilityModel.resolveLayers(documentModel).forEach(
            (layer, index) => {
                const key = PcbLayerVisibilityModel.resolveLayerKey(layer, index)
                if (!hidden.has(key)) {
                    return
                }
                PcbLayerVisibilityModel.#layerAliases(layer, key).forEach(
                    (alias) => aliases.add(alias)
                )
            }
        )

        return [...aliases].filter(Boolean)
    }

    /**
     * Returns true when a layer belongs to the named visibility preset.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Resolved layer key.
     * @param {string} preset Preset id.
     * @returns {boolean}
     */
    static matchesPreset(layer, layerKey, preset) {
        const text = PcbLayerVisibilityModel.#layerSearchText(layer, layerKey)
        if (preset === 'front') {
            return !PcbLayerVisibilityModel.#isBackLayer(text)
        }
        if (preset === 'back') {
            return !PcbLayerVisibilityModel.#isFrontLayer(text)
        }
        if (preset === 'copper') {
            return PcbLayerVisibilityModel.#isCopperLayer(text)
        }
        if (preset === 'drawings') {
            return !PcbLayerVisibilityModel.#isCopperLayer(text)
        }
        return true
    }

    /**
     * Clones a hidden-layer map.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Current map.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #cloneMap(hiddenPcbLayers) {
        return Object.fromEntries(
            Object.entries(hiddenPcbLayers || {}).map(([documentId, keys]) => [
                documentId,
                Array.isArray(keys) ? [...keys.map(String)] : []
            ])
        )
    }

    /**
     * Writes one normalized hidden-key set into a cloned map.
     * @param {{ [documentId: string]: string[] }} map Hidden-layer map.
     * @param {string} documentId Target document id.
     * @param {Set<string>} hidden Hidden layer keys.
     * @returns {void}
     */
    static #writeHiddenKeys(map, documentId, hidden) {
        const values = [...hidden].filter(Boolean)
        if (values.length) {
            map[documentId] = values
            return
        }
        delete map[documentId]
    }

    /**
     * Resolves hidden layer keys for one preset.
     * @param {any} documentModel Active document model.
     * @param {string} preset Preset id.
     * @returns {Set<string>}
     */
    static #hiddenKeysForPreset(documentModel, preset) {
        const normalizedPreset = String(preset || 'all')
        return new Set(
            PcbLayerVisibilityModel.resolveLayers(documentModel)
                .map((layer, index) => ({
                    layer,
                    key: PcbLayerVisibilityModel.resolveLayerKey(layer, index)
                }))
                .filter(
                    ({ layer, key }) =>
                        !PcbLayerVisibilityModel.matchesPreset(
                            layer,
                            key,
                            normalizedPreset
                        )
                )
                .map(({ key }) => key)
        )
    }

    /**
     * Returns layer aliases from common model properties.
     * @param {any} layer Layer metadata.
     * @param {string} key Layer key.
     * @returns {string[]}
     */
    static #layerAliases(layer, key) {
        return [
            key,
            layer?.name,
            layer?.layer,
            layer?.id,
            layer?.layerId,
            layer?.number
        ]
            .filter((value) => value !== undefined && value !== null)
            .map(String)
    }

    /**
     * Returns normalized searchable text for layer classification.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Resolved layer key.
     * @returns {string}
     */
    static #layerSearchText(layer, layerKey) {
        return [
            layerKey,
            layer?.name,
            layer?.layer,
            layer?.type,
            layer?.kind,
            layer?.side
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
    }

    /**
     * Returns true for front/top layers.
     * @param {string} text Search text.
     * @returns {boolean}
     */
    static #isFrontLayer(text) {
        return /\b(front|top)\b|\bf[._-]/.test(text)
    }

    /**
     * Returns true for back/bottom layers.
     * @param {string} text Search text.
     * @returns {boolean}
     */
    static #isBackLayer(text) {
        return /\b(back|bottom)\b|\bb[._-]/.test(text)
    }

    /**
     * Returns true for copper/routing layers.
     * @param {string} text Search text.
     * @returns {boolean}
     */
    static #isCopperLayer(text) {
        return (
            /\b(cu|copper)\b/.test(text) ||
            /\b(top|bottom)\s+layer\b/.test(text) ||
            /\bmid[-\s]?layer\b/.test(text) ||
            /\binternal\s+plane\b/.test(text)
        )
    }
}
