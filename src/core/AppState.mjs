import { PcbObjectVisibilityModel } from './PcbObjectVisibilityModel.mjs'
import { EcadDocumentType } from './ecad/EcadDocumentType.mjs'

/**
 * Viewer state container with subscription support.
 */
export class AppState {
    /** @type {{ activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[] }} */
    #state

    /** @type {Set<(snapshot: { activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[], activeFileName: string, documentModel: object | null }, changedPaths: PropertyKey[][] | null) => void>} */
    #listeners

    /**
     * @param {{ activeView?: string, activeSidebarTab?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, hiddenPcbObjects?: { [documentId: string]: string[] }, pcbObjectOpacities?: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents?: { [documentId: string]: string }, selectedNets?: { [documentId: string]: string }, autoSearchMissingModels?: boolean, locale?: string, parseStatus?: string, statusMessage?: string, documents?: { id: string, documentModel: object }[], activeDocumentId?: string, sessionAssets?: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[] }} [initial]
     */
    constructor(initial = {}) {
        this.#state = {
            activeView: AppState.#sanitizeView(initial.activeView),
            activeSidebarTab: AppState.#sanitizeSidebarTab(
                initial.activeSidebarTab
            ),
            hiddenPcbLayers: AppState.#sanitizeHiddenPcbLayers(
                initial.hiddenPcbLayers
            ),
            hiddenPcbObjects: AppState.#sanitizeHiddenPcbObjects(
                initial.hiddenPcbObjects
            ),
            pcbObjectOpacities: AppState.#sanitizePcbObjectOpacities(
                initial.pcbObjectOpacities
            ),
            selectedPcbComponents: AppState.#sanitizeSelectedPcbComponents(
                initial.selectedPcbComponents
            ),
            selectedNets: AppState.#sanitizeSelectedNets(initial.selectedNets),
            autoSearchMissingModels: AppState.#sanitizeBoolean(
                initial.autoSearchMissingModels
            ),
            locale: String(initial.locale || 'en'),
            parseStatus: AppState.#sanitizeStatus(initial.parseStatus),
            statusMessage: String(initial.statusMessage || ''),
            documents: AppState.#sanitizeDocuments(initial.documents),
            activeDocumentId: String(initial.activeDocumentId || ''),
            sessionAssets: AppState.#sanitizeSessionAssets(
                initial.sessionAssets
            )
        }
        this.#normalizeDocumentSelection()
        this.#listeners = new Set()
    }

    /**
     * Returns a readonly snapshot.
     * @returns {{ activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[], activeFileName: string, documentModel: object | null }}
     */
    getSnapshot() {
        const activeEntry = AppState.#findActiveDocumentEntry(
            this.#state.documents,
            this.#state.activeDocumentId
        )

        return Object.freeze({
            ...this.#state,
            hiddenPcbLayers: AppState.#cloneHiddenPcbLayers(
                this.#state.hiddenPcbLayers
            ),
            hiddenPcbObjects: AppState.#cloneHiddenPcbObjects(
                this.#state.hiddenPcbObjects
            ),
            pcbObjectOpacities: AppState.#clonePcbObjectOpacities(
                this.#state.pcbObjectOpacities
            ),
            selectedPcbComponents: AppState.#cloneSelectedPcbComponents(
                this.#state.selectedPcbComponents
            ),
            selectedNets: AppState.#cloneSelectedNets(this.#state.selectedNets),
            documents: this.#state.documents.map((entry) => ({ ...entry })),
            sessionAssets: this.#state.sessionAssets.map((asset) => ({
                ...asset,
                ...(Array.isArray(asset.aliases)
                    ? { aliases: [...asset.aliases] }
                    : {})
            })),
            activeFileName: EcadDocumentType.fileName(
                activeEntry?.documentModel
            ),
            documentModel: activeEntry?.documentModel || null
        })
    }

    /**
     * Sets one state field and notifies listeners.
     * @param {'activeView' | 'activeSidebarTab' | 'hiddenPcbLayers' | 'hiddenPcbObjects' | 'pcbObjectOpacities' | 'selectedPcbComponents' | 'selectedNets' | 'autoSearchMissingModels' | 'locale' | 'parseStatus' | 'statusMessage' | 'documents' | 'activeDocumentId' | 'sessionAssets'} key
     * @param {string | boolean | object[] | null} value
     * @returns {{ activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[], activeFileName: string, documentModel: object | null }}
     */
    setValue(key, value) {
        this.#applyValue(key, value)
        this.#normalizeDocumentSelection()

        return this.#emit(AppState.#changedPathsFor([key]))
    }

    /**
     * Applies multiple state fields.
     * @param {{ activeView?: string, activeSidebarTab?: string, hiddenPcbLayers?: { [documentId: string]: string[] }, hiddenPcbObjects?: { [documentId: string]: string[] }, pcbObjectOpacities?: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents?: { [documentId: string]: string }, selectedNets?: { [documentId: string]: string }, autoSearchMissingModels?: boolean, locale?: string, parseStatus?: string, statusMessage?: string, documents?: { id: string, documentModel: object }[], activeDocumentId?: string, sessionAssets?: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[] }} patch
     * @returns {{ activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[], activeFileName: string, documentModel: object | null }}
     */
    patch(patch) {
        const keys = Object.keys(patch)
        for (const key of keys) {
            this.#applyValue(key, patch[key])
        }
        this.#normalizeDocumentSelection()

        return this.#emit(AppState.#changedPathsFor(keys))
    }

    /**
     * Subscribes to state changes.
     * @param {(snapshot: { activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[], activeFileName: string, documentModel: object | null }, changedPaths: PropertyKey[][] | null) => void} callback
     * @returns {() => void}
     */
    subscribe(callback) {
        if (typeof callback !== 'function') {
            return () => {}
        }

        this.#listeners.add(callback)
        callback(this.getSnapshot(), null)

        return () => {
            this.#listeners.delete(callback)
        }
    }

    /**
     * Emits a fresh state snapshot and changed modifiable roots to listeners.
     * @param {PropertyKey[][]} changedPaths Changed snapshot paths.
     * @returns {{ activeView: string, activeSidebarTab: string, hiddenPcbLayers: { [documentId: string]: string[] }, hiddenPcbObjects: { [documentId: string]: string[] }, pcbObjectOpacities: { [documentId: string]: { [objectKey: string]: number } }, selectedPcbComponents: { [documentId: string]: string }, selectedNets: { [documentId: string]: string }, autoSearchMissingModels: boolean, locale: string, parseStatus: string, statusMessage: string, documents: { id: string, documentModel: object }[], activeDocumentId: string, sessionAssets: { name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[], activeFileName: string, documentModel: object | null }}
     */
    #emit(changedPaths) {
        const snapshot = this.getSnapshot()
        this.#listeners.forEach((listener) => listener(snapshot, changedPaths))
        return snapshot
    }

    /**
     * Expands mutator keys with roots derived or normalized from them.
     * @param {string[]} keys Mutated state keys.
     * @returns {PropertyKey[][]} Conservative changed snapshot paths.
     */
    static #changedPathsFor(keys) {
        const roots = new Set(keys.map(String))
        if (roots.has('documents')) {
            roots.add('hiddenPcbLayers')
            roots.add('hiddenPcbObjects')
            roots.add('pcbObjectOpacities')
            roots.add('selectedPcbComponents')
            roots.add('selectedNets')
            roots.add('activeDocumentId')
        }
        if (roots.has('documents') || roots.has('activeDocumentId')) {
            roots.add('activeFileName')
            roots.add('documentModel')
        }
        return [...roots].map((root) => [root])
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

        if (key === 'activeSidebarTab') {
            this.#state.activeSidebarTab = AppState.#sanitizeSidebarTab(value)
        }

        if (key === 'hiddenPcbLayers') {
            this.#state.hiddenPcbLayers =
                AppState.#sanitizeHiddenPcbLayers(value)
        }

        if (key === 'hiddenPcbObjects') {
            this.#state.hiddenPcbObjects =
                AppState.#sanitizeHiddenPcbObjects(value)
        }

        if (key === 'pcbObjectOpacities') {
            this.#state.pcbObjectOpacities =
                AppState.#sanitizePcbObjectOpacities(value)
        }

        if (key === 'selectedPcbComponents') {
            this.#state.selectedPcbComponents =
                AppState.#sanitizeSelectedPcbComponents(value)
        }

        if (key === 'selectedNets') {
            this.#state.selectedNets = AppState.#sanitizeSelectedNets(value)
        }

        if (key === 'autoSearchMissingModels') {
            this.#state.autoSearchMissingModels =
                AppState.#sanitizeBoolean(value)
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
            this.#state.hiddenPcbLayers = AppState.#filterHiddenPcbLayers(
                this.#state.hiddenPcbLayers,
                this.#state.documents
            )
            this.#state.hiddenPcbObjects = AppState.#filterHiddenPcbObjects(
                this.#state.hiddenPcbObjects,
                this.#state.documents
            )
            this.#state.pcbObjectOpacities = AppState.#filterPcbObjectOpacities(
                this.#state.pcbObjectOpacities,
                this.#state.documents
            )
            this.#state.selectedPcbComponents =
                AppState.#filterSelectedPcbComponents(
                    this.#state.selectedPcbComponents,
                    this.#state.documents
                )
            this.#state.selectedNets = AppState.#filterSelectedNets(
                this.#state.selectedNets,
                this.#state.documents
            )
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
     * Returns a supported sidebar tab id.
     * @param {any} value
     * @returns {string}
     */
    static #sanitizeSidebarTab(value) {
        const supported = new Set([
            'project',
            'layers',
            'objects',
            'components',
            'nets',
            'properties',
            'model3d',
            'info',
            'preferences',
            'help'
        ])
        const normalized = String(value || 'project')
        return supported.has(normalized) ? normalized : 'project'
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
     * Normalizes checkbox-style state.
     * @param {unknown} value Raw value.
     * @returns {boolean}
     */
    static #sanitizeBoolean(value) {
        return value === true
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
     * @returns {{ name: string, relativePath: string, file: any, format: string, source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }[]}
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
                format: entry.format,
                ...AppState.#optionalSessionAssetFields(entry)
            }))
    }

    /**
     * Preserves optional model asset metadata used by downstream renderers.
     * @param {object} entry Session asset entry.
     * @returns {{ source?: string, sourceUrl?: string, componentKey?: string, aliases?: string[], documentScope?: object }}
     */
    static #optionalSessionAssetFields(entry) {
        const fields = Object.fromEntries(
            ['source', 'sourceUrl', 'componentKey']
                .map((key) => [key, String(entry?.[key] || '').trim()])
                .filter(([_key, value]) => value)
        )
        const aliases = AppState.#sessionAssetAliases(entry?.aliases)
        if (aliases.length) fields.aliases = aliases

        const documentScope = entry?.documentScope
        if (documentScope && typeof documentScope === 'object') {
            fields.documentScope = documentScope
        }
        return fields
    }

    /**
     * Copies a dense ordinary list of exact session asset aliases.
     * @param {unknown} value Alias list candidate.
     * @returns {string[]}
     */
    static #sessionAssetAliases(value) {
        let descriptors
        let prototype
        try {
            if (!Array.isArray(value)) return []
            descriptors = Object.getOwnPropertyDescriptors(value)
            prototype = Object.getPrototypeOf(value)
        } catch {
            return []
        }
        const length = descriptors.length?.value
        if (
            prototype !== Array.prototype ||
            !Number.isSafeInteger(length) ||
            length < 0
        ) {
            return []
        }

        const aliases = []
        for (let index = 0; index < length; index += 1) {
            const descriptor = descriptors[String(index)]
            if (!descriptor || !Object.hasOwn(descriptor, 'value')) return []
            if (typeof descriptor.value !== 'string') continue
            const alias = descriptor.value.trim()
            if (alias && !aliases.includes(alias)) aliases.push(alias)
        }
        return aliases
    }

    /**
     * Normalizes hidden PCB layer map entries.
     * @param {unknown} value Raw hidden-layer map.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #sanitizeHiddenPcbLayers(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {}
        }

        return Object.fromEntries(
            Object.entries(value)
                .map(([documentId, layerKeys]) => [
                    String(documentId || ''),
                    Array.isArray(layerKeys)
                        ? [...new Set(layerKeys.map(String).filter(Boolean))]
                        : []
                ])
                .filter(([documentId, layerKeys]) =>
                    Boolean(documentId && layerKeys.length)
                )
        )
    }

    /**
     * Normalizes hidden PCB object map entries.
     * @param {unknown} value Raw hidden-object map.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #sanitizeHiddenPcbObjects(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {}
        }

        return Object.fromEntries(
            Object.entries(value)
                .map(([documentId, objectKeys]) => [
                    String(documentId || ''),
                    Array.isArray(objectKeys)
                        ? [...new Set(objectKeys.map(String).filter(Boolean))]
                        : []
                ])
                .filter(([documentId, objectKeys]) =>
                    Boolean(documentId && objectKeys.length)
                )
        )
    }

    /**
     * Normalizes PCB object opacity map entries.
     * @param {unknown} value Raw opacity map.
     * @returns {{ [documentId: string]: { [objectKey: string]: number } }}
     */
    static #sanitizePcbObjectOpacities(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {}
        }

        return Object.fromEntries(
            Object.entries(value)
                .map(([documentId, objectOpacities]) => [
                    String(documentId || ''),
                    AppState.#sanitizePcbObjectOpacityValues(objectOpacities)
                ])
                .filter(([documentId, objectOpacities]) =>
                    Boolean(documentId && Object.keys(objectOpacities).length)
                )
        )
    }

    /**
     * Normalizes one document's PCB object opacity values.
     * @param {unknown} objectOpacities Raw object opacity values.
     * @returns {{ [objectKey: string]: number }}
     */
    static #sanitizePcbObjectOpacityValues(objectOpacities) {
        if (
            !objectOpacities ||
            typeof objectOpacities !== 'object' ||
            Array.isArray(objectOpacities)
        ) {
            return {}
        }

        return Object.fromEntries(
            Object.entries(objectOpacities)
                .map(([objectKey, opacity]) => [
                    String(objectKey || ''),
                    PcbObjectVisibilityModel.normalizeOpacityPercent(
                        opacity,
                        100
                    )
                ])
                .filter(([objectKey]) => Boolean(objectKey))
        )
    }

    /**
     * Normalizes selected PCB component map entries.
     * @param {unknown} value Raw selected-component map.
     * @returns {{ [documentId: string]: string }}
     */
    static #sanitizeSelectedPcbComponents(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {}
        }

        return Object.fromEntries(
            Object.entries(value)
                .map(([documentId, componentKey]) => [
                    String(documentId || ''),
                    String(componentKey || '').trim()
                ])
                .filter(([documentId, componentKey]) =>
                    Boolean(documentId && componentKey)
                )
        )
    }

    /**
     * Normalizes selected net map entries.
     * @param {unknown} value Raw selected-net map.
     * @returns {{ [documentId: string]: string }}
     */
    static #sanitizeSelectedNets(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {}
        }

        return Object.fromEntries(
            Object.entries(value)
                .map(([documentId, netName]) => [
                    String(documentId || ''),
                    String(netName || '').trim()
                ])
                .filter(([documentId, netName]) =>
                    Boolean(documentId && netName)
                )
        )
    }

    /**
     * Clones hidden PCB layer state for snapshots.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #cloneHiddenPcbLayers(hiddenPcbLayers) {
        return Object.fromEntries(
            Object.entries(hiddenPcbLayers || {}).map(([documentId, keys]) => [
                documentId,
                [...keys]
            ])
        )
    }

    /**
     * Clones hidden PCB object state for snapshots.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Hidden object map.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #cloneHiddenPcbObjects(hiddenPcbObjects) {
        return Object.fromEntries(
            Object.entries(hiddenPcbObjects || {}).map(([documentId, keys]) => [
                documentId,
                [...keys]
            ])
        )
    }

    /**
     * Clones PCB object opacity state for snapshots.
     * @param {{ [documentId: string]: { [objectKey: string]: number } }} pcbObjectOpacities Opacity map.
     * @returns {{ [documentId: string]: { [objectKey: string]: number } }}
     */
    static #clonePcbObjectOpacities(pcbObjectOpacities) {
        return PcbObjectVisibilityModel.cloneOpacityMap(pcbObjectOpacities)
    }

    /**
     * Clones selected PCB component state for snapshots.
     * @param {{ [documentId: string]: string }} selectedPcbComponents Selected component map.
     * @returns {{ [documentId: string]: string }}
     */
    static #cloneSelectedPcbComponents(selectedPcbComponents) {
        return { ...(selectedPcbComponents || {}) }
    }

    /**
     * Clones selected net state for snapshots.
     * @param {{ [documentId: string]: string }} selectedNets Selected net map.
     * @returns {{ [documentId: string]: string }}
     */
    static #cloneSelectedNets(selectedNets) {
        return { ...(selectedNets || {}) }
    }

    /**
     * Drops hidden-layer state for documents that are no longer open.
     * @param {{ [documentId: string]: string[] }} hiddenPcbLayers Hidden layer map.
     * @param {{ id: string, documentModel: object }[]} documents Open documents.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #filterHiddenPcbLayers(hiddenPcbLayers, documents) {
        const availableIds = new Set(documents.map((entry) => entry.id))
        return Object.fromEntries(
            Object.entries(hiddenPcbLayers || {}).filter(([documentId]) =>
                availableIds.has(documentId)
            )
        )
    }

    /**
     * Drops hidden-object state for documents that are no longer open.
     * @param {{ [documentId: string]: string[] }} hiddenPcbObjects Hidden object map.
     * @param {{ id: string, documentModel: object }[]} documents Open documents.
     * @returns {{ [documentId: string]: string[] }}
     */
    static #filterHiddenPcbObjects(hiddenPcbObjects, documents) {
        const availableIds = new Set(documents.map((entry) => entry.id))
        return Object.fromEntries(
            Object.entries(hiddenPcbObjects || {}).filter(([documentId]) =>
                availableIds.has(documentId)
            )
        )
    }

    /**
     * Drops opacity state for documents that are no longer open.
     * @param {{ [documentId: string]: { [objectKey: string]: number } }} pcbObjectOpacities Opacity map.
     * @param {{ id: string, documentModel: object }[]} documents Open documents.
     * @returns {{ [documentId: string]: { [objectKey: string]: number } }}
     */
    static #filterPcbObjectOpacities(pcbObjectOpacities, documents) {
        const availableIds = new Set(documents.map((entry) => entry.id))
        return Object.fromEntries(
            Object.entries(pcbObjectOpacities || {}).filter(([documentId]) =>
                availableIds.has(documentId)
            )
        )
    }

    /**
     * Drops selected-component state for documents that are no longer open.
     * @param {{ [documentId: string]: string }} selectedPcbComponents Selected component map.
     * @param {{ id: string, documentModel: object }[]} documents Open documents.
     * @returns {{ [documentId: string]: string }}
     */
    static #filterSelectedPcbComponents(selectedPcbComponents, documents) {
        const availableIds = new Set(documents.map((entry) => entry.id))
        return Object.fromEntries(
            Object.entries(selectedPcbComponents || {}).filter(([documentId]) =>
                availableIds.has(documentId)
            )
        )
    }

    /**
     * Drops selected-net state for documents that are no longer open.
     * @param {{ [documentId: string]: string }} selectedNets Selected net map.
     * @param {{ id: string, documentModel: object }[]} documents Open documents.
     * @returns {{ [documentId: string]: string }}
     */
    static #filterSelectedNets(selectedNets, documents) {
        const availableIds = new Set(documents.map((entry) => entry.id))
        return Object.fromEntries(
            Object.entries(selectedNets || {}).filter(([documentId]) =>
                availableIds.has(documentId)
            )
        )
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
        return documents.find((entry) => entry.id === activeDocumentId) || null
    }
}
