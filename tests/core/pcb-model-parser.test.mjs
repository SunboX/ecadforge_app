import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbModelParser } from '../../src/core/altium/PcbModelParser.mjs'

/**
 * Verifies normalized PCB models carry decoded pad geometry through the
 * board-space flip into viewer coordinates.
 */
test('PcbModelParser preserves and normalizes decoded pads', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    KIND0: '0',
                    VX0: '0mil',
                    VY0: '0mil',
                    CX0: '0mil',
                    CY0: '0mil',
                    SA0: '0',
                    EA0: '0',
                    R0: '0mil',
                    KIND1: '0',
                    VX1: '1000mil',
                    VY1: '0mil',
                    CX1: '0mil',
                    CY1: '0mil',
                    SA1: '0',
                    EA1: '0',
                    R1: '0mil',
                    KIND2: '0',
                    VX2: '1000mil',
                    VY2: '500mil',
                    CX2: '0mil',
                    CY2: '0mil',
                    SA2: '0',
                    EA2: '0',
                    R2: '0mil',
                    KIND3: '0',
                    VX3: '0mil',
                    VY3: '500mil',
                    CX3: '0mil',
                    CY3: '0mil',
                    SA3: '0',
                    EA3: '0',
                    R3: '0mil',
                    V9_STACK_LAYER1_NAME: 'Top Layer',
                    V9_STACK_LAYER1_LAYERID: '1'
                }
            }
        ],
        {
            streamNames: ['Board6/Data', 'Pads6/Data'],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                vias: [],
                pads: [
                    {
                        x: 120,
                        y: 80,
                        sizeTopX: 160,
                        sizeTopY: 160,
                        sizeMidX: 160,
                        sizeMidY: 160,
                        sizeBottomX: 160,
                        sizeBottomY: 160,
                        holeDiameter: 90,
                        shapeTop: 1,
                        shapeMid: 1,
                        shapeBottom: 1,
                        rotation: 90,
                        isPlated: true,
                        holeShape: 2,
                        holeSlotLength: 140,
                        holeRotation: 15,
                        hasRoundedRect: false,
                        roundedRectShapeTop: null,
                        cornerRadiusTop: null,
                        offsetTopX: 0,
                        offsetTopY: 0
                    }
                ]
            },
            diagnostics: {
                printableRecordCount: 1,
                printableStreamCount: 1,
                binaryPrimitiveCount: 1
            }
        }
    )

    assert.deepEqual(documentModel.pcb.pads, [
        {
            x: 120,
            y: 420,
            sizeTopX: 160,
            sizeTopY: 160,
            sizeMidX: 160,
            sizeMidY: 160,
            sizeBottomX: 160,
            sizeBottomY: 160,
            holeDiameter: 90,
            shapeTop: 1,
            shapeMid: 1,
            shapeBottom: 1,
            rotation: 270,
            isPlated: true,
            holeShape: 2,
            holeSlotLength: 140,
            holeRotation: 15,
            hasRoundedRect: false,
            roundedRectShapeTop: null,
            cornerRadiusTop: null,
            offsetTopX: 0,
            offsetTopY: 0
        }
    ])
})

/**
 * Verifies normalized PCB models expose legacy primitive layer names used by
 * decoded binary primitives such as overlay and mechanical outline tracks.
 */
test('PcbModelParser exposes primitive layer names for decoded binary layers', () => {
    const documentModel = PcbModelParser.parse(
        'demo.PcbDoc',
        [
            {
                sourceStream: 'Board6/Data',
                fields: {
                    KIND0: '0',
                    VX0: '0mil',
                    VY0: '0mil',
                    CX0: '0mil',
                    CY0: '0mil',
                    SA0: '0',
                    EA0: '0',
                    R0: '0mil',
                    KIND1: '0',
                    VX1: '1000mil',
                    VY1: '0mil',
                    CX1: '0mil',
                    CY1: '0mil',
                    SA1: '0',
                    EA1: '0',
                    R1: '0mil',
                    KIND2: '0',
                    VX2: '1000mil',
                    VY2: '500mil',
                    CX2: '0mil',
                    CY2: '0mil',
                    SA2: '0',
                    EA2: '0',
                    R2: '0mil',
                    KIND3: '0',
                    VX3: '0mil',
                    VY3: '500mil',
                    CX3: '0mil',
                    CY3: '0mil',
                    SA3: '0',
                    EA3: '0',
                    R3: '0mil'
                }
            },
            {
                sourceStream: 'Board6/Data',
                fields: {
                    RECORD: '6',
                    LAYER33NAME: 'Top Overlay',
                    LAYER59NAME: 'M3 Placement Outline',
                    LAYER71NAME: 'M15 Top RefDes'
                }
            }
        ],
        {
            streamNames: ['Board6/Data'],
            binaryPrimitives: {
                fills: [],
                tracks: [],
                vias: [],
                pads: []
            },
            diagnostics: {
                printableRecordCount: 2,
                printableStreamCount: 1,
                binaryPrimitiveCount: 0
            }
        }
    )

    assert.deepEqual(documentModel.pcb.primitiveLayers, [
        { layerId: 33, name: 'Top Overlay' },
        { layerId: 59, name: 'M3 Placement Outline' },
        { layerId: 71, name: 'M15 Top RefDes' }
    ])
})
