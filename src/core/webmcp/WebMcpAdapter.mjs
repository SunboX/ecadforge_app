import { WebMcpToolRegistry } from './WebMcpToolRegistry.mjs'

/**
 * Registers loaded-session WebMCP tools with the native browser API.
 */
export class WebMcpAdapter {
    /** @type {object | null} */
    #modelContext

    /** @type {WebMcpToolRegistry} */
    #registry

    /**
     * @param {{ getSnapshot: () => object, modelContext?: object | null, registry?: WebMcpToolRegistry }} dependencies Dependencies.
     */
    constructor(dependencies) {
        this.#modelContext =
            dependencies?.modelContext === undefined
                ? globalThis.navigator?.modelContext || null
                : dependencies.modelContext
        this.#registry =
            dependencies?.registry ||
            new WebMcpToolRegistry({
                getSnapshot: dependencies?.getSnapshot
            })
    }

    /**
     * Registers tools when native WebMCP support is available.
     * @returns {{ available: boolean, registered: number, failed: number }}
     */
    initialize() {
        if (
            !this.#modelContext ||
            typeof this.#modelContext.registerTool !== 'function'
        ) {
            return { available: false, registered: 0, failed: 0 }
        }

        let registered = 0
        let failed = 0
        for (const tool of this.#registry.getTools()) {
            try {
                this.#registerTool(tool)
                registered += 1
            } catch (_error) {
                failed += 1
            }
        }

        return { available: true, registered, failed }
    }

    /**
     * Registers one tool using the available browser signature.
     * @param {{ name: string, description: string, inputSchema: object, handler: (args: object) => object }} tool Tool definition.
     * @returns {void}
     */
    #registerTool(tool) {
        const handler = async (args = {}) => {
            return WebMcpAdapter.#formatResult(await tool.handler(args || {}))
        }

        if (this.#modelContext.registerTool.length >= 4) {
            this.#modelContext.registerTool(
                tool.name,
                tool.description,
                tool.inputSchema,
                handler
            )
            return
        }

        this.#modelContext.registerTool(
            tool.name,
            {
                description: tool.description,
                inputSchema: tool.inputSchema
            },
            handler
        )
    }

    /**
     * Formats one result as MCP text content.
     * @param {unknown} result Tool result.
     * @returns {{ content: { type: 'text', text: string }[] }}
     */
    static #formatResult(result) {
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        }
    }
}
