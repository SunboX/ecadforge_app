import { AppViewSchematicContentReuseModel } from './AppViewSchematicContentReuseModel.mjs'
import { SchematicComponentSelectionBinder } from './SchematicComponentSelectionBinder.mjs'
import { SchematicSelectionMarkerBoundsResolver } from './SchematicSelectionMarkerBoundsResolver.mjs'
import { SchematicViewRenderer } from './SchematicViewRenderer.mjs'
import { SchematicViewportController } from './SchematicViewportController.mjs'
import { SchematicViewportPreserver } from './SchematicViewportPreserver.mjs'

/**
 * Renders schematic panel content and owns schematic-specific bindings.
 */
export class AppViewSchematicPanelRenderer {
    /**
     * Returns whether mounted schematic content can be reused for a snapshot.
     * @param {HTMLElement | null} contentNode Content mount node.
     * @param {object} snapshot App state snapshot.
     * @returns {boolean}
     */
    static shouldReuse(contentNode, snapshot) {
        return AppViewSchematicContentReuseModel.shouldReuse(
            contentNode,
            snapshot
        )
    }

    /**
     * Captures a schematic viewport before the panel is replaced.
     * @param {HTMLElement | null} contentNode Content mount node.
     * @param {object} snapshot App state snapshot.
     * @returns {string}
     */
    static captureViewport(contentNode, snapshot) {
        return SchematicViewportPreserver.capture(contentNode, snapshot)
    }

    /**
     * Clears remembered schematic panel state from the content node.
     * @param {HTMLElement | null} contentNode Content mount node.
     * @returns {void}
     */
    static clear(contentNode) {
        SchematicViewportPreserver.clear(contentNode)
        AppViewSchematicContentReuseModel.clear(contentNode)
    }

    /**
     * Renders the schematic view and returns active interaction bindings.
     * @param {{ contentNode: HTMLElement, snapshot: object, preservedViewBox: string, onComponentSelectionChange: (change: { documentId: string, componentKey: string, source?: string }) => void, onNetSelectionChange: ((change: { documentId: string, netName: string, source?: string }) => void) | null }} options Render options.
     * @returns {{ svgViewportController: SchematicViewportController | null, selectionDisposer: (() => void) | null }}
     */
    static render(options) {
        const contentNode = options.contentNode
        const snapshot = options.snapshot
        const documentId = String(snapshot?.activeDocumentId || '')
        const selectedComponentKey = String(
            snapshot?.selectedPcbComponents?.[documentId] || ''
        )
        contentNode.innerHTML = SchematicViewRenderer.render(
            snapshot.documentModel,
            selectedComponentKey,
            String(snapshot?.selectedNets?.[documentId] || '')
        )

        const restoredSchematicViewport = SchematicViewportPreserver.restore(
            contentNode,
            options.preservedViewBox
        )
        SchematicViewportPreserver.remember(
            contentNode,
            documentId,
            snapshot.documentModel
        )
        AppViewSchematicContentReuseModel.remember(contentNode, snapshot)

        const svgViewportController =
            AppViewSchematicPanelRenderer.#createViewportController(
                contentNode.querySelector('.schematic-svg')
            )
        SchematicSelectionMarkerBoundsResolver.centerViewport(
            svgViewportController,
            contentNode.innerHTML,
            selectedComponentKey,
            restoredSchematicViewport
        )

        return {
            svgViewportController,
            selectionDisposer: SchematicComponentSelectionBinder.bind(
                contentNode.querySelector('.schematic-svg'),
                documentId,
                options.onComponentSelectionChange,
                options.onNetSelectionChange
            )
        }
    }

    /**
     * Creates a viewport controller when the SVG node has the needed API.
     * @param {any} svgNode Candidate SVG node.
     * @returns {SchematicViewportController | null}
     */
    static #createViewportController(svgNode) {
        if (
            !svgNode ||
            typeof svgNode.getAttribute !== 'function' ||
            typeof svgNode.setAttribute !== 'function' ||
            typeof svgNode.getBoundingClientRect !== 'function' ||
            typeof svgNode.addEventListener !== 'function' ||
            typeof svgNode.removeEventListener !== 'function'
        ) {
            return null
        }

        return new SchematicViewportController(svgNode)
    }
}
