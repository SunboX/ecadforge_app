import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'

/**
 * Builds a compact board with route-based documentation artwork.
 * @returns {object[]}
 */
function createArtworkPathDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 8,
            height: 6,
            num_layers: 2
        },
        {
            type: 'source_component',
            source_component_id: 'source_u1',
            name: 'U1'
        },
        {
            type: 'pcb_component',
            pcb_component_id: 'pcb_u1',
            source_component_id: 'source_u1',
            center: { x: 0, y: 0 },
            layer: 'top'
        },
        {
            type: 'pcb_silkscreen_path',
            pcb_silkscreen_path_id: 'silk_path_route',
            pcb_component_id: 'pcb_u1',
            route: [
                { x: 0.2, y: 1.8 },
                { x: 1, y: 1.8 },
                { x: 1, y: 2.2 }
            ],
            width: 0.08,
            layer: 'top_silkscreen'
        },
        {
            type: 'pcb_fabrication_note_path',
            pcb_fabrication_note_path_id: 'fab_path_route',
            pcb_component_id: 'pcb_u1',
            points: [
                { x: -1.4, y: 1.8 },
                { x: -0.8, y: 1.8 },
                { x: -0.8, y: 2.2 }
            ],
            width: 0.06,
            layer: 'top_fabrication'
        },
        {
            type: 'pcb_courtyard_rect',
            pcb_courtyard_rect_id: 'courtyard_rect_1',
            center: { x: 2.6, y: -1.6 },
            width: 1,
            height: 0.8,
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_courtyard_circle',
            pcb_courtyard_circle_id: 'courtyard_circle_1',
            center: { x: -2.6, y: -1.6 },
            radius: 0.5,
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_courtyard_outline',
            pcb_courtyard_outline_id: 'courtyard_outline_1',
            points: [
                { x: -0.6, y: 2.4 },
                { x: 0.6, y: 2.4 },
                { x: 0.6, y: 3 },
                { x: -0.6, y: 3 }
            ],
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_courtyard_path',
            pcb_courtyard_path_id: 'courtyard_path_1',
            route: [
                { x: 1.4, y: 2.6 },
                { x: 2.2, y: 2.6 },
                { x: 2.2, y: 2 }
            ],
            width: 0.06,
            layer: 'top_courtyard'
        },
        {
            type: 'pcb_courtyard_line',
            pcb_courtyard_line_id: 'courtyard_line_1',
            start: { x: -2.2, y: 2.6 },
            end: { x: -1.4, y: 2.6 },
            width: 0.06,
            layer: 'top_courtyard'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'artwork-paths.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

test('PcbInteractionPrimitiveModel expands CircuitJSON artwork paths', () => {
    const model = PcbInteractionPrimitiveModel.build(
        createArtworkPathDocument()
    )
    const primitiveById = new Map(
        model.primitives.map((primitive) => [primitive.id, primitive])
    )

    assert.deepEqual(
        [
            primitiveById.get('silk_path_route:0'),
            primitiveById.get('silk_path_route:1')
        ].map((primitive) => ({
            kind: primitive?.kind,
            componentKey: primitive?.componentKey,
            layer: primitive?.layer
        })),
        [
            {
                kind: 'silkscreen',
                componentKey: 'U1',
                layer: 'top_silkscreen'
            },
            {
                kind: 'silkscreen',
                componentKey: 'U1',
                layer: 'top_silkscreen'
            }
        ]
    )
    assert.deepEqual(
        [
            primitiveById.get('fab_path_route:0'),
            primitiveById.get('fab_path_route:1')
        ].map((primitive) => ({
            kind: primitive?.kind,
            componentKey: primitive?.componentKey,
            layer: primitive?.layer
        })),
        [
            {
                kind: 'fabrication',
                componentKey: 'U1',
                layer: 'top_fabrication'
            },
            {
                kind: 'fabrication',
                componentKey: 'U1',
                layer: 'top_fabrication'
            }
        ]
    )
    assert.deepEqual(
        [
            primitiveById.get('courtyard_rect_1'),
            primitiveById.get('courtyard_circle_1'),
            primitiveById.get('courtyard_outline_1'),
            primitiveById.get('courtyard_path_1:0'),
            primitiveById.get('courtyard_path_1:1'),
            primitiveById.get('courtyard_line_1:0')
        ].map((primitive) => ({
            kind: primitive?.kind,
            layer: primitive?.layer
        })),
        [
            { kind: 'courtyard', layer: 'top_courtyard' },
            { kind: 'courtyard', layer: 'top_courtyard' },
            { kind: 'courtyard', layer: 'top_courtyard' },
            { kind: 'courtyard', layer: 'top_courtyard' },
            { kind: 'courtyard', layer: 'top_courtyard' },
            { kind: 'courtyard', layer: 'top_courtyard' }
        ]
    )
})

test('PcbInteractionPrimitiveModel hit tests CircuitJSON artwork paths', () => {
    const documentModel = createArtworkPathDocument()

    const silkHits = PcbInteractionPrimitiveModel.hitTest(
        documentModel,
        { x: 0.6, y: 1.8 },
        { tolerance: 0.02 }
    )
    const fabHits = PcbInteractionPrimitiveModel.hitTest(
        documentModel,
        { x: -1, y: 1.8 },
        { tolerance: 0.02 }
    )

    assert.equal(
        silkHits.some(
            (hit) => hit.source?.pcb_silkscreen_path_id === 'silk_path_route'
        ),
        true
    )
    assert.equal(
        fabHits.some(
            (hit) =>
                hit.source?.pcb_fabrication_note_path_id === 'fab_path_route'
        ),
        true
    )
})
