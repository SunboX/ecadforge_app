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
}
