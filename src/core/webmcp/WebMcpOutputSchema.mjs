/** Defines the JSON shape of successful tool results and returned errors. */
export class WebMcpOutputSchema {
    /**
     * Describes a query result without constraining format-specific detail fields.
     * @param {object} requiredProperties Properties every successful result has.
     * @param {object} [optionalProperties] Additional documented properties.
     * @returns {object} Object-root JSON Schema compatible with native WebMCP and MCP.
     */
    static query(requiredProperties, optionalProperties = {}) {
        return {
            type: 'object',
            properties: {
                ...requiredProperties,
                ...optionalProperties,
                error: { type: 'string' }
            },
            anyOf: [
                { required: Object.keys(requiredProperties) },
                { required: ['error'] }
            ]
        }
    }
}
