import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { PcbComponentSideAttributeRenderer } from '../../src/ui/PcbComponentSideAttributeRenderer.mjs'
import { PcbDiagnosticFocusRenderer } from '../../src/ui/PcbDiagnosticFocusRenderer.mjs'
import { PcbViewRenderer } from '../../src/ui/PcbViewRenderer.mjs'
import { PcbViewportToolbarRenderer } from '../../src/ui/PcbViewportToolbarRenderer.mjs'

/**
 * Builds a compact canonical PCB with interaction-rich fake data.
 * @returns {object[]}
 */
function createInteractionPcbDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_a',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4
        },
        {
            type: 'source_component',
            source_component_id: 'source_a',
            name: 'A1',
            ftype: 'simple_chip'
        },
        {
            type: 'source_component',
            source_component_id: 'source_b',
            name: 'B1',
            ftype: 'simple_chip'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'component_a',
            source_component_id: 'source_a',
            center: { x: 0, y: 0 },
            width: 1,
            height: 1,
            layer: 'top',
            rotation: 0
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'component_b',
            source_component_id: 'source_b',
            center: { x: 2, y: 1 },
            width: 1,
            height: 1,
            layer: 'bottom',
            rotation: 0
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_a',
            pcb_component_id: 'component_a',
            shape: 'rect',
            x: 0,
            y: 0,
            width: 0.5,
            height: 0.3,
            layer: 'top',
            net: 'NET_A'
        },
        {
            type: 'source_trace',
            source_trace_id: 'source_trace_a',
            connected_source_net_ids: [],
            connected_source_port_ids: []
        },
        {
            type: 'pcb_trace',
            pcb_trace_id: 'trace_a',
            source_trace_id: 'source_trace_a',
            net: 'NET_A',
            route: [
                {
                    route_type: 'wire',
                    x: 0,
                    y: 0,
                    width: 0.2,
                    layer: 'top'
                },
                {
                    route_type: 'wire',
                    x: 1,
                    y: 0,
                    width: 0.2,
                    layer: 'top'
                }
            ]
        },
        {
            type: 'pcb_trace_error',
            pcb_trace_error_id: 'error_a',
            pcb_trace_id: 'trace_a',
            source_trace_id: 'source_trace_a',
            pcb_component_ids: ['component_a'],
            pcb_port_ids: [],
            error_type: 'pcb_trace_error',
            message: 'A fake trace exceeds its budget.'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'interaction-board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Wraps the fake PCB in the common native-source document contract.
 * @returns {object}
 */
function createCanonicalNativePcbDocument() {
    return {
        schema: 'ecad-toolkit.document.v1',
        model: [...createInteractionPcbDocument()],
        source: {
            format: 'altium',
            fileName: 'fake-board.PcbDoc',
            fileType: 'pcb'
        }
    }
}

/**
 * Counts toolkit primitive build requests while one callback runs.
 * @param {() => string} render Render callback.
 * @returns {{ count: number, markup: string }} Build count and rendered markup.
 */
function countPrimitiveBuilds(render) {
    const originalBuild = PcbInteractionPrimitiveModel.build
    let count = 0
    PcbInteractionPrimitiveModel.build = function (documentModel) {
        count += 1
        return originalBuild.call(this, documentModel)
    }

    try {
        const markup = render()
        return { count, markup }
    } finally {
        PcbInteractionPrimitiveModel.build = originalBuild
    }
}

/**
 * Verifies the default hidden-toolbar render avoids primitive preparation.
 */
test('PcbViewRenderer skips unused hidden-toolbar primitive preparation', () => {
    const result = countPrimitiveBuilds(() =>
        PcbViewRenderer.render(createCanonicalNativePcbDocument(), 'top')
    )

    assert.equal(result.count, 0)
    assert.match(result.markup, /data-pcb-component-side="top"/)
    assert.match(
        result.markup,
        /<[^>]*data-pcb-component-side="bottom"[^>]*data-component-key="B1"/
    )
    assert.match(result.markup, /hidden[^>]*data-pcb-view-reset="true"/)
    assert.match(
        result.markup,
        /hidden[^>]*data-pcb-trace-length-toggle="true"/
    )
    assert.doesNotMatch(result.markup, /class="[^"]*\bpcb-diagnostic-panel\b/)
})

/**
 * Verifies incomplete reused component rows retain the primitive fallback.
 */
test('PcbComponentSideAttributeRenderer falls back for unmapped reused rows', () => {
    const documentModel = createInteractionPcbDocument()
    const result = countPrimitiveBuilds(() =>
        PcbComponentSideAttributeRenderer.render(
            '<svg><g data-component-key="A1"></g></svg>',
            documentModel,
            []
        )
    )

    assert.equal(result.count, 1)
    assert.match(result.markup, /data-pcb-component-side="top"/)
})

/**
 * Verifies an already prepared model also serves the unmapped-key fallback.
 */
test('PcbComponentSideAttributeRenderer reuses prepared fallback data', () => {
    const documentModel = createInteractionPcbDocument()
    const interactionModel = PcbInteractionPrimitiveModel.build(documentModel)
    const result = countPrimitiveBuilds(() =>
        PcbComponentSideAttributeRenderer.render(
            '<svg><g data-component-key="A1"></g></svg>',
            documentModel,
            [],
            interactionModel
        )
    )

    assert.equal(result.count, 0)
    assert.match(result.markup, /data-pcb-component-side="top"/)
})

/**
 * Verifies prepared interaction data also focuses tolerant wrapper inputs.
 */
test('PcbDiagnosticFocusRenderer reuses native fallback interaction data', () => {
    const documentModel = {
        sourceFormat: 'altium',
        elements: createInteractionPcbDocument(),
        pcb: { components: [] }
    }
    const interactionModel = PcbInteractionPrimitiveModel.build(documentModel)
    const result = countPrimitiveBuilds(() =>
        PcbDiagnosticFocusRenderer.inject(
            '<svg class="pcb-svg"></svg>',
            documentModel,
            'error_a',
            { context: null, model: interactionModel }
        )
    )

    assert.equal(result.count, 0)
    assert.match(result.markup, /data-pcb-diagnostic-related-preview="true"/)
})

/**
 * Verifies all canonical PCB render consumers share one primitive preparation.
 */
test('PcbViewRenderer prepares canonical PCB interaction primitives once', () => {
    const documentModel = createCanonicalNativePcbDocument()
    const result = countPrimitiveBuilds(() =>
        PcbViewRenderer.render(documentModel, 'top', null, [], [], '', {}, '', {
            measurement: { mode: 'distance' },
            focusedDiagnosticId: 'error_a'
        })
    )

    assert.equal(result.count, 1)
    assert.match(result.markup, /data-pcb-component-side="top"/)
    assert.match(
        result.markup,
        /hidden[^>]*data-pcb-trace-length-toggle="true"/
    )
    assert.match(result.markup, /data-pcb-diagnostic-focus="error_a"/)
    assert.match(result.markup, /data-pcb-diagnostic-related-preview="true"/)
    assert.match(result.markup, /class="pcb-measurement-snap-targets"/)
})

/**
 * Verifies a visible toolbar accepts prepared interaction data without rebuilds.
 */
test('PcbViewportToolbarRenderer reuses prepared visible control data', () => {
    const documentModel = createInteractionPcbDocument()
    const interactionModel = PcbInteractionPrimitiveModel.build(documentModel)
    const result = countPrimitiveBuilds(() =>
        PcbViewportToolbarRenderer.renderControls({
            documentModel,
            interactionModel,
            hidden: false,
            translate: (key) => key
        })
    )

    assert.equal(result.count, 0)
    assert.doesNotMatch(result.markup, /(?:^|\s)hidden(?:\s|>)/)
    assert.match(result.markup, /data-pcb-view-reset="true"/)
    assert.match(result.markup, /data-pcb-trace-length-toggle="true"/)
    assert.match(result.markup, /data-pcb-diagnostic-focus="error_a"/)
})
