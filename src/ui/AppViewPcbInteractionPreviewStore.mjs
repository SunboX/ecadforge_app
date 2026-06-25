/**
 * Stores transient PCB interaction previews for sidebar rendering.
 */
export class AppViewPcbInteractionPreviewStore {
    /** @type {object | null} */
    #preview

    /** Creates an empty preview store. */
    constructor() {
        this.#preview = null
    }

    /**
     * Adds the current PCB hover or bounds preview to an app snapshot.
     * @param {object} snapshot App state snapshot.
     * @returns {object}
     */
    withPreview(snapshot) {
        const preview = this.#preview
        return preview &&
            String(preview.documentId || '') ===
                String(snapshot?.activeDocumentId || '') &&
            snapshot?.activeView === 'pcb'
            ? { ...snapshot, pcbInteractionPreview: preview }
            : AppViewPcbInteractionPreviewStore.#withoutPreview(snapshot)
    }

    /**
     * Applies one candidate preview update to the last rendered snapshot.
     * @param {{ documentId?: string, candidates?: object[] }} change Preview change.
     * @param {object | null} lastSnapshot Last rendered app snapshot.
     * @returns {object | null}
     */
    handleChange(change, lastSnapshot) {
        const candidates = Array.isArray(change?.candidates)
            ? change.candidates
            : []
        this.#preview =
            change?.documentId && candidates.length ? { ...change } : null
        return lastSnapshot ? this.withPreview(lastSnapshot) : null
    }

    /**
     * Removes transient PCB preview data from a snapshot.
     * @param {object} snapshot App state snapshot.
     * @returns {object}
     */
    static #withoutPreview(snapshot) {
        if (!snapshot || !('pcbInteractionPreview' in snapshot)) return snapshot
        const next = { ...snapshot }
        delete next.pcbInteractionPreview
        return next
    }
}
