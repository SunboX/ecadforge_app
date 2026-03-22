import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dBoardShapeFactory } from '../../src/ui/PcbScene3dBoardShapeFactory.mjs'

test('PcbScene3dBoardShapeFactory cuts circular and slotted drills into the board shape', () => {
    const shape = PcbScene3dBoardShapeFactory.buildShape(
        THREE,
        {
            widthMil: 100,
            heightMil: 80,
            segments: []
        },
        {
            vias: [{ x: 50, y: 40, diameter: 20, holeDiameter: 12 }],
            pads: [
                {
                    x: 30,
                    y: 20,
                    holeDiameter: 18,
                    holeShape: null,
                    holeSlotLength: null,
                    holeRotation: null
                },
                {
                    x: 70,
                    y: 55,
                    holeDiameter: 12,
                    holeShape: 2,
                    holeSlotLength: 28,
                    holeRotation: 0,
                    rotation: 90
                }
            ]
        },
        (x, y) => ({ x: x - 50, y: y - 40 })
    )

    assert.equal(shape.holes.length, 3)

    const circularDrillBounds = shape.holes[1].getPoints(24).reduce(
        (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            maxX: Math.max(bounds.maxX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxY: Math.max(bounds.maxY, point.y)
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    )
    const slottedDrillBounds = shape.holes[2].getPoints(64).reduce(
        (bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            maxX: Math.max(bounds.maxX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxY: Math.max(bounds.maxY, point.y)
        }),
        { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity }
    )

    assert.ok(circularDrillBounds.maxX - circularDrillBounds.minX > 17)
    assert.ok(circularDrillBounds.maxY - circularDrillBounds.minY > 17)
    assert.ok(slottedDrillBounds.maxX - slottedDrillBounds.minX > 10)
    assert.ok(slottedDrillBounds.maxY - slottedDrillBounds.minY > 20)
    assert.ok(
        slottedDrillBounds.maxY - slottedDrillBounds.minY >
            slottedDrillBounds.maxX - slottedDrillBounds.minX + 6
    )
})
