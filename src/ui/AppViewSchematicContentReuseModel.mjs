const SCHEMATIC_CONTENT_SIGNATURE_KEY =
    '__ecadForgeSchematicContentSignature'

/**
 * Tracks whether mounted schematic content can survive an AppView render.
 */
export class AppViewSchematicContentReuseModel {
    /**
     * Returns true when mounted schematic content already matches a snapshot.
     * @param {HTMLElement | null} contentNode Schematic content mount.
     * @param {object} snapshot App state snapshot.
     * @returns {boolean}
     */
    static shouldReuse(contentNode, snapshot) {
        if (!contentNode || snapshot?.activeView !== 'schematic') {
            return false
        }

        if (!contentNode.querySelector?.('.schematic-svg')) {
            return false
        }

        const previous = contentNode[SCHEMATIC_CONTENT_SIGNATURE_KEY]
        if (!previous) return false

        const next =
            AppViewSchematicContentReuseModel.#createSignature(snapshot)
        return AppViewSchematicContentReuseModel.#matches(previous, next)
    }

    /**
     * Stores the signature for the mounted schematic content.
     * @param {HTMLElement | null} contentNode Schematic content mount.
     * @param {object} snapshot App state snapshot.
     * @returns {void}
     */
    static remember(contentNode, snapshot) {
        if (!contentNode || snapshot?.activeView !== 'schematic') {
            return
        }

        contentNode[SCHEMATIC_CONTENT_SIGNATURE_KEY] =
            AppViewSchematicContentReuseModel.#createSignature(snapshot)
    }

    /**
     * Clears any remembered schematic content signature.
     * @param {HTMLElement | null} contentNode Schematic content mount.
     * @returns {void}
     */
    static clear(contentNode) {
        if (contentNode) delete contentNode[SCHEMATIC_CONTENT_SIGNATURE_KEY]
    }

    /**
     * Creates a comparable signature for schematic content-affecting state.
     * @param {object} snapshot App state snapshot.
     * @returns {object}
     */
    static #createSignature(snapshot) {
        const documentId = String(snapshot?.activeDocumentId || '')
        return {
            activeDocumentId: documentId,
            activeView: String(snapshot?.activeView || ''),
            documentModel: snapshot?.documentModel || null,
            parseStatus: String(snapshot?.parseStatus || ''),
            selectedComponentKey: String(
                snapshot?.selectedPcbComponents?.[documentId] || ''
            )
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
            previous?.parseStatus === next.parseStatus &&
            previous?.selectedComponentKey === next.selectedComponentKey
        )
    }
}
