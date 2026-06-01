import { LoadedDesignNetlistService as AltiumLoadedDesignNetlistService } from 'altium-toolkit/netlist-query'
import { LoadedDesignNetlistService as KicadLoadedDesignNetlistService } from 'kicad-toolkit/netlist-query'
import { EcadFormatRegistry } from '../ecad/EcadFormatRegistry.mjs'

/**
 * Dispatches loaded-session WebMCP queries to toolkit-owned netlist services.
 */
export class LoadedDesignNetlistService {
    /** @type {() => object} */
    #getSnapshot

    /** @type {Record<string, typeof AltiumLoadedDesignNetlistService>} */
    #serviceFactories

    /**
     * @param {{ getSnapshot: () => object, serviceFactories?: object }} dependencies Dependencies.
     */
    constructor(dependencies = {}) {
        this.#getSnapshot =
            typeof dependencies.getSnapshot === 'function'
                ? dependencies.getSnapshot
                : () => ({ documents: [] })
        this.#serviceFactories = {
            altium: AltiumLoadedDesignNetlistService,
            kicad: KicadLoadedDesignNetlistService,
            ...(dependencies.serviceFactories || {})
        }
    }

    /**
     * Lists loaded session designs.
     * @param {{ pattern?: string, max_results?: number }} [args] Tool args.
     * @returns {object[] | { error: string }}
     */
    listDesigns(args = {}) {
        const entriesByFormat = this.#supportedEntriesByFormat()
        const results = []

        for (const [sourceFormat, entries] of entriesByFormat.entries()) {
            const service = this.#createService(sourceFormat, entries)
            const serviceResult = service.listDesigns(args)
            if (Array.isArray(serviceResult)) {
                results.push(...serviceResult)
            }
        }

        return results.slice(
            0,
            LoadedDesignNetlistService.#maxResults(args.max_results)
        )
    }

    /**
     * Lists components matching one reference-designator prefix.
     * @param {{ design?: string, type?: string, include_dns?: boolean }} [args] Tool args.
     * @returns {{ components: object[] } | { error: string }}
     */
    listComponents(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.listComponents({ ...args, design: 'active' })
        )
    }

    /**
     * Lists net names for one loaded design.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {{ nets: string[] } | { error: string }}
     */
    listNets(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.listNets({ ...args, design: 'active' })
        )
    }

    /**
     * Searches net names by regex.
     * @param {{ design?: string, pattern?: string }} [args] Tool args.
     * @returns {{ results: Record<string, string[]>, notes?: string[] } | { error: string }}
     */
    searchNets(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.searchNets({ ...args, design: 'active' })
        )
    }

    /**
     * Searches components by reference designator.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} [args] Tool args.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    searchComponentsByRefdes(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.searchComponentsByRefdes({ ...args, design: 'active' })
        )
    }

    /**
     * Searches components by MPN.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} [args] Tool args.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    searchComponentsByMpn(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.searchComponentsByMpn({ ...args, design: 'active' })
        )
    }

    /**
     * Searches components by description.
     * @param {{ design?: string, pattern?: string, include_dns?: boolean }} [args] Tool args.
     * @returns {{ results: Record<string, object[]>, notes?: string[] } | { error: string }}
     */
    searchComponentsByDescription(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.searchComponentsByDescription({
                ...args,
                design: 'active'
            })
        )
    }

    /**
     * Queries one component and all known pin connections.
     * @param {{ design?: string, refdes?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryComponent(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.queryComponent({ ...args, design: 'active' })
        )
    }

    /**
     * Queries extended connectivity starting from a net name.
     * @param {{ design?: string, net_name?: string, skip_types?: string[], include_dns?: boolean }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryXnetByNetName(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.queryXnetByNetName({ ...args, design: 'active' })
        )
    }

    /**
     * Queries extended connectivity starting from a component pin.
     * @param {{ design?: string, pin_name?: string, skip_types?: string[], include_dns?: boolean }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryXnetByPinName(args = {}) {
        return this.#dispatch(args.design, (service) =>
            service.queryXnetByPinName({ ...args, design: 'active' })
        )
    }

    /**
     * Runs a query against the toolkit service for the selected document.
     * @param {string | undefined} design Design selector.
     * @param {(service: object) => object} callback Query callback.
     * @returns {object}
     */
    #dispatch(design, callback) {
        const resolved = this.#resolveEntry(design)
        if (resolved.error) return resolved

        const sourceFormat = resolved.entry.sourceFormat
        if (!this.#serviceFactories[sourceFormat]) {
            return {
                error:
                    "Unsupported ECAD source format '" +
                    sourceFormat +
                    "' for loaded-session netlist queries."
            }
        }

        return callback(
            this.#createService(sourceFormat, [
                {
                    ...resolved.entry,
                    active: true
                }
            ])
        )
    }

    /**
     * Creates a toolkit service for document entries.
     * @param {string} sourceFormat Source format.
     * @param {object[]} entries Loaded entries.
     * @returns {object}
     */
    #createService(sourceFormat, entries) {
        const ServiceFactory = this.#serviceFactories[sourceFormat]
        return new ServiceFactory({
            getDocuments: () => entries
        })
    }

    /**
     * Groups supported loaded entries by source format.
     * @returns {Map<string, object[]>}
     */
    #supportedEntriesByFormat() {
        const grouped = new Map()

        for (const entry of this.#loadedEntries()) {
            if (!this.#serviceFactories[entry.sourceFormat]) continue
            if (!grouped.has(entry.sourceFormat)) {
                grouped.set(entry.sourceFormat, [])
            }
            grouped.get(entry.sourceFormat).push(entry)
        }

        return grouped
    }

    /**
     * Resolves one loaded entry from a design selector.
     * @param {string | undefined} design Design selector.
     * @returns {{ entry: object } | { error: string }}
     */
    #resolveEntry(design) {
        const entries = this.#loadedEntries()
        if (!entries.length) {
            return { error: 'No design is loaded in the current session.' }
        }

        const selector = String(design || 'active').trim()
        if (!selector || selector.toLowerCase() === 'active') {
            return {
                entry: entries.find((entry) => entry.active) || entries[0]
            }
        }

        const matches = entries.filter((entry) =>
            LoadedDesignNetlistService.#entryMatchesSelector(entry, selector)
        )
        if (matches.length > 1) {
            return {
                error:
                    "Design selector '" +
                    selector +
                    "' is ambiguous. Use a loaded document id."
            }
        }
        if (!matches.length) {
            return {
                error:
                    "Design selector '" +
                    selector +
                    "' did not match a loaded design."
            }
        }

        return { entry: matches[0] }
    }

    /**
     * Returns loaded design entries with app-session metadata.
     * @returns {object[]}
     */
    #loadedEntries() {
        const snapshot = this.#getSnapshot() || {}
        const activeDocumentId = String(snapshot.activeDocumentId || '')

        return (Array.isArray(snapshot.documents) ? snapshot.documents : [])
            .filter((entry) => entry?.id && entry?.documentModel)
            .map((entry) => {
                const documentModel = entry.documentModel
                return {
                    id: String(entry.id),
                    active: String(entry.id) === activeDocumentId,
                    documentModel,
                    sourceFormat:
                        LoadedDesignNetlistService.#sourceFormatForDocument(
                            documentModel
                        ),
                    fileName: String(documentModel?.fileName || ''),
                    baseName: LoadedDesignNetlistService.#baseName(
                        documentModel?.fileName
                    )
                }
            })
    }

    /**
     * Resolves the source format for a loaded document.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static #sourceFormatForDocument(documentModel) {
        if (documentModel?.sourceFormat) {
            return String(documentModel.sourceFormat)
        }

        return (
            EcadFormatRegistry.resolveNativeRole(documentModel?.fileName)
                ?.sourceFormat ||
            EcadFormatRegistry.sourceFormatForDocument(documentModel)
        )
    }

    /**
     * Returns true when an entry matches a design selector.
     * @param {object} entry Loaded entry.
     * @param {string} selector Selector.
     * @returns {boolean}
     */
    static #entryMatchesSelector(entry, selector) {
        const normalized = selector.toLowerCase()
        return (
            entry.id.toLowerCase() === normalized ||
            entry.fileName.toLowerCase() === normalized ||
            entry.baseName.toLowerCase() === normalized
        )
    }

    /**
     * Resolves a file base name.
     * @param {string | undefined} fileName File name.
     * @returns {string}
     */
    static #baseName(fileName) {
        return String(fileName || '').replace(/\.[^.]+$/, '')
    }

    /**
     * Resolves a max-results limit.
     * @param {unknown} value Raw value.
     * @returns {number}
     */
    static #maxResults(value) {
        const parsed = Number.parseInt(String(value || ''), 10)
        return Number.isInteger(parsed) && parsed > 0 ? parsed : 50
    }
}
