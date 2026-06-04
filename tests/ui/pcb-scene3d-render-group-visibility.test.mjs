import assert from 'node:assert/strict'
import test from 'node:test'
import { PcbScene3dRenderGroupVisibility } from '../../src/ui/PcbScene3dRenderGroupVisibility.mjs'

/**
 * Minimal render group fixture.
 */
class FakeGroup {
    /** @type {boolean} */
    visible

    /** @type {number} */
    renderOrder

    /** @type {any[]} */
    children

    constructor() {
        this.visible = true
        this.renderOrder = 0
        this.children = []
    }

    /**
     * @param {any} child
     * @returns {void}
     */
    add(child) {
        this.children.push(child)
    }

    /**
     * @param {(object: any) => void} visitor
     * @returns {void}
     */
    traverse(visitor) {
        visitor(this)
        this.children.forEach((child) => {
            if (typeof child.traverse === 'function') {
                child.traverse(visitor)
                return
            }

            visitor(child)
        })
    }
}

/**
 * Minimal mesh fixture.
 */
class FakeMesh {
    /** @type {number} */
    renderOrder

    /** @type {{ depthTest: boolean, depthWrite: boolean }} */
    material

    constructor() {
        this.renderOrder = 0
        this.material = {
            depthTest: true,
            depthWrite: true
        }
    }
}

test('PcbScene3dRenderGroupVisibility preserves PCB detail while board assembly is active', () => {
    const groups = new Map(
        ['board', 'silkscreen', 'copper', 'fallback-bodies', 'external-models']
            .map((name) => [name, new FakeGroup()])
    )

    PcbScene3dRenderGroupVisibility.apply({
        groups,
        toggles: {
            'external-models': true,
            'fallback-bodies': true,
            copper: true
        },
        fallbackBodyRoots: new Map(),
        loadedExternalModelDesignators: new Set(),
        hasLoadedBoardAssemblyModel: true
    })

    assert.equal(groups.get('board').visible, true)
    assert.equal(groups.get('silkscreen').visible, true)
    assert.equal(groups.get('copper').visible, true)
    assert.equal(groups.get('fallback-bodies').visible, false)
    assert.equal(groups.get('external-models').visible, true)
})

test('PcbScene3dRenderGroupVisibility keeps component depth over board assemblies', () => {
    const groups = new Map(
        ['board', 'silkscreen', 'copper', 'fallback-bodies', 'external-models']
            .map((name) => [name, new FakeGroup()])
    )
    const silkscreenMesh = new FakeMesh()
    const copperMesh = new FakeMesh()
    groups.get('silkscreen').add(silkscreenMesh)
    groups.get('copper').add(copperMesh)

    PcbScene3dRenderGroupVisibility.apply({
        groups,
        toggles: {
            'external-models': true,
            'fallback-bodies': true,
            copper: true
        },
        fallbackBodyRoots: new Map(),
        loadedExternalModelDesignators: new Set(),
        hasLoadedBoardAssemblyModel: true
    })

    assert.equal(silkscreenMesh.renderOrder > 0, true)
    assert.equal(copperMesh.renderOrder > 0, true)
    assert.equal(silkscreenMesh.material.depthTest, true)
    assert.equal(copperMesh.material.depthTest, true)
    assert.equal(silkscreenMesh.material.depthWrite, true)
    assert.equal(copperMesh.material.depthWrite, true)
})
