import { PcbObjectVisibilityModel } from '../core/PcbObjectVisibilityModel.mjs'

/**
 * Renders read-only PCB view setting controls for in-board toolbar use.
 */
export class PcbViewSettingsRenderer {
    /**
     * Renders object and overlay visibility controls.
     * @param {{ hiddenObjects?: string[], showTraceLengths?: boolean, hasTraceLengths?: boolean, hidden?: boolean, translate: (key: string) => string }} options Render options.
     * @returns {string}
     */
    static render(options) {
        const translate =
            typeof options?.translate === 'function'
                ? options.translate
                : (key) => key
        const hidden = options?.hidden === true
        const rows = [
            ...(options?.hasTraceLengths
                ? [
                      PcbViewSettingsRenderer.#traceLengthRow(
                          Boolean(options?.showTraceLengths),
                          translate,
                          hidden
                      )
                  ]
                : []),
            ...PcbObjectVisibilityModel.resolveObjectCategories().map(
                (category) =>
                    PcbViewSettingsRenderer.#objectRow(
                        category,
                        options?.hiddenObjects || [],
                        translate,
                        hidden
                    )
            )
        ].join('')

        return (
            '<details class="pcb-view-settings"' +
            (hidden ? ' hidden' : '') +
            ' data-pcb-view-settings="true">' +
            '<summary class="scene-3d__preset pcb-view__measure-tool pcb-view-settings__summary" title="' +
            PcbViewSettingsRenderer.#escapeHtml(
                translate('pcbView.viewSettings')
            ) +
            '">' +
            PcbViewSettingsRenderer.#escapeHtml(
                translate('pcbView.viewSettings')
            ) +
            '</summary><div class="pcb-view-settings__menu">' +
            rows +
            '</div></details>'
        )
    }

    /**
     * Renders one object visibility setting row.
     * @param {{ key: string, labelKey: string }} category Object category.
     * @param {string[]} hiddenObjects Hidden object keys.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {boolean} hidden Whether the row is hidden.
     * @returns {string}
     */
    static #objectRow(category, hiddenObjects, translate, hidden) {
        const visible = !new Set(hiddenObjects.map(String)).has(category.key)
        const label = translate(category.labelKey)
        return (
            '<button class="pcb-view-settings__item" type="button"' +
            (hidden ? ' hidden' : '') +
            ' data-pcb-view-setting="' +
            PcbViewSettingsRenderer.#escapeHtml(category.key) +
            '" data-pcb-view-setting-visible="' +
            (visible ? 'true' : 'false') +
            '" aria-pressed="' +
            (visible ? 'true' : 'false') +
            '"><span>' +
            PcbViewSettingsRenderer.#escapeHtml(label) +
            '</span></button>'
        )
    }

    /**
     * Renders the trace-length visibility row.
     * @param {boolean} visible Whether trace lengths are visible.
     * @param {(key: string) => string} translate Translation lookup.
     * @param {boolean} hidden Whether the row is hidden.
     * @returns {string}
     */
    static #traceLengthRow(visible, translate, hidden) {
        const label = translate('pcbView.traceLengths')
        return (
            '<button class="pcb-view-settings__item" type="button"' +
            (hidden ? ' hidden' : '') +
            ' data-pcb-trace-length-toggle="true" aria-pressed="' +
            (visible ? 'true' : 'false') +
            '"><span>' +
            PcbViewSettingsRenderer.#escapeHtml(label) +
            '</span></button>'
        )
    }

    /**
     * Escapes markup text.
     * @param {string} value Raw text.
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
