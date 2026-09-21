/** Validates the automatic WebMCP wire contract independently of tool input. */
export class WebMcpAnalyticsProperties {
    static #enums = {
        apiForm: ['object', 'legacy_positional', 'legacy_descriptor'],
        runtimeSource: ['native', 'fallback', 'unavailable', 'unknown'],
        resultStatus: [
            'success',
            'error',
            'cancelled',
            'started',
            'unavailable'
        ],
        errorBucket: [
            'none',
            'no_design',
            'design_not_found',
            'unsupported_format',
            'missing_data',
            'invalid_input',
            'not_found',
            'cancelled',
            'tool_error',
            'exception',
            'registration_failed',
            'runtime_unavailable'
        ],
        resultShape: ['empty', 'list', 'object', 'error', 'unknown'],
        designSelector: ['default', 'active', 'selected'],
        queryMode: ['default', 'compact'],
        pagination: ['none', 'first_page', 'later_page'],
        hasFilter: ['yes', 'no'],
        hasLimit: ['yes', 'no'],
        includeDns: ['yes', 'no', 'default']
    }

    /** Builds only typed, bounded fields from trusted provider observations. */
    static sanitize(properties = {}) {
        const result = {}
        for (const [key, values] of Object.entries(this.#enums)) {
            if (values.includes(properties[key]))
                result[this.#wireName(key)] = properties[key]
        }
        for (const key of [
            'durationMs',
            'resultCount',
            'registeredCount',
            'failedCount',
            'documentCount',
            'callSequence'
        ]) {
            const value = properties[key]
            if (
                typeof value === 'number' &&
                Number.isFinite(value) &&
                value >= 0
            ) {
                result[this.#wireName(key)] = Math.min(
                    Math.round(value),
                    key === 'durationMs' ? 3600000 : 1000000
                )
            }
        }
        for (const [key, pattern] of [
            ['methodName', /^[a-z][a-z0-9_]{0,63}$/],
            ['appVersion', /^\d{1,6}\.\d{1,6}\.\d{1,6}$/],
            [
                'pageSessionId',
                /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/
            ]
        ]) {
            if (
                typeof properties[key] === 'string' &&
                pattern.test(properties[key])
            )
                result[this.#wireName(key)] = properties[key]
        }
        return result
    }

    /** Maps internal camel case to the collector's property names. */
    static #wireName(key) {
        return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
    }
}
