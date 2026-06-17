/**
 * Small shared helpers for AppView.
 */
export class AppViewSupport {
    /**
     * Resolves a normalized session document list from the render snapshot.
     * @param {{ documents?: { id: string, documentModel: any }[], activeDocumentId?: string, documentModel: any }} snapshot Render snapshot.
     * @returns {{ id: string, documentModel: any }[]}
     */
    static resolveSessionDocuments(snapshot) {
        if (Array.isArray(snapshot.documents)) {
            return snapshot.documents
        }

        if (!snapshot.documentModel) {
            return []
        }

        return [
            {
                id: String(snapshot.activeDocumentId || 'active-document'),
                documentModel: snapshot.documentModel
            }
        ]
    }

    /**
     * Resolves browser storage without throwing in restricted environments.
     * @param {Document} documentRef Browser document.
     * @returns {Storage | null}
     */
    static resolveBrowserStorage(documentRef) {
        try {
            return documentRef.defaultView?.localStorage || null
        } catch (_error) {
            return null
        }
    }

    /**
     * Escapes user-facing markup.
     * @param {string} value Source text.
     * @returns {string}
     */
    static escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
