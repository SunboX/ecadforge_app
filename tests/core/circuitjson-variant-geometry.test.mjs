import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'
import { CircuitJsonPcbSvgRenderer } from 'circuitjson-toolkit/extensions'

/**
 * Builds a synthetic board with schema variant geometry rows.
 * @returns {object[]}
 */
function createVariantGeometryDocument() {
    const documentModel = [
        {
            type: 'pcb_board',
            pcb_board_id: 'board_1',
            center: { x: 0, y: 0 },
            width: 12,
            height: 8
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
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_round_rect',
            pcb_component_id: 'pcb_u1',
            shape: 'rounded_rect',
            x: -1,
            y: 1,
            width: 1.2,
            height: 0.5,
            corner_radius: 0.08,
            ccw_rotation: 15,
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_smtpad',
            pcb_smtpad_id: 'pad_rot_pill',
            pcb_component_id: 'pcb_u1',
            shape: 'rotated_pill',
            x: 1,
            y: 1,
            width: 1.4,
            height: 0.4,
            ccw_rotation: 30,
            layer: 'top',
            net: 'SIG'
        },
        {
            type: 'pcb_hole',
            pcb_hole_id: 'hole_round_1',
            hole_shape: 'round',
            x: -3,
            y: 0,
            diameter: 0.7,
            layer: 'board'
        },
        {
            type: 'pcb_plated_hole',
            pcb_plated_hole_id: 'hole_poly_pad_1',
            shape: 'hole_with_polygon_pad',
            hole_shape: 'pill',
            x: -2,
            y: -0.8,
            hole_width: 0.6,
            hole_height: 0.24,
            pad_outline: [
                { x: -2.5, y: -1.2 },
                { x: -1.5, y: -1.2 },
                { x: -1.6, y: -0.4 },
                { x: -2.4, y: -0.4 }
            ],
            layer: 'top',
            layers: ['top', 'bottom']
        },
        {
            type: 'pcb_solder_paste',
            pcb_solder_paste_id: 'paste_rot_rect_1',
            shape: 'rotated_rect',
            x: 1.8,
            y: -0.6,
            width: 0.9,
            height: 0.3,
            ccw_rotation: 22,
            layer: 'top'
        },
        {
            type: 'pcb_solder_paste',
            pcb_solder_paste_id: 'paste_oval_1',
            shape: 'oval',
            x: 2.9,
            y: -0.6,
            width: 0.9,
            height: 0.3,
            layer: 'top'
        },
        {
            type: 'pcb_copper_pour',
            pcb_copper_pour_id: 'pour_rect_1',
            shape: 'rect',
            center: { x: 0, y: -1.4 },
            width: 2,
            height: 0.8,
            layer: 'top',
            net: 'GND'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'cutout_circle_1',
            shape: 'circle',
            center: { x: 3, y: 0 },
            radius: 0.45,
            layer: 'board'
        },
        {
            type: 'pcb_cutout',
            pcb_cutout_id: 'cutout_path_1',
            shape: 'path',
            route: [
                { x: 2.2, y: -2 },
                { x: 3.1, y: -2.1 },
                { x: 3.4, y: -1.4 }
            ],
            width: 0.12,
            layer: 'board'
        },
        {
            type: 'pcb_keepout',
            pcb_keepout_id: 'keepout_poly_1',
            shape: 'polygon',
            points: [
                { x: -4, y: -2 },
                { x: -3, y: -2 },
                { x: -3.5, y: -1.3 }
            ],
            layer: 'top'
        }
    ]
    Object.assign(documentModel, {
        fileName: 'variant-board.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies shape variants normalize into renderer-neutral primitives.
 */
test('PcbInteractionPrimitiveModel builds variant CircuitJSON geometry', () => {
    const model = PcbInteractionPrimitiveModel.build(
        createVariantGeometryDocument()
    )

    assert.deepEqual(
        ['pad_round_rect', 'pad_rot_pill', 'hole_round_1', 'pour_rect_1'].map(
            (id) => {
                const primitive = model.primitives.find((row) => row.id === id)
                return {
                    id,
                    kind: primitive.kind,
                    shape: primitive.shape,
                    radius: primitive.radius,
                    rotation: primitive.rotation,
                    points: primitive.points?.length || 0,
                    holeShape: primitive.holeShape || ''
                }
            }
        ),
        [
            {
                id: 'pad_round_rect',
                kind: 'pad',
                shape: 'rounded_rect',
                radius: 0.08,
                rotation: 15,
                points: 0,
                holeShape: ''
            },
            {
                id: 'pad_rot_pill',
                kind: 'pad',
                shape: 'rotated_pill',
                radius: 0.2,
                rotation: 30,
                points: 0,
                holeShape: ''
            },
            {
                id: 'hole_round_1',
                kind: 'via',
                shape: 'circle',
                radius: undefined,
                rotation: 0,
                points: 0,
                holeShape: 'circle'
            },
            {
                id: 'pour_rect_1',
                kind: 'zone',
                shape: 'rect',
                radius: undefined,
                rotation: undefined,
                points: 4,
                holeShape: ''
            }
        ]
    )
    assert.equal(
        model.primitives.find((row) => row.id === 'cutout_circle_1').shape,
        'circle'
    )
    assert.deepEqual(
        model.primitives
            .filter((row) => String(row.id || '').startsWith('cutout_path_1:'))
            .map((row) => ({
                id: row.id,
                kind: row.kind,
                width: row.width
            })),
        [
            { id: 'cutout_path_1:0', kind: 'cutout', width: 0.12 },
            { id: 'cutout_path_1:1', kind: 'cutout', width: 0.12 }
        ]
    )
    const polygonHole = model.primitives.find(
        (row) => row.id === 'hole_poly_pad_1'
    )
    assert.equal(polygonHole.shape, 'polygon')
    assert.equal(polygonHole.points.length, 4)
    assert.equal(polygonHole.holeShape, 'pill')
    assert.equal(polygonHole.holeWidth, 0.6)
    assert.equal(
        model.primitives.find((row) => row.id === 'paste_rot_rect_1').shape,
        'rotated_rect'
    )
    assert.equal(
        model.primitives.find((row) => row.id === 'paste_rot_rect_1').rotation,
        22
    )
    assert.equal(
        model.primitives.find((row) => row.id === 'paste_oval_1').shape,
        'oval'
    )
})

/**
 * Verifies the SVG renderer exposes variant-specific geometry classes.
 */
test('CircuitJsonPcbSvgRenderer renders variant geometry', () => {
    const markup = CircuitJsonPcbSvgRenderer.render(
        createVariantGeometryDocument()
    )

    assert.match(markup, /pcb-pad--rounded_rect/)
    assert.match(markup, /rx="0\.08"/)
    assert.match(markup, /rotate\(15 -1 1\)/)
    assert.match(markup, /pcb-pad--rotated_pill/)
    assert.match(markup, /pcb-via-hole--circle/)
    assert.match(markup, /pcb-via--polygon/)
    assert.match(markup, /pcb-solder-paste--rotated_rect/)
    assert.match(markup, /rotate\(22 1\.8 -0\.6\)/)
    assert.match(markup, /pcb-solder-paste--oval/)
    assert.match(markup, /class="[^"]*\bpcb-zone\b/)
    assert.match(markup, /class="[^"]*\bpcb-cutout\b/)
    assert.match(markup, /class="[^"]*\bpcb-keepout\b/)
})
