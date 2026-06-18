import assert from 'node:assert/strict'
import test from 'node:test'
import { EcadScene3dService } from '../../src/core/ecad/EcadScene3dService.mjs'

/**
 * Builds a fake dense Altium PCB where unrelated nearby pads would inflate a
 * procedural IC body if ownership is ignored.
 * @returns {object}
 */
function createDensePadDocument() {
    return {
        sourceFormat: 'altium',
        kind: 'pcb',
        fileName: 'dense-owned-pad-fake.PcbDoc',
        pcb: {
            boardOutline: {
                minX: 0,
                minY: 0,
                widthMil: 2400,
                heightMil: 1600,
                segments: []
            },
            components: [
                {
                    componentIndex: 7,
                    designator: 'U1',
                    x: 1000,
                    y: 800,
                    layer: 'TOP',
                    pattern: 'FAKE_DFN6',
                    source: 'FAKE_SWITCH',
                    rotation: 180,
                    height: 22
                }
            ],
            pads: [
                ...createOwnedPackagePads(),
                createUnrelatedPad(870, 640),
                createUnrelatedPad(1130, 960)
            ],
            componentBodies: [],
            embeddedModels: [],
            tracks: [],
            arcs: [],
            fills: [],
            vias: [],
            texts: []
        }
    }
}

/**
 * Builds six owned pads for a compact fake package.
 * @returns {object[]}
 */
function createOwnedPackagePads() {
    return [-20, 0, 20].flatMap((yOffset) => [
        createOwnedPad(985, 800 + yOffset),
        createOwnedPad(1015, 800 + yOffset)
    ])
}

/**
 * Builds one owned top-side package pad.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createOwnedPad(x, y) {
    return {
        componentIndex: 7,
        x,
        y,
        hasTopPasteMaskOpening: true,
        sizeTopX: 10,
        sizeTopY: 10,
        sizeMidX: 10,
        sizeMidY: 10
    }
}

/**
 * Builds one unrelated pad inside the toolkit's neighborhood search window.
 * @param {number} x Pad X.
 * @param {number} y Pad Y.
 * @returns {object}
 */
function createUnrelatedPad(x, y) {
    return {
        componentIndex: 99,
        x,
        y,
        hasTopPasteMaskOpening: true,
        sizeTopX: 40,
        sizeTopY: 40,
        sizeMidX: 40,
        sizeMidY: 40
    }
}

/**
 * Verifies procedural bodies use owned pads rather than unrelated nearby pads
 * in dense layouts.
 */
test('Altium 3D procedural bodies use owned pad span in dense layouts', () => {
    const scene = EcadScene3dService.build(createDensePadDocument())
    const component = scene.components.find((item) => item.designator === 'U1')

    assert.equal(component.body.family, 'ic')
    assert.deepEqual(component.body.sizeMil, {
        width: 40,
        depth: 50,
        height: 22
    })
})
