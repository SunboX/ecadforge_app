import { EcadRendererService } from '../core/ecad/EcadRendererService.mjs'
import { SchematicComponentHighlightRenderer } from './SchematicComponentHighlightRenderer.mjs'
import { SchematicNetDiagnosticOverlayRenderer } from './SchematicNetDiagnosticOverlayRenderer.mjs'
import { SchematicNetHighlightRenderer } from './SchematicNetHighlightRenderer.mjs'
import { SvgPanelChromeStripper } from './SvgPanelChromeStripper.mjs'

/**
 * Renders schematic SVG content for the main viewer pane.
 */
export class SchematicViewRenderer {
    /**
     * Renders one schematic document with app-owned SVG post-processing.
     * @param {object} documentModel Document model.
     * @param {string} [selectedComponentKey] Selected component key.
     * @param {string} [selectedNetName] Selected net name.
     * @param {{ showNetGeometryDiagnostics?: boolean, netGeometryDiagnostics?: object }} [options] Render options.
     * @returns {string}
     */
    static render(
        documentModel,
        selectedComponentKey = '',
        selectedNetName = '',
        options = {}
    ) {
        const markup = SvgPanelChromeStripper.stripMetadataHeader(
            EcadRendererService.renderSchematic(documentModel)
        )
        const componentMarkup = SchematicComponentHighlightRenderer.inject(
            markup,
            documentModel,
            selectedComponentKey
        )
        const netMarkup = SchematicNetHighlightRenderer.inject(
            componentMarkup,
            documentModel,
            selectedNetName
        )
        return SchematicNetDiagnosticOverlayRenderer.inject(
            netMarkup,
            documentModel,
            {
                enabled: Boolean(options.showNetGeometryDiagnostics),
                diagnostics: options.netGeometryDiagnostics
            }
        )
    }
}
