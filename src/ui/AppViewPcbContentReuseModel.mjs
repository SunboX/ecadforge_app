const PCB_CONTENT_SIGNATURE_KEY = '__ecadForgePcbContentSignature'

/**
 * Tracks whether the mounted 2D PCB content can survive an AppView render.
 */
export class AppViewPcbContentReuseModel {
    /**
     * Returns true when the mounted PCB controller already matches a snapshot.
     * @param {HTMLElement | null} contentNode PCB content mount.
     * @param {{ side?: string } | null} controller Active PCB controller.
     * @param {object} snapshot App state snapshot.
     * @returns {boolean}
     */
    static shouldReuse(contentNode, controller, snapshot) {
        if (!contentNode || !controller || snapshot?.activeView !== 'pcb') {
            return false
        }

        const previous = contentNode[PCB_CONTENT_SIGNATURE_KEY]
        if (!previous) return false

        const next = AppViewPcbContentReuseModel.#createSignature(
            snapshot,
            controller.side
        )
        return AppViewPcbContentReuseModel.#matches(previous, next)
    }

    /**
     * Stores the signature for the mounted PCB content.
     * @param {HTMLElement | null} contentNode PCB content mount.
     * @param {{ side?: string } | null} controller Active PCB controller.
     * @param {object} snapshot App state snapshot.
     * @returns {void}
     */
    static remember(contentNode, controller, snapshot) {
        if (!contentNode || !controller || snapshot?.activeView !== 'pcb') {
            return
        }

        contentNode[PCB_CONTENT_SIGNATURE_KEY] =
            AppViewPcbContentReuseModel.#createSignature(
                snapshot,
                controller.side
            )
    }

    /**
     * Clears any remembered PCB content signature.
     * @param {HTMLElement | null} contentNode PCB content mount.
     * @returns {void}
     */
    static clear(contentNode) {
        if (contentNode) delete contentNode[PCB_CONTENT_SIGNATURE_KEY]
    }

    /**
     * Creates a comparable signature for PCB content-affecting state.
     * @param {object} snapshot App state snapshot.
     * @param {string | undefined} side Active board side.
     * @returns {object}
     */
    static #createSignature(snapshot, side) {
        const documentId = String(snapshot?.activeDocumentId || '')
        return {
            activeDocumentId: documentId,
            activeView: String(snapshot?.activeView || ''),
            documentModel: snapshot?.documentModel || null,
            hiddenLayerKey: AppViewPcbContentReuseModel.#stringListKey(
                snapshot?.hiddenPcbLayers?.[documentId]
            ),
            hiddenObjectKey: AppViewPcbContentReuseModel.#stringListKey(
                snapshot?.hiddenPcbObjects?.[documentId]
            ),
            locale: String(snapshot?.locale || ''),
            objectOpacityKey: AppViewPcbContentReuseModel.#objectKey(
                snapshot?.pcbObjectOpacities?.[documentId]
            ),
            parseStatus: String(snapshot?.parseStatus || ''),
            selectedComponentKey: String(
                snapshot?.selectedPcbComponents?.[documentId] || ''
            ),
            selectedNetName: String(snapshot?.selectedNets?.[documentId] || ''),
            side: side === 'bottom' ? 'bottom' : 'top'
        }
    }

    /**
     * Returns true when two signatures describe the same mounted content.
     * @param {any} previous Previous signature.
     * @param {any} next Next signature.
     * @returns {boolean}
     */
    static #matches(previous, next) {
        return (
            previous?.activeDocumentId === next.activeDocumentId &&
            previous?.activeView === next.activeView &&
            previous?.documentModel === next.documentModel &&
            previous?.hiddenLayerKey === next.hiddenLayerKey &&
            previous?.hiddenObjectKey === next.hiddenObjectKey &&
            previous?.locale === next.locale &&
            previous?.objectOpacityKey === next.objectOpacityKey &&
            previous?.parseStatus === next.parseStatus &&
            previous?.selectedComponentKey === next.selectedComponentKey &&
            previous?.selectedNetName === next.selectedNetName &&
            previous?.side === next.side
        )
    }

    /**
     * Serializes a string list without preserving caller array identity.
     * @param {unknown} values Raw list.
     * @returns {string}
     */
    static #stringListKey(values) {
        return JSON.stringify(Array.isArray(values) ? values.map(String) : [])
    }

    /**
     * Serializes an object map in stable key order.
     * @param {unknown} value Raw object map.
     * @returns {string}
     */
    static #objectKey(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return '[]'
        }

        return JSON.stringify(
            Object.entries(value)
                .map(([key, entryValue]) => [String(key), Number(entryValue)])
                .sort(([left], [right]) => left.localeCompare(right))
        )
    }
}
