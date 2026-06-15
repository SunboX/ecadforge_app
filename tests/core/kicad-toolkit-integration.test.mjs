import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from '../../node_modules/kicad-toolkit/src/scene3d.mjs'

/**
 * Converts millimeters to mils.
 * @param {number} value Millimeter value.
 * @returns {number}
 */
function millimetersToMil(value) {
    return (Number(value) * 1000) / 25.4
}

/**
 * Samples the geometric endpoint represented by one arc row.
 * @param {{ x: number, y: number, radius: number, startAngle: number, sweepAngle: number }} arc
 * Arc row.
 * @returns {{ x: number, y: number }}
 */
function sampleArcEndpoint(arc) {
    const angle = ((arc.startAngle + arc.sweepAngle) * Math.PI) / 180

    return {
        x: arc.x + Math.cos(angle) * arc.radius,
        y: arc.y + Math.sin(angle) * arc.radius
    }
}

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
 * Verifies KiCad 3D scene data carries copper keepouts for silkscreen artwork.
 */
test('kicad-toolkit scene3d clips silkscreen around visible copper pads', () => {
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
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 1,
                    holeDiameter: 30
                }
            ],
            vias: [],
            kicadBoard: {
                drawings: [
                    {
                        type: 'line',
                        layer: 'F.SilkS',
                        strokeWidth: 0.2,
                        start: { x: 2, y: 2 },
                        end: { x: 5, y: 2 }
                    }
                ],
                texts: []
            },
            components: []
        }
    })
    const keepout = scene.detail.silkscreen.top.copperCutouts[0]
    const xs = keepout.map((point) => point.x)
    const ys = keepout.map((point) => point.y)

    assert.equal(scene.detail.silkscreen.top.drillCutouts.length, 1)
    assert.equal(keepout.length, 32)
    assert.equal(Math.round(Math.max(...xs) - Math.min(...xs)), 80)
    assert.equal(Math.round(Math.max(...ys) - Math.min(...ys)), 80)
})

/**
 * Verifies long KiCad footprint silkscreen arcs survive scene3d conversion.
 */
test('kicad-toolkit scene3d preserves long silkscreen arc sweeps', () => {
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
            pads: [],
            vias: [],
            kicadBoard: {
                drawings: [
                    {
                        type: 'arc',
                        layer: 'B.SilkS',
                        side: 'back',
                        strokeWidth: 0.2,
                        start: { x: -4, y: -2 },
                        mid: { x: 8, y: 0 },
                        end: { x: -4, y: 2 }
                    }
                ],
                texts: []
            },
            components: []
        }
    })
    const arc = scene.detail.silkscreen.bottom.arcs[0]
    const endpoint = sampleArcEndpoint(arc)
    const expectedEnd = {
        x: millimetersToMil(-4),
        y: scene.board.centerY * 2 - millimetersToMil(2)
    }

    assert.ok(arc)
    assert.ok(Math.abs(arc.sweepAngle) > 180)
    assert.ok(Math.abs(endpoint.x - expectedEnd.x) < 0.001)
    assert.ok(Math.abs(endpoint.y - expectedEnd.y) < 0.001)
})

/**
 * Verifies mirrored bottom silkscreen text keeps KiCad's displayed rotation.
 */
test('kicad-toolkit scene3d keeps mirrored bottom text rotation upright', () => {
    const scene = PcbScene3dBuilder.build({
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 500,
                segments: []
            },
            pads: [],
            vias: [],
            components: [],
            kicadBoard: {
                drawings: [],
                texts: [
                    {
                        value: '-',
                        layer: 'B.SilkS',
                        side: 'back',
                        x: 10,
                        y: 10,
                        rotation: 28,
                        mirrored: true,
                        hAlign: 'center',
                        vAlign: 'center',
                        sizeX: 1,
                        sizeY: 1,
                        thickness: 0.15,
                        visible: true
                    }
                ]
            }
        }
    })
    const track = scene.detail.silkscreen.bottom.tracks[0]

    assert.ok(track.x2 - track.x1 < 0)
    assert.ok(track.y2 - track.y1 > 0)
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
