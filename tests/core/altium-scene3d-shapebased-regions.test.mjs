import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dBuilder } from 'altium-toolkit/extensions'

test('Altium scene builder prefers shape-based overlay regions when available', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 300,
                segments: []
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            fills: [],
            tracks: [],
            arcs: [],
            texts: [],
            regions: [
                {
                    layerId: 34,
                    points: [
                        { x: 20, y: 30 },
                        { x: 180, y: 30 },
                        { x: 180, y: 120 },
                        { x: 20, y: 120 }
                    ],
                    holes: []
                }
            ],
            shapeBasedRegions: [
                {
                    layerId: 34,
                    points: [
                        {
                            x: 60,
                            y: 30,
                            isArc: true,
                            centerX: 60,
                            centerY: 60,
                            radius: 30,
                            startAngle: 270,
                            endAngle: 180
                        },
                        { x: 30, y: 60, isArc: false },
                        { x: 30, y: 140, isArc: false },
                        { x: 180, y: 140, isArc: false },
                        { x: 180, y: 30, isArc: false }
                    ],
                    holes: []
                }
            ],
            pads: [],
            vias: [],
            components: []
        }
    })

    const fill = scene.detail.silkscreen.bottom.fills[0]

    assert.equal(fill.points[0].isArc, true)
    assert.equal(fill.points[0].centerX, 60)
    assert.equal(fill.points.length, 5)
})

test('Altium scene builder keeps dense overlay tracks in silkscreen color while separating knockout color', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: []
            },
            appearance3d: {
                silkscreenBottomColor: 0xebebeb
            },
            primitiveLayers: [{ layerId: 34, name: 'Bottom Overlay' }],
            fills: [],
            tracks: [
                ...Array.from({ length: 260 }, (_, index) => ({
                    layerId: 34,
                    x1: 100 + index,
                    y1: 120,
                    x2: 100 + index,
                    y2: 720,
                    width: 0.57,
                    componentIndex: null,
                    polygonIndex: null
                })),
                {
                    layerId: 34,
                    x1: 80,
                    y1: 100,
                    x2: 920,
                    y2: 100,
                    width: 8,
                    componentIndex: 10,
                    polygonIndex: null
                }
            ],
            arcs: [],
            texts: [],
            regions: [],
            shapeBasedRegions: [
                {
                    layerId: 34,
                    points: [
                        { x: 50, y: 80 },
                        { x: 950, y: 80 },
                        { x: 950, y: 760 },
                        { x: 50, y: 760 }
                    ],
                    holes: []
                }
            ],
            pads: [],
            vias: [],
            components: []
        }
    })

    assert.equal(scene.detail.silkscreen.bottom.tracks.length, 261)
    assert.equal(
        scene.detail.silkscreen.bottom.tracks.filter(
            (track) => track.width === 0.57
        ).length,
        260
    )
    assert.equal(scene.detail.silkscreen.bottom.fillColor, 0xebebeb)
    assert.equal(scene.detail.silkscreen.bottom.strokeColor, 0xebebeb)
    assert.equal(scene.detail.silkscreen.bottom.knockoutColor, 0x2f6a2c)
})

test('Altium scene builder carries embedded PCB fonts into 3D detail', () => {
    const scene = PcbScene3dBuilder.build({
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 400,
                heightMil: 300,
                segments: []
            },
            primitiveLayers: [{ layerId: 33, name: 'Top Overlay' }],
            embeddedFonts: [
                {
                    index: 2,
                    name: 'Panel Mono',
                    style: 'Bold',
                    mimeType: 'font/ttf',
                    payloadBase64: 'AA==',
                    metrics: {
                        emScaleFromPcbHeight: 0.75,
                        weightClass: 700
                    }
                }
            ],
            fills: [],
            tracks: [],
            arcs: [],
            texts: [
                {
                    text: 'LABEL',
                    layerId: 33,
                    x: 20,
                    y: 40,
                    height: 80,
                    fontType: 1,
                    fontTypeName: 'TrueType',
                    fontFamily: 'Panel Mono',
                    fontWeight: 700,
                    fontMetrics: {
                        emScaleFromPcbHeight: 0.75
                    }
                }
            ],
            pads: [],
            vias: [],
            components: []
        }
    })

    assert.equal(scene.detail.embeddedFonts.length, 1)
    assert.equal(scene.detail.embeddedFonts[0].name, 'Panel Mono')
    assert.equal(
        scene.detail.silkscreen.top.texts[0].fontMetrics.emScaleFromPcbHeight,
        0.75
    )
})
