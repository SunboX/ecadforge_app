import { LoadedDesignNetlistService as AltiumLoadedDesignNetlistService } from 'altium-toolkit/extensions'
import { LoadedDesignNetlistService as KicadLoadedDesignNetlistService } from 'kicad-toolkit/extensions'
import { EcadFormatRegistry } from '../ecad/EcadFormatRegistry.mjs'
import { EcadDocumentType } from '../ecad/EcadDocumentType.mjs'
import { WebMcpDesignAnalyzer } from './WebMcpDesignAnalyzer.mjs'
import { WebMcpDesignInspector } from './WebMcpDesignInspector.mjs'
import { WebMcpFocusedInspector } from './WebMcpFocusedInspector.mjs'
import { WebMcpPcbInspector } from './WebMcpPcbInspector.mjs'

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
        const result = this.#dispatch(args.design, (service) =>
            service.listComponents({ ...args, design: 'active' })
        )
        return WebMcpDesignAnalyzer.shapeListResult(
            result,
            'components',
            args,
            WebMcpDesignAnalyzer.compactComponent
        )
    }

    /**
     * Lists net names for one loaded design.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {{ nets: string[] } | { error: string }}
     */
    listNets(args = {}) {
        const result = this.#dispatch(args.design, (service) =>
            service.listNets({ ...args, design: 'active' })
        )
        return WebMcpDesignAnalyzer.shapeListResult(
            result,
            'nets',
            args,
            (net) => net
        )
    }

    /**
     * Reviews loaded design coverage for agent planning.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    reviewDesign(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        const entries = resolvedEntries.entries
        const supportedEntries = entries.filter(
            (entry) => this.#serviceFactories[entry.sourceFormat]
        )
        return WebMcpDesignAnalyzer.review(entries, supportedEntries)
    }

    /**
     * Audits loaded designs for parser, metadata, and connectivity issues.
     * @param {{ design?: string, max_issues?: number }} [args] Tool args.
     * @returns {{ summary: object, issues: object[] } | { error: string }}
     */
    auditDesign(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpDesignAnalyzer.audit(
            resolvedEntries.entries,
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            ),
            LoadedDesignNetlistService.#maxResults(args.max_issues)
        )
    }

    /**
     * Cross-references one schematic net against matching PCB pads.
     * @param {{ design?: string, pcb_design?: string, net_name?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    crossrefNet(args = {}) {
        const resolved = this.#resolveCrossrefEntries(args)
        if (resolved.error) return resolved

        return WebMcpDesignAnalyzer.crossrefNet(
            resolved.schematicEntry,
            resolved.pcbEntry,
            args.net_name
        )
    }

    /**
     * Compares schematic connectivity against matching PCB pad assignments.
     * @param {{ design?: string, pcb_design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    compareSchematicPcb(args = {}) {
        const resolved = this.#resolveCrossrefEntries(args)
        if (resolved.error) return resolved

        return WebMcpDesignInspector.compareSchematicPcb(
            resolved.schematicEntry,
            resolved.pcbEntry
        )
    }

    /**
     * Summarizes loaded design state for agent planning.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    summarizeDesign(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpDesignInspector.summarizeDesign(
            resolvedEntries.entries,
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            )
        )
    }

    /**
     * Finds components across common metadata fields.
     * @param {{ design?: string, query?: string, limit?: number }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    findComponents(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpDesignInspector.findComponents(
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            ),
            args
        )
    }

    /**
     * Queries BOM rows by refdes, MPN, or text pattern.
     * @param {{ design?: string, refdes?: string, mpn?: string, pattern?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryBomItem(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpDesignInspector.queryBomItem(
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            ),
            args
        )
    }

    /**
     * Lists compact pin-to-net rows for one component.
     * @param {{ design?: string, refdes?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    listPinConnections(args = {}) {
        const resolved = this.#resolveEntry(args.design)
        if (resolved.error) return resolved

        return WebMcpDesignInspector.listPinConnections(resolved.entry, args)
    }

    /**
     * Returns direct schematic net membership without traversal.
     * @param {{ design?: string, net_name?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryNet(args = {}) {
        const resolved = this.#resolveEntry(args.design)
        if (resolved.error) return resolved

        return WebMcpFocusedInspector.queryNet(resolved.entry, args)
    }

    /**
     * Lists component counts by reference-designator prefix.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    listComponentTypes(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpFocusedInspector.listComponentTypes(
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            )
        )
    }

    /**
     * Lists parser diagnostics directly.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    listDiagnostics(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpFocusedInspector.listDiagnostics(
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            )
        )
    }

    /**
     * Compares BOM component rows against matching PCB components.
     * @param {{ design?: string, pcb_design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    compareBomPcb(args = {}) {
        const resolved = this.#resolveCrossrefEntries(args)
        if (resolved.error) return resolved

        return WebMcpFocusedInspector.compareBomPcb(
            resolved.schematicEntry,
            resolved.pcbEntry
        )
    }

    /**
     * Lists schematic nets that have exactly one connected pin.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    listSinglePinNets(args = {}) {
        const resolvedEntries = this.#resolveEntries(args.design)
        if (resolvedEntries.error) return resolvedEntries

        return WebMcpFocusedInspector.listSinglePinNets(
            resolvedEntries.entries.filter(
                (entry) => this.#serviceFactories[entry.sourceFormat]
            )
        )
    }

    /**
     * Queries PCB placement, pads, and model metadata for one component.
     * @param {{ design?: string, refdes?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryPcbComponent(args = {}) {
        const resolved = this.#resolvePcbEntry(
            args.design,
            'query_pcb_component'
        )
        if (resolved.error) return resolved

        return WebMcpPcbInspector.queryPcbComponent(resolved.entry, args)
    }

    /**
     * Queries physical PCB membership for one net.
     * @param {{ design?: string, net_name?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    queryPcbNet(args = {}) {
        const resolved = this.#resolvePcbEntry(args.design, 'query_pcb_net')
        if (resolved.error) return resolved

        return WebMcpPcbInspector.queryPcbNet(resolved.entry, args)
    }

    /**
     * Summarizes loaded PCB board, placement, routing, and stackup data.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    summarizePcb(args = {}) {
        const resolved = this.#resolvePcbEntry(args.design, 'summarize_pcb')
        if (resolved.error) return resolved

        return WebMcpPcbInspector.summarizePcb(resolved.entry)
    }

    /**
     * Lists compact normalized PCB design rules.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    listDesignRules(args = {}) {
        const resolved = this.#resolvePcbEntry(args.design, 'list_design_rules')
        if (resolved.error) return resolved

        return WebMcpPcbInspector.listDesignRules(resolved.entry)
    }

    /**
     * Reviews loaded PCB data for fabrication-readiness signals.
     * @param {{ design?: string }} [args] Tool args.
     * @returns {object | { error: string }}
     */
    reviewFabricationReadiness(args = {}) {
        const resolved = this.#resolvePcbEntry(
            args.design,
            'review_fabrication_readiness'
        )
        if (resolved.error) return resolved

        return WebMcpPcbInspector.reviewFabricationReadiness(resolved.entry)
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
     * Resolves all entries or one selected entry.
     * @param {string | undefined} design Design selector.
     * @returns {{ entries: object[] } | { error: string }}
     */
    #resolveEntries(design) {
        if (design) {
            const resolved = this.#resolveEntry(design)
            if (resolved.error) return resolved
            return { entries: [resolved.entry] }
        }

        const entries = this.#loadedEntries()
        if (!entries.length) {
            return { error: 'No design is loaded in the current session.' }
        }

        return { entries }
    }

    /**
     * Resolves the schematic and PCB entries for a net cross-reference.
     * @param {{ design?: string, pcb_design?: string }} args Tool args.
     * @returns {{ schematicEntry: object, pcbEntry: object } | { error: string }}
     */
    #resolveCrossrefEntries(args) {
        const selected = this.#resolveEntry(args.design)
        if (selected.error) return selected

        const entries = this.#loadedEntries()
        const selectedEntry = selected.entry
        const schematicEntry = WebMcpDesignAnalyzer.hasSchematicNets(
            selectedEntry.documentModel
        )
            ? selectedEntry
            : this.#matchingEntry(selectedEntry, entries, (entry) =>
                  WebMcpDesignAnalyzer.hasSchematicNets(entry.documentModel)
              )
        if (!schematicEntry) {
            return {
                error: 'No loaded schematic connectivity is available for crossref_net.'
            }
        }

        const pcbEntry = args.pcb_design
            ? this.#resolveEntry(args.pcb_design)
            : {
                  entry: WebMcpDesignAnalyzer.hasPcbPads(
                      selectedEntry.documentModel
                  )
                      ? selectedEntry
                      : this.#matchingEntry(selectedEntry, entries, (entry) =>
                            WebMcpDesignAnalyzer.hasPcbPads(entry.documentModel)
                        )
              }
        if (pcbEntry.error) return pcbEntry
        if (!pcbEntry.entry) {
            return {
                error: 'No loaded PCB pad data is available for crossref_net.'
            }
        }

        return {
            schematicEntry,
            pcbEntry: pcbEntry.entry
        }
    }

    /**
     * Resolves the loaded PCB entry for PCB-specific inspection tools.
     * @param {string | undefined} design Design selector.
     * @param {string} toolName Tool name.
     * @returns {{ entry: object } | { error: string }}
     */
    #resolvePcbEntry(design, toolName) {
        const selected = this.#resolveEntry(design)
        if (selected.error) return selected

        if (WebMcpPcbInspector.hasPcbData(selected.entry.documentModel)) {
            return selected
        }

        const matched = this.#matchingEntry(
            selected.entry,
            this.#loadedEntries(),
            (entry) => WebMcpPcbInspector.hasPcbData(entry.documentModel)
        )
        if (!matched) {
            return {
                error: 'No loaded PCB data is available for ' + toolName + '.'
            }
        }

        return { entry: matched }
    }

    /**
     * Finds a matching loaded entry.
     * @param {object} selectedEntry Selected entry.
     * @param {object[]} entries Loaded entries.
     * @param {(entry: object) => boolean} predicate Match predicate.
     * @returns {object | undefined}
     */
    #matchingEntry(selectedEntry, entries, predicate) {
        return (
            entries.find(
                (entry) =>
                    entry.baseName &&
                    entry.baseName === selectedEntry.baseName &&
                    predicate(entry)
            ) || entries.find((entry) => predicate(entry))
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
                const fileName = EcadDocumentType.fileName(documentModel)
                return {
                    id: String(entry.id),
                    active: String(entry.id) === activeDocumentId,
                    documentModel,
                    sourceFormat:
                        LoadedDesignNetlistService.#sourceFormatForDocument(
                            documentModel
                        ),
                    fileName,
                    baseName: LoadedDesignNetlistService.#baseName(fileName)
                }
            })
    }

    /**
     * Resolves the source format for a loaded document.
     * @param {object} documentModel Document model.
     * @returns {string}
     */
    static #sourceFormatForDocument(documentModel) {
        const fileName = EcadDocumentType.fileName(documentModel)
        return (
            EcadFormatRegistry.sourceFormatForDocument(documentModel) ||
            EcadFormatRegistry.resolveNativeRole(fileName)?.sourceFormat ||
            ''
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
