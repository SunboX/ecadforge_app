import { PcbScene3dShellRenderer as Scene3dRenderer } from 'pcb-scene3d-viewer'
import { SvgPanelChromeStripper } from './SvgPanelChromeStripper.mjs'

/**
 * Adapts the shared 3D scene shell for the app's active viewer layout.
 */
export class AppViewScene3dShellRenderer {
    /**
     * Renders the active app 3D shell without the compact stats strip.
     * @param {any} documentModel Active document model.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @param {{ autoSearchMissingModels?: boolean }} [options] Shell options.
     * @returns {string}
     */
    static render(documentModel, translate = null, options = {}) {
        return AppViewScene3dShellRenderer.#insertModelSearchToggle(
            AppViewScene3dShellRenderer.#removeStatsStrip(
                SvgPanelChromeStripper.stripMetadataHeader(
                    Scene3dRenderer.render(documentModel, translate)
                )
            ),
            translate,
            options
        )
    }

    /**
     * Removes the package stats strip once those values are available in the
     * persistent sidebar info panel.
     * @param {string} markup Rendered 3D shell markup.
     * @returns {string}
     */
    static #removeStatsStrip(markup) {
        const statsStart = String(markup).indexOf(
            '<dl class="scene-3d__stats">'
        )
        if (statsStart < 0) {
            return markup
        }

        const statsEnd = String(markup).indexOf('</dl>', statsStart)
        if (statsEnd < 0) {
            return markup
        }

        return (
            String(markup).slice(0, statsStart) +
            String(markup).slice(statsEnd + '</dl>'.length)
        )
    }

    /**
     * Inserts the app-owned missing model search checkbox into the 3D controls.
     * @param {string} markup Rendered 3D shell markup.
     * @param {((key: string) => string) | null} translate Translation lookup.
     * @param {{ autoSearchMissingModels?: boolean }} options Shell options.
     * @returns {string}
     */
    static #insertModelSearchToggle(markup, translate, options) {
        const selectionMatch = String(markup).match(
            /<section\b[^>]*class="[^"]*\bscene-3d__selection\b[^"]*"[^>]*>/u
        )
        if (!selectionMatch || selectionMatch.index === undefined) {
            return markup
        }

        const t = typeof translate === 'function' ? translate : (key) => key
        const checked = options.autoSearchMissingModels ? ' checked' : ''
        const toggle =
            '<label class="scene-3d__toggle scene-3d__toggle--model-search" title="' +
            AppViewScene3dShellRenderer.#escapeHtml(
                t('scene3d.modelSearchHint')
            ) +
            '"><input type="checkbox"' +
            checked +
            ' data-scene-3d-model-search />' +
            AppViewScene3dShellRenderer.#escapeHtml(
                t('scene3d.autoSearchModels')
            ) +
            '</label>'

        return (
            String(markup).slice(0, selectionMatch.index) +
            toggle +
            String(markup).slice(selectionMatch.index)
        )
    }

    /**
     * Escapes text for HTML attributes and body text.
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
