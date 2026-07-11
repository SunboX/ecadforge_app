import assert from 'node:assert/strict'
import test from 'node:test'
import {
    PcbSvgRenderer as AltiumPcbSvgRenderer,
    SchematicSvgRenderer as AltiumSchematicSvgRenderer
} from 'altium-toolkit/extensions'
import { EcadRendererService } from '../../src/core/ecad/EcadRendererService.mjs'

/**
 * Builds a minimal Altium schematic document.
 * @returns {object}
 */
function createSchematicDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'schematic',
        fileName: 'cache-fixture.SchDoc',
        schematic: {
            sheet: { width: 100, height: 80 },
            lines: [],
            texts: [],
            components: [],
            pins: []
        }
    }
}

/**
 * Builds a minimal Altium PCB document.
 * @returns {object}
 */
function createPcbDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'cache-fixture.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 80,
                segments: []
            },
            layers: [{ name: 'Top Layer', layerId: 1 }],
            primitiveLayers: [{ name: 'Top Layer', layerId: 1 }],
            components: [],
            pads: []
        }
    }
}

test('EcadRendererService reuses schematic SVG output for the same parsed document', () => {
    const documentModel = createSchematicDocument()
    const originalRender = AltiumSchematicSvgRenderer.render
    let renderCount = 0

    AltiumSchematicSvgRenderer.render = () => {
        renderCount += 1
        return (
            '<section class="svg-panel"><svg class="schematic-svg">' +
            '<text>' +
            renderCount +
            '</text></svg></section>'
        )
    }

    try {
        const firstMarkup = EcadRendererService.renderSchematic(documentModel)
        const secondMarkup = EcadRendererService.renderSchematic(documentModel)

        assert.equal(renderCount, 1)
        assert.equal(secondMarkup, firstMarkup)
    } finally {
        AltiumSchematicSvgRenderer.render = originalRender
    }
})

test('EcadRendererService caches PCB SVG output separately per board side', () => {
    const documentModel = createPcbDocument()
    const originalRender = AltiumPcbSvgRenderer.render
    let renderCount = 0

    AltiumPcbSvgRenderer.render = () => {
        renderCount += 1
        return (
            '<section class="svg-panel"><svg class="pcb-svg">' +
            '<title>Top-facing composite view</title><text>' +
            renderCount +
            '</text></svg></section>'
        )
    }

    try {
        const firstTop = EcadRendererService.renderPcb(documentModel, {
            side: 'top'
        })
        const secondTop = EcadRendererService.renderPcb(documentModel, {
            side: 'top'
        })
        const bottom = EcadRendererService.renderPcb(documentModel, {
            side: 'bottom'
        })

        assert.equal(renderCount, 2)
        assert.equal(secondTop, firstTop)
        assert.notEqual(bottom, firstTop)
    } finally {
        AltiumPcbSvgRenderer.render = originalRender
    }
})
