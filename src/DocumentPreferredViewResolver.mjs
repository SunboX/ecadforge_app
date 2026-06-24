/**
 * Chooses the first viewer tab for a freshly parsed document model.
 */
export class DocumentPreferredViewResolver {
    /**
     * Resolves the preferred view for one parsed document.
     * @param {object} documentModel Parsed document model.
     * @returns {string}
     */
    static resolve(documentModel) {
        if (documentModel?.kind === 'schematic') {
            return 'schematic'
        }

        if (documentModel?.kind === 'pcb') {
            return 'pcb'
        }

        if (!documentModel?.pcb) {
            return Array.isArray(documentModel?.diagnostics)
                ? 'diagnostics'
                : 'bom'
        }

        return 'pcb'
    }
}
