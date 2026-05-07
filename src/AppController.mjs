import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { EcadParserService } from './core/ecad/EcadParserService.mjs'

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

    /** @type {{ parseArrayBuffer?: (fileName: string, buffer: ArrayBuffer) => object, parseEntries?: (entries: { name: string, buffer: ArrayBuffer }[]) => Promise<object> | object }} */
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
     * parser?: { parseArrayBuffer?: (fileName: string, buffer: ArrayBuffer) => object, parseEntries?: (entries: { name: string, buffer: ArrayBuffer }[]) => Promise<object> | object }
     * }} dependencies
     */
    constructor(dependencies) {
        this.#state = dependencies.state
        this.#view = dependencies.view
        this.#i18n = dependencies.i18n || null
        this.#createWorker = dependencies.workerFactory || null
        this.#parser = dependencies.parser || EcadParserService
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
            EcadFormatRegistry.isNativeDocument(file?.name)
        )
        const companionFiles = selectedFiles.filter((file) =>
            EcadFormatRegistry.isCompanionAsset(file?.name)
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

        try {
            const entries = await Promise.all(
                nativeFiles.map((file) => AppController.#buildParserEntry(file))
            )
            const parseResult = await this.#parseEntries(entries)
            const parsedAssets = parseResult.assets.map((asset) =>
                AppController.#buildParsedAsset(asset)
            )

            if (parsedAssets.length) {
                this.#state.setValue(
                    'sessionAssets',
                    AppController.#mergeSessionAssets(
                        this.#state.getSnapshot().sessionAssets,
                        parsedAssets
                    )
                )
            }

            this.#handleParsedDocuments(parseResult.documents, {
                adoptPreferredView: shouldAdoptPreferredView
            })
            shouldAdoptPreferredView = sessionWasEmpty
        } catch (error) {
            this.#handleParseError(AppController.#getErrorMessage(error))
        }
    }

    /**
     * Parses one selected source batch either directly or through the parser
     * worker.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {Promise<{ documents: object[], assets: object[], diagnostics: object[], project: object | null }>}
     */
    async #parseEntries(entries) {
        if (this.#worker) {
            const workerEntries = entries.map((entry) => ({
                name: entry.name,
                buffer: entry.buffer.slice(0)
            }))
            try {
                return await this.#parseEntriesWithWorker(workerEntries)
            } catch (error) {
                if (AppController.#isWorkerFailure(error)) {
                    this.#disposeWorker()
                    return this.#parseEntriesDirect(entries)
                }

                throw error
            }
        }

        return this.#parseEntriesDirect(entries)
    }

    /**
     * Parses one selected source batch without a worker.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {Promise<{ documents: object[], assets: object[], diagnostics: object[], project: object | null }>}
     */
    async #parseEntriesDirect(entries) {
        if (typeof this.#parser.parseEntries === 'function') {
            return AppController.#normalizeParseResult(
                await this.#parser.parseEntries(entries)
            )
        }

        return AppController.#normalizeParseResult({
            documents: entries.map((entry) =>
                this.#parser.parseArrayBuffer(entry.name, entry.buffer)
            )
        })
    }

    /**
     * Dispatches one parse request batch through the worker and resolves the
     * matching response by request id.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Source entries.
     * @returns {Promise<{ documents: object[], assets: object[], diagnostics: object[], project: object | null }>}
     */
    #parseEntriesWithWorker(entries) {
        return new Promise((resolve, reject) => {
            if (!this.#worker) {
                reject(new Error('Parser worker is unavailable.'))
                return
            }

            const requestId = 'parse-request-' + this.#workerRequestSequence++
            this.#pendingWorkerParses.set(requestId, { resolve, reject })
            this.#worker.postMessage(
                {
                    type: 'parse:entries',
                    requestId,
                    entries
                },
                entries.map((entry) => entry.buffer)
            )
        })
    }

    /**
     * Routes one worker payload to the matching pending parse request.
     * @param {{ type?: string, requestId?: string, documentModel?: object, documents?: object[], assets?: object[], diagnostics?: object[], project?: object, message?: string }} payload
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
            matchedRequest.resolve(AppController.#normalizeParseResult(payload))
            return
        }

        const error = new Error(payload.message || 'Parser worker failed.')
        if (AppController.#isRecoverableWorkerResponseError(error)) {
            error.workerFailure = true
        }
        matchedRequest.reject(error)
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
     * Applies parsed documents to state.
     * @param {object[]} documentModels Parsed documents.
     * @param {{ adoptPreferredView?: boolean }} [options]
     */
    #handleParsedDocuments(documentModels, options = {}) {
        const parsedDocuments = (documentModels || []).filter(Boolean)
        if (!parsedDocuments.length) {
            throw new Error('Parser did not return any documents.')
        }

        const snapshot = this.#state.getSnapshot()
        const preferredDocument = parsedDocuments.at(-1)
        const preferredView =
            preferredDocument.kind === 'schematic' ? 'schematic' : 'pcb'
        const appendedDocuments = parsedDocuments.map((documentModel) => ({
            id: this.#buildDocumentId(),
            documentModel
        }))
        const nextActiveView = options.adoptPreferredView
            ? preferredView
            : snapshot.activeView
        const nextDocuments = [...snapshot.documents, ...appendedDocuments]
        const preferredDocumentId = appendedDocuments.at(-1)?.id || ''
        const patch = {
            documents: nextDocuments,
            activeDocumentId: AppController.#resolveCompatibleDocumentId(
                nextDocuments,
                nextActiveView,
                preferredDocumentId
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
                'Drop native Altium or KiCad files, project folders, ZIPs, or companion model files to begin.',
            'status.loading': 'Parsing native ECAD files in the browser...',
            'status.loaded': 'File parsed successfully.',
            'status.invalidFile':
                'Please choose an Altium .SchDoc/.PcbDoc or KiCad .kicad_pro/.kicad_sch/.kicad_pcb/.zip project file.',
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
     * Returns true when a parser worker error likely came from transferring a
     * large parsed model back to the main thread, not from native parsing.
     * @param {Error} error
     * @returns {boolean}
     */
    static #isRecoverableWorkerResponseError(error) {
        return /maximum call stack size exceeded/i.test(error.message)
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
            format: EcadFormatRegistry.resolveCompanionFormat(fileName)
        }
    }

    /**
     * Normalizes one parser asset record for session state.
     * @param {{ name?: string, bytes?: Uint8Array, relativePath?: string, format?: string }} asset Parser asset.
     * @returns {{ name: string, relativePath: string, file: any, format: string }}
     */
    static #buildParsedAsset(asset) {
        const relativePath = String(asset?.relativePath || asset?.name || '')
        const name = String(asset?.name || relativePath.split('/').pop() || '')
        const bytes = asset?.bytes || new Uint8Array()
        const format =
            String(asset?.format || '') ||
            EcadFormatRegistry.resolveCompanionFormat(name)

        return {
            name,
            relativePath,
            file: typeof Blob === 'function' ? new Blob([bytes]) : bytes,
            format
        }
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
     * Builds one parser entry from a browser File.
     * @param {{ name?: string, webkitRelativePath?: string, arrayBuffer: () => Promise<ArrayBuffer> }} file Source file.
     * @returns {Promise<{ name: string, buffer: ArrayBuffer }>}
     */
    static async #buildParserEntry(file) {
        const fileName = String(file?.name || '')
        const relativePath =
            String(file?.webkitRelativePath || fileName) || fileName

        return {
            name: relativePath,
            buffer: await file.arrayBuffer()
        }
    }

    /**
     * Normalizes parser return shapes from direct and worker code paths.
     * @param {object} result Parser result.
     * @returns {{ documents: object[], assets: object[], diagnostics: object[], project: object | null }}
     */
    static #normalizeParseResult(result) {
        const documents = Array.isArray(result?.documents)
            ? result.documents
            : result?.documentModel
              ? [result.documentModel]
              : result?.kind || result?.pcb || result?.schematic
                ? [result]
                : []

        return {
            documents,
            assets: Array.isArray(result?.assets) ? result.assets : [],
            diagnostics: Array.isArray(result?.diagnostics)
                ? result.diagnostics
                : [],
            project: result?.project || null
        }
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
