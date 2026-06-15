import { WebMcpToolRegistry } from './WebMcpToolRegistry.mjs'

/**
 * Registers loaded-session WebMCP tools with the native browser API.
 */
export class WebMcpAdapter {
    /** @type {{ track?: (eventName: string, properties?: object) => void } | null} */
    #analytics

    /** @type {object | null} */
    #modelContext

    /** @type {WebMcpToolRegistry} */
    #registry

    /**
     * @param {{ getSnapshot: () => object, modelContext?: object | null, registry?: WebMcpToolRegistry, analytics?: { track?: (eventName: string, properties?: object) => void } | null }} dependencies Dependencies.
     */
    constructor(dependencies) {
        this.#analytics = dependencies?.analytics || null
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
        const apiForm = this.#apiForm()
        for (const tool of this.#registry.getTools()) {
            try {
                this.#registerTool(tool, apiForm)
                registered += 1
            } catch (_error) {
                failed += 1
                this.#track('webmcp_tool_registration_failed', {
                    methodName: tool.name,
                    apiForm,
                    resultStatus: 'error'
                })
            }
        }

        this.#track('webmcp_available', {
            apiForm,
            resultStatus: failed === 0 ? 'success' : 'error'
        })

        return { available: true, registered, failed }
    }

    /**
     * Registers one tool using the available browser signature.
     * @param {{ name: string, description: string, inputSchema: object, annotations?: object, handler: (args: object) => unknown }} tool Tool definition.
     * @param {string} apiForm Browser API form.
     * @returns {void}
     */
    #registerTool(tool, apiForm) {
        const registerTool = this.#modelContext.registerTool
        if (registerTool.length <= 2) {
            this.#modelContext.registerTool(this.#toNativeTool(tool, apiForm))
            return
        }

        const handler = this.#toLegacyHandler(tool, apiForm)
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
     * Returns a stable label for the native WebMCP registration signature.
     * @returns {string}
     */
    #apiForm() {
        if (this.#modelContext.registerTool.length <= 2) {
            return 'object'
        }

        if (this.#modelContext.registerTool.length >= 4) {
            return 'legacy_positional'
        }

        return 'legacy_descriptor'
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
     * @param {string} apiForm Browser API form.
     * @returns {{ name: string, description: string, inputSchema: object, annotations?: object, execute: (args?: object) => Promise<unknown> }}
     */
    #toNativeTool(tool, apiForm) {
        return {
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
            annotations: tool.annotations,
            execute: async (args = {}) =>
                this.#trackToolCall(tool, apiForm, args || {})
        }
    }

    /**
     * Builds a handler for older positional browser APIs.
     * @param {{ handler: (args: object) => object }} tool Tool definition.
     * @param {string} apiForm Browser API form.
     * @returns {(args?: object) => Promise<{ content: { type: 'text', text: string }[] }>}
     */
    #toLegacyHandler(tool, apiForm) {
        return async (args = {}) => {
            return WebMcpAdapter.#formatResult(
                await this.#trackToolCall(tool, apiForm, args || {})
            )
        }
    }

    /**
     * Executes one tool while emitting privacy-safe method-call analytics.
     * @param {{ name: string, handler: (args: object) => unknown }} tool Tool definition.
     * @param {string} apiForm Browser API form.
     * @param {object} args Tool arguments.
     * @returns {Promise<unknown>}
     */
    async #trackToolCall(tool, apiForm, args) {
        try {
            const result = await tool.handler(args)
            this.#track('webmcp_tool_called', {
                methodName: tool.name,
                apiForm,
                resultStatus: 'success'
            })
            return result
        } catch (error) {
            this.#track('webmcp_tool_called', {
                methodName: tool.name,
                apiForm,
                resultStatus: 'error'
            })
            throw error
        }
    }

    /**
     * Emits one analytics event when a compatible tracker is configured.
     * @param {string} eventName Event name.
     * @param {object} properties Event properties.
     * @returns {void}
     */
    #track(eventName, properties) {
        if (typeof this.#analytics?.track === 'function') {
            this.#analytics.track(eventName, properties)
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
