import { WebMcpExecution } from './WebMcpExecution.mjs'

/** Prepares public support reports without sending report text or design data. */
export class WebMcpSupport {
    static #issuesUrl = 'https://github.com/SunboX/ecadforge_app/issues'
    static #areas = ['page', 'webmcp', 'other']

    /**
     * Defines the support tool independently of loaded designs and network access.
     * @param {string} [appVersion] Loaded app version.
     * @returns {object} WebMCP tool descriptor.
     */
    static createTool(appVersion) {
        return {
            name: 'prepare_issue_report',
            description:
                'Request support or report an ECAD Forge page bug, feature request, or WebMCP discovery/tool problem on GitHub. Prepares a title, body and issue URL without submitting. Works without a loaded design. Use an authenticated GitHub tool or open the returned URL to submit; check existing issues first. Include generic reproduction steps, expected/actual behavior and relevant tool names. Do not include private design data, file names, paths, prompts or secrets. If WebMCP is unavailable, use /llms.txt or the Request support link.',
            annotations: {
                readOnlyHint: true,
                consequentialHint: false,
                untrustedContentHint: true
            },
            inputSchema: {
                type: 'object',
                additionalProperties: false,
                required: ['title', 'description', 'area'],
                properties: {
                    title: { type: 'string', minLength: 10, maxLength: 120 },
                    description: {
                        type: 'string',
                        minLength: 10,
                        maxLength: 2000,
                        description:
                            'Public report: reproduction steps, expected and observed behavior, or requested capability. No private session data.'
                    },
                    area: { type: 'string', enum: WebMcpSupport.#areas }
                }
            },
            handler: (args, options = {}) => {
                WebMcpExecution.throwIfAborted(options)
                return WebMcpSupport.#prepare(args, appVersion)
            }
        }
    }

    /**
     * Validates explicit input and builds a GitHub issue draft.
     * @param {object} args Public report fields.
     * @param {string} [appVersion] Loaded app version.
     * @returns {object} Draft and submission instructions, or input error.
     */
    static #prepare(args, appVersion) {
        if (
            !args ||
            typeof args !== 'object' ||
            Array.isArray(args) ||
            Object.keys(args).some(
                (key) => !['title', 'description', 'area'].includes(key)
            ) ||
            !WebMcpSupport.#areas.includes(args.area) ||
            !WebMcpSupport.#validText(args.title, 120) ||
            /[\r\n\t]/.test(args.title) ||
            !WebMcpSupport.#validText(args.description, 2000)
        ) {
            return {
                error: 'Provide a 10–120 character title, a 10–2000 character public description, and area: page, webmcp or other. No extra fields.',
                submitted: false,
                status: 'invalid_input'
            }
        }
        const title = args.title.trim()
        const body = [
            '## Problem or feature request',
            args.description.trim(),
            '## Environment',
            'ECAD Forge version: ' + (appVersion || 'unknown'),
            'Area: ' + args.area,
            'Prepared with the ECAD Forge agent support tool.'
        ].join('\n\n')
        const url = new URL(WebMcpSupport.#issuesUrl + '/new')
        url.searchParams.set('title', title)
        url.searchParams.set('body', body)
        // Long Unicode reports can exceed practical URL limits after encoding.
        // Keep the complete body available for a GitHub client or manual paste.
        const prefilled = url.href.length <= 7500
        return {
            submitted: false,
            status: 'prepared',
            repository: 'SunboX/ecadforge_app',
            issues_url: WebMcpSupport.#issuesUrl,
            new_issue_url: prefilled
                ? url.href
                : WebMcpSupport.#issuesUrl + '/new',
            prefilled,
            title,
            body,
            next_step:
                'Check existing issues, then submit this public title and body with your authenticated GitHub tool or the new_issue_url form. GitHub sign-in and repository permission are required. No issue has been submitted by this tool.'
        }
    }

    /**
     * Checks bounded Unicode text, rejecting nonprinting control characters.
     * @param {unknown} value Supplied text.
     * @param {number} maximum Maximum code point count.
     * @returns {boolean} Whether text is suitable for a public report.
     */
    static #validText(value, maximum) {
        if (typeof value !== 'string') return false
        const length = Array.from(value.trim()).length
        return (
            length >= 10 &&
            length <= maximum &&
            !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
        )
    }
}
