import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { AppViewPcbComponentScroller } from './AppViewPcbComponentScroller.mjs'

/**
 * Renders the BOM tab panel and keeps selected rows visible.
 */
export class AppViewBomPanelRenderer {
    /**
     * Renders the BOM panel content.
     * @param {HTMLElement | null} contentNode Viewer content node.
     * @param {{ activeDocumentId?: string, documentModel?: object, selectedPcbComponents?: { [documentId: string]: string } }} snapshot App state snapshot.
     * @param {(key: string) => string} translate Translation lookup.
     * @returns {void}
     */
    static render(contentNode, snapshot, translate) {
        if (!contentNode) return

        const documentId = String(snapshot?.activeDocumentId || '')
        const bomMarkup = EcadRendererService.renderBom(
            snapshot.documentModel,
            {
                selectedComponentKey:
                    snapshot?.selectedPcbComponents?.[documentId] || '',
                translate
            }
        )
        contentNode.innerHTML =
            AppViewBomPanelRenderer.#wrapBomMarkup(bomMarkup)
        AppViewPcbComponentScroller.scrollSelectedBomRowIntoView(
            contentNode,
            snapshot
        )
    }

    /**
     * Ensures toolkit BOM tables have the expected app panel wrapper.
     * @param {string} bomMarkup Renderer BOM markup.
     * @returns {string}
     */
    static #wrapBomMarkup(bomMarkup) {
        return bomMarkup.includes('class="bom-panel"')
            ? bomMarkup
            : '<div class="bom-panel">' + bomMarkup + '</div>'
    }
}
