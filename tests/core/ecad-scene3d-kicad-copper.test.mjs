import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dPadFactory } from 'pcb-scene3d-viewer/scene3d'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a small KiCad PCB document with front, back, and inner routes.
 * @returns {object}
 */
function createKicadCopperDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 800,
                segments: []
            },
            layers: [],
            components: [],
            pads: [],
            vias: [],
            tracks: [
                {
                    x1: 100,
                    y1: 100,
                    x2: 300,
                    y2: 100,
                    width: 10,
                    layerId: 0,
                    layerCode: 1,
                    netName: 'TOP_NET'
                },
                {
                    x1: 100,
                    y1: 200,
                    x2: 300,
                    y2: 200,
                    width: 10,
                    layerId: 31,
                    layerCode: 1,
                    netName: 'BOTTOM_NET'
                },
                {
                    x1: 100,
                    y1: 300,
                    x2: 300,
                    y2: 300,
                    width: 10,
                    layer: 'In1.Cu',
                    layerId: 1,
                    layerCode: 1,
                    netName: 'INNER_NET'
                }
            ],
            arcs: [
                {
                    x: 500,
                    y: 400,
                    radius: 60,
                    startAngle: 0,
                    endAngle: 90,
                    sweepAngle: 90,
                    width: 10,
                    layerId: 0,
                    layerCode: 1,
                    netName: 'ARC_NET'
                }
            ]
        }
    }
}

/**
 * Builds a small KiCad PCB document with routes crossing pads and holes.
 * @returns {object}
 */
function createKicadCopperCutoutDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 800,
                segments: []
            },
            layers: [],
            components: [],
            pads: [
                {
                    x: 200,
                    y: 100,
                    holeDiameter: 40,
                    hasTopSolderMaskOpening: false,
                    hasBottomSolderMaskOpening: false
                },
                {
                    x: 200,
                    y: 200,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 1
                }
            ],
            vias: [],
            tracks: [
                {
                    x1: 100,
                    y1: 100,
                    x2: 300,
                    y2: 100,
                    width: 10,
                    layerId: 0,
                    layerCode: 1,
                    netName: 'DRILLED_NET'
                },
                {
                    x1: 100,
                    y1: 200,
                    x2: 300,
                    y2: 200,
                    width: 10,
                    layerId: 0,
                    layerCode: 1,
                    netName: 'PAD_NET'
                }
            ],
            arcs: []
        }
    }
}

/**
 * Builds a KiCad PCB document with silkscreen fill cut by round and rectangular
 * copper keepouts.
 * @returns {object}
 */
function createKicadSilkscreenCutoutDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 600,
                heightMil: 500,
                segments: []
            },
            layers: [],
            components: [],
            pads: [
                {
                    x: 100,
                    y: 160,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 0
                },
                {
                    x: 160,
                    y: 160,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 1,
                    holeDiameter: 30
                },
                {
                    x: 220,
                    y: 160,
                    sizeTopX: 90,
                    sizeTopY: 50,
                    shapeTop: 2
                },
                {
                    x: 300,
                    y: 160,
                    sizeTopX: 90,
                    sizeTopY: 50,
                    shapeTop: 4
                }
            ],
            vias: [],
            tracks: [],
            arcs: [],
            kicadBoard: {
                drawings: [
                    {
                        type: 'rect',
                        layer: 'F.SilkS',
                        fill: true,
                        start: { x: 2, y: 2 },
                        end: { x: 9.5, y: 5 }
                    }
                ],
                texts: []
            }
        }
    }
}

/**
 * Builds a KiCad PCB document with the pad shape codes that differ from the
 * shared renderer shape contract.
 * @returns {object}
 */
function createKicadPadShapeDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 700,
                heightMil: 400,
                segments: []
            },
            layers: [],
            components: [],
            pads: [
                {
                    name: 'rect-square',
                    x: 100,
                    y: 100,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 0,
                    hasRoundedRect: true,
                    roundedRectShapeTop: 0,
                    cornerRadiusTop: 25
                },
                {
                    name: 'oval-square',
                    x: 220,
                    y: 100,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 2
                },
                {
                    name: 'oval-oblong',
                    x: 340,
                    y: 100,
                    sizeTopX: 120,
                    sizeTopY: 60,
                    shapeTop: 2,
                    hasRoundedRect: true,
                    roundedRectShapeTop: 2,
                    cornerRadiusTop: 25
                },
                {
                    name: 'roundrect-square',
                    x: 480,
                    y: 100,
                    sizeTopX: 80,
                    sizeTopY: 80,
                    shapeTop: 4,
                    hasRoundedRect: true,
                    roundedRectShapeTop: 4,
                    cornerRadiusTop: 25
                }
            ],
            vias: [],
            tracks: [],
            arcs: [],
            kicadBoard: {
                drawings: [
                    {
                        type: 'rect',
                        layer: 'F.SilkS',
                        fill: true,
                        start: { x: 1, y: 1 },
                        end: { x: 14, y: 4 }
                    }
                ],
                texts: []
            }
        }
    }
}

/**
 * Builds overlapping pad faces that represent one authored contact area.
 * @returns {object[]}
 */
function createOverlappingPadFaces() {
    return [
        {
            number: 'A',
            x: 100,
            y: 100,
            rotation: 0,
            sizeTopX: 80,
            sizeTopY: 80,
            shapeTop: 1,
            holeDiameter: 52
        },
        {
            number: 'B',
            x: 100,
            y: 135,
            rotation: 0,
            sizeTopX: 80,
            sizeTopY: 110,
            shapeTop: 2
        }
    ]
}

/**
 * Keeps test board coordinates in renderer units.
 * @param {number} x Board X coordinate.
 * @param {number} y Board Y coordinate.
 * @returns {{ x: number, y: number }}
 */
function identityBoardPoint(x, y) {
    return { x, y }
}

/**
 * Extracts one track's X endpoints.
 * @param {object} track Track scene detail.
 * @returns {number[]}
 */
function trackX(track) {
    return [track.x1, track.x2].map((value) => Math.round(value))
}

/**
 * Verifies KiCad route layers are normalized for the shared 3D copper renderer.
 */
test('EcadScene3dService maps KiCad outer copper routes to renderer layer ids', () => {
    const scene = EcadScene3dService.build(createKicadCopperDocument())

    assert.deepEqual(
        scene.detail.tracks.map((track) => track.layerId),
        [1, 32, -1]
    )
    assert.deepEqual(
        scene.detail.tracks.map((track) => track.layerCode),
        [1, 32, -1]
    )
    assert.equal(scene.tracks[0].sourceLayerId, 0)
    assert.equal(scene.tracks[1].sourceLayerId, 31)
    assert.equal(scene.detail.arcs[0].layerId, 1)
    assert.equal(scene.detail.arcs[0].sourceLayerId, 0)
})

/**
 * Verifies KiCad tracks are split around drill and exposed pad geometry.
 */
test('EcadScene3dService cuts KiCad 3D traces around holes and exposed pads', () => {
    const scene = EcadScene3dService.build(createKicadCopperCutoutDocument())
    const drilledSegments = scene.detail.tracks.filter(
        (track) => track.netName === 'DRILLED_NET'
    )
    const padSegments = scene.detail.tracks.filter(
        (track) => track.netName === 'PAD_NET'
    )

    assert.deepEqual(drilledSegments.map(trackX), [
        [100, 175],
        [225, 300]
    ])
    assert.equal(drilledSegments[0].capEndRound, false)
    assert.equal(drilledSegments[0].capEndSideWall, false)
    assert.equal(drilledSegments[1].capStartRound, false)
    assert.equal(drilledSegments[1].capStartSideWall, false)
    assert.deepEqual(padSegments.map(trackX), [
        [100, 155],
        [245, 300]
    ])
    assert.equal(padSegments[0].capEndRound, false)
    assert.equal(padSegments[1].capStartRound, false)
})

/**
 * Verifies KiCad pad shape codes are adapted to the shared 3D renderer.
 */
test('EcadScene3dService maps KiCad pad shape codes to renderer geometry', () => {
    const scene = EcadScene3dService.build(createKicadPadShapeDocument())
    const [rectSquare, ovalSquare, ovalOblong, roundrectSquare] =
        scene.detail.pads
    const specs = scene.detail.pads.map((pad) =>
        PcbScene3dPadFactory.resolvePadSurfaceSpec(pad, 'top')
    )
    const topSilkscreen = scene.detail.silkscreen.top

    assert.equal(rectSquare.sourceShapeTop, 0)
    assert.equal(rectSquare.shapeTop, 2)
    assert.equal(specs[0].kind, 'rect')

    assert.equal(ovalSquare.sourceShapeTop, 2)
    assert.equal(ovalSquare.shapeTop, 1)
    assert.equal(specs[1].kind, 'circle')

    assert.equal(ovalOblong.sourceShapeTop, 2)
    assert.equal(ovalOblong.shapeTop, 2)
    assert.equal(ovalOblong.hasRoundedRect, true)
    assert.equal(ovalOblong.cornerRadiusTop, 50)
    assert.equal(specs[2].kind, 'rounded-rect')

    assert.equal(roundrectSquare.sourceShapeTop, 4)
    assert.equal(roundrectSquare.shapeTop, 2)
    assert.equal(roundrectSquare.roundedRectShapeTop, 2)
    assert.equal(specs[3].kind, 'rounded-rect')

    assert.ok(
        topSilkscreen.copperCutouts.some((cutout) => cutout.length === 4),
        'Expected rectangular KiCad pad to remain a rectangular keepout'
    )
    assert.ok(
        topSilkscreen.copperCutouts.some((cutout) => cutout.length >= 96),
        'Expected square KiCad oval pad to become a circular keepout'
    )
    assert.ok(
        topSilkscreen.copperCutouts.filter(
            (cutout) => cutout.length >= 64 && cutout.length < 96
        ).length >= 2,
        'Expected oblong oval and roundrect pads to use rounded keepouts'
    )
})

/**
 * Verifies KiCad curved silkscreen keepouts render without coarse stair steps.
 */
test('EcadScene3dService smooths KiCad curved silkscreen cutouts', () => {
    const scene = EcadScene3dService.build(
        createKicadSilkscreenCutoutDocument()
    )
    const topSilkscreen = scene.detail.silkscreen.top
    const circularCopperKeepout = topSilkscreen.copperCutouts.find(
        (cutout) => cutout.length > 8
    )
    const rectangularCopperKeepout = topSilkscreen.copperCutouts.find(
        (cutout) => cutout.length === 4
    )
    const roundedCopperKeepout = topSilkscreen.copperCutouts.find(
        (cutout) => cutout.length > 4 && cutout.length < 96
    )
    assert.ok(
        topSilkscreen.drillCutouts[0].length >= 256,
        'Expected drill cutout to use a high-resolution circular contour'
    )
    assert.ok(
        circularCopperKeepout.length >= 256,
        'Expected circular pad keepout to use a high-resolution circular contour'
    )
    assert.ok(
        roundedCopperKeepout.length >= 64,
        'Expected rounded pad keepout to use dense rounded corners'
    )
    assert.equal(rectangularCopperKeepout.length, 4)
    assert.equal(
        topSilkscreen.fills[0].holes?.length || 0,
        0,
        'Expected generated keepouts to stay as side cutouts for shape holes'
    )
})

/**
 * Verifies overlapping KiCad pad faces keep drilled annular rings visible.
 */
test('PcbScene3dPadFactory stacks drilled KiCad pads above SMD contacts', () => {
    const group = PcbScene3dPadFactory.buildGroup(
        THREE,
        createOverlappingPadFaces(),
        10,
        identityBoardPoint,
        { side: 'top' }
    )
    const meshZPositions = group.children.map((root) =>
        Number(root.children[0]?.position?.z || 0)
    )

    assert.ok(
        meshZPositions[0] > meshZPositions[1],
        'Expected the drilled annular ring to render above the overlapping SMD contact'
    )
})
