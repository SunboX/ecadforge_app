import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a minimal KiCad PCB document with a rectangular normalized fallback
 * and a rounded native Edge.Cuts outline.
 * @returns {object}
 */
function createRoundedOutlineDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'sample-board.kicad_pcb',
        pcb: {
            layers: [],
            components: [],
            pads: [],
            tracks: [],
            vias: [],
            polygons: [],
            texts: [],
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 2000, y2: 0 },
                    { type: 'line', x1: 2000, y1: 0, x2: 2000, y2: 1000 },
                    { type: 'line', x1: 2000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            kicadBoard: {
                bounds: {
                    minX: 0,
                    minY: 0,
                    maxX: 20,
                    maxY: 10,
                    width: 20,
                    height: 10
                },
                outlines: [
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 0, y: 0 },
                        end: { x: 15, y: 0 }
                    },
                    {
                        type: 'arc',
                        layer: 'Edge.Cuts',
                        start: { x: 15, y: 0 },
                        mid: { x: 20, y: 5 },
                        end: { x: 15, y: 10 }
                    },
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 15, y: 10 },
                        end: { x: 0, y: 10 }
                    },
                    {
                        type: 'line',
                        layer: 'Edge.Cuts',
                        start: { x: 0, y: 10 },
                        end: { x: 0, y: 0 }
                    }
                ]
            }
        }
    }
}

/**
 * Builds a minimal KiCad PCB document with one explicit WRL model reference.
 * @returns {object}
 */
function createModelReferenceDocument() {
    return {
        sourceFormat: 'kicad',
        kind: 'pcb',
        fileName: 'sample-board.kicad_pcb',
        pcb: {
            layers: [],
            pads: [],
            tracks: [],
            vias: [],
            polygons: [],
            texts: [],
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 1000,
                heightMil: 1000,
                segments: [
                    { type: 'line', x1: 0, y1: 0, x2: 1000, y2: 0 },
                    { type: 'line', x1: 1000, y1: 0, x2: 1000, y2: 1000 },
                    { type: 'line', x1: 1000, y1: 1000, x2: 0, y2: 1000 },
                    { type: 'line', x1: 0, y1: 1000, x2: 0, y2: 0 }
                ]
            },
            components: [
                {
                    designator: 'J1',
                    layer: 'TOP',
                    x: 500,
                    y: 500,
                    width: 100,
                    depth: 100,
                    rotation: 0,
                    pattern: 'CONN_FAKE',
                    source: 'CONN_FAKE',
                    modelName: 'body.wrl',
                    modelPath: '${KIPRJMOD}/parts/body.wrl',
                    modelTransform: null
                }
            ]
        }
    }
}

test('EcadScene3dService preserves KiCad Edge.Cuts arcs in 3D board outlines', () => {
    const scene = EcadScene3dService.build(createRoundedOutlineDocument())

    assert.equal(scene.board.segments.length, 4)
    assert.equal(
        scene.board.segments.some((segment) => segment.type === 'arc'),
        true
    )
    assert.notDeepEqual(
        scene.board.segments.map((segment) => segment.type),
        ['line', 'line', 'line', 'line']
    )
})

test('EcadScene3dService prefers exact KiCad model file extensions', () => {
    const scene = EcadScene3dService.build(createModelReferenceDocument(), {
        sessionAssets: [
            {
                name: 'body.step',
                relativePath: 'sample/parts/body.step',
                file: new Blob([new Uint8Array([1])]),
                format: 'step'
            },
            {
                name: 'body.wrl',
                relativePath: 'sample/parts/body.wrl',
                file: new Blob([new Uint8Array([2])]),
                format: 'wrl'
            }
        ]
    })

    assert.equal(scene.externalModels.length, 1)
    assert.equal(scene.externalModels[0].name, 'body.wrl')
})

test('EcadScene3dService scales KiCad WRL model units into mil scene units', () => {
    const scene = EcadScene3dService.build(createModelReferenceDocument(), {
        sessionAssets: [
            {
                name: 'body.wrl',
                relativePath: 'sample/parts/body.wrl',
                file: new Blob([new Uint8Array([2])]),
                format: 'wrl'
            }
        ]
    })
    const modelPlacement =
        scene.externalPlacements[0] ||
        scene.components.find(
            (component) => component?.externalModel?.format === 'wrl'
        )
    const scale = modelPlacement?.modelTransform?.scale

    assert.equal(modelPlacement.externalModel.format, 'wrl')
    assert.equal(scale.x, 100)
    assert.equal(scale.y, 100)
    assert.equal(scale.z, 100)
})
