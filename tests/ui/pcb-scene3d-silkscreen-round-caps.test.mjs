import assert from 'node:assert/strict'
import test from 'node:test'
import * as THREE from 'three'
import { PcbScene3dSilkscreenFactory } from '../../src/ui/PcbScene3dSilkscreenFactory.mjs'

/**
 * Resolves axis-aligned bounds from one position attribute array.
 * @param {ArrayLike<number>} positions Vertex position array.
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
function resolveBounds(positions) {
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity
    }

    for (let index = 0; index < positions.length; index += 3) {
        bounds.minX = Math.min(bounds.minX, positions[index])
        bounds.maxX = Math.max(bounds.maxX, positions[index])
        bounds.minY = Math.min(bounds.minY, positions[index + 1])
        bounds.maxY = Math.max(bounds.maxY, positions[index + 1])
    }

    return bounds
}

/**
 * Finds a nested rendered object by name.
 * @param {any} object Root object.
 * @param {string} name Object name.
 * @returns {any | null}
 */
function findObjectByName(object, name) {
    if (object?.name === name) {
        return object
    }

    for (const child of object?.children || []) {
        const match = findObjectByName(child, name)
        if (match) {
            return match
        }
    }

    return null
}

test('PcbScene3dSilkscreenFactory rounds stroke track endpoints', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks: [{ x1: 0, y1: 0, x2: 100, y2: 0, width: 20 }],
                arcs: []
            },
            bottom: { fills: [], tracks: [], arcs: [] }
        },
        5,
        -5,
        (x, y) => ({ x, y })
    )

    const trackMesh = group.children[0].children[0]
    const bounds = resolveBounds(trackMesh.geometry.attributes.position.array)

    assert.ok(bounds.minX <= -9.99)
    assert.ok(bounds.maxX >= 109.99)
    assert.equal(bounds.minY, -10)
    assert.equal(bounds.maxY, 10)
})

test('PcbScene3dSilkscreenFactory rounds vector-font text stroke endpoints', () => {
    const group = PcbScene3dSilkscreenFactory.buildGroup(
        THREE,
        {
            top: {
                fills: [],
                tracks: [],
                arcs: [],
                texts: [
                    {
                        x: 0,
                        y: 0,
                        text: '-',
                        sizeX: 100,
                        sizeY: 100,
                        thickness: 20,
                        hAlign: 'left',
                        vAlign: 'bottom'
                    }
                ]
            },
            bottom: { fills: [], tracks: [], arcs: [], texts: [] }
        },
        5,
        -5,
        (x, y) => ({ x, y })
    )

    const textMesh = findObjectByName(group, 'copper-text')
    const bounds = resolveBounds(textMesh.geometry.attributes.position.array)

    assert.ok(bounds.minX < 30)
    assert.ok(bounds.maxX > 122)
})
