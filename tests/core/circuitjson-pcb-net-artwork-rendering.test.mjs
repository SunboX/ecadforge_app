import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { CircuitJsonPcbSvgRenderer } from 'circuitjson-toolkit/extensions'

/**
 * Builds a board with explicit net metadata and a styled note path.
 * @returns {object[]}
 */
function createNetArtworkDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 6,
            height: 4
        },
        {
            type: 'source_net',
            source_net_id: 'source_net_signal',
            name: 'SIGNAL',
            member_source_group_ids: []
        },
        {
            type: 'pcb_net',
            pcb_net_id: 'pcb_net_signal',
            source_net_id: 'source_net_signal',
            highlight_color: '#ff3366'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_signal',
            shape: 'rect',
            x: 0,
            y: 0,
            width: 0.8,
            height: 0.5,
            layer: 'top',
            net: 'SIGNAL'
        },
        {
            type: 'pcb_note_path',
            pcb_note_path_id: 'note_path_1',
            route: [
                { x: -2, y: 1 },
                { x: -1, y: 1 },
                { x: -1, y: 1.6 }
            ],
            stroke_width: 0.11,
            stroke_color: '#123456',
            is_dashed: true,
            dash_length: 0.25,
            dash_gap: 0.1,
            layer: 'top_fabrication'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'net-artwork.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies PCB net highlight metadata reaches primitives and SVG output.
 */
test('CircuitJSON PCB net highlight metadata is renderable', () => {
    const documentModel = createNetArtworkDocument()
    const model = PcbInteractionPrimitiveModel.build(documentModel)
    const pad = model.primitives.find(
        (primitive) => primitive.id === 'pad_signal'
    )
    const svg = CircuitJsonPcbSvgRenderer.render(documentModel)

    assert.deepEqual(model.nets, [
        {
            name: 'SIGNAL',
            sourceNetId: 'source_net_signal',
            pcbNetId: 'pcb_net_signal',
            highlightColor: '#ff3366'
        }
    ])
    assert.equal(pad.netColor, '#ff3366')
    assert.match(svg, /data-net="SIGNAL"/)
    assert.match(svg, /data-net-color="#ff3366"/)
    assert.match(svg, /style="--pcb-net-color: #ff3366"/)
})

/**
 * Verifies note paths render as styled open line segments.
 */
test('CircuitJSON PCB note paths preserve stroke styles', () => {
    const documentModel = createNetArtworkDocument()
    const model = PcbInteractionPrimitiveModel.build(documentModel)
    const noteSegments = model.primitives.filter((primitive) =>
        String(primitive.id || '').startsWith('note_path_1:')
    )
    const hits = PcbInteractionPrimitiveModel.hitTest(
        documentModel,
        { x: -1.5, y: 1 },
        { tolerance: 0.02 }
    )
    const svg = CircuitJsonPcbSvgRenderer.render(documentModel)

    assert.equal(noteSegments.length, 2)
    assert.equal(noteSegments[0].kind, 'note')
    assert.equal(noteSegments[0].width, 0.11)
    assert.equal(noteSegments[0].strokeColor, '#123456')
    assert.equal(noteSegments[0].dashArray, '0.25 0.1')
    assert.equal(
        hits.some((hit) => String(hit.id || '').startsWith('note_path_1:')),
        true
    )
    assert.match(svg, /class="pcb-note"[^>]*stroke="#123456"/)
    assert.match(svg, /stroke-width="0.11"/)
    assert.match(svg, /stroke-dasharray="0.25 0.1"/)
})
