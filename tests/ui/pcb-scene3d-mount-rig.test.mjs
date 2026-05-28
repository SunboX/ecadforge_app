import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dMountRig } from '../../src/ui/PcbScene3dMountRig.mjs'

/**
 * Minimal vector holder for mount-rig tests.
 */
class FakeVector3 {
    /** @type {number} */
    x

    /** @type {number} */
    y

    /** @type {number} */
    z

    constructor() {
        this.x = 0
        this.y = 0
        this.z = 0
    }

    /**
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {void}
     */
    set(x, y, z) {
        this.x = x
        this.y = y
        this.z = z
    }
}

/**
 * Minimal Euler holder for mount-rig tests.
 */
class FakeEuler {
    /** @type {number} */
    x

    /** @type {number} */
    y

    /** @type {number} */
    z

    constructor() {
        this.x = 0
        this.y = 0
        this.z = 0
    }
}

/**
 * Minimal group implementation for mount-rig tests.
 */
class FakeGroup {
    /** @type {any[]} */
    children

    /** @type {FakeVector3} */
    position

    /** @type {FakeEuler} */
    rotation

    constructor() {
        this.children = []
        this.position = new FakeVector3()
        this.rotation = new FakeEuler()
    }

    /**
     * @param {any} child
     * @returns {void}
     */
    add(child) {
        this.children.push(child)
    }
}

test('PcbScene3dMountRig keeps top-side placements on the authored board face', () => {
    const rig = PcbScene3dMountRig.create(
        { Group: FakeGroup },
        {
            mountSide: 'top',
            rotationDeg: 180,
            positionMil: { x: 10, y: 20, z: 31.5 }
        }
    )

    assert.equal(rig.rootGroup.position.x, 10)
    assert.equal(rig.rootGroup.position.y, 20)
    assert.equal(rig.rootGroup.position.z, 0)
    assert.equal(rig.rootGroup.children[0], rig.orientationGroup)
    assert.equal(rig.orientationGroup.children[0], rig.sideGroup)
    assert.equal(rig.sideGroup.children[0], rig.faceGroup)
    assert.equal(rig.orientationGroup.rotation.z, Math.PI)
    assert.equal(rig.sideGroup.rotation.x, 0)
    assert.equal(rig.sideGroup.rotation.y, 0)
    assert.equal(rig.sideGroup.rotation.z, 0)
    assert.equal(rig.faceGroup.position.z, 31.5)
    assert.equal(rig.faceGroup.rotation.z, 0)
})

test('PcbScene3dMountRig flips bottom-side placements under the board face', () => {
    const rig = PcbScene3dMountRig.create(
        { Group: FakeGroup },
        {
            mountSide: 'bottom',
            rotationDeg: 90,
            positionMil: { x: -15, y: 25, z: -31.5 }
        }
    )

    assert.equal(rig.rootGroup.position.x, -15)
    assert.equal(rig.rootGroup.position.y, 25)
    assert.equal(rig.rootGroup.position.z, 0)
    assert.equal(rig.rootGroup.children[0], rig.orientationGroup)
    assert.equal(rig.orientationGroup.children[0], rig.sideGroup)
    assert.equal(rig.sideGroup.children[0], rig.faceGroup)
    assert.equal(rig.orientationGroup.rotation.z, Math.PI / 2)
    assert.equal(rig.sideGroup.rotation.x, 0)
    assert.equal(rig.sideGroup.rotation.y, Math.PI)
    assert.equal(rig.sideGroup.rotation.z, Math.PI)
    assert.equal(rig.faceGroup.position.z, 31.5)
    assert.equal(rig.faceGroup.rotation.z, 0)
})
