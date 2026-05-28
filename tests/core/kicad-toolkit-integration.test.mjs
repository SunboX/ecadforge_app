import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../node_modules/kicad-toolkit/src/scene3d.mjs'

/**
 * Verifies KiCad 3D scene data carries drill cutouts for silkscreen artwork.
 */
test('kicad-toolkit scene3d clips silkscreen fills around drilled pads and vias', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: []
            },
            pads: [
                {
                    x: 120,
                    y: 82,
                    holeDiameter: 40,
                    holeShape: 2,
                    holeSlotLength: 80,
                    rotation: 90,
                    holeRotation: 0
                },
                {
                    x: 330,
                    y: 80,
                    holeDiameter: 40
                }
            ],
            vias: [{ x: 300, y: 100, holeDiameter: 24 }],
            kicadBoard: {
                drawings: [
                    {
                        type: 'rect',
                        layer: 'F.SilkS',
                        fill: true,
                        start: { x: 2, y: 1 },
                        end: { x: 8.5, y: 3.2 }
                    }
                ],
                texts: []
            },
            components: []
        }
    })

    const fill = scene.detail.silkscreen.top.fills[0]
    const topCutouts = scene.detail.silkscreen.top.drillCutouts
    const bottomCutouts = scene.detail.silkscreen.bottom.drillCutouts

    assert.ok(fill, 'Expected a top silkscreen fill')
    assert.equal(fill.holes.length, 2)
    assert.equal(topCutouts.length, 3)
    assert.equal(bottomCutouts.length, 3)
    assert.ok(fill.holes.every((hole) => hole.length >= 12))
    assert.ok(
        fill.holes.some((hole) => {
            const xs = hole.map((point) => point.x)
            const ys = hole.map((point) => point.y)

            return (
                Math.max(...xs) - Math.min(...xs) > 80 ||
                Math.max(...ys) - Math.min(...ys) >= 80
            )
        }),
        'Expected the slotted pad drill to be included as a long cutout'
    )
    assert.ok(
        fill.holes.every((hole) =>
            hole.every(
                (point) =>
                    point.x >= fill.x1 &&
                    point.x <= fill.x2 &&
                    point.y >= fill.y1 &&
                    point.y <= fill.y2
            )
        ),
        'Expected partially overlapping drill contours to stay out of fill holes'
    )
})

/**
 * Verifies KiCad footprint rotations stay in KiCad 3D renderer orientation.
 */
test('kicad-toolkit scene3d keeps raw component rotations for 3D placements', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 500,
                heightMil: 400,
                segments: []
            },
            components: [
                { designator: 'U1', x: 100, y: 100, rotation: 90 },
                {
                    designator: 'U2',
                    x: 200,
                    y: 100,
                    layer: 'BOTTOM',
                    rotation: -45
                }
            ],
            pads: [],
            vias: []
        }
    })

    assert.equal(scene.components[0].rotationDeg, 90)
    assert.equal(scene.components[1].rotationDeg, -45)
})
