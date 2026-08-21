import { LoadedDesignNetlistService } from './LoadedDesignNetlistService.mjs'

/**
 * Defines loaded-session WebMCP tools and dispatches to the query service.
 */
export class WebMcpToolRegistry {
    /** @type {LoadedDesignNetlistService} */
    #service

    /**
     * @param {{ getSnapshot: () => object, service?: LoadedDesignNetlistService }} dependencies Dependencies.
     */
    constructor(dependencies) {
        this.#service =
            dependencies?.service ||
            new LoadedDesignNetlistService({
                getSnapshot: dependencies?.getSnapshot
            })
    }

    /**
     * Returns all registered tool definitions.
     * @returns {{ name: string, description: string, inputSchema: object, annotations: object, handler: (args: object, executionOptions?: object) => object }[]}
     */
    getTools() {
        return [
            this.#tool(
                'list_designs',
                'List ECAD designs loaded in the current browser session.',
                {
                    pattern: { type: 'string' },
                    max_results: { type: 'number' }
                },
                (args, executionOptions) =>
                    this.#service.listDesigns(args, executionOptions)
            ),
            this.#tool(
                'list_components',
                'List loaded design components by reference-designator prefix.',
                {
                    design: { type: 'string' },
                    type: { type: 'string' },
                    include_dns: { type: 'boolean' },
                    limit: { type: 'number' },
                    offset: { type: 'number' },
                    compact: { type: 'boolean' }
                },
                (args, executionOptions) =>
                    this.#service.listComponents(args, executionOptions)
            ),
            this.#tool(
                'list_nets',
                'List net names for one loaded design.',
                {
                    design: { type: 'string' },
                    limit: { type: 'number' },
                    offset: { type: 'number' }
                },
                (args, executionOptions) =>
                    this.#service.listNets(args, executionOptions)
            ),
            this.#tool(
                'review_design',
                'Summarize loaded design coverage, metadata, and diagnostics.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.reviewDesign(args, executionOptions)
            ),
            this.#tool(
                'audit_design',
                'Return parser, metadata, and connectivity issues for loaded designs.',
                {
                    design: { type: 'string' },
                    max_issues: { type: 'number' }
                },
                (args, executionOptions) =>
                    this.#service.auditDesign(args, executionOptions)
            ),
            this.#tool(
                'crossref_net',
                'Compare one schematic net against matching PCB pads.',
                {
                    design: { type: 'string' },
                    pcb_design: { type: 'string' },
                    net_name: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.crossrefNet(args, executionOptions)
            ),
            this.#tool(
                'compare_schematic_pcb',
                'Compare all schematic nets against matching PCB pads.',
                {
                    design: { type: 'string' },
                    pcb_design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.compareSchematicPcb(args, executionOptions)
            ),
            this.#tool(
                'summarize_design',
                'Return an agent-friendly loaded-design summary.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.summarizeDesign(args, executionOptions)
            ),
            this.#tool(
                'find_components',
                'Find loaded components by refdes, MPN, value, description, or footprint.',
                {
                    design: { type: 'string' },
                    query: { type: 'string' },
                    limit: { type: 'number' }
                },
                (args, executionOptions) =>
                    this.#service.findComponents(args, executionOptions)
            ),
            this.#tool(
                'query_bom_item',
                'Find normalized BOM rows by refdes, MPN, or text pattern.',
                {
                    design: { type: 'string' },
                    refdes: { type: 'string' },
                    mpn: { type: 'string' },
                    pattern: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.queryBomItem(args, executionOptions)
            ),
            this.#tool(
                'list_pin_connections',
                'List compact pin-to-net rows for one loaded component.',
                {
                    design: { type: 'string' },
                    refdes: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.listPinConnections(args, executionOptions)
            ),
            this.#tool(
                'query_net',
                'Return direct pin membership for one loaded schematic net.',
                {
                    design: { type: 'string' },
                    net_name: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.queryNet(args, executionOptions)
            ),
            this.#tool(
                'list_component_types',
                'Return loaded component counts by reference-designator prefix.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.listComponentTypes(args, executionOptions)
            ),
            this.#tool(
                'list_diagnostics',
                'Return parser diagnostics for loaded designs.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.listDiagnostics(args, executionOptions)
            ),
            this.#tool(
                'compare_bom_pcb',
                'Compare normalized BOM rows against matching PCB components.',
                {
                    design: { type: 'string' },
                    pcb_design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.compareBomPcb(args, executionOptions)
            ),
            this.#tool(
                'list_single_pin_nets',
                'List schematic nets with exactly one connected pin.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.listSinglePinNets(args, executionOptions)
            ),
            this.#tool(
                'query_pcb_component',
                'Return PCB placement, pads, and model metadata for one component.',
                {
                    design: { type: 'string' },
                    refdes: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.queryPcbComponent(args, executionOptions)
            ),
            this.#tool(
                'query_pcb_net',
                'Return physical PCB membership for one routed net.',
                {
                    design: { type: 'string' },
                    net_name: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.queryPcbNet(args, executionOptions)
            ),
            this.#tool(
                'summarize_pcb',
                'Summarize loaded PCB board, placement, routing, and stackup data.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.summarizePcb(args, executionOptions)
            ),
            this.#tool(
                'list_design_rules',
                'List compact normalized PCB design rules.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.listDesignRules(args, executionOptions)
            ),
            this.#tool(
                'review_fabrication_readiness',
                'Review loaded PCB data for fabrication-readiness signals.',
                {
                    design: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.reviewFabricationReadiness(
                        args,
                        executionOptions
                    )
            ),
            this.#tool(
                'search_nets',
                'Search loaded design net names by regex.',
                {
                    design: { type: 'string' },
                    pattern: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.searchNets(args, executionOptions)
            ),
            this.#tool(
                'search_components_by_refdes',
                'Search loaded components by reference designator regex.',
                WebMcpToolRegistry.#componentSearchSchema(),
                (args, executionOptions) =>
                    this.#service.searchComponentsByRefdes(
                        args,
                        executionOptions
                    )
            ),
            this.#tool(
                'search_components_by_mpn',
                'Search loaded components by MPN regex.',
                WebMcpToolRegistry.#componentSearchSchema(),
                (args, executionOptions) =>
                    this.#service.searchComponentsByMpn(args, executionOptions)
            ),
            this.#tool(
                'search_component_descriptions',
                'Search loaded components by description regex.',
                WebMcpToolRegistry.#componentSearchSchema(),
                (args, executionOptions) =>
                    this.#service.searchComponentsByDescription(
                        args,
                        executionOptions
                    )
            ),
            this.#tool(
                'query_component',
                'Return one loaded component with all known pin connections.',
                {
                    design: { type: 'string' },
                    refdes: { type: 'string' }
                },
                (args, executionOptions) =>
                    this.#service.queryComponent(args, executionOptions)
            ),
            this.#tool(
                'query_xnet_by_net_name',
                'Trace loaded design connectivity starting from a net.',
                WebMcpToolRegistry.#xnetByNetSchema(),
                (args, executionOptions) =>
                    this.#service.queryXnetByNetName(args, executionOptions)
            ),
            this.#tool(
                'query_xnet_by_pin_name',
                'Trace loaded design connectivity starting from a component pin.',
                WebMcpToolRegistry.#xnetByPinSchema(),
                (args, executionOptions) =>
                    this.#service.queryXnetByPinName(args, executionOptions)
            )
        ]
    }

    /**
     * Builds one tool descriptor.
     * @param {string} name Tool name.
     * @param {string} description Tool description.
     * @param {object} properties Input properties.
     * @param {(args: object, executionOptions?: object) => object} handler Tool handler.
     * @returns {{ name: string, description: string, inputSchema: object, annotations: object, handler: (args: object, executionOptions?: object) => object }}
     */
    #tool(name, description, properties, handler) {
        return {
            name,
            description,
            inputSchema: {
                type: 'object',
                properties,
                additionalProperties: false
            },
            annotations: {
                readOnlyHint: true,
                untrustedContentHint: true
            },
            handler
        }
    }

    /**
     * Returns the common component-search schema properties.
     * @returns {object}
     */
    static #componentSearchSchema() {
        return {
            design: { type: 'string' },
            pattern: { type: 'string' },
            include_dns: { type: 'boolean' }
        }
    }

    /**
     * Returns the extended-net-by-net schema properties.
     * @returns {object}
     */
    static #xnetByNetSchema() {
        return {
            design: { type: 'string' },
            net_name: { type: 'string' },
            skip_types: { type: 'array', items: { type: 'string' } },
            include_dns: { type: 'boolean' }
        }
    }

    /**
     * Returns the extended-net-by-pin schema properties.
     * @returns {object}
     */
    static #xnetByPinSchema() {
        return {
            design: { type: 'string' },
            pin_name: { type: 'string' },
            skip_types: { type: 'array', items: { type: 'string' } },
            include_dns: { type: 'boolean' }
        }
    }
}
