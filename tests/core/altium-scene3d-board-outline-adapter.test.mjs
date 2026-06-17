import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a rasterized board outline that can trigger region-based refinement.
 * @returns {object[]}
 */
function createRasterizedOutlineSegments() {
    const points = [
        { x: 0, y: 100 },
        { x: 72, y: 100 },
        { x: 72, y: 96 },
        { x: 80, y: 96 },
        { x: 80, y: 92 },
        { x: 84, y: 92 },
        { x: 84, y: 88 },
        { x: 88, y: 88 },
        { x: 88, y: 84 },
        { x: 92, y: 84 },
        { x: 92, y: 80 },
        { x: 96, y: 80 },
        { x: 96, y: 72 },
        { x: 100, y: 72 },
        { x: 100, y: 0 },
        { x: 0, y: 0 }
    ]

    return points.map((point, index) => {
        const next = points[(index + 1) % points.length]
        return {
            type: 'line',
            x1: point.x,
            y1: point.y,
            x2: next.x,
            y2: next.y
        }
    })
}

/**
 * Builds a fake Altium PCB where a board-region candidate is inset from the
 * authored edge-cut bounds.
 * @returns {object}
 */
function createInsetRegionPcbDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'generic-board.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 100,
                heightMil: 100,
                segments: createRasterizedOutlineSegments()
            },
            primitiveLayers: [],
            boardRegions: [
                {
                    objectKind: 'BoardRegion',
                    isBoardCutout: true,
                    points: [
                        { x: 4, y: 96 },
                        { x: 4, y: 5 },
                        { x: 95, y: 5 },
                        { x: 95, y: 96 }
                    ]
                }
            ],
            pads: [],
            tracks: [],
            arcs: [],
            vias: [],
            components: [
                {
                    designator: 'U1',
                    x: 70,
                    y: 60,
                    layer: 'TOP',
                    pattern: 'GENERIC',
                    height: 20
                }
            ]
        },
        bom: []
    }
}

/**
 * Asserts that a scene kept the source edge-cut outline.
 * @param {object} scene Scene description.
 * @returns {void}
 */
function assertSourceEdgeCuts(scene) {
    assert.equal(scene.board.minX, 0)
    assert.equal(scene.board.minY, 0)
    assert.equal(scene.board.widthMil, 100)
    assert.equal(scene.board.heightMil, 100)
    assert.equal(scene.board.centerX, 50)
    assert.equal(scene.board.centerY, 50)
    assert.equal(scene.board.segments.length, 16)
    assert.equal(scene.components[0].positionMil.x, 20)
    assert.equal(scene.components[0].positionMil.y, 10)
}

test('ECAD 3D service rejects inset Altium board-region edge-cut replacements', async () => {
    const altiumPcbDocument = createInsetRegionPcbDocument()
    const builtScene = EcadScene3dService.build(altiumPcbDocument)
    const preparedScene = await EcadScene3dService.prepare(altiumPcbDocument)

    assertSourceEdgeCuts(builtScene)
    assertSourceEdgeCuts(preparedScene)
})
