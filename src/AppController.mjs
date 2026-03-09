import { AltiumParser } from './core/altium/AltiumParser.mjs'

/**
 * Coordinates file intake, parsing, state, and rendering.
 */
export class AppController {
    /** @type {import('./core/AppState.mjs').AppState} */
    #state

    /** @type {import('./ui/AppView.mjs').AppView} */
    #view

    /** @type {{ getLocale: () => string, setLocale: (locale: string) => void, translate: (key: string) => string, applyToDom: (node: Document) => void } | null} */
    #i18n

    /** @type {(() => Worker) | null} */
    #createWorker

    /** @type {Worker | null} */
    #worker

    /**
     * @param {{
     * state: import('./core/AppState.mjs').AppState,
     * view: import('./ui/AppView.mjs').AppView,
     * i18n?: { getLocale: () => string, setLocale: (locale: string) => void, translate: (key: string) => string, applyToDom: (node: Document) => void } | null,
     * workerFactory?: (() => Worker) | null
     * }} dependencies
     */
    constructor(dependencies) {
        this.#state = dependencies.state
        this.#view = dependencies.view
        this.#i18n = dependencies.i18n || null
        this.#createWorker = dependencies.workerFactory || null
        this.#worker = null
    }

    /**
     * Initializes event wiring and first render.
     * @returns {Promise<void>}
     */
    async init() {
        this.#state.subscribe((snapshot) => {
            this.#view.render(snapshot)
        })

        this.#view.bindFileSelection((files) => this.#handleFiles(files))
        this.#view.bindDrop((files) => this.#handleFiles(files))
        this.#view.bindViewChange((viewName) => {
            this.#state.setValue('activeView', viewName)
        })

        if (this.#i18n && this.#view.hasLocaleSelect()) {
            const locale = this.#i18n.getLocale()
            this.#state.setValue('locale', locale)
            this.#i18n.applyToDom(document)

            this.#view.bindLocaleChange(async (nextLocale) => {
                await this.#i18n.setLocale(nextLocale)
                this.#state.setValue('locale', nextLocale)
                this.#i18n.applyToDom(document)
                this.#view.setStatus(
                    this.#i18n.translate('status.localeChanged')
                )
            })
        }

        if (this.#createWorker) {
            this.#worker = this.#createWorker()
            this.#worker.addEventListener('message', (event) => {
                const payload = event?.data || {}
                if (payload.type === 'parser:success') {
                    this.#handleParsedDocument(payload.documentModel)
                }
                if (payload.type === 'parser:error') {
                    this.#handleParseError(
                        payload.message || 'Parser worker failed.'
                    )
                }
            })
        }

        this.#view.setStatus(this.#translate('status.ready'))
    }

    /**
     * Handles native file selection.
     * @param {File[]} files
     * @returns {Promise<void>}
     */
    async #handleFiles(files) {
        const [file] = files || []
        if (!file) return

        if (!/\.(schdoc|pcbdoc)$/i.test(file.name)) {
            this.#handleParseError(this.#translate('status.invalidFile'))
            return
        }

        this.#state.patch({
            parseStatus: 'loading',
            activeFileName: file.name,
            documentModel: null,
            statusMessage: this.#translate('status.loading')
        })

        try {
            const buffer = await file.arrayBuffer()

            if (this.#worker) {
                this.#worker.postMessage(
                    {
                        type: 'parse:file',
                        fileName: file.name,
                        buffer
                    },
                    [buffer]
                )
                return
            }

            const documentModel = AltiumParser.parseArrayBuffer(
                file.name,
                buffer
            )
            this.#handleParsedDocument(documentModel)
        } catch (error) {
            this.#handleParseError(AppController.#getErrorMessage(error))
        }
    }

    /**
     * Applies a parsed document to state.
     * @param {object} documentModel
     */
    #handleParsedDocument(documentModel) {
        const preferredView =
            documentModel.kind === 'schematic' ? 'schematic' : 'pcb'
        this.#state.patch({
            documentModel,
            activeView: preferredView,
            parseStatus: 'ready',
            activeFileName: documentModel.fileName,
            statusMessage: this.#translate('status.loaded')
        })
    }

    /**
     * Applies a parse error to state.
     * @param {string} message
     */
    #handleParseError(message) {
        this.#state.patch({
            parseStatus: 'error',
            documentModel: null,
            statusMessage: message
        })
    }

    /**
     * Returns a stable state snapshot for integration consumers.
     * @returns {{ app: string, activeView: string, locale: string, parseStatus: string, activeFileName: string }}
     */
    getPublicState() {
        const snapshot = this.#state.getSnapshot()
        return {
            app: 'Altium Viewer',
            activeView: snapshot.activeView,
            locale: snapshot.locale,
            parseStatus: snapshot.parseStatus,
            activeFileName: snapshot.activeFileName
        }
    }

    /**
     * Terminates controller resources.
     * @returns {void}
     */
    dispose() {
        this.#worker?.terminate()
    }

    /**
     * Translates a key via i18n if available.
     * @param {string} key
     * @returns {string}
     */
    #translate(key) {
        if (!this.#i18n) return AppController.#fallbackMessage(key)
        return this.#i18n.translate(key)
    }

    /**
     * Fallback status texts when i18n is disabled.
     * @param {string} key
     * @returns {string}
     */
    static #fallbackMessage(key) {
        const fallbackMap = {
            'status.ready': 'Drop a native SchDoc or PcbDoc file to begin.',
            'status.loading': 'Parsing native Altium file in the browser...',
            'status.loaded': 'File parsed successfully.',
            'status.invalidFile': 'Please choose a .SchDoc or .PcbDoc file.',
            'status.localeChanged': 'Language updated.'
        }
        return fallbackMap[key] || key
    }

    /**
     * Normalizes an error message.
     * @param {unknown} error
     * @returns {string}
     */
    static #getErrorMessage(error) {
        if (error instanceof Error && error.message) {
            return error.message
        }
        return 'Unknown parser error.'
    }
}
