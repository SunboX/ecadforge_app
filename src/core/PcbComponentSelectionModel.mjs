/**
 * Resolves PCB component selection state shared by sidebar and rendering.
 */
export class PcbComponentSelectionModel {
    /**
     * Returns a stable component key for state and DOM events.
     * @param {any} component Component metadata.
     * @param {number} index Component index.
     * @returns {string}
     */
    static resolveComponentKey(component, index = 0) {
        return String(
            component?.designator ??
                component?.reference ??
                component?.refdes ??
                component?.name ??
                'Component ' + (index + 1)
        ).trim()
    }

    /**
     * Resolves the selected component key for one document.
     * @param {{ [documentId: string]: string }} selectedPcbComponents Selection map.
     * @param {string} documentId Active document id.
     * @returns {string}
     */
    static resolveSelectedKey(selectedPcbComponents, documentId) {
        return String(selectedPcbComponents?.[documentId] || '').trim()
    }

    /**
     * Applies one component selection to a selection map.
     * @param {{ [documentId: string]: string }} selectedPcbComponents Current map.
     * @param {string} documentId Target document id.
     * @param {string} componentKey Target component key.
     * @returns {{ [documentId: string]: string }}
     */
    static withSelection(selectedPcbComponents, documentId, componentKey) {
        const normalizedDocumentId = String(documentId || '').trim()
        const normalizedComponentKey = String(componentKey || '').trim()
        const next = PcbComponentSelectionModel.cloneMap(
            selectedPcbComponents
        )
        if (!normalizedDocumentId) {
            return next
        }

        if (normalizedComponentKey) {
            next[normalizedDocumentId] = normalizedComponentKey
            return next
        }

        delete next[normalizedDocumentId]
        return next
    }

    /**
     * Applies one component selection across compatible open documents.
     * @param {{ [documentId: string]: string }} selectedPcbComponents Current map.
     * @param {{ id: string, documentModel: any }[]} documents Open documents.
     * @param {string} documentId Target document id.
     * @param {string} componentKey Target component key.
     * @param {string} [clearKey] Previously selected key for deselection.
     * @returns {{ [documentId: string]: string }}
     */
    static withSessionSelection(
        selectedPcbComponents,
        documents,
        documentId,
        componentKey,
        clearKey = ''
    ) {
        const targetDocumentId = String(documentId || '').trim()
        const normalizedComponentKey = String(componentKey || '').trim()
        const normalizedClearKey = String(clearKey || '').trim()
        const next = PcbComponentSelectionModel.cloneMap(
            selectedPcbComponents
        )

        if (!normalizedComponentKey) {
            Object.keys(next).forEach((entryDocumentId) => {
                if (
                    entryDocumentId === targetDocumentId ||
                    next[entryDocumentId] === normalizedClearKey
                ) {
                    delete next[entryDocumentId]
                }
            })
            return next
        }

        for (const entry of documents || []) {
            const entryDocumentId = String(entry?.id || '').trim()
            if (
                entryDocumentId &&
                (entryDocumentId === targetDocumentId ||
                    PcbComponentSelectionModel.#documentHasComponentKey(
                        entry?.documentModel,
                        normalizedComponentKey
                    ))
            ) {
                next[entryDocumentId] = normalizedComponentKey
            }
        }

        return next
    }

    /**
     * Clones a selected-component map.
     * @param {{ [documentId: string]: string }} selectedPcbComponents Selection map.
     * @returns {{ [documentId: string]: string }}
     */
    static cloneMap(selectedPcbComponents) {
        return Object.fromEntries(
            Object.entries(selectedPcbComponents || {})
                .map(([documentId, componentKey]) => [
                    String(documentId || '').trim(),
                    String(componentKey || '').trim()
                ])
                .filter(([documentId, componentKey]) =>
                    Boolean(documentId && componentKey)
                )
        )
    }

    /**
     * Returns true when a document contains the selected component key.
     * @param {any} documentModel Document model.
     * @param {string} componentKey Component key.
     * @returns {boolean}
     */
    static #documentHasComponentKey(documentModel, componentKey) {
        const components = [
            ...(documentModel?.schematic?.components || []),
            ...(documentModel?.pcb?.components || [])
        ]
        return components.some(
            (component, index) =>
                PcbComponentSelectionModel.resolveComponentKey(
                    component,
                    index
                ) === componentKey
        )
    }
}
