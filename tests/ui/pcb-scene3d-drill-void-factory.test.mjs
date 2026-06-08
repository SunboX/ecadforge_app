import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dDrillVoidFactory } from '../../src/ui/PcbScene3dDrillVoidFactory.mjs'
import * as THREE from 'three'

test('PcbScene3dDrillVoidFactory builds open circular drill interiors', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        THREE,
        {
            pads: [{ x: 30, y: 20, holeDiameter: 10 }],
            vias: [{ x: 70, y: 55, holeDiameter: 8 }]
        },
        31,
        -31,
        (x, y) => ({ x: x - 50, y: y - 25 }),
        { enabled: true }
    )

    assert.equal(group.name, 'drill-voids')
    assert.equal(group.children.length, 2)
    assert.equal(group.children[0].geometry.type, 'CylinderGeometry')
    assert.equal(group.children[0].geometry.parameters.openEnded, true)
    assert.equal(group.children[0].rotation.x, Math.PI / 2)
    assert.equal(group.children[0].position.x, 20)
    assert.equal(group.children[0].position.y, 30)
    assert.equal(group.children[0].position.z, 0)
})

test('PcbScene3dDrillVoidFactory skips slotted interiors without capping them', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        THREE,
        {
            pads: [
                {
                    x: 30,
                    y: 20,
                    holeDiameter: 10,
                    holeShape: 2,
                    holeSlotLength: 24,
                    holeRotation: 90
                }
            ],
            vias: []
        },
        31,
        -31,
        (x, y) => ({ x: x - 50, y: y - 25 }),
        { enabled: true }
    )

    assert.equal(group.children.length, 0)
})

test('PcbScene3dDrillVoidFactory leaves plated drill interiors to copper barrels', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        THREE,
        {
            pads: [
                {
                    x: 30,
                    y: 20,
                    holeDiameter: 10,
                    sizeTopX: 28,
                    sizeTopY: 28,
                    sizeBottomX: 28,
                    sizeBottomY: 28
                },
                { x: 44, y: 20, holeDiameter: 8 }
            ],
            vias: [
                { x: 70, y: 55, diameter: 18, holeDiameter: 8 },
                { x: 76, y: 55, holeDiameter: 6 }
            ]
        },
        31,
        -31,
        (x, y) => ({ x: x - 50, y: y - 25 }),
        { enabled: true }
    )

    assert.equal(group.children.length, 2)
    assert.deepEqual(
        group.children
            .map((child) => [child.position.x, child.position.y])
            .sort((left, right) => left[0] - right[0]),
        [
            [-6, -5],
            [26, 30]
        ]
    )
})

test('PcbScene3dDrillVoidFactory skips edge-cutout drill interiors', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        THREE,
        {
            pads: [
                { x: 0, y: 0, holeDiameter: 12 },
                { x: 50, y: 0, holeDiameter: 20 }
            ],
            vias: []
        },
        31,
        -31,
        (x, y) => ({ x, y }),
        {
            enabled: true,
            board: { widthMil: 100, heightMil: 60 }
        }
    )

    assert.equal(group.children.length, 1)
    assert.equal(group.children[0].position.x, 0)
    assert.equal(group.children[0].position.y, 0)
})

test('PcbScene3dDrillVoidFactory stays empty when disabled', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        THREE,
        {
            pads: [{ x: 30, y: 20, holeDiameter: 10 }],
            vias: [{ x: 70, y: 55, holeDiameter: 8 }]
        },
        31,
        -31,
        (x, y) => ({ x: x - 50, y: y - 25 }),
        { enabled: false }
    )

    assert.equal(group.name, 'drill-voids')
    assert.equal(group.children.length, 0)
})
