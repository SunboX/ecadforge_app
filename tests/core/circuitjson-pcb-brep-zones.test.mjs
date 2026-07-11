import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbInteractionPrimitiveModel } from 'circuitjson-toolkit/extensions'

/**
 * Builds a compact board with solved copper area geometry.
 * @returns {object[]}
 */
function createSolvedAreaDocument() {
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
            type: 'source_net',
            source_net_id: 'source_net_1',
            name: 'GND',
            member_source_group_ids: []
        },
        {
            type: 'pcb_copper_pour',
            pcb_copper_pour_id: 'pour_1',
            shape: 'brep',
            layer: 'top',
            net: 'GND',
            source_net_id: 'source_net_1',
            covered_with_solder_mask: true,
            brep_shape: {
                outerRing: {
                    cwVertices: [
                        { x: -3, y: -2 },
                        { x: 3, y: -2 },
                        { x: 3, y: 2 },
                        { x: -3, y: 2 },
                        { x: -3, y: -2 }
                    ]
                },
                innerRings: [
                    {
                        cwVertices: [
                            { x: -0.5, y: -0.5 },
                            { x: 0.5, y: -0.5 },
                            { x: 0.5, y: 0.5 },
                            { x: -0.5, y: 0.5 }
                        ]
                    },
                    {
                        cwVertices: [
                            { x: 1, y: 1 },
                            { x: 1.25, y: 1 }
                        ]
                    }
                ]
            }
        },
        {
            type: 'pcb_copper_pour',
            pcb_copper_pour_id: 'pour_2',
            shape: 'brep',
            layer: 'top',
            net: 'GND',
            brep_shapes: [
                {
                    outer_ring: [
                        { x: -2.5, y: 2.3 },
                        { x: -2.2, y: 2.3 },
                        { x: -2.2, y: 2.6 },
                        { x: -2.5, y: 2.6 }
                    ],
                    inner_rings: []
                },
                {
                    outer_ring: [
                        { x: 2, y: 2 },
                        { x: 2, y: 2 },
                        { x: 2, y: 2 }
                    ],
                    inner_rings: []
                }
            ]
        }
    ]
    Object.assign(documentModel, {
        fileName: 'solved-area.json',
        kind: 'pcb',
        sourceFormat: 'circuitjson'
    })
    return documentModel
}

/**
 * Verifies solved copper area rings and metadata are preserved.
 */
test('PcbInteractionPrimitiveModel builds solved copper area rings', () => {
    const model = PcbInteractionPrimitiveModel.build(createSolvedAreaDocument())
    const zone = model.primitives.find((primitive) => primitive.id === 'pour_1')

    assert.ok(zone)
    assert.equal(zone.kind, 'zone')
    assert.equal(zone.shape, 'brep')
    assert.equal(zone.sourceNetId, 'source_net_1')
    assert.equal(zone.coveredWithSolderMask, true)
    assert.equal(zone.netName, 'GND')
    assert.equal(zone.rings.length, 2)
    assert.equal(zone.points.length, 4)
    assert.deepEqual(
        zone.rings.map((ring) => ring.role),
        ['outer', 'hole']
    )
    assert.deepEqual(zone.bounds, {
        minX: -3,
        minY: -2,
        maxX: 3,
        maxY: 2,
        width: 6,
        height: 4
    })
})

/**
 * Verifies unusable rings are reported without dropping valid islands.
 */
test('PcbInteractionPrimitiveModel reports malformed solved copper areas', () => {
    const model = PcbInteractionPrimitiveModel.build(createSolvedAreaDocument())
    const islandZone = model.primitives.find(
        (primitive) => primitive.id === 'pour_2'
    )
    const diagnostics = model.diagnostics.filter((diagnostic) =>
        String(diagnostic.code || '').startsWith('pcb_zone_brep_')
    )

    assert.ok(islandZone)
    assert.equal(islandZone.rings.length, 1)
    assert.equal(islandZone.points.length, 4)
    assert.deepEqual(diagnostics.map((diagnostic) => diagnostic.code).sort(), [
        'pcb_zone_brep_island_dropped',
        'pcb_zone_brep_ring_dropped'
    ])
    assert.equal(
        diagnostics.every((diagnostic) => diagnostic.severity === 'warning'),
        true
    )
})
