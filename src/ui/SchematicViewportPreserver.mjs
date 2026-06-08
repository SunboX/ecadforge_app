const SCHEMATIC_VIEWPORT_STATE_KEY = '__ecadForgeSchematicViewportState'

/**
 * Preserves schematic SVG pan and zoom across same-document rerenders.
 */
export class SchematicViewportPreserver {
    /**
     * Captures the current schematic SVG viewBox when the next snapshot still
     * targets the same rendered schematic document.
     * @param {HTMLElement | null} contentNode Viewer content mount.
     * @param {{ activeView?: string, activeDocumentId?: string, documentModel?: any }} snapshot Next render snapshot.
     * @returns {string}
     */
    static capture(contentNode, snapshot) {
        if (!contentNode || snapshot?.activeView !== 'schematic') return ''

        const state = contentNode[SCHEMATIC_VIEWPORT_STATE_KEY]
        if (!SchematicViewportPreserver.#matchesSnapshot(state, snapshot)) {
            return ''
        }

        return String(
            contentNode
                .querySelector?.('.schematic-svg')
                ?.getAttribute?.('viewBox') || ''
        ).trim()
    }

    /**
     * Stores the identity of the currently rendered schematic document.
     * @param {HTMLElement | null} contentNode Viewer content mount.
     * @param {string} documentId Active document id.
     * @param {any} documentModel Active schematic document model.
     * @returns {void}
     */
    static remember(contentNode, documentId, documentModel) {
        if (!contentNode) return

        contentNode[SCHEMATIC_VIEWPORT_STATE_KEY] = {
            documentId: String(documentId || ''),
            documentModel
        }
    }

    /**
     * Applies a captured schematic viewBox to the newly rendered SVG.
     * @param {HTMLElement | null} contentNode Viewer content mount.
     * @param {string} viewBox Captured SVG viewBox.
     * @returns {boolean}
     */
    static restore(contentNode, viewBox) {
        const value = String(viewBox || '').trim()
        if (!contentNode || !value) return false

        const svgNode = contentNode.querySelector?.('.schematic-svg')
        if (typeof svgNode?.setAttribute !== 'function') return false

        svgNode.setAttribute('viewBox', value)
        return true
    }

    /**
     * Clears any remembered schematic identity from the content node.
     * @param {HTMLElement | null} contentNode Viewer content mount.
     * @returns {void}
     */
    static clear(contentNode) {
        if (!contentNode) return
        delete contentNode[SCHEMATIC_VIEWPORT_STATE_KEY]
    }

    /**
     * Returns true when preserved state belongs to the next schematic snapshot.
     * @param {{ documentId?: string, documentModel?: any } | null | undefined} state Preserved schematic identity.
     * @param {{ activeDocumentId?: string, documentModel?: any }} snapshot Next render snapshot.
     * @returns {boolean}
     */
    static #matchesSnapshot(state, snapshot) {
        return (
            Boolean(state) &&
            state.documentId === String(snapshot?.activeDocumentId || '') &&
            state.documentModel === snapshot?.documentModel
        )
    }
}
