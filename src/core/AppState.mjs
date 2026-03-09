/**
 * Viewer state container with subscription support.
 */
export class AppState {
    /** @type {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }} */
    #state

    /** @type {Set<(snapshot: { activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }) => void>} */
    #listeners

    /**
     * @param {{ activeView?: string, locale?: string, parseStatus?: string, statusMessage?: string, activeFileName?: string, documentModel?: object | null }} [initial]
     */
    constructor(initial = {}) {
        this.#state = {
            activeView: AppState.#sanitizeView(initial.activeView),
            locale: String(initial.locale || 'en'),
            parseStatus: AppState.#sanitizeStatus(initial.parseStatus),
            statusMessage: String(initial.statusMessage || ''),
            activeFileName: String(initial.activeFileName || ''),
            documentModel: initial.documentModel || null
        }
        this.#listeners = new Set()
    }

    /**
     * Returns a readonly snapshot.
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }}
     */
    getSnapshot() {
        return Object.freeze({ ...this.#state })
    }

    /**
     * Sets one state field and notifies listeners.
     * @param {'activeView' | 'locale' | 'parseStatus' | 'statusMessage' | 'activeFileName' | 'documentModel'} key
     * @param {string | object | null} value
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }}
     */
    setValue(key, value) {
        this.#applyValue(key, value)

        return this.#emit()
    }

    /**
     * Applies multiple state fields.
     * @param {{ activeView?: string, locale?: string, parseStatus?: string, statusMessage?: string, activeFileName?: string, documentModel?: object | null }} patch
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }}
     */
    patch(patch) {
        for (const key of Object.keys(patch)) {
            this.#applyValue(key, patch[key])
        }

        return this.#emit()
    }

    /**
     * Subscribes to state changes.
     * @param {(snapshot: { activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }) => void} callback
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
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, activeFileName: string, documentModel: object | null }}
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

        if (key === 'activeFileName') {
            this.#state.activeFileName = String(value || '')
        }

        if (key === 'documentModel') {
            this.#state.documentModel = value || null
        }
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
}
