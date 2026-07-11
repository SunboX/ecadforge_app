import assert from 'node:assert/strict'
import test from 'node:test'
import { DocumentPreferredViewResolver } from '../../src/DocumentPreferredViewResolver.mjs'
import { DocumentViewCompatibility } from '../../src/DocumentViewCompatibility.mjs'
import { EcadCircuitJsonContext } from '../../src/core/ecad/EcadCircuitJsonContext.mjs'
import { EcadCircuitJsonRendererService } from '../../src/core/ecad/EcadCircuitJsonRendererService.mjs'
import { EcadFormatRegistry } from '../../src/core/ecad/EcadFormatRegistry.mjs'

/**
 * Builds one source-neutral canonical document envelope.
 * @param {string} format Native source format.
 * @returns {object}
 */
function canonicalDocument(format) {
    return {
        schema: 'ecad-toolkit.document.v1',
        model: [
            {
                type: 'pcb_board',
                pcb_board_id: 'board_1',
                center: { x: 0, y: 0 },
                width: 10,
                height: 5
            }
        ],
        source: {
            format,
            fileName: 'board.data',
            fileType: 'pcb'
        }
    }
}

test('canonical source documents retain native identity and use CircuitJSON services', () => {
    const document = canonicalDocument('gerber')

    assert.equal(EcadFormatRegistry.isCanonicalDocument(document), true)
    assert.equal(EcadFormatRegistry.isCircuitJsonDocument(document), true)
    assert.equal(EcadFormatRegistry.sourceFormatForDocument(document), 'gerber')
    assert.equal(
        EcadFormatRegistry.circuitJsonElementsForDocument(document),
        document.model
    )
})

test('native hybrid arrays keep their compatibility service path', () => {
    const document = canonicalDocument('altium').model
    Object.assign(document, {
        sourceFormat: 'altium',
        bom: []
    })

    assert.equal(EcadFormatRegistry.isCanonicalDocument(document), false)
    assert.equal(EcadFormatRegistry.isCircuitJsonDocument(document), false)
    assert.equal(EcadFormatRegistry.sourceFormatForDocument(document), 'altium')
})

test('pure CircuitJSON arrays use shared services without legacy metadata', () => {
    const document = canonicalDocument('circuitjson').model

    assert.equal(EcadFormatRegistry.isCircuitJsonDocument(document), true)
    assert.equal(
        EcadFormatRegistry.circuitJsonElementsForDocument(document),
        document
    )
})

test('canonical documents expose viewer compatibility from their model', () => {
    const pcbDocument = canonicalDocument('kicad')
    const schematicDocument = {
        ...canonicalDocument('altium'),
        model: [
            {
                type: 'schematic_sheet',
                schematic_sheet_id: 'sheet_1'
            },
            {
                type: 'source_component',
                source_component_id: 'source_r1',
                name: 'R1',
                ftype: 'simple_resistor',
                resistance: '1k'
            }
        ]
    }

    assert.equal(
        DocumentViewCompatibility.supportsView(pcbDocument, 'pcb'),
        true
    )
    assert.equal(
        DocumentViewCompatibility.supportsView(pcbDocument, '3d'),
        true
    )
    assert.equal(DocumentPreferredViewResolver.resolve(pcbDocument), 'pcb')
    assert.equal(
        DocumentViewCompatibility.supportsView(schematicDocument, 'schematic'),
        true
    )
    assert.equal(
        DocumentViewCompatibility.supportsView(schematicDocument, 'bom'),
        true
    )
    assert.equal(
        DocumentPreferredViewResolver.resolve(schematicDocument),
        'schematic'
    )
})

test('canonical source metadata alone does not invent BOM compatibility', () => {
    const diagnosticDocument = {
        ...canonicalDocument('circuitjson'),
        model: [
            {
                type: 'source_unnamed_trace_warning',
                source_unnamed_trace_warning_id: 'warning_1',
                source_trace_id: 'source_trace_1',
                message: 'Unnamed trace.'
            }
        ],
        diagnostics: []
    }
    const bomDocument = {
        ...diagnosticDocument,
        model: [
            {
                type: 'source_component',
                source_component_id: 'source_r1',
                name: 'R1',
                ftype: 'simple_resistor',
                resistance: '1k'
            }
        ]
    }

    assert.equal(
        DocumentViewCompatibility.supportsView(diagnosticDocument, 'bom'),
        false
    )
    assert.equal(
        DocumentViewCompatibility.supportsView(bomDocument, 'bom'),
        true
    )
    assert.equal(DocumentPreferredViewResolver.resolve(bomDocument), 'bom')
})

test('app services reuse one prepared CircuitJSON context and its indexes', () => {
    const document = canonicalDocument('gerber')
    const first = EcadCircuitJsonContext.prepare(document, {
        indexes: ['elements']
    })
    const second = EcadCircuitJsonContext.prepare(document, {
        indexes: ['elements']
    })

    assert.equal(first, second)
    assert.equal(first.document.source.format, 'gerber')
    assert.equal(first.hasIndex('elements'), true)
    assert.equal(first.statistics.validationPasses, 1)
    assert.equal(first.statistics.indexBuilds.elements, 1)
})

test('shared renderer services consume canonical native-source envelopes', () => {
    const document = canonicalDocument('altium')
    const firstMarkup = EcadCircuitJsonRendererService.renderPcb(document, {
        side: 'top'
    })
    const secondMarkup = EcadCircuitJsonRendererService.renderPcb(document, {
        side: 'top'
    })
    const layers =
        EcadCircuitJsonRendererService.resolvePcbInteractionLayers(document)
    const context = EcadCircuitJsonContext.prepare(document)

    assert.equal(firstMarkup, secondMarkup)
    assert.match(firstMarkup, /<svg/u)
    assert.equal(Array.isArray(layers.physicalLayers), true)
    assert.equal(context.statistics.validationPasses, 1)
})

test('shared renderer services preserve app-localizable canonical BOM rows', () => {
    const document = {
        ...canonicalDocument('kicad'),
        model: [
            {
                type: 'source_component',
                source_component_id: 'source_r1',
                name: 'R1',
                resistance: '10k',
                ftype: 'simple_resistor'
            }
        ]
    }

    assert.deepEqual(
        EcadCircuitJsonRendererService.buildBomRows(document).map((row) => ({
            designators: row.designators,
            quantity: row.quantity,
            value: row.value,
            pattern: row.pattern
        })),
        [
            {
                designators: ['R1'],
                quantity: 1,
                value: '10k',
                pattern: 'simple_resistor'
            }
        ]
    )
})
