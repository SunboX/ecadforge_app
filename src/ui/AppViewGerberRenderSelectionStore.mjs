/**
 * Stores Gerber render selections owned by AppView sidebar chrome.
 */
export class AppViewGerberRenderSelectionStore {
    /** @type {Map<string, { renderMode: string, layerId: string, layerIds: string[] }>} */
    #selections

    constructor() {
        this.#selections = new Map()
    }

    /**
     * Applies a sidebar row click to one document selection.
     * @param {{ documentId?: string, renderMode?: string, layerId?: string }} change Sidebar change.
     * @param {object | null} snapshot Current app snapshot.
     * @returns {{ documentId: string, selection: { renderMode: string, layerId: string, layerIds: string[] } } | null}
     */
    apply(change, snapshot) {
        const documentId = String(change?.documentId || '')
        if (!documentId) {
            return null
        }

        const layers = AppViewGerberRenderSelectionStore.#layersForDocument(
            snapshot,
            documentId
        )
        const layerId = String(change?.layerId || '')
        const selection =
            change?.renderMode === 'separated'
                ? this.#toggleLayerSelection(documentId, layerId, layers)
                : AppViewGerberRenderSelectionStore.#compositeSelection()

        this.#selections.set(documentId, selection)
        return { documentId, selection }
    }

    /**
     * Adds stored Gerber selections to a snapshot.
     * @param {object} snapshot App state snapshot.
     * @returns {object}
     */
    withSelections(snapshot) {
        return {
            ...snapshot,
            gerberRenderSelections: this.snapshotValue()
        }
    }

    /**
     * Serializes current selections for renderers.
     * @returns {{ [documentId: string]: { renderMode: string, layerId: string, layerIds: string[] } }}
     */
    snapshotValue() {
        const selections = {}
        for (const [documentId, selection] of this.#selections) {
            selections[documentId] = {
                renderMode: selection.renderMode,
                layerId: selection.layerId,
                layerIds: [...selection.layerIds]
            }
        }
        return selections
    }

    /**
     * Toggles one source-layer row within a selected subset.
     * @param {string} documentId Document id.
     * @param {string} layerId Source layer id.
     * @param {object[]} layers Available layers.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[] }}
     */
    #toggleLayerSelection(documentId, layerId, layers) {
        if (!layerId) {
            return AppViewGerberRenderSelectionStore.#compositeSelection()
        }

        const previous = this.#selections.get(documentId)
        const existingIds =
            previous?.renderMode === 'separated'
                ? new Set(previous.layerIds || [])
                : new Set()
        if (existingIds.has(layerId)) {
            existingIds.delete(layerId)
        } else {
            existingIds.add(layerId)
        }

        const layerIds = AppViewGerberRenderSelectionStore.#orderedLayerIds(
            layers,
            existingIds
        )
        if (!layerIds.length) {
            return AppViewGerberRenderSelectionStore.#compositeSelection()
        }

        return {
            renderMode: 'separated',
            layerId: layerIds[0],
            layerIds
        }
    }

    /**
     * Returns the full-stack selection.
     * @returns {{ renderMode: string, layerId: string, layerIds: string[] }}
     */
    static #compositeSelection() {
        return { renderMode: 'composite', layerId: '', layerIds: [] }
    }

    /**
     * Resolves available Gerber source layers for one document.
     * @param {object | null} snapshot Current app snapshot.
     * @param {string} documentId Document id.
     * @returns {object[]}
     */
    static #layersForDocument(snapshot, documentId) {
        const documents = Array.isArray(snapshot?.documents)
            ? snapshot.documents
            : []
        const entry = documents.find(
            (candidate) => String(candidate?.id || '') === documentId
        )
        const documentModel =
            entry?.documentModel ||
            (String(snapshot?.activeDocumentId || '') === documentId
                ? snapshot?.documentModel
                : null)
        return Array.isArray(documentModel?.pcb?.fabrication?.layers)
            ? documentModel.pcb.fabrication.layers
            : []
    }

    /**
     * Orders selected ids by source layer order and drops unknown ids.
     * @param {object[]} layers Available layers.
     * @param {Set<string>} selectedIds Selected layer ids.
     * @returns {string[]}
     */
    static #orderedLayerIds(layers, selectedIds) {
        return layers
            .map((layer) => String(layer?.id || ''))
            .filter((id) => id && selectedIds.has(id))
    }
}
