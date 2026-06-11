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
                ? WebMcpAdapter.#getNativeModelContext()
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
     * @param {{ name: string, description: string, inputSchema: object, annotations?: object, handler: (args: object) => unknown }} tool Tool definition.
     * @returns {void}
     */
    #registerTool(tool) {
        const registerTool = this.#modelContext.registerTool
        if (registerTool.length <= 2) {
            this.#modelContext.registerTool(WebMcpAdapter.#toNativeTool(tool))
            return
        }

        const handler = WebMcpAdapter.#toLegacyHandler(tool)
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
     * Returns the current document-scoped browser WebMCP model context.
     * @returns {object | null}
     */
    static #getNativeModelContext() {
        return globalThis.document?.modelContext || null
    }

    /**
     * Converts one registry tool to the current object-form WebMCP API.
     * @param {{ name: string, description: string, inputSchema: object, annotations?: object, handler: (args: object) => unknown }} tool Tool definition.
     * @returns {{ name: string, description: string, inputSchema: object, annotations?: object, execute: (args?: object) => Promise<unknown> }}
     */
    static #toNativeTool(tool) {
        return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
            execute: async (args = {}) => tool.handler(args || {})
        }
    }

    /**
     * Builds a handler for older positional browser APIs.
     * @param {{ handler: (args: object) => object }} tool Tool definition.
     * @returns {(args?: object) => Promise<{ content: { type: 'text', text: string }[] }>}
     */
    static #toLegacyHandler(tool) {
        return async (args = {}) => {
            return WebMcpAdapter.#formatResult(await tool.handler(args || {}))
        }
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
