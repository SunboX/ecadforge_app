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
     * @returns {{ name: string, description: string, inputSchema: object, annotations: object, handler: (args: object) => object }[]}
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
                (args) => this.#service.listDesigns(args)
            ),
            this.#tool(
                'list_components',
                'List loaded design components by reference-designator prefix.',
                {
                    design: { type: 'string' },
                    type: { type: 'string' },
                    include_dns: { type: 'boolean' }
                },
                (args) => this.#service.listComponents(args)
            ),
            this.#tool(
                'list_nets',
                'List net names for one loaded design.',
                { design: { type: 'string' } },
                (args) => this.#service.listNets(args)
            ),
            this.#tool(
                'search_nets',
                'Search loaded design net names by regex.',
                {
                    design: { type: 'string' },
                    pattern: { type: 'string' }
                },
                (args) => this.#service.searchNets(args)
            ),
            this.#tool(
                'search_components_by_refdes',
                'Search loaded components by reference designator regex.',
                WebMcpToolRegistry.#componentSearchSchema(),
                (args) => this.#service.searchComponentsByRefdes(args)
            ),
            this.#tool(
                'search_components_by_mpn',
                'Search loaded components by MPN regex.',
                WebMcpToolRegistry.#componentSearchSchema(),
                (args) => this.#service.searchComponentsByMpn(args)
            ),
            this.#tool(
                'search_components_by_description',
                'Search loaded components by description regex.',
                WebMcpToolRegistry.#componentSearchSchema(),
                (args) => this.#service.searchComponentsByDescription(args)
            ),
            this.#tool(
                'query_component',
                'Return one loaded component with all known pin connections.',
                {
                    design: { type: 'string' },
                    refdes: { type: 'string' }
                },
                (args) => this.#service.queryComponent(args)
            ),
            this.#tool(
                'query_xnet_by_net_name',
                'Trace loaded design connectivity starting from a net.',
                WebMcpToolRegistry.#xnetByNetSchema(),
                (args) => this.#service.queryXnetByNetName(args)
            ),
            this.#tool(
                'query_xnet_by_pin_name',
                'Trace loaded design connectivity starting from a component pin.',
                WebMcpToolRegistry.#xnetByPinSchema(),
                (args) => this.#service.queryXnetByPinName(args)
            )
        ]
    }

    /**
     * Builds one tool descriptor.
     * @param {string} name Tool name.
     * @param {string} description Tool description.
     * @param {object} properties Input properties.
     * @param {(args: object) => object} handler Tool handler.
     * @returns {{ name: string, description: string, inputSchema: object, annotations: object, handler: (args: object) => object }}
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
