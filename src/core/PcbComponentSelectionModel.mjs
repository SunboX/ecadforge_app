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
     * Resolves the PCB side declared by component metadata.
     * @param {object} component Component metadata.
     * @returns {'top' | 'bottom' | ''}
     */
    static resolveComponentSide(component) {
        const layerId = Number(
            component?.layerId ?? component?.layerCode ?? component?.sideCode
        )
        if (layerId === 32 || layerId === 34) return 'bottom'
        if (layerId === 1 || layerId === 33) return 'top'

        const text = PcbComponentSelectionModel.#componentSearchText(component)
        if (/\b(bottom|back)\b|\bb[._-]/.test(text)) return 'bottom'
        if (/\b(top|front)\b|\bf[._-]/.test(text)) return 'top'

        return ''
    }

    /**
     * Resolves the PCB side for one selected component key.
     * @param {object} documentModel PCB document model.
     * @param {string} componentKey Selected component key.
     * @returns {'top' | 'bottom' | ''}
     */
    static resolveSelectedComponentSide(documentModel, componentKey) {
        const key = String(componentKey || '').trim()
        if (!key) return ''

        const components = Array.isArray(documentModel?.pcb?.components)
            ? documentModel.pcb.components
            : []
        for (let index = 0; index < components.length; index += 1) {
            const component = components[index]
            if (
                PcbComponentSelectionModel.resolveComponentKey(
                    component,
                    index
                ) === key
            ) {
                return PcbComponentSelectionModel.resolveComponentSide(
                    component
                )
            }
        }

        return ''
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
                    PcbComponentSelectionModel.documentHasComponentKey(
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
    static documentHasComponentKey(documentModel, componentKey) {
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

    /**
     * Builds normalized search text for component metadata classification.
     * @param {object | null} component Component metadata.
     * @returns {string}
     */
    static #componentSearchText(component) {
        return [component?.layer, component?.side, component?.layerName]
            .filter((value) => value !== undefined && value !== null)
            .join(' ')
            .toLowerCase()
    }
}
