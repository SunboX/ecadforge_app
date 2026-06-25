const PCB_OBJECT_KEYS = new Set([
    'components-top',
    'components-bottom',
    'tracks',
    'vias',
    'pads',
    'holes',
    'zones',
    'footprint-text',
    'rats-nest',
    'solder-mask',
    'solder-paste',
    'silkscreen',
    'fabrication',
    'courtyards',
    'groups',
    'anchor-offsets',
    'grid',
    'page'
])

/**
 * Resolves PCB object visibility state shared by sidebar and rendering.
 */
export class PcbObjectVisibilityModel {
    /**
     * Returns the supported object categories in display order.
     * @returns {{ key: string, labelKey: string }[]}
     */
    static resolveObjectCategories() {
        return [
            {
                key: 'components-top',
                labelKey: 'sidebar.objectTopComponents'
            },
            {
                key: 'components-bottom',
                labelKey: 'sidebar.objectBottomComponents'
            },
            { key: 'tracks', labelKey: 'sidebar.objectTracks' },
            { key: 'vias', labelKey: 'sidebar.objectVias' },
            { key: 'pads', labelKey: 'sidebar.objectPads' },
            { key: 'holes', labelKey: 'sidebar.objectThroughHoles' },
            { key: 'zones', labelKey: 'sidebar.objectZones' },
            {
                key: 'footprint-text',
                labelKey: 'sidebar.objectFootprintText'
            },
            { key: 'rats-nest', labelKey: 'sidebar.objectRatsNest' },
            { key: 'solder-mask', labelKey: 'sidebar.objectSolderMask' },
            { key: 'solder-paste', labelKey: 'sidebar.objectSolderPaste' },
            { key: 'silkscreen', labelKey: 'sidebar.objectSilkscreen' },
            { key: 'fabrication', labelKey: 'sidebar.objectFabrication' },
            { key: 'courtyards', labelKey: 'sidebar.objectCourtyards' },
            { key: 'groups', labelKey: 'sidebar.objectGroups' },
            {
                key: 'anchor-offsets',
                labelKey: 'sidebar.objectAnchorOffsets'
            },
            { key: 'grid', labelKey: 'sidebar.objectGrid' },
            { key: 'page', labelKey: 'sidebar.objectPage' }
        ]
    }

    /**
     * Returns true when the given object category is hidden.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Hidden object map.
     * @param {string} documentId Active document id.
     * @param {string} objectKey Object category key.
     * @returns {boolean}
     */
    static isObjectHidden(hiddenPcbObjects, documentId, objectKey) {
        return PcbObjectVisibilityModel.resolveHiddenKeys(
            hiddenPcbObjects,
            documentId
        ).has(String(objectKey || ''))
    }

    /**
     * Resolves the opacity percentage for one object category.
     * @param {{ [documentId: string]: { [objectKey: string]: number } }} pcbObjectOpacities Opacity map.
     * @param {string} documentId Active document id.
     * @param {string} objectKey Object category key.
     * @returns {number}
     */
    static resolveObjectOpacity(pcbObjectOpacities, documentId, objectKey) {
        return PcbObjectVisibilityModel.normalizeOpacityPercent(
            pcbObjectOpacities?.[documentId]?.[objectKey],
            100
        )
    }

    /**
     * Resolves hidden object keys for one document.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Hidden object map.
     * @param {string} documentId Active document id.
     * @returns {Set<string>}
     */
    static resolveHiddenKeys(hiddenPcbObjects, documentId) {
        const values = hiddenPcbObjects?.[documentId]
        return new Set(Array.isArray(values) ? values.map(String) : [])
    }

    /**
     * Applies one object visibility change to a hidden-object map.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Current map.
     * @param {string} documentId Target document id.
     * @param {string} objectKey Target object key.
     * @param {boolean} visible Whether the object category should be visible.
     * @returns {{ [documentId: string]: string[] }}
     */
    static withObjectVisibility(
        hiddenPcbObjects,
        documentId,
        objectKey,
        visible
    ) {
        const normalizedDocumentId = String(documentId || '')
        const normalizedObjectKey = String(objectKey || '')
        const next = PcbObjectVisibilityModel.#cloneMap(hiddenPcbObjects)
        if (
            !normalizedDocumentId ||
            !PCB_OBJECT_KEYS.has(normalizedObjectKey)
        ) {
            return next
        }

        const hidden = PcbObjectVisibilityModel.resolveHiddenKeys(
            next,
            normalizedDocumentId
        )
        if (visible) {
            hidden.delete(normalizedObjectKey)
        } else {
            hidden.add(normalizedObjectKey)
        }
        PcbObjectVisibilityModel.#writeHiddenKeys(
            next,
            normalizedDocumentId,
            hidden
        )

        return next
    }

    /**
     * Applies one object opacity change to an opacity map.
     * @param {{ [documentId: string]: { [objectKey: string]: number } }} pcbObjectOpacities Current map.
     * @param {string} documentId Target document id.
     * @param {string} objectKey Target object key.
     * @param {number} opacity Opacity percentage from 0 to 100.
     * @returns {{ [documentId: string]: { [objectKey: string]: number } }}
     */
    static withObjectOpacity(
        pcbObjectOpacities,
        documentId,
        objectKey,
        opacity
    ) {
        const normalizedDocumentId = String(documentId || '')
        const normalizedObjectKey = String(objectKey || '')
        const next = PcbObjectVisibilityModel.cloneOpacityMap(
            pcbObjectOpacities
        )
        if (
            !normalizedDocumentId ||
            !PCB_OBJECT_KEYS.has(normalizedObjectKey)
        ) {
            return next
        }

        next[normalizedDocumentId] = {
            ...(next[normalizedDocumentId] || {}),
            [normalizedObjectKey]:
                PcbObjectVisibilityModel.normalizeOpacityPercent(opacity, 100)
        }

        return next
    }

    /**
     * Returns only supported hidden object keys.
     * @param {string[]} hiddenObjectKeys Raw hidden object keys.
     * @returns {string[]}
     */
    static filterSupportedKeys(hiddenObjectKeys) {
        return [...new Set((hiddenObjectKeys || []).map(String))].filter(
            (key) => PCB_OBJECT_KEYS.has(key)
        )
    }

    /**
     * Resolves non-default opacity rules from legacy hidden keys and opacity map.
     * @param {string[]} hiddenObjectKeys Legacy hidden object keys.
     * @param {{ [objectKey: string]: number }} objectOpacities Active document opacity map.
     * @returns {{ key: string, opacity: number }[]}
     */
    static resolveOpacityEntries(hiddenObjectKeys, objectOpacities) {
        const values = new Map(
            PcbObjectVisibilityModel.filterSupportedKeys(hiddenObjectKeys).map(
                (key) => [key, 0]
            )
        )
        Object.entries(objectOpacities || {}).forEach(([key, value]) => {
            if (!PCB_OBJECT_KEYS.has(String(key))) return
            values.set(
                String(key),
                PcbObjectVisibilityModel.normalizeOpacityPercent(value, 100)
            )
        })

        return [...values.entries()]
            .filter((entry) => entry[1] < 100)
            .map(([key, percent]) => ({
                key,
                opacity: Number((percent / 100).toFixed(2))
            }))
    }

    /**
     * Normalizes raw opacity input to an integer percentage.
     * @param {unknown} value Raw value.
     * @param {number} fallback Fallback percentage.
     * @returns {number}
     */
    static normalizeOpacityPercent(value, fallback = 100) {
        const numeric = Number(value)
        const fallbackValue = Number.isFinite(Number(fallback))
            ? Number(fallback)
            : 100
        if (!Number.isFinite(numeric)) {
            return Math.round(Math.min(100, Math.max(0, fallbackValue)))
        }
        return Math.round(Math.min(100, Math.max(0, numeric)))
    }

    /**
     * Clones an opacity map.
     * @param {{ [documentId: string]: { [objectKey: string]: number } }} pcbObjectOpacities Current map.
     * @returns {{ [documentId: string]: { [objectKey: string]: number } }}
     */
    static cloneOpacityMap(pcbObjectOpacities) {
        return Object.fromEntries(
            Object.entries(pcbObjectOpacities || {}).map(
                ([documentId, values]) => [
                    documentId,
                    values && typeof values === 'object' && !Array.isArray(values)
                        ? { ...values }
                        : {}
                ]
            )
        )
    }

    /**
     * Clones a hidden-object map.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Current map.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #cloneMap(hiddenPcbObjects) {
        return Object.fromEntries(
            Object.entries(hiddenPcbObjects || {}).map(([documentId, keys]) => [
                documentId,
                Array.isArray(keys) ? [...keys.map(String)] : []
            ])
        )
    }

    /**
     * Writes one normalized hidden-key set into a cloned map.
     * @param {{ [documentId: string]: string[] }} map Hidden-object map.
     * @param {string} documentId Target document id.
     * @param {Set<string>} hidden Hidden object keys.
     * @returns {void}
     */
    static #writeHiddenKeys(map, documentId, hidden) {
        const values = PcbObjectVisibilityModel.filterSupportedKeys([...hidden])
        if (values.length) {
            map[documentId] = values
            return
        }
        delete map[documentId]
    }
}
