import { AltiumParser } from '@sunbox/altium-toolkit/parser'

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

    /** @type {{ parseArrayBuffer: (fileName: string, buffer: ArrayBuffer) => object }} */
    #parser

    /** @type {Worker | null} */
    #worker

    /** @type {number} */
    #documentSequence

    /** @type {number} */
    #workerRequestSequence

    /** @type {Map<string, { resolve: (documentModel: object) => void, reject: (error: Error) => void }>} */
    #pendingWorkerParses

    /**
     * @param {{
     * state: import('./core/AppState.mjs').AppState,
     * view: import('./ui/AppView.mjs').AppView,
     * i18n?: { getLocale: () => string, setLocale: (locale: string) => void, translate: (key: string) => string, applyToDom: (node: Document) => void } | null,
     * workerFactory?: (() => Worker) | null,
     * parser?: { parseArrayBuffer: (fileName: string, buffer: ArrayBuffer) => object }
     * }} dependencies
     */
    constructor(dependencies) {
        this.#state = dependencies.state
        this.#view = dependencies.view
        this.#i18n = dependencies.i18n || null
        this.#createWorker = dependencies.workerFactory || null
        this.#parser = dependencies.parser || AltiumParser
        this.#worker = null
        this.#documentSequence = 1
        this.#workerRequestSequence = 1
        this.#pendingWorkerParses = new Map()
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
            this.#state.patch(
                this.#buildCompatibleViewPatch(
                    viewName,
                    this.#state.getSnapshot()
                )
            )
        })
        if (typeof this.#view.bindDocumentSelection === 'function') {
            this.#view.bindDocumentSelection((documentId) => {
                this.#state.setValue('activeDocumentId', documentId)
            })
        }

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
                this.#handleWorkerMessage(event?.data || {})
            })
            this.#worker.addEventListener('error', (event) => {
                this.#handleWorkerFailure(event)
            })
            this.#worker.addEventListener('messageerror', (event) => {
                this.#handleWorkerFailure(event)
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
        const selectedFiles = Array.isArray(files) ? files : []
        if (!selectedFiles.length) return

        const snapshot = this.#state.getSnapshot()
        const sessionWasEmpty = !snapshot.documents.length
        let shouldAdoptPreferredView = sessionWasEmpty
        const nativeFiles = selectedFiles.filter((file) =>
            AppController.#isSupportedFile(file?.name)
        )
        const companionFiles = selectedFiles.filter((file) =>
            AppController.#isSupportedCompanionFile(file?.name)
        )

        if (companionFiles.length) {
            this.#state.setValue(
                'sessionAssets',
                AppController.#mergeSessionAssets(
                    snapshot.sessionAssets,
                    companionFiles.map((file) =>
                        AppController.#buildCompanionAsset(file)
                    )
                )
            )
        }

        if (!nativeFiles.length) {
            if (!companionFiles.length) {
                this.#handleParseError(this.#translate('status.invalidFile'))
                return
            }

            this.#state.patch({
                statusMessage: this.#translate('status.assetsAdded')
            })
            return
        }

        this.#state.patch({
            parseStatus: 'loading',
            statusMessage: this.#translate('status.loading')
        })

        for (const file of nativeFiles) {
            try {
                const buffer = await file.arrayBuffer()
                const documentModel = await this.#parseArrayBuffer(
                    file.name,
                    buffer
                )

                this.#handleParsedDocument(documentModel, {
                    adoptPreferredView: shouldAdoptPreferredView
                })
                shouldAdoptPreferredView = sessionWasEmpty
            } catch (error) {
                this.#handleParseError(AppController.#getErrorMessage(error))
            }
        }
    }

    /**
     * Parses one native document either directly or through the parser worker.
     * @param {string} fileName
     * @param {ArrayBuffer} buffer
     * @returns {Promise<object>}
     */
    async #parseArrayBuffer(fileName, buffer) {
        if (this.#worker) {
            const workerBuffer = buffer.slice(0)
            try {
                return await this.#parseArrayBufferWithWorker(
                    fileName,
                    workerBuffer
                )
            } catch (error) {
                if (AppController.#isWorkerFailure(error)) {
                    this.#disposeWorker()
                    return this.#parser.parseArrayBuffer(fileName, buffer)
                }

                throw error
            }
        }

        return this.#parser.parseArrayBuffer(fileName, buffer)
    }

    /**
     * Dispatches one parse request through the worker and resolves the
     * matching response by request id.
     * @param {string} fileName
     * @param {ArrayBuffer} buffer
     * @returns {Promise<object>}
     */
    #parseArrayBufferWithWorker(fileName, buffer) {
        return new Promise((resolve, reject) => {
            if (!this.#worker) {
                reject(new Error('Parser worker is unavailable.'))
                return
            }

            const requestId = 'parse-request-' + this.#workerRequestSequence++
            this.#pendingWorkerParses.set(requestId, { resolve, reject })
            this.#worker.postMessage(
                {
                    type: 'parse:file',
                    requestId,
                    fileName,
                    buffer
                },
                [buffer]
            )
        })
    }

    /**
     * Routes one worker payload to the matching pending parse request.
     * @param {{ type?: string, requestId?: string, documentModel?: object, message?: string }} payload
     * @returns {void}
     */
    #handleWorkerMessage(payload) {
        const matchedRequest = this.#resolvePendingWorkerRequest(
            String(payload.requestId || '')
        )
        if (!matchedRequest) {
            return
        }

        if (payload.type === 'parser:success') {
            matchedRequest.resolve(payload.documentModel || {})
            return
        }

        matchedRequest.reject(
            new Error(payload.message || 'Parser worker failed.')
        )
    }

    /**
     * Rejects pending parses when the module worker itself cannot run.
     * @param {{ message?: string, error?: Error, preventDefault?: () => void }} event
     * @returns {void}
     */
    #handleWorkerFailure(event) {
        event?.preventDefault?.()
        const message = String(
            event?.message ||
                event?.error?.message ||
                'Parser worker failed to load.'
        )
        const error = new Error('Parser worker failed: ' + message)
        error.workerFailure = true
        this.#rejectPendingWorkerParses(error)
        this.#disposeWorker()
    }

    /**
     * Applies a parsed document to state.
     * @param {object} documentModel
     * @param {{ adoptPreferredView?: boolean }} [options]
     */
    #handleParsedDocument(documentModel, options = {}) {
        const snapshot = this.#state.getSnapshot()
        const preferredView =
            documentModel.kind === 'schematic' ? 'schematic' : 'pcb'
        const documentId = this.#buildDocumentId()
        const nextActiveView = options.adoptPreferredView
            ? preferredView
            : snapshot.activeView
        const nextDocuments = [
            ...snapshot.documents,
            {
                id: documentId,
                documentModel
            }
        ]
        const patch = {
            documents: nextDocuments,
            activeDocumentId: AppController.#resolveCompatibleDocumentId(
                nextDocuments,
                nextActiveView,
                documentId
            ),
            parseStatus: 'ready',
            statusMessage: this.#translate('status.loaded')
        }

        if (options.adoptPreferredView) {
            patch.activeView = nextActiveView
        }

        this.#state.patch({
            ...patch
        })
    }

    /**
     * Applies a parse error to state.
     * @param {string} message
     */
    #handleParseError(message) {
        this.#state.patch({
            parseStatus: 'error',
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
            app: 'ECAD Forge',
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
        this.#rejectPendingWorkerParses(new Error('Parser worker terminated.'))
        this.#disposeWorker()
    }

    /**
     * Terminates the current parser worker.
     * @returns {void}
     */
    #disposeWorker() {
        this.#worker?.terminate()
        this.#worker = null
    }

    /**
     * Rejects every unresolved parser worker request.
     * @param {Error} error
     * @returns {void}
     */
    #rejectPendingWorkerParses(error) {
        this.#pendingWorkerParses.forEach(({ reject }) => {
            reject(error)
        })
        this.#pendingWorkerParses.clear()
    }

    /**
     * Builds one stable in-session document id.
     * @returns {string}
     */
    #buildDocumentId() {
        return 'session-document-' + this.#documentSequence++
    }

    /**
     * Builds the active-view patch while keeping the active document
     * compatible with the selected view whenever possible.
     * @param {string} viewName
     * @param {{ activeDocumentId: string, documents: { id: string, documentModel: object }[] }} snapshot
     * @returns {{ activeView: string, activeDocumentId?: string }}
     */
    #buildCompatibleViewPatch(viewName, snapshot) {
        const patch = {
            activeView: viewName
        }
        const compatibleDocumentId = AppController.#resolveCompatibleDocumentId(
            snapshot.documents,
            viewName,
            snapshot.activeDocumentId
        )

        if (compatibleDocumentId) {
            patch.activeDocumentId = compatibleDocumentId
        }

        return patch
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
            'status.ready':
                'Drop a native SchDoc, PcbDoc, or companion model file to begin.',
            'status.loading': 'Parsing native Altium file in the browser...',
            'status.loaded': 'File parsed successfully.',
            'status.invalidFile':
                'Please choose a .SchDoc, .PcbDoc, .PrjPcb, .WRL, or .STEP file.',
            'status.assetsAdded':
                'Companion 3D assets added to the current session.',
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

    /**
     * Returns true for worker transport/module failures that can safely fall
     * back to direct parsing in the document module graph.
     * @param {unknown} error
     * @returns {boolean}
     */
    static #isWorkerFailure(error) {
        return Boolean(error && error.workerFailure)
    }

    /**
     * Returns true when the file name points to a supported native document.
     * @param {string} fileName
     * @returns {boolean}
     */
    static #isSupportedFile(fileName) {
        return /\.(schdoc|pcbdoc)$/i.test(String(fileName || ''))
    }

    /**
     * Returns true when the file name points to a supported 3D companion
     * asset or project file.
     * @param {string} fileName
     * @returns {boolean}
     */
    static #isSupportedCompanionFile(fileName) {
        return /\.(wrl|vrml|step|stp|prjpcb)$/i.test(String(fileName || ''))
    }

    /**
     * Normalizes one companion asset record for session state.
     * @param {{ name?: string, webkitRelativePath?: string }} file
     * @returns {{ name: string, relativePath: string, file: any, format: string }}
     */
    static #buildCompanionAsset(file) {
        const fileName = String(file?.name || '')
        const relativePath =
            String(file?.webkitRelativePath || fileName) || fileName

        return {
            name: fileName,
            relativePath,
            file,
            format: AppController.#resolveCompanionFormat(fileName)
        }
    }

    /**
     * Resolves the normalized companion format label.
     * @param {string} fileName
     * @returns {string}
     */
    static #resolveCompanionFormat(fileName) {
        const normalized = String(fileName || '').toLowerCase()
        if (normalized.endsWith('.wrl') || normalized.endsWith('.vrml')) {
            return 'wrl'
        }

        if (normalized.endsWith('.step') || normalized.endsWith('.stp')) {
            return 'step'
        }

        return 'project'
    }

    /**
     * Merges session companion assets by relative path.
     * @param {{ name: string, relativePath: string, file: any, format: string }[]} existingAssets
     * @param {{ name: string, relativePath: string, file: any, format: string }[]} nextAssets
     * @returns {{ name: string, relativePath: string, file: any, format: string }[]}
     */
    static #mergeSessionAssets(existingAssets, nextAssets) {
        const mergedAssets = new Map()

        ;[...(existingAssets || []), ...(nextAssets || [])].forEach((asset) => {
            mergedAssets.set(String(asset.relativePath).toLowerCase(), asset)
        })

        return [...mergedAssets.values()]
    }

    /**
     * Returns true when a session document can render the requested top-level
     * view.
     * @param {object | null | undefined} documentModel
     * @param {string} viewName
     * @returns {boolean}
     */
    static #supportsView(documentModel, viewName) {
        if (!documentModel || typeof documentModel !== 'object') {
            return false
        }

        if (viewName === 'schematic') {
            return Boolean(documentModel.schematic)
        }

        if (viewName === 'pcb' || viewName === '3d') {
            return Boolean(documentModel.pcb)
        }

        if (viewName === 'bom') {
            return Array.isArray(documentModel.bom)
        }

        if (viewName === 'diagnostics') {
            return Array.isArray(documentModel.diagnostics)
        }

        return false
    }

    /**
     * Resolves the session document id that best matches the requested view.
     * Prefers the requested id when it is compatible, otherwise falls back to
     * the first compatible document, or the requested id when no compatible
     * document exists.
     * @param {{ id: string, documentModel: object }[]} documents
     * @param {string} viewName
     * @param {string} preferredDocumentId
     * @returns {string}
     */
    static #resolveCompatibleDocumentId(
        documents,
        viewName,
        preferredDocumentId
    ) {
        const preferredDocument = documents.find(
            (entry) => entry.id === preferredDocumentId
        )
        if (
            preferredDocument &&
            AppController.#supportsView(
                preferredDocument.documentModel,
                viewName
            )
        ) {
            return preferredDocument.id
        }

        const compatibleDocument = documents.find((entry) =>
            AppController.#supportsView(entry.documentModel, viewName)
        )
        if (compatibleDocument) {
            return compatibleDocument.id
        }

        return preferredDocumentId || documents[0]?.id || ''
    }

    /**
     * Resolves and removes the pending worker request matching the provided
     * request id. When an older worker omits request ids, the single pending
     * request is accepted as a safe fallback.
     * @param {string} requestId
     * @returns {{ resolve: (documentModel: object) => void, reject: (error: Error) => void } | null}
     */
    #resolvePendingWorkerRequest(requestId) {
        if (requestId && this.#pendingWorkerParses.has(requestId)) {
            const matchedRequest = this.#pendingWorkerParses.get(requestId)
            this.#pendingWorkerParses.delete(requestId)
            return matchedRequest || null
        }

        if (this.#pendingWorkerParses.size !== 1) {
            return null
        }

        const [fallbackRequestId] = this.#pendingWorkerParses.keys()
        const matchedRequest = this.#pendingWorkerParses.get(fallbackRequestId)
        this.#pendingWorkerParses.delete(fallbackRequestId)
        return matchedRequest || null
    }
}
