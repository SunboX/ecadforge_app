import { EcadRendererService } from './ecad/EcadRendererService.mjs'
import { EcadDocumentType } from './ecad/EcadDocumentType.mjs'
import { PcbTechnicalDrawingContent } from './PcbTechnicalDrawingContent.mjs'

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
        if (EcadDocumentType.isPcb(documentModel)) {
            const interactionGroups =
                PcbLayerVisibilityModel.#resolveInteractionLayerGroups(
                    documentModel
                )
            if (
                interactionGroups.physicalLayers.length ||
                interactionGroups.virtualLayers.length
            ) {
                return PcbLayerVisibilityModel.#filterLayerGroups(
                    interactionGroups
                )
            }
        }

        return PcbLayerVisibilityModel.#filterLayerGroups({
            physicalLayers:
                PcbLayerVisibilityModel.#resolveLegacyPhysicalLayers(
                    documentModel
                ),
            virtualLayers: []
        })
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
     * Filters physical rows to layers that can be meaningfully toggled.
     * @param {{ physicalLayers: any[], virtualLayers: any[] }} groups Raw layer groups.
     * @returns {{ physicalLayers: any[], virtualLayers: any[] }}
     */
    static #filterLayerGroups(groups) {
        const physicalLayers = Array.isArray(groups?.physicalLayers)
            ? groups.physicalLayers
            : []
        const virtualLayers = Array.isArray(groups?.virtualLayers)
            ? groups.virtualLayers
            : []
        const referencedKeys =
            PcbLayerVisibilityModel.#referencedPhysicalLayerKeys(virtualLayers)
        const hasStackLayers = physicalLayers.some((layer, index) =>
            PcbLayerVisibilityModel.#isStackLayer(
                layer,
                PcbLayerVisibilityModel.resolveLayerKey(layer, index)
            )
        )

        return {
            physicalLayers: physicalLayers.filter((layer, index) =>
                PcbLayerVisibilityModel.#isToggleableLayer(
                    layer,
                    PcbLayerVisibilityModel.resolveLayerKey(layer, index),
                    referencedKeys,
                    hasStackLayers
                )
            ),
            virtualLayers
        }
    }

    /**
     * Collects physical layer keys referenced by virtual object controls.
     * @param {any[]} virtualLayers Virtual layer metadata rows.
     * @returns {Set<string>}
     */
    static #referencedPhysicalLayerKeys(virtualLayers) {
        const keys = new Set()
        for (const layer of virtualLayers) {
            for (const key of layer?.physicalLayerKeys || []) {
                keys.add(String(key))
            }
        }
        return keys
    }

    /**
     * Returns true when a physical layer should be shown as a visibility row.
     * @param {any} layer Physical layer metadata.
     * @param {string} layerKey Stable layer key.
     * @param {Set<string>} referencedKeys Physical layer keys with objects.
     * @param {boolean} hasStackLayers Whether explicit stack rows exist.
     * @returns {boolean}
     */
    static #isToggleableLayer(layer, layerKey, referencedKeys, hasStackLayers) {
        if (PcbLayerVisibilityModel.#isNonRenderedLayer(layer, layerKey)) {
            return false
        }
        if (
            PcbLayerVisibilityModel.#isUnusedGeneratedMechanicalLayer(
                layer,
                layerKey,
                referencedKeys,
                hasStackLayers
            )
        ) {
            return false
        }
        return !PcbLayerVisibilityModel.#isUnusedGeneratedInternalLayer(
            layer,
            layerKey,
            referencedKeys,
            hasStackLayers
        )
    }

    /**
     * Returns true for stack materials and editor-only utility rows.
     * @param {any} layer Physical layer metadata.
     * @param {string} layerKey Stable layer key.
     * @returns {boolean}
     */
    static #isNonRenderedLayer(layer, layerKey) {
        const text = PcbLayerVisibilityModel.#layerSearchText(layer, layerKey)
        const label = String(layerKey || '')
            .trim()
            .toLowerCase()

        return (
            /\b(dielectric|substrate|prepreg|core)\b/.test(text) ||
            /^(connections|background|drc error markers|selections|visible grid \d+|pad holes|via holes)$/.test(
                label
            )
        )
    }

    /**
     * Returns true for unused default internal rows superseded by stack rows.
     * @param {any} layer Physical layer metadata.
     * @param {string} layerKey Stable layer key.
     * @param {Set<string>} referencedKeys Physical layer keys with objects.
     * @param {boolean} hasStackLayers Whether explicit stack rows exist.
     * @returns {boolean}
     */
    static #isUnusedGeneratedInternalLayer(
        layer,
        layerKey,
        referencedKeys,
        hasStackLayers
    ) {
        if (!hasStackLayers || referencedKeys.has(String(layerKey))) {
            return false
        }
        if (PcbLayerVisibilityModel.#isStackLayer(layer, layerKey)) {
            return false
        }

        const text = PcbLayerVisibilityModel.#layerSearchText(layer, layerKey)
        return /\bmid[-\s]?layer\s+\d+\b|\binternal\s+plane\s+\d+\b/.test(text)
    }

    /**
     * Returns true for empty numbered mechanical slots from generated defaults.
     * @param {any} layer Physical layer metadata.
     * @param {string} layerKey Stable layer key.
     * @param {Set<string>} referencedKeys Physical layer keys with objects.
     * @param {boolean} hasStackLayers Whether explicit stack rows exist.
     * @returns {boolean}
     */
    static #isUnusedGeneratedMechanicalLayer(
        layer,
        layerKey,
        referencedKeys,
        hasStackLayers
    ) {
        if (!hasStackLayers || referencedKeys.has(String(layerKey))) {
            return false
        }
        if (PcbLayerVisibilityModel.#isStackLayer(layer, layerKey)) {
            return false
        }

        const text = PcbLayerVisibilityModel.#layerSearchText(layer, layerKey)
        const match = text.match(/\bmechanical\s+(\d+)\b/)
        if (!match) return false

        const number = Number(match[1])
        return Number.isFinite(number) && number > 1
    }

    /**
     * Returns true for explicit Altium layer-stack rows.
     * @param {any} layer Physical layer metadata.
     * @param {string} _layerKey Stable layer key.
     * @returns {boolean}
     */
    static #isStackLayer(layer, _layerKey) {
        const layerId = Number(layer?.layerId ?? layer?.id ?? layer?.number)
        return Number.isFinite(layerId) && layerId >= 0x01000000
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
     * Applies one visibility change to several layer keys.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Current map.
     * @param {string} documentId Target document id.
     * @param {string[]} layerKeys Target layer keys.
     * @param {boolean} visible Whether the layers should be visible.
     * @returns {{ [documentId: string]: string[] }}
     */
    static withLayerKeysVisibility(
        hiddenPcbLayers,
        documentId,
        layerKeys,
        visible
    ) {
        const next = PcbLayerVisibilityModel.#cloneMap(hiddenPcbLayers)
        const normalizedDocumentId = String(documentId || '')
        const normalizedLayerKeys =
            PcbLayerVisibilityModel.#normalizeLayerKeys(layerKeys)
        if (!normalizedDocumentId || !normalizedLayerKeys.length) {
            return next
        }

        const hidden = PcbLayerVisibilityModel.resolveHiddenKeys(
            next,
            normalizedDocumentId
        )
        normalizedLayerKeys.forEach((layerKey) => {
            if (visible) {
                hidden.delete(layerKey)
                return
            }
            hidden.add(layerKey)
        })
        PcbLayerVisibilityModel.#writeHiddenKeys(
            next,
            normalizedDocumentId,
            hidden
        )

        return next
    }

    /**
     * Hides all physical PCB layers except the requested visible layer keys.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Current map.
     * @param {string} documentId Target document id.
     * @param {any} documentModel Active document model.
     * @param {string[]} layerKeys Layer keys that should remain visible.
     * @returns {{ [documentId: string]: string[] }}
     */
    static withOnlyLayers(
        hiddenPcbLayers,
        documentId,
        documentModel,
        layerKeys
    ) {
        const next = PcbLayerVisibilityModel.#cloneMap(hiddenPcbLayers)
        const normalizedDocumentId = String(documentId || '')
        const visible = new Set(
            PcbLayerVisibilityModel.#normalizeLayerKeys(layerKeys)
        )
        if (!normalizedDocumentId || !visible.size) {
            return next
        }

        const layers = PcbLayerVisibilityModel.resolveLayers(documentModel).map(
            (layer, index) => ({
                layer,
                key: PcbLayerVisibilityModel.resolveLayerKey(layer, index)
            })
        )
        const hidden = new Set(
            layers
                .filter(
                    ({ layer, key }) =>
                        !PcbLayerVisibilityModel.#matchesVisibleLayerKey(
                            layer,
                            key,
                            visible
                        )
                )
                .map(({ key }) => key)
        )
        const currentHidden = PcbLayerVisibilityModel.resolveHiddenKeys(
            next,
            normalizedDocumentId
        )
        if (PcbLayerVisibilityModel.#setEquals(currentHidden, hidden)) {
            PcbLayerVisibilityModel.#writeHiddenKeys(
                next,
                normalizedDocumentId,
                new Set()
            )
            return next
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
                const key = PcbLayerVisibilityModel.resolveLayerKey(
                    layer,
                    index
                )
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
     * Resolves the physical layer keys represented by the mechanical-drawings
     * aggregate control.
     * @param {any} documentModel Active document model.
     * @returns {string[]}
     */
    static resolveMechanicalDrawingLayerKeys(documentModel) {
        return PcbLayerVisibilityModel.resolveLayers(documentModel)
            .map((layer, index) => ({
                layer,
                key: PcbLayerVisibilityModel.resolveLayerKey(layer, index)
            }))
            .filter(({ layer, key }) =>
                PcbLayerVisibilityModel.isMechanicalDrawingLayer(layer, key)
            )
            .map(({ key }) => key)
    }

    /**
     * Resolves drawing-layer keys only when their populated artwork materially
     * expands beyond the physical PCB envelope as a separate technical sheet.
     * @param {any} documentModel Active document model.
     * @returns {string[]}
     */
    static resolveTechnicalDrawingLayerKeys(documentModel) {
        const drawingLayers = PcbLayerVisibilityModel.resolveLayers(
            documentModel
        )
            .map((layer, index) => ({
                layer,
                key: PcbLayerVisibilityModel.resolveLayerKey(layer, index)
            }))
            .filter(({ layer, key }) =>
                PcbLayerVisibilityModel.isMechanicalDrawingLayer(layer, key)
            )
            .map(({ layer, key }) => ({
                layer,
                key,
                aliases: PcbLayerVisibilityModel.#layerAliases(layer, key)
            }))

        return PcbTechnicalDrawingContent.resolveLayerKeys(
            documentModel,
            drawingLayers
        )
    }

    /**
     * Returns true when one physical layer belongs to mechanical drawings.
     * @param {any} layer Layer metadata.
     * @param {string} layerKey Resolved layer key.
     * @returns {boolean}
     */
    static isMechanicalDrawingLayer(layer, layerKey) {
        return PcbLayerVisibilityModel.#isMechanicalDrawingLayer(
            PcbLayerVisibilityModel.#layerSearchText(layer, layerKey)
        )
    }

    /**
     * Initializes newly added PCB documents with mechanical drawings hidden.
     * Existing document state is never overwritten.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Current map.
     * @param {{ id?: string, documentModel?: any }[]} documents New documents.
     * @returns {{ [documentId: string]: string[] }}
     */
    static withMechanicalDrawingsHiddenByDefault(hiddenPcbLayers, documents) {
        const next = PcbLayerVisibilityModel.#cloneMap(hiddenPcbLayers)
        for (const entry of documents || []) {
            const documentId = String(entry?.id || '')
            if (!documentId || Object.hasOwn(next, documentId)) continue
            const layerKeys =
                PcbLayerVisibilityModel.resolveTechnicalDrawingLayerKeys(
                    entry?.documentModel
                )
            if (layerKeys.length) next[documentId] = layerKeys
        }
        return next
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
            return PcbLayerVisibilityModel.#isDrawingLayer(text)
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
     * Returns true when a layer matches one of the requested visible keys.
     * @param {any} layer Layer metadata.
     * @param {string} key Resolved layer key.
     * @param {Set<string>} visible Requested visible keys.
     * @returns {boolean}
     */
    static #matchesVisibleLayerKey(layer, key, visible) {
        return PcbLayerVisibilityModel.#layerAliases(layer, key).some((alias) =>
            visible.has(alias)
        )
    }

    /**
     * Returns true when two sets contain the same string values.
     * @param {Set<string>} left First set.
     * @param {Set<string>} right Second set.
     * @returns {boolean}
     */
    static #setEquals(left, right) {
        if (left.size !== right.size) return false
        for (const value of left) {
            if (!right.has(value)) return false
        }
        return true
    }

    /**
     * Normalizes layer key input into a de-duplicated string list.
     * @param {string[] | string | null | undefined} layerKeys Raw layer keys.
     * @returns {string[]}
     */
    static #normalizeLayerKeys(layerKeys) {
        const values = Array.isArray(layerKeys) ? layerKeys : [layerKeys]
        return [
            ...new Set(
                values
                    .map((layerKey) => String(layerKey || '').trim())
                    .filter(Boolean)
            )
        ]
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
            layer?.legacyLayerId,
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
            layer?.side,
            layer?.role,
            layer?.id,
            layer?.fileName,
            layer?.sourceFormat
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
            /(^|[._\-\s])cu($|[._\-\s])/.test(text) ||
            /\b(top|bottom)\s+layer\b/.test(text) ||
            /\bmid[-\s]?layer\b/.test(text) ||
            /\binternal\s+plane\b/.test(text) ||
            /\binternal[-_\s]*\d+\b/.test(text) ||
            /\binternal[-_\s]+layer\b/.test(text) ||
            /\binner[-_\s]*\d+\b/.test(text)
        )
    }

    /**
     * Returns true for documentation or board drawing layers.
     * @param {string} text Search text.
     * @returns {boolean}
     */
    static #isDrawingLayer(text) {
        if (
            /\b(mask|soldermask|solder\s+mask|paste|adhes|adhesive|drill|drl)\b/.test(
                text
            ) &&
            !/\b(drill|drl)[-_\s]?map\b/.test(text)
        ) {
            return false
        }

        return (
            /\b(silk|silks|silkscreen|overlay|legend)\b/.test(text) ||
            /\b(edge|edge[-_\s]?cuts|outline|profile|dimension)\b/.test(text) ||
            /\b(drawing|drawings|dwg|mechanical|mech)\b/.test(text) ||
            /\b(fab|assembly|courtyard|crtyd)\b/.test(text) ||
            /\b(drill|drl)[-_\s]?map\b/.test(text) ||
            PcbLayerVisibilityModel.#isKicadDocumentationLayer(text)
        )
    }

    /**
     * Returns true for mechanical, assembly, and documentation artwork while
     * excluding electrical overlays and the physical board outline.
     * @param {string} text Search text.
     * @returns {boolean}
     */
    static #isMechanicalDrawingLayer(text) {
        return (
            /mechanical\s*\d*|\bmech\b/.test(text) ||
            /\b(assembly|asm|fabrication|fab|dimension|drawing|drawings|documentation|document|notes?|courtyard|crtyd)\b/.test(
                text
            )
        )
    }

    /**
     * Returns true for standard KiCad board documentation layers.
     * @param {string} text Search text.
     * @returns {boolean}
     */
    static #isKicadDocumentationLayer(text) {
        return (
            /(^|[\s])(?:dwgs|cmts|eco\d+)\.user($|[\s])/.test(text) ||
            /(^|[\s])edge\.cuts($|[\s])/.test(text) ||
            /(^|[\s])margin($|[\s])/.test(text) ||
            /(^|[\s])user\.(?:drawings?|comments?|eco\d+|margin)($|[\s])/.test(
                text
            )
        )
    }
}
