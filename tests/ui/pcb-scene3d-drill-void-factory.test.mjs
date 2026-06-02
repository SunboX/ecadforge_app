import assert from 'node:assert/strict'
import test from 'node:test'
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
