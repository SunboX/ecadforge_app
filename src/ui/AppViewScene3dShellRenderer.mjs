import { PcbScene3dShellRenderer as Scene3dRenderer } from 'pcb-scene3d-viewer'

/**
 * Adapts the shared 3D scene shell for the app's active viewer layout.
 */
export class AppViewScene3dShellRenderer {
    /**
     * Renders the active app 3D shell without the compact stats strip.
     * @param {any} documentModel Active document model.
     * @param {((key: string) => string) | null} [translate] Translation lookup.
     * @returns {string}
     */
    static render(documentModel, translate = null) {
        return AppViewScene3dShellRenderer.#removeStatsStrip(
            Scene3dRenderer.render(documentModel, translate)
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
}
