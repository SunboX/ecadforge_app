import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { PcbMeasurementRenderer } from './PcbMeasurementRenderer.mjs'
import { PcbViewSettingsRenderer } from './PcbViewSettingsRenderer.mjs'

/**
 * Renders temporary PCB viewport toolbar controls.
 */
export class PcbViewportToolbarRenderer {
    /**
     * Renders optional PCB viewport controls after board-side selection.
     * @param {{ documentModel: object, interactionModel?: object, hiddenObjects?: string[], measurementMode?: string, showTraceLengths?: boolean, hoverFocusEnabled?: boolean, focusedDiagnosticId?: string, hidden?: boolean, translate: (key: string) => string }} options Render options.
     * @returns {string}
     */
    static renderControls(options) {
        const translate =
            typeof options?.translate === 'function'
                ? options.translate
                : (key) => key
        const hidden = options?.hidden === true
        const hiddenAttribute = hidden ? ' hidden' : ''
        const documentModel = options?.documentModel || null
        const interactionModel =
            options?.interactionModel ??
            (hidden ? null : PcbInteractionPrimitiveModel.build(documentModel))
        const traceLengths = interactionModel?.traceLengths || []
        // Keep the legacy delegated toggle target while controls are globally
        // hidden; determining whether traces exist must not force preparation.
        const traceLengthButtonRows =
            hidden && !interactionModel ? [{}] : traceLengths

        return (
            PcbViewportToolbarRenderer.#renderResetViewButton(
                translate,
                hiddenAttribute
            ) +
            PcbViewportToolbarRenderer.#renderHoverFocusButton(
                Boolean(options?.hoverFocusEnabled),
                translate,
                hiddenAttribute
            ) +
            PcbViewSettingsRenderer.render({
                hiddenObjects: options?.hiddenObjects || [],
                showTraceLengths: Boolean(options?.showTraceLengths),
                hasTraceLengths: Boolean(traceLengths.length),
                hidden,
                translate
            }) +
            PcbMeasurementRenderer.renderToolbarButtons(
                String(options?.measurementMode || ''),
                translate,
                { hidden }
            ) +
            PcbViewportToolbarRenderer.#renderTraceLengthButton(
                traceLengthButtonRows,
                Boolean(options?.showTraceLengths),
                translate,
                hiddenAttribute
            ) +
            PcbViewportToolbarRenderer.#renderDiagnosticNavigator(
                interactionModel,
                translate,
                String(options?.focusedDiagnosticId || '').trim(),
                hiddenAttribute
            )
        )
    }

    /**
     * Renders the PCB reset-view toolbar button.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} hiddenAttribute Optional hidden attribute.
     * @returns {string}
     */
    static #renderResetViewButton(translate, hiddenAttribute) {
        const label = translate('pcbView.resetView')
        return (
            '<button class="scene-3d__preset pcb-view__measure-tool pcb-view__reset-view" type="button"' +
            hiddenAttribute +
            ' data-pcb-view-reset="true" aria-label="' +
            PcbViewportToolbarRenderer.#escapeHtml(label) +
            '" title="' +
            PcbViewportToolbarRenderer.#escapeHtml(label) +
            '"><svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path d="M4 8a5 5 0 0 1 8.2-3.8"></path><path d="M12.2 2.4v3.8H8.4"></path><path d="M14 10a5 5 0 0 1-8.2 3.8"></path><path d="M5.8 15.6v-3.8h3.8"></path></svg></button>'
        )
    }

    /**
     * Renders the hover-focus toolbar toggle.
     * @param {boolean} enabled Whether hover focus is enabled.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} hiddenAttribute Optional hidden attribute.
     * @returns {string}
     */
    static #renderHoverFocusButton(enabled, translate, hiddenAttribute) {
        const label = translate('pcbView.hoverFocus')
        return (
            '<button class="scene-3d__preset pcb-view__measure-tool pcb-view__hover-focus' +
            (enabled ? ' is-active' : '') +
            '" type="button"' +
            hiddenAttribute +
            ' data-pcb-hover-focus-toggle="true" aria-label="' +
            PcbViewportToolbarRenderer.#escapeHtml(label) +
            '" title="' +
            PcbViewportToolbarRenderer.#escapeHtml(label) +
            '" aria-pressed="' +
            (enabled ? 'true' : 'false') +
            '"><svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><circle cx="9" cy="9" r="5"></circle><circle cx="9" cy="9" r="1.6"></circle><path d="M9 2v2M9 14v2M2 9h2M14 9h2"></path></svg></button>'
        )
    }

    /**
     * Renders the trace length overlay toggle when routed traces are available.
     * @param {object[]} traceLengths Trace length summaries.
     * @param {boolean} visible Whether trace labels are visible.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} hiddenAttribute Optional hidden attribute.
     * @returns {string}
     */
    static #renderTraceLengthButton(
        traceLengths,
        visible,
        translate,
        hiddenAttribute
    ) {
        if (!traceLengths.length) return ''

        const label = translate('pcbView.traceLengths')
        return (
            '<button class="scene-3d__preset pcb-view__measure-tool pcb-view__trace-length-toggle' +
            (visible ? ' is-active' : '') +
            '" type="button"' +
            hiddenAttribute +
            ' data-pcb-trace-length-toggle="true" aria-label="' +
            PcbViewportToolbarRenderer.#escapeHtml(label) +
            '" title="' +
            PcbViewportToolbarRenderer.#escapeHtml(label) +
            '" aria-pressed="' +
            (visible ? 'true' : 'false') +
            '"><svg aria-hidden="true" viewBox="0 0 18 18" width="16" height="16"><path d="M3 12h12"></path><path d="M5 9l-2 3 2 3"></path><path d="M13 9l2 3-2 3"></path><path d="M6 5h6"></path></svg></button>'
        )
    }

    /**
     * Renders grouped in-view diagnostic navigation controls.
     * @param {object} interactionModel Prepared PCB interaction model.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} focusedDiagnosticId Focused diagnostic id.
     * @param {string} hiddenAttribute Optional hidden attribute.
     * @returns {string}
     */
    static #renderDiagnosticNavigator(
        interactionModel,
        translate,
        focusedDiagnosticId,
        hiddenAttribute
    ) {
        const diagnostics = interactionModel?.diagnostics || []
        if (!diagnostics.length) return ''

        return (
            '<details class="pcb-diagnostic-panel"' +
            hiddenAttribute +
            '><summary class="pcb-diagnostic-panel__summary">' +
            PcbViewportToolbarRenderer.#escapeHtml(
                translate('app.diagnostics')
            ) +
            ' · ' +
            diagnostics.length +
            '</summary><div class="pcb-diagnostic-panel__menu">' +
            PcbViewportToolbarRenderer.#diagnosticGroups(diagnostics)
                .map((group) =>
                    PcbViewportToolbarRenderer.#renderDiagnosticGroup(
                        group,
                        translate,
                        focusedDiagnosticId
                    )
                )
                .join('') +
            '</div></details>'
        )
    }

    /**
     * Groups diagnostics by severity and code.
     * @param {object[]} diagnostics Diagnostic rows.
     * @returns {{ label: string, rows: object[] }[]}
     */
    static #diagnosticGroups(diagnostics) {
        const groups = new Map()
        for (const diagnostic of diagnostics) {
            const label = [
                diagnostic.severity || 'info',
                diagnostic.code || diagnostic.category || 'diagnostic'
            ].join(': ')
            if (!groups.has(label)) groups.set(label, [])
            groups.get(label).push(diagnostic)
        }
        return [...groups.entries()].map(([label, rows]) => ({ label, rows }))
    }

    /**
     * Renders one diagnostic group.
     * @param {{ label: string, rows: object[] }} group Diagnostic group.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} focusedDiagnosticId Focused diagnostic id.
     * @returns {string}
     */
    static #renderDiagnosticGroup(group, translate, focusedDiagnosticId) {
        return (
            '<details class="pcb-diagnostic-panel__group" open><summary class="pcb-diagnostic-panel__group-summary">' +
            PcbViewportToolbarRenderer.#escapeHtml(group.label) +
            ' · ' +
            group.rows.length +
            '</summary>' +
            group.rows
                .map((diagnostic) =>
                    PcbViewportToolbarRenderer.#renderDiagnosticRow(
                        diagnostic,
                        translate,
                        focusedDiagnosticId
                    )
                )
                .join('') +
            '</details>'
        )
    }

    /**
     * Renders one diagnostic navigation row.
     * @param {object} diagnostic Diagnostic row.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {string} focusedDiagnosticId Focused diagnostic id.
     * @returns {string}
     */
    static #renderDiagnosticRow(diagnostic, translate, focusedDiagnosticId) {
        const message = String(diagnostic.message || '')
        const id = String(diagnostic.id || '')
        const focused = id && id === focusedDiagnosticId
        const copyLabel = translate('pcbView.copyDiagnostic')
        return (
            '<div class="pcb-diagnostic-panel__row"><button class="pcb-diagnostic-panel__item' +
            (focused ? ' is-focused' : '') +
            '" type="button" data-pcb-diagnostic-focus="' +
            PcbViewportToolbarRenderer.#escapeHtml(id) +
            '" aria-current="' +
            (focused ? 'true' : 'false') +
            '"><span>' +
            PcbViewportToolbarRenderer.#escapeHtml(message) +
            '</span></button><button class="pcb-diagnostic-panel__copy" type="button" data-pcb-diagnostic-copy="' +
            PcbViewportToolbarRenderer.#escapeHtml(message) +
            '" title="' +
            PcbViewportToolbarRenderer.#escapeHtml(copyLabel) +
            '" aria-label="' +
            PcbViewportToolbarRenderer.#escapeHtml(copyLabel) +
            '"><svg aria-hidden="true" viewBox="0 0 18 18" width="14" height="14"><rect x="6" y="5" width="8" height="10" rx="1"></rect><path d="M4 12V3h8"></path></svg></button></div>'
        )
    }

    /**
     * Escapes markup text.
     * @param {string} value Raw value.
     * @returns {string}
     */
    static #escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
    }
}
