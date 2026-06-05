import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dDrillVoidFactory } from '../../src/ui/PcbScene3dDrillVoidFactory.mjs'

/**
 * Builds minimal Three-compatible doubles for drill-void factory tests.
 * @returns {any}
 */
function createFakeThree() {
    class FakeGroup {
        constructor() {
            this.children = []
            this.name = ''
        }

        /**
         * @param {...any} children
         * @returns {void}
         */
        add(...children) {
            this.children.push(...children)
        }
    }

    return {
        Group: FakeGroup
    }
}

test('PcbScene3dDrillVoidFactory leaves through apertures uncapped', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        createFakeThree(),
        {
            silkscreen: {
                top: {
                    drillCutouts: [
                        [
                            { x: 20, y: 30 },
                            { x: 40, y: 30 },
                            { x: 40, y: 50 },
                            { x: 20, y: 50 }
                        ]
                    ]
                }
            },
            pads: [],
            vias: []
        },
        0,
        (x, y) => ({ x, y })
    )

    assert.equal(group.name, 'drill-voids')
    assert.equal(group.children.length, 0)
})

test('PcbScene3dDrillVoidFactory does not cap pad and via drills', () => {
    const group = PcbScene3dDrillVoidFactory.buildGroup(
        createFakeThree(),
        {
            silkscreen: {},
            pads: [{ x: 30, y: 20, holeDiameter: 10 }],
            vias: [{ x: 70, y: 55, holeDiameter: 8 }]
        },
        0,
        (x, y) => ({ x, y })
    )

    assert.equal(group.children.length, 0)
})

test('PcbScene3dDrillVoidFactory renders board-assembly aperture masks from drills', () => {
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
            vias: [{ x: 70, y: 55, holeDiameter: 8 }]
        },
        31,
        -31,
        (x, y) => ({ x: x - 50, y: y - 25 }),
        { enabled: true }
    )

    assert.equal(group.name, 'drill-voids')
    assert.equal(group.children.length, 2)
    assert.equal(group.children[0].name, 'drill-voids-top')
    assert.equal(group.children[1].name, 'drill-voids-bottom')
    assert.equal(group.children[0].geometry.type, 'ShapeGeometry')
    assert.equal(group.children[0].material.color.getHex(), 0xf4f0ea)
    assert.equal(group.children[0].material.depthWrite, false)
    assert.equal(group.children[0].renderOrder > 0, true)
    assert.equal(group.children[0].position.z > 31, true)
    assert.equal(group.children[1].position.z < -31, true)
    assert.equal(group.children[0].geometry.attributes.position.count > 0, true)
})
