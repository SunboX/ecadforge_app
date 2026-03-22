import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dSelectionStyler } from '../../src/ui/PcbScene3dSelectionStyler.mjs'

/**
 * Minimal fake color implementation for selection highlight tests.
 */
class FakeColor {
    /** @type {number} */
    #hex

    /**
     * @param {number} hex
     */
    constructor(hex) {
        this.#hex = hex
    }

    /**
     * @returns {number}
     */
    getHex() {
        return this.#hex
    }

    /**
     * @param {number} hex
     * @returns {void}
     */
    setHex(hex) {
        this.#hex = hex
    }
}

/**
 * Minimal fake material implementation.
 */
class FakeMaterial {
    /** @type {FakeColor} */
    color

    /** @type {FakeColor} */
    emissive

    /** @type {number} */
    emissiveIntensity

    /** @type {Record<string, any>} */
    userData

    constructor() {
        this.color = new FakeColor(0x222222)
        this.emissive = new FakeColor(0x000000)
        this.emissiveIntensity = 0
        this.userData = {}
    }
}

/**
 * Minimal fake mesh/group node with nested children.
 */
class FakeNode {
    /** @type {FakeMaterial | FakeMaterial[] | null} */
    material

    /** @type {FakeNode[]} */
    children

    /**
     * @param {FakeMaterial | FakeMaterial[] | null} material
     * @param {FakeNode[]} children
     */
    constructor(material = null, children = []) {
        this.material = material
        this.children = children
    }
}

/**
 * Verifies one selected designator highlights every registered rendered
 * representation and restores the original material state when cleared.
 */
test('PcbScene3dSelectionStyler highlights every root registered for one designator', () => {
    const selectionRoots = new Map()
    const fallbackMaterial = new FakeMaterial()
    const externalBodyMaterial = new FakeMaterial()
    const externalPinsMaterial = new FakeMaterial()
    const fallbackRoot = new FakeNode(fallbackMaterial)
    const externalRoot = new FakeNode(null, [
        new FakeNode([externalBodyMaterial, externalPinsMaterial])
    ])

    PcbScene3dSelectionStyler.registerSelectionRoot(
        selectionRoots,
        'J16',
        fallbackRoot
    )
    PcbScene3dSelectionStyler.registerSelectionRoot(
        selectionRoots,
        'J16',
        externalRoot
    )

    PcbScene3dSelectionStyler.applySelection(
        selectionRoots,
        '',
        'J16',
        0x14c5e6
    )

    assert.equal(fallbackMaterial.color.getHex(), 0x000000)
    assert.equal(externalBodyMaterial.color.getHex(), 0x000000)
    assert.equal(externalPinsMaterial.color.getHex(), 0x000000)
    assert.equal(fallbackMaterial.emissive.getHex(), 0x14c5e6)
    assert.equal(externalBodyMaterial.emissive.getHex(), 0x14c5e6)
    assert.equal(externalPinsMaterial.emissive.getHex(), 0x14c5e6)
    assert.equal(fallbackMaterial.emissiveIntensity, 1)
    assert.equal(externalBodyMaterial.emissiveIntensity, 1)

    PcbScene3dSelectionStyler.applySelection(
        selectionRoots,
        'J16',
        '',
        0x14c5e6
    )

    assert.equal(fallbackMaterial.color.getHex(), 0x222222)
    assert.equal(externalBodyMaterial.color.getHex(), 0x222222)
    assert.equal(externalPinsMaterial.color.getHex(), 0x222222)
    assert.equal(fallbackMaterial.emissive.getHex(), 0x000000)
    assert.equal(externalBodyMaterial.emissive.getHex(), 0x000000)
    assert.equal(externalPinsMaterial.emissive.getHex(), 0x000000)
    assert.equal(fallbackMaterial.emissiveIntensity, 0)
    assert.equal(externalBodyMaterial.emissiveIntensity, 0)
})
