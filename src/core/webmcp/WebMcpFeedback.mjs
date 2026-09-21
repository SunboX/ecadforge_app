import { WebMcpExecution } from './WebMcpExecution.mjs'

/** Submits deliberate generic agent feedback separately from automatic telemetry. */
export class WebMcpFeedback {
    #fetch
    #location
    #appVersion
    #submitted = new Map()
    #pending = new Map()
    static #kinds = ['feature_request', 'bug_report']
    static #areas = [
        'discovery',
        'search',
        'connectivity',
        'bom',
        'pcb',
        'performance',
        'output',
        'other'
    ]

    /** @param {object} dependencies Production location, version and HTTP transport. */
    constructor(dependencies = {}) {
        this.#fetch = dependencies.fetch || globalThis.fetch?.bind(globalThis)
        this.#location = dependencies.location || globalThis.location
        this.#appVersion = dependencies.appVersion
    }

    /** Defines a discoverable tool with explicit outbound-data annotations. */
    createTool(toolNames) {
        return {
            name: 'submit_agent_feedback',
            description:
                'Send ECAD Forge maintainers a generic missing-feature request or reproducible WebMCP limitation. This sends the supplied summary to Analytics. Use only when useful; never include design contents, file names, paths, project/component/net identifiers, conversation prompts, personal data or secrets. Describe the capability or behavior generically. Submission requires network access and does not change the design.',
            annotations: {
                readOnlyHint: false,
                consequentialHint: true,
                untrustedContentHint: true
            },
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['kind', 'area', 'summary'],
                properties: {
                    kind: { type: 'string', enum: WebMcpFeedback.#kinds },
                    area: { type: 'string', enum: WebMcpFeedback.#areas },
                    summary: {
                        type: 'string',
                        minLength: 10,
                        maxLength: 500,
                        description:
                            'Generic capability need or limitation only; no private design or conversation data.'
                    },
                    related_tool: { type: 'string', enum: toolNames }
                }
            },
            handler: (args, options = {}) =>
                this.#submit(args, options, toolNames)
        }
    }

    /** Validates explicit feedback before any network access. */
    async #submit(args, options, toolNames) {
        WebMcpExecution.throwIfAborted(options)
        const properties = this.#validate(args, toolNames)
        if (!properties)
            return {
                error: 'Invalid feedback. Use the documented fields and a generic 10–500 character summary.',
                submitted: false,
                status: 'invalid_input'
            }
        if (!this.#isProductionOrigin() || !this.#fetch) {
            return {
                error: 'Feedback submission is unavailable on local sessions or without network support.',
                submitted: false,
                status: 'unavailable'
            }
        }
        const key = JSON.stringify(properties)
        if (this.#submitted.has(key))
            return {
                ...this.#submitted.get(key),
                submitted: false,
                status: 'duplicate'
            }
        if (this.#pending.has(key))
            return {
                error: 'Equivalent feedback is already being submitted.',
                submitted: false,
                status: 'pending'
            }
        if (this.#submitted.size + this.#pending.size >= 10)
            return {
                error: 'Feedback limit reached for this page session.',
                submitted: false,
                status: 'rate_limited'
            }
        this.#pending.set(key, true)
        try {
            const result = await this.#send(properties, options)
            if (result.submitted || result.status === 'duplicate')
                this.#submitted.set(key, result)
            return result
        } finally {
            this.#pending.delete(key)
        }
    }

    /** Restricts deliberate outbound feedback to the registered production site. */
    #isProductionOrigin() {
        try {
            const href =
                typeof this.#location === 'string'
                    ? this.#location
                    : this.#location?.href
            return new URL(href).origin === 'https://ecadforge.app'
        } catch (_error) {
            return false
        }
    }

    /** Accepts only declared, bounded feedback fields; no session snapshot is read. */
    #validate(args, toolNames) {
        if (!args || typeof args !== 'object' || Array.isArray(args))
            return null
        if (
            Object.keys(args).some(
                (key) =>
                    !['kind', 'area', 'summary', 'related_tool'].includes(key)
            )
        )
            return null
        if (
            !WebMcpFeedback.#kinds.includes(args.kind) ||
            !WebMcpFeedback.#areas.includes(args.area)
        )
            return null
        if (typeof args.summary !== 'string') return null
        const summary = args.summary.trim()
        if (
            Array.from(summary).length < 10 ||
            Array.from(summary).length > 500 ||
            /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(summary)
        )
            return null
        if (
            args.related_tool !== undefined &&
            !toolNames.includes(args.related_tool)
        )
            return null
        return {
            feedback_kind: args.kind,
            feedback_area: args.area,
            feedback_summary: summary,
            ...(args.related_tool ? { related_method: args.related_tool } : {}),
            ...(this.#appVersion ? { app_version: this.#appVersion } : {})
        }
    }

    /** Waits for actual collector acceptance, never treating a queued beacon as delivery. */
    async #send(properties, options) {
        const timeout = new AbortController()
        const timer = setTimeout(() => timeout.abort(), 10000)
        const signal = options.signal
            ? AbortSignal.any([options.signal, timeout.signal])
            : timeout.signal
        try {
            const response = await this.#fetch(
                'https://analytics.andrefiedler.de/v1/collect',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'omit',
                    mode: 'cors',
                    signal,
                    body: JSON.stringify({
                        site_key: 'ecadforge_app',
                        event_type: 'event',
                        event_name: 'webmcp_feedback',
                        properties
                    })
                }
            )
            const body = await response.json()
            if (
                response.ok &&
                body.ok === true &&
                Number.isInteger(body.event_id) &&
                body.event_id > 0
            ) {
                return {
                    submitted: true,
                    status: 'received',
                    event_id: body.event_id
                }
            }
            if (
                response.status === 409 &&
                body.error?.code === 'feedback_duplicate'
            ) {
                return {
                    submitted: false,
                    status: 'duplicate',
                    message:
                        'Equivalent feedback was already received recently.'
                }
            }
            return {
                error: 'The feedback collector did not accept this submission.',
                submitted: false,
                status: response.status === 429 ? 'rate_limited' : 'rejected'
            }
        } catch (_error) {
            WebMcpExecution.throwIfAborted(options)
            return {
                error: 'Feedback could not be delivered. Retry when network access is available.',
                submitted: false,
                status: 'unavailable'
            }
        } finally {
            clearTimeout(timer)
        }
    }
}
