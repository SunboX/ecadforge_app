/**
 * Viewer state container with subscription support.
 */
export class AppState {
    /** @type {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[] }} */
    #state

    /** @type {Set<(snapshot: { activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }) => void>} */
    #listeners

    /**
     * @param {{ activeView?: string, locale?: string, parseStatus?: string, statusMessage?: string, documents?: { id: string, documentModel: object }[], activeDocumentId?: string, sessionAssets?: { name: string, relativePath: string, file: any, format: string }[] }} [initial]
     */
    constructor(initial = {}) {
        this.#state = {
            activeView: AppState.#sanitizeView(initial.activeView),
            locale: String(initial.locale || 'en'),
            parseStatus: AppState.#sanitizeStatus(initial.parseStatus),
            statusMessage: String(initial.statusMessage || ''),
            documents: AppState.#sanitizeDocuments(initial.documents),
            activeDocumentId: String(initial.activeDocumentId || ''),
            sessionAssets: AppState.#sanitizeSessionAssets(initial.sessionAssets)
        }
        this.#normalizeDocumentSelection()
        this.#listeners = new Set()
    }

    /**
     * Returns a readonly snapshot.
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }}
     */
    getSnapshot() {
        const activeEntry = AppState.#findActiveDocumentEntry(
            this.#state.documents,
            this.#state.activeDocumentId
        )

        return Object.freeze({
            ...this.#state,
            documents: this.#state.documents.map((entry) => ({ ...entry })),
            sessionAssets: this.#state.sessionAssets.map((asset) => ({
                ...asset
            })),
            activeFileName: String(activeEntry?.documentModel?.fileName || ''),
            documentModel: activeEntry?.documentModel || null
        })
    }

    /**
     * Sets one state field and notifies listeners.
     * @param {'activeView' | 'locale' | 'parseStatus' | 'statusMessage' | 'documents' | 'activeDocumentId' | 'sessionAssets'} key
     * @param {string | object[] | null} value
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }}
     */
    setValue(key, value) {
        this.#applyValue(key, value)
        this.#normalizeDocumentSelection()

        return this.#emit()
    }

    /**
     * Applies multiple state fields.
     * @param {{ activeView?: string, locale?: string, parseStatus?: string, statusMessage?: string, documents?: { id: string, documentModel: object }[], activeDocumentId?: string, sessionAssets?: { name: string, relativePath: string, file: any, format: string }[] }} patch
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }}
     */
    patch(patch) {
        for (const key of Object.keys(patch)) {
            this.#applyValue(key, patch[key])
        }
        this.#normalizeDocumentSelection()

        return this.#emit()
    }

    /**
     * Subscribes to state changes.
     * @param {(snapshot: { activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }) => void} callback
     * @returns {() => void}
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            return () => {}
        }

        this.#listeners.add(callback)
        callback(this.getSnapshot())

        return () => {
            this.#listeners.delete(callback)
        }
    }

    /**
     * Emits a fresh state snapshot to all listeners.
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }}
     */
    #emit() {
        const snapshot = this.getSnapshot()
        this.#listeners.forEach((listener) => listener(snapshot))
        return snapshot
    }

    /**
     * Applies one normalized state value.
     * @param {string} key
     * @param {any} value
     */
    #applyValue(key, value) {
        if (key === 'activeView') {
            this.#state.activeView = AppState.#sanitizeView(value)
        }

        if (key === 'locale') {
            this.#state.locale = String(value || 'en')
        }

        if (key === 'parseStatus') {
            this.#state.parseStatus = AppState.#sanitizeStatus(value)
        }

        if (key === 'statusMessage') {
            this.#state.statusMessage = String(value || '')
        }

        if (key === 'documents') {
            this.#state.documents = AppState.#sanitizeDocuments(value)
        }

        if (key === 'activeDocumentId') {
            this.#state.activeDocumentId = String(value || '')
        }

        if (key === 'sessionAssets') {
            this.#state.sessionAssets = AppState.#sanitizeSessionAssets(value)
        }
    }

    /**
     * Normalizes the active document selection against the current session
     * document list.
     * @returns {void}
     */
    #normalizeDocumentSelection() {
        this.#state.activeDocumentId = AppState.#resolveActiveDocumentId(
            this.#state.documents,
            this.#state.activeDocumentId
        )
    }

    /**
     * Returns a supported tab/view id.
     * @param {any} value
     * @returns {string}
     */
    static #sanitizeView(value) {
        const supported = new Set([
            'schematic',
            'pcb',
            '3d',
            'bom',
            'diagnostics'
        ])
        const normalized = String(value || 'schematic')
        return supported.has(normalized) ? normalized : 'schematic'
    }

    /**
     * Returns a supported parser status.
     * @param {any} value
     * @returns {string}
     */
    static #sanitizeStatus(value) {
        const supported = new Set(['idle', 'loading', 'ready', 'error'])
        const normalized = String(value || 'idle')
        return supported.has(normalized) ? normalized : 'idle'
    }

    /**
     * Normalizes session document entries.
     * @param {unknown} value
     * @returns {{ id: string, documentModel: object }[]}
     */
    static #sanitizeDocuments(value) {
        if (!Array.isArray(value)) {
            return []
        }

        return value
            .filter(
                (entry) =>
                    entry &&
                    typeof entry === 'object' &&
                    typeof entry.id === 'string' &&
                    entry.id &&
                    entry.documentModel &&
                    typeof entry.documentModel === 'object'
            )
            .map((entry) => ({
                id: entry.id,
                documentModel: entry.documentModel
            }))
    }

    /**
     * Normalizes session companion assets.
     * @param {unknown} value
     * @returns {{ name: string, relativePath: string, file: any, format: string }[]}
     */
    static #sanitizeSessionAssets(value) {
        if (!Array.isArray(value)) {
            return []
        }

        return value
            .filter(
                (entry) =>
                    entry &&
                    typeof entry === 'object' &&
                    typeof entry.name === 'string' &&
                    entry.name &&
                    typeof entry.relativePath === 'string' &&
                    entry.relativePath &&
                    typeof entry.format === 'string' &&
                    entry.format
            )
            .map((entry) => ({
                name: entry.name,
                relativePath: entry.relativePath,
                file: entry.file,
                format: entry.format
            }))
    }

    /**
     * Resolves the active document id to an existing session entry.
     * @param {{ id: string, documentModel: object }[]} documents
     * @param {string} activeDocumentId
     * @returns {string}
     */
    static #resolveActiveDocumentId(documents, activeDocumentId) {
        if (!documents.length) {
            return ''
        }

        if (documents.some((entry) => entry.id === activeDocumentId)) {
            return activeDocumentId
        }

        return documents[0].id
    }

    /**
     * Finds the active document entry for the current session snapshot.
     * @param {{ id: string, documentModel: object }[]} documents
     * @param {string} activeDocumentId
     * @returns {{ id: string, documentModel: object } | null}
     */
    static #findActiveDocumentEntry(documents, activeDocumentId) {
        return (
            documents.find((entry) => entry.id === activeDocumentId) || null
        )
    }
}
