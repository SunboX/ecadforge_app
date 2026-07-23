import { EcadFormatRegistry } from './core/ecad/EcadFormatRegistry.mjs'
import { EcadParserService } from './core/ecad/EcadParserService.mjs'
import { AppControllerDocumentSelection } from './AppControllerDocumentSelection.mjs'
import { AppControllerModelSearchPreferenceHandler } from './AppControllerModelSearchPreferenceHandler.mjs'
import { AppControllerMessages } from './AppControllerMessages.mjs'
import { DocumentPreferredViewResolver } from './DocumentPreferredViewResolver.mjs'
import { DemoProjectRegistry } from './DemoProjectRegistry.mjs'
import { AppControllerParserData } from './AppControllerParserData.mjs'
import { AppControllerLocalFileParserFiles } from './AppControllerLocalFileParserFiles.mjs'
import { AppControllerDeepLinkState } from './AppControllerDeepLinkState.mjs'
import { GitHubSourceLoader } from './GitHubSourceLoader.mjs'
import { GitHubSourceModelLinker } from './GitHubSourceModelLinker.mjs'
import { GitHubParsePlan } from './GitHubParsePlan.mjs'
import { AppControllerPcbStateHandlers } from './AppControllerPcbStateHandlers.mjs'
import { AppControllerSelectedPartExport } from './AppControllerSelectedPartExport.mjs'
import { AppControllerPcbAssemblyExport } from './AppControllerPcbAssemblyExport.mjs'
import { AppControllerSessionAssetHandler } from './AppControllerSessionAssetHandler.mjs'
import { AppControllerLifecycle } from './AppControllerLifecycle.mjs'
import { AppControllerWorkerRequests } from './AppControllerWorkerRequests.mjs'
import { SelectedPartExportService } from './core/SelectedPartExportService.mjs'
import { PcbAssemblyExportService } from './core/PcbAssemblyExportService.mjs'
import { PcbStylerLinkState } from './PcbStylerLinkState.mjs'
import { PrivacySafeAnalytics } from './PrivacySafeAnalytics.mjs'

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

    /** @type {Map<string, { resolve: (documentModel: object) => void, reject: (error: Error) => void, normalizing: boolean, abortController: AbortController }>} */
    #pendingWorkerParses
    /** @type {AppControllerLifecycle} */
    #lifecycle

    /** @type {(url: string) => Promise<Response>} */
    #fetcher

    /** @type {{ loadUrl: (url: string) => Promise<object>, loadGitHubPath?: (path: string, ref?: string) => Promise<object> }} */
    #githubSourceLoader

    /** @type {{ track: (eventName: string, properties?: object) => void }} */
    #analytics

    /** @type {{ export: (options: object) => Promise<{ archiveName: string, archiveBytes: Uint8Array }> }} */
    #selectedPartExportService

    /** @type {{ export: (options: object) => Promise<{ fileName: string, bytes: Uint8Array, contentType: string, diagnostics?: object[] }> }} */
    #pcbAssemblyExportService

    /** @type {{ resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null} */
    #modelSearchService

    /** @type {{ type: string, id?: string, url?: string, path?: string, ref?: string, view?: string, document?: string, component?: string, net?: string, panel?: string } | null} */
    #startupSource

    /**
     * @param {{
     * state: import('./core/AppState.mjs').AppState,
     * view: import('./ui/AppView.mjs').AppView,
     * i18n?: { getLocale: () => string, setLocale: (locale: string) => void, translate: (key: string) => string, applyToDom: (node: Document) => void } | null,
     * workerFactory?: (() => Worker) | null,
     * parser?: { parseArrayBuffer?: (fileName: string, buffer: ArrayBuffer) => object, parseEntries?: (entries: { name: string, buffer: ArrayBuffer }[]) => Promise<object> | object },
     * fetcher?: (url: string) => Promise<Response>,
     * githubSourceLoader?: { loadUrl: (url: string) => Promise<object>, loadGitHubPath?: (path: string, ref?: string) => Promise<object> },
     * analytics?: { track: (eventName: string, properties?: object) => void },
     * selectedPartExportService?: { export: (options: object) => Promise<{ archiveName: string, archiveBytes: Uint8Array }> },
     * pcbAssemblyExportService?: { export: (options: object) => Promise<{ fileName: string, bytes: Uint8Array, contentType: string, diagnostics?: object[] }> },
     * modelSearchService?: { resolveSessionAssets?: (documentModel: object, options: { enabled?: boolean, sessionAssets?: object[] }) => Promise<object[]> } | null,
     * startupSource?: { type: string, id?: string, url?: string, path?: string, ref?: string, view?: string, document?: string, component?: string, net?: string, panel?: string } | null
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
        this.#lifecycle = new AppControllerLifecycle()
        this.#fetcher =
            dependencies.fetcher ||
            (typeof globalThis.fetch === 'function'
                ? globalThis.fetch.bind(globalThis)
                : undefined)
        this.#githubSourceLoader =
            dependencies.githubSourceLoader ||
            new GitHubSourceLoader({ fetcher: this.#fetcher })
        this.#analytics =
            dependencies.analytics || PrivacySafeAnalytics.fromWindow()
        this.#selectedPartExportService =
            dependencies.selectedPartExportService ||
            new SelectedPartExportService()
        this.#pcbAssemblyExportService =
            dependencies.pcbAssemblyExportService ||
            new PcbAssemblyExportService()
        this.#modelSearchService = dependencies.modelSearchService || null
        this.#startupSource = dependencies.startupSource || null
    }

    /**
     * Initializes event wiring and first render.
     * @returns {Promise<void>}
     */
    async init() {
        this.#state.subscribe((snapshot, changedPaths) => {
            this.#view.render(snapshot, changedPaths)
        })

        this.#view.bindFileSelection((files) => this.#handleFiles(files))
        this.#view.bindDrop((files) => this.#handleFiles(files))
        this.#view.bindViewChange((viewName) => {
            const snapshot = this.#state.patch(
                AppControllerDocumentSelection.buildCompatibleViewPatch(
                    viewName,
                    this.#state.getSnapshot()
                )
            )
            this.#trackViewOpened(snapshot.activeView)
            AppControllerDeepLinkState.sync(snapshot)
        })
        this.#view.bindDocumentSelection?.((documentId) => {
            AppControllerDeepLinkState.sync(
                this.#state.patch(
                    AppControllerDocumentSelection.buildCompatibleDocumentPatch(
                        documentId,
                        this.#state.getSnapshot()
                    )
                )
            )
        })
        this.#view.bindSidebarTabSelection?.((tabName) => {
            AppControllerDeepLinkState.sync(
                this.#state.setValue('activeSidebarTab', tabName)
            )
        })
        this.#view.bindPcbLayerVisibilityChange?.((change) => {
            AppControllerPcbStateHandlers.handleLayerVisibility(
                this.#state,
                change
            )
        })
        this.#view.bindPcbObjectOpacityChange?.((change) => {
            AppControllerPcbStateHandlers.handleObjectOpacity(
                this.#state,
                change
            )
        })
        this.#view.bindPcbObjectVisibilityChange?.((change) => {
            AppControllerPcbStateHandlers.handleObjectVisibility(
                this.#state,
                change
            )
        })
        this.#view.bindPcbComponentSelectionChange?.((change) => {
            AppControllerPcbStateHandlers.handleComponentSelection(
                this.#state,
                change
            )
        })
        this.#view.bindPcbNetSelectionChange?.((change) => {
            AppControllerPcbStateHandlers.handleNetSelection(
                this.#state,
                change
            )
        })
        this.#view.bindPcbLayerPresetSelection?.((change) => {
            AppControllerPcbStateHandlers.handleLayerPreset(this.#state, change)
        })
        this.#view.bindSelectedPartExport?.((change) => {
            return AppControllerSelectedPartExport.handle({
                change,
                state: this.#state,
                view: this.#view,
                selectedPartExportService: this.#selectedPartExportService,
                modelSearchService: this.#modelSearchService
            })
        })
        this.#view.bindPcbAssemblyExport?.((change) => {
            return AppControllerPcbAssemblyExport.handle({
                change,
                state: this.#state,
                view: this.#view,
                pcbAssemblyExportService: this.#pcbAssemblyExportService,
                modelSearchService: this.#modelSearchService
            })
        })
        this.#view.bindModelSearchPreferenceChange?.((enabled) => {
            void AppControllerModelSearchPreferenceHandler.handle(
                enabled,
                this.#state,
                this.#modelSearchService
            )
        })
        this.#view.bindSessionAssetsResolved?.((change) => {
            AppControllerSessionAssetHandler.handle(change, this.#state)
        })
        this.#view.bindDemoSelection?.((demoId) => this.#loadDemo(demoId))
        this.#view.bindHomeNavigation?.(() => this.#handleHomeNavigation())
        this.#view.bindGitHubOpen?.((url) => this.#loadGitHubUrl(url))
        this.#view.bindLocalOpen?.(() => {
            this.#analytics.track('local_file_open_clicked', {
                sourceType: 'local'
            })
        })
        this.#view.bindPcbStylerClick?.(() => {
            this.#analytics.track('crosslink_pcb_styler_clicked', {
                sourceType: 'crosslink'
            })
        })

        if (this.#i18n && this.#view.hasLocaleSelect()) {
            const locale = this.#i18n.getLocale()
            this.#state.setValue('locale', locale)
            this.#i18n.applyToDom(document)

            this.#view.bindLocaleChange(async (nextLocale) => {
                await this.#i18n.setLocale(nextLocale)
                this.#state.setValue('locale', nextLocale)
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
        this.#analytics.track('landing_view')
        await this.#loadStartupSource()
    }

    /**
     * Handles native file selection.
     * @param {File[]} files
     * @returns {Promise<void>}
     */
    async #handleFiles(files) {
        const selectedFiles = Array.isArray(files) ? files : []
        if (!selectedFiles.length) return
        const lifecycleGeneration = this.#lifecycle.capture()
        if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return

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
                AppControllerParserData.mergeSessionAssets(
                    snapshot.sessionAssets,
                    companionFiles.map((file) =>
                        AppControllerParserData.buildCompanionAsset(file)
                    )
                )
            )
        }

        if (!nativeFiles.length) {
            if (!companionFiles.length) {
                this.#handleParseError(this.#translate('status.invalidFile'))
                this.#analytics.track('local_file_loaded_error', {
                    sourceType: 'local',
                    errorBucket: 'unsupported_file'
                })
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
            const parserFiles = AppControllerLocalFileParserFiles.resolve(
                nativeFiles,
                companionFiles
            )
            const entries = await Promise.all(
                parserFiles.map((file) =>
                    AppControllerParserData.buildParserEntry(file)
                )
            )
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            const parseResult = await this.#parseEntries(entries)
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            const snapshotAfterLoad = this.#applyParseResult(parseResult, {
                adoptPreferredView: shouldAdoptPreferredView,
                statusMessage: this.#translate('status.loaded')
            })
            shouldAdoptPreferredView = sessionWasEmpty
            this.#analytics.track('local_file_loaded_success', {
                sourceType: 'local',
                formatFamily:
                    AppControllerParserData.resolveFormatFamily(entries)
            })
            this.#trackViewOpened(snapshotAfterLoad.activeView)
            AppControllerDeepLinkState.sync(snapshotAfterLoad)
            PcbStylerLinkState.updateView(this.#view, '', 'local')
        } catch (error) {
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            this.#handleParseError(AppControllerMessages.getErrorMessage(error))
            this.#analytics.track('local_file_loaded_error', {
                sourceType: 'local',
                errorBucket: 'parse'
            })
        }
    }

    /**
     * Loads a bundled demo project by id.
     * @param {string} demoId Demo id.
     * @param {{ preferredView?: string, preferredDocument?: string }} [options] Startup load hints.
     * @returns {Promise<void>}
     */
    async #loadDemo(demoId, options = {}) {
        const lifecycleGeneration = this.#lifecycle.capture()
        if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
        const demo = DemoProjectRegistry.get(demoId)
        if (!demo) {
            this.#handleParseError(this.#translate('status.unknownSample'))
            return
        }

        this.#analytics.track('sample_' + demo.id + '_clicked', {
            sourceType: 'sample',
            formatFamily: demo.formatFamily
        })
        this.#state.patch({
            parseStatus: 'loading',
            statusMessage: this.#translate('status.loadingSample')
        })

        try {
            const entries = await Promise.all(
                demo.files.map((file) =>
                    this.#fetchParserEntry(file.path, file.name)
                )
            )
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            const parseResult = await this.#parseEntries(entries)
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            const snapshotAfterLoad = this.#applyParseResult(parseResult, {
                adoptPreferredView: true,
                preferredDocument: String(options.preferredDocument || ''),
                preferredView: String(options.preferredView || ''),
                statusMessage: this.#translate('status.loadedSample')
            })
            this.#analytics.track('sample_loaded_success', {
                sourceType: 'sample',
                formatFamily: demo.formatFamily
            })
            this.#trackViewOpened(snapshotAfterLoad.activeView)
            AppControllerDeepLinkState.syncDemoShareUrl(
                demo.id,
                snapshotAfterLoad
            )
            PcbStylerLinkState.updateView(this.#view, '', 'local')
        } catch (error) {
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            this.#handleParseError(AppControllerMessages.getErrorMessage(error))
            this.#analytics.track('sample_loaded_error', {
                sourceType: 'sample',
                formatFamily: demo.formatFamily,
                errorBucket: 'parse'
            })
        }
    }

    /**
     * Loads a GitHub URL source.
     * @param {string} url Raw or GitHub blob URL.
     * @returns {Promise<void>}
     */
    async #loadGitHubUrl(url, options = {}) {
        await this.#loadGitHubSource(
            async () =>
                Object.assign(
                    await this.#githubSourceLoader.loadUrl(url, options),
                    {
                        shareUrl: url
                    }
                ),
            options
        )
    }

    /**
     * Loads a GitHub path source.
     * @param {string} githubPath Query path.
     * @param {string} ref Optional git ref.
     * @returns {Promise<void>}
     */
    async #loadGitHubPath(githubPath, ref, options = {}) {
        await this.#loadGitHubSource(
            () =>
                typeof this.#githubSourceLoader.loadGitHubPath === 'function'
                    ? this.#githubSourceLoader.loadGitHubPath(
                          githubPath,
                          ref,
                          options
                      )
                    : new GitHubSourceLoader({
                          fetcher: this.#fetcher
                      }).loadGitHubPath(githubPath, ref, options),
            options
        )
    }

    /**
     * Loads and parses one GitHub source descriptor.
     * @param {() => Promise<object>} loadSource Source loader.
     * @param {{ preferredDocument?: string, preferredView?: string }} [options] Load options.
     * @returns {Promise<void>}
     */
    async #loadGitHubSource(loadSource, options = {}) {
        const lifecycleGeneration = this.#lifecycle.capture()
        if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
        this.#analytics.track('github_url_open_attempted', {
            sourceType: 'github'
        })
        this.#state.patch({
            parseStatus: 'loading',
            statusMessage: this.#translate('status.loadingGithub')
        })

        try {
            const source = await loadSource()
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            const parsePlan = GitHubParsePlan.build(
                source.entries || [],
                String(options.preferredDocument || '')
            )
            const parseResult = await this.#parseEntries(
                parsePlan.initialEntries
            )
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            GitHubSourceModelLinker.apply(parseResult, source)
            const snapshotAfterLoad = this.#applyParseResult(parseResult, {
                adoptPreferredView: true,
                preferredDocument: String(options.preferredDocument || ''),
                preferredView: String(options.preferredView || ''),
                statusMessage: this.#translate('status.loadedGithub')
            })

            this.#analytics.track('github_url_loaded_success', {
                sourceType: 'github',
                formatFamily: source.formatFamily
            })
            this.#trackViewOpened(snapshotAfterLoad.activeView)
            PcbStylerLinkState.updateView(
                this.#view,
                String(source.boardUrl || ''),
                'github'
            )
            AppControllerDeepLinkState.syncGitHubShareUrl(
                String(source.shareUrl || ''),
                snapshotAfterLoad
            )
            const deferredEntries =
                source.deferredSource ||
                (parsePlan.prioritized ? parsePlan.deferredEntries : null)
            if (deferredEntries) {
                this.#scheduleDeferredGitHubEntries(source, deferredEntries)
            }
        } catch (error) {
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            this.#handleParseError(AppControllerMessages.getErrorMessage(error))
            this.#analytics.track('github_url_loaded_error', {
                sourceType: 'github',
                errorBucket: AppControllerMessages.resolveErrorBucket(error)
            })
        }
    }

    /**
     * Schedules non-critical GitHub project parsing after first paint.
     * @param {object} source GitHub source descriptor.
     * @param {{ name: string, buffer: ArrayBuffer }[] | Promise<object>} entries Deferred entries.
     * @returns {void}
     */
    #scheduleDeferredGitHubEntries(source, entries) {
        if (!entries?.length && typeof entries?.then !== 'function') return
        const runDeferredParse = async () => {
            const deferred = await Promise.resolve(entries)
            const batch = Array.isArray(deferred) ? deferred : deferred.entries
            await this.#loadDeferredGitHubEntries(
                Array.isArray(deferred) ? source : { ...source, ...deferred },
                batch
            )
        }
        if (typeof globalThis.requestIdleCallback === 'function') {
            globalThis.requestIdleCallback(runDeferredParse, { timeout: 2000 })
            return
        }
        globalThis.setTimeout?.(runDeferredParse, 250)
    }

    /**
     * Parses non-critical GitHub project entries after the requested document
     * has painted.
     * @param {object} source GitHub source descriptor.
     * @param {{ name: string, buffer: ArrayBuffer }[]} entries Deferred entries.
     * @returns {Promise<void>}
     */
    async #loadDeferredGitHubEntries(source, entries) {
        const lifecycleGeneration = this.#lifecycle.capture()
        if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
        try {
            const parseResult = await this.#parseEntries(entries)
            if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
            GitHubSourceModelLinker.apply(parseResult, source, {
                includeAssets: source.includeDeferredAssets === true
            })
            const filteredResult = GitHubParsePlan.filterNewDocuments(
                parseResult,
                this.#state.getSnapshot().documents
            )
            const hasNewContent =
                filteredResult.documents.length || filteredResult.assets.length
            if (!hasNewContent) return
            this.#applyParseResult(filteredResult, {
                allowEmptyDocuments: true,
                preserveActiveDocument: true,
                statusMessage: this.#translate('status.loadedGithub')
            })
        } catch (_error) {
            // A deferred project document should not replace the already
            // rendered deep-linked document with an error state.
        }
    }

    /**
     * Returns the current app session to the landing page view.
     * @returns {void}
     */
    #handleHomeNavigation() {
        this.#state.patch({
            activeView: 'schematic',
            activeSidebarTab: 'project',
            parseStatus: 'idle',
            statusMessage: this.#translate('status.ready'),
            documents: [],
            activeDocumentId: '',
            hiddenPcbLayers: {},
            hiddenPcbObjects: {},
            pcbObjectOpacities: {},
            selectedPcbComponents: {},
            selectedNets: {},
            sessionAssets: []
        })
        this.#view.clearPcbStylerLink?.()
        this.#analytics.track('landing_view')
    }

    /**
     * Loads the configured startup source, if any.
     * @returns {Promise<void>}
     */
    async #loadStartupSource() {
        const lifecycleGeneration = this.#lifecycle.capture()
        if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return
        const startupSource = this.#startupSource
        if (!startupSource) return

        const startupLoadOptions = {
            preferredDocument: String(startupSource.document || ''),
            preferredView: String(startupSource.view || '')
        }
        let loadedStartupSource = false

        if (startupSource.type === 'demo') {
            await this.#loadDemo(
                String(startupSource.id || ''),
                startupLoadOptions
            )
            loadedStartupSource = true
        }

        if (startupSource.type === 'url') {
            await this.#loadGitHubUrl(String(startupSource.url || ''), {
                ...startupLoadOptions
            })
            loadedStartupSource = true
        }

        if (startupSource.type === 'github') {
            await this.#loadGitHubPath(
                String(startupSource.path || ''),
                String(startupSource.ref || 'main'),
                startupLoadOptions
            )
            loadedStartupSource = true
        }
        if (!this.#lifecycle.isCurrent(lifecycleGeneration)) return

        if (!loadedStartupSource && startupSource.view) {
            const patch =
                AppControllerDocumentSelection.buildCompatibleViewPatch(
                    String(startupSource.view),
                    this.#state.getSnapshot()
                )
            this.#state.patch(patch)
        }

        const startupDocument = String(startupSource.document || '')
        const startupComponent = String(startupSource.component || '')
        const startupNet = String(startupSource.net || '')
        const startupPanel = String(startupSource.panel || '')
        if (!loadedStartupSource) {
            AppControllerDeepLinkState.restoreDocument(
                this.#state,
                startupDocument
            )
        }
        AppControllerDeepLinkState.restoreComponent(
            this.#state,
            startupComponent
        )
        AppControllerDeepLinkState.restoreNet(this.#state, startupNet)
        AppControllerDeepLinkState.restorePanel(this.#state, startupPanel)
        AppControllerDeepLinkState.sync(this.#state.getSnapshot())
    }

    /**
     * Fetches one static demo file as a parser entry.
     * @param {string} url File URL.
     * @param {string} fileName Parser file name.
     * @returns {Promise<{ name: string, buffer: ArrayBuffer }>}
     */
    async #fetchParserEntry(url, fileName) {
        if (typeof this.#fetcher !== 'function') {
            throw new Error(this.#translate('status.browserFetchUnavailable'))
        }

        const response = await this.#fetcher(url)
        if (!response?.ok) {
            throw new Error(
                this.#translate('status.sampleLoadHttp') +
                    ' ' +
                    String(response?.status || 0)
            )
        }

        return {
            name: fileName,
            buffer: await response.arrayBuffer()
        }
    }

    /**
     * Applies parser assets and documents to state.
     * @param {{ documents: object[], assets: object[] }} parseResult Parse result.
     * @param {{ adoptPreferredView?: boolean, allowEmptyDocuments?: boolean, preserveActiveDocument?: boolean, preferredDocument?: string, preferredView?: string, statusMessage?: string }} options
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }}
     */
    #applyParseResult(parseResult, options = {}) {
        const parsedAssets = parseResult.assets.map((asset) =>
            AppControllerParserData.buildParsedAsset(asset)
        )
        if (parsedAssets.length) {
            this.#state.setValue(
                'sessionAssets',
                AppControllerParserData.mergeSessionAssets(
                    this.#state.getSnapshot().sessionAssets,
                    parsedAssets
                )
            )
        }

        if (!parseResult.documents.length && options.allowEmptyDocuments) {
            return this.#state.getSnapshot()
        }

        return this.#handleParsedDocuments(parseResult.documents, options)
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
                if (AppControllerWorkerRequests.isFailure(error)) {
                    this.#worker = AppControllerWorkerRequests.terminate(
                        this.#worker
                    )
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
            return AppControllerParserData.normalizeParseResult(
                await this.#parser.parseEntries(entries)
            )
        }

        return AppControllerParserData.normalizeParseResult({
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
            this.#pendingWorkerParses.set(requestId, {
                resolve,
                reject,
                normalizing: false,
                abortController: new AbortController()
            })
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
        const matched = AppControllerWorkerRequests.match(
            this.#pendingWorkerParses,
            String(payload.requestId || '')
        )
        if (!matched) return
        const { requestId, request } = matched
        if (request.normalizing) return

        if (payload.type === 'parser:success') {
            request.normalizing = true
            void AppControllerParserData.normalizeStructuredCloneParseResultAsync(
                payload,
                { signal: request.abortController.signal }
            ).then(
                (result) =>
                    AppControllerWorkerRequests.settle(
                        this.#pendingWorkerParses,
                        requestId,
                        request,
                        'resolve',
                        result
                    ),
                (error) =>
                    AppControllerWorkerRequests.settle(
                        this.#pendingWorkerParses,
                        requestId,
                        request,
                        'reject',
                        error
                    )
            )
            return
        }

        const error = new Error(payload.message || 'Parser worker failed.')
        if (AppControllerWorkerRequests.isRecoverableResponseError(error)) {
            error.workerFailure = true
        }
        AppControllerWorkerRequests.settle(
            this.#pendingWorkerParses,
            requestId,
            request,
            'reject',
            error
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
        AppControllerWorkerRequests.rejectAll(this.#pendingWorkerParses, error)
        this.#worker = AppControllerWorkerRequests.terminate(this.#worker)
    }

    /**
     * Applies parsed documents to state.
     * @param {object[]} documentModels Parsed documents.
     * @param {{ adoptPreferredView?: boolean, preserveActiveDocument?: boolean, preferredDocument?: string, preferredView?: string, statusMessage?: string }} [options]
     * @returns {{ activeView: string, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string }[], activeFileName: string, documentModel: object | null }}
     */
    #handleParsedDocuments(documentModels, options = {}) {
        const parsedDocuments = (documentModels || []).filter(Boolean)
        if (!parsedDocuments.length) {
            throw new Error(this.#translate('status.noDocuments'))
        }

        const snapshot = this.#state.getSnapshot()
        const preferredDocument = parsedDocuments.at(-1)
        const preferredView =
            DocumentPreferredViewResolver.resolve(preferredDocument)
        const appendedDocuments = parsedDocuments.map((documentModel) => ({
            id: this.#buildDocumentId(),
            documentModel
        }))
        const nextActiveView =
            options.adoptPreferredView && options.preferredView
                ? String(options.preferredView)
                : options.adoptPreferredView
                  ? preferredView
                  : snapshot.activeView
        const nextDocuments = [...snapshot.documents, ...appendedDocuments]
        const preferredDocumentId = options.preserveActiveDocument
            ? snapshot.activeDocumentId
            : AppControllerDocumentSelection.resolveLoadedDocumentId(
                  appendedDocuments,
                  nextActiveView,
                  options
              )
        const patch = {
            documents: nextDocuments,
            activeDocumentId: AppControllerDocumentSelection.resolveDocumentId(
                nextDocuments,
                nextActiveView,
                preferredDocumentId
            ),
            parseStatus: 'ready',
            statusMessage:
                options.statusMessage || this.#translate('status.loaded')
        }

        if (options.adoptPreferredView) {
            patch.activeView = nextActiveView
        }

        return this.#state.patch(patch)
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
     * Emits the active view analytics event.
     * @param {string} viewName Active view.
     * @returns {void}
     */
    #trackViewOpened(viewName) {
        const normalizedView = String(viewName || '')
        if (!normalizedView) {
            return
        }

        this.#analytics.track('view_' + normalizedView + '_opened', {
            activeView: normalizedView
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
        this.#lifecycle.dispose()
        AppControllerWorkerRequests.rejectAll(
            this.#pendingWorkerParses,
            new Error('Parser worker terminated.')
        )
        this.#worker = AppControllerWorkerRequests.terminate(this.#worker)
    }

    /**
     * Builds one stable in-session document id.
     * @returns {string}
     */
    #buildDocumentId() {
        return 'session-document-' + this.#documentSequence++
    }

    /**
     * Translates a key via i18n if available.
     * @param {string} key
     * @returns {string}
     */
    #translate(key) {
        if (!this.#i18n) return AppControllerMessages.fallback(key)
        return this.#i18n.translate(key)
    }
}
